from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import Depends, Header, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.rate_limit import rate_limiter
from app.core.security import decode_access_token, verify_admin_key
from app.database.session import get_db
from app.models.models import User

bearer_scheme = HTTPBearer(auto_error=False)


def get_client_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    real_ip = request.headers.get("x-real-ip")
    if real_ip:
        return real_ip.strip()
    if request.client and request.client.host:
        return request.client.host
    return "127.0.0.1"


def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    if credentials is None or not credentials.credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required. Use /api/auth/guest or /api/auth/login.",
        )

    payload = decode_access_token(credentials.credentials)
    if not payload or not payload.get("sub"):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired access token.",
        )

    user = db.query(User).filter(User.id == payload["sub"], User.is_active.is_(True)).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Account not found or inactive.",
        )

    # Reset daily counter if 24h has elapsed
    now = datetime.now(timezone.utc)
    reset_at = user.daily_reset_at
    if reset_at.tzinfo is None:
        reset_at = reset_at.replace(tzinfo=timezone.utc)
    if now - reset_at >= timedelta(hours=24):
        user.daily_sessions_used = 0
        user.daily_reset_at = now
        db.commit()
        db.refresh(user)

    # Per-user rate limit
    settings = get_settings()
    limit = (
        settings.pro_tier_rate_limit_per_minute
        if user.plan_tier == "pro"
        else settings.free_tier_rate_limit_per_minute
    )
    allowed, _ = rate_limiter.check_rate_limit(f"user:{user.id}", limit=limit, window_seconds=60)
    if not allowed:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Rate limit exceeded. Please wait a minute before retrying.",
        )

    return user


def require_admin(x_admin_key: Optional[str] = Header(default=None)) -> None:
    if not x_admin_key or not verify_admin_key(x_admin_key):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Valid X-Admin-Key header required.",
        )
