from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from app.api.deps import get_client_ip, get_current_user
from app.core.config import get_settings
from app.database.session import get_db
from app.models.models import ConnectionSession, User
from app.schemas.schemas import (
    CurrentIpResponse,
    UserProfileResponse,
    UserUsageResponse,
)

router = APIRouter(prefix="/user", tags=["User"])


@router.get("/profile", response_model=UserProfileResponse)
def get_user_profile(current_user: User = Depends(get_current_user)) -> UserProfileResponse:
    return UserProfileResponse(
        user_id=current_user.id,
        email=current_user.email,
        is_guest=current_user.is_guest,
        plan_tier=current_user.plan_tier,
        created_at=current_user.created_at,
    )


@router.get("/usage", response_model=UserUsageResponse)
def get_user_usage(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> UserUsageResponse:
    settings = get_settings()
    active_session = (
        db.query(ConnectionSession)
        .filter(
            ConnectionSession.user_id == current_user.id,
            ConnectionSession.status == "active",
        )
        .order_by(ConnectionSession.started_at.desc())
        .first()
    )
    is_pro = current_user.plan_tier == "pro"
    return UserUsageResponse(
        plan_tier=current_user.plan_tier,
        daily_sessions_used=current_user.daily_sessions_used,
        daily_sessions_limit=(
            1000 if is_pro else settings.free_tier_max_daily_sessions
        ),
        max_session_minutes=(
            settings.pro_tier_max_session_minutes
            if is_pro
            else settings.free_tier_max_session_minutes
        ),
        rate_limit_per_minute=(
            settings.pro_tier_rate_limit_per_minute
            if is_pro
            else settings.free_tier_rate_limit_per_minute
        ),
        active_session_id=active_session.id if active_session else None,
        fair_use_policy=(
            "Free tier includes up to "
            f"{settings.free_tier_max_daily_sessions} sessions/day and "
            f"{settings.free_tier_max_session_minutes} min/session across operational free nodes. "
            "No browsing history is collected."
        ),
    )


@router.get("/current-ip", response_model=CurrentIpResponse)
def get_current_ip(request: Request) -> CurrentIpResponse:
    """
    Returns the real client IP observed by the backend from the incoming request.
    Never fabricates an IP address.
    """
    return CurrentIpResponse(
        ip=get_client_ip(request),
        source="backend_observed_remote_addr",
        checked_at=datetime.now(timezone.utc),
    )
