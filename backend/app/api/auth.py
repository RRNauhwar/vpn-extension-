import uuid

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.api.deps import get_client_ip
from app.core.config import get_settings
from app.core.rate_limit import rate_limiter
from app.core.security import (
    create_access_token,
    hash_identifier,
    hash_password,
    verify_password,
)
from app.database.session import get_db
from app.models.models import User
from app.schemas.schemas import (
    GuestAuthRequest,
    LoginRequest,
    RegisterRequest,
    TokenResponse,
)

router = APIRouter(prefix="/auth", tags=["Authentication"])


def _issue_token(user: User) -> TokenResponse:
    settings = get_settings()
    token = create_access_token(
        subject=user.id,
        plan_tier=user.plan_tier,
        is_guest=user.is_guest,
    )
    return TokenResponse(
        access_token=token,
        expires_in=settings.access_token_expire_minutes * 60,
        user_id=user.id,
        email=user.email,
        is_guest=user.is_guest,
        plan_tier=user.plan_tier,
    )


@router.post("/guest", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
def create_guest_session(
    payload: GuestAuthRequest,
    request: Request,
    db: Session = Depends(get_db),
) -> TokenResponse:
    """Issues a free-tier guest session without mandatory payment or signup."""
    ip_hash = hash_identifier(get_client_ip(request))
    allowed, _ = rate_limiter.check_rate_limit(f"guest_init:{ip_hash}", limit=15, window_seconds=60)
    if not allowed:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many guest session requests. Try again shortly.",
        )

    fp_hash = hash_identifier(payload.device_id) if payload.device_id else None
    if fp_hash:
        existing = (
            db.query(User)
            .filter(User.device_fingerprint_hash == fp_hash, User.is_guest.is_(True))
            .first()
        )
        if existing and existing.is_active:
            return _issue_token(existing)

    guest = User(
        id=f"usr_{uuid.uuid4().hex[:16]}",
        email=None,
        password_hash=None,
        is_guest=True,
        device_fingerprint_hash=fp_hash,
        plan_tier="free",
    )
    db.add(guest)
    db.commit()
    db.refresh(guest)
    return _issue_token(guest)


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
def register_account(
    payload: RegisterRequest,
    request: Request,
    db: Session = Depends(get_db),
) -> TokenResponse:
    ip_hash = hash_identifier(get_client_ip(request))
    allowed, _ = rate_limiter.check_rate_limit(f"register:{ip_hash}", limit=10, window_seconds=60)
    if not allowed:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many registration attempts. Please wait a minute.",
        )

    normalized_email = payload.email.lower().strip()
    if db.query(User).filter(User.email == normalized_email).first():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists.",
        )

    user = User(
        id=f"usr_{uuid.uuid4().hex[:16]}",
        email=normalized_email,
        password_hash=hash_password(payload.password),
        is_guest=False,
        plan_tier="free",
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return _issue_token(user)


@router.post("/login", response_model=TokenResponse)
def login_account(
    payload: LoginRequest,
    request: Request,
    db: Session = Depends(get_db),
) -> TokenResponse:
    ip_hash = hash_identifier(get_client_ip(request))
    allowed, _ = rate_limiter.check_rate_limit(f"login:{ip_hash}", limit=15, window_seconds=60)
    if not allowed:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many login attempts. Please wait a minute.",
        )

    normalized_email = payload.email.lower().strip()
    user = db.query(User).filter(User.email == normalized_email, User.is_active.is_(True)).first()
    if not user or not user.password_hash or not verify_password(payload.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
        )
    return _issue_token(user)
