import asyncio
from contextlib import asynccontextmanager, suppress
import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import admin, auth, servers, sessions, user
from app.core.config import get_settings
from app.core.logging import configure_logging
from app.database.session import Base, SessionLocal, engine
from app.middleware.request_context import RequestContextMiddleware
from app.models.models import Country, Server
from app.services.health_monitor import check_all_servers

configure_logging()
logger = logging.getLogger("globevpn.main")

# Planned country metadata ONLY (zero fake servers!).
# Countries stay "coming_soon" until a real authorized exit node registers and passes live health checks.
PLANNED_COUNTRIES = [
    ("US", "United States", "🇺🇸", "North America"),
    ("GB", "United Kingdom", "🇬🇧", "Europe"),
    ("DE", "Germany", "🇩🇪", "Europe"),
    ("FR", "France", "🇫🇷", "Europe"),
    ("NL", "Netherlands", "🇳🇱", "Europe"),
    ("CA", "Canada", "🇨🇦", "North America"),
    ("SG", "Singapore", "🇸🇬", "Asia Pacific"),
    ("JP", "Japan", "🇯🇵", "Asia Pacific"),
    ("IN", "India", "🇮🇳", "Asia Pacific"),
    ("AU", "Australia", "🇦🇺", "Asia Pacific"),
    ("CH", "Switzerland", "🇨🇭", "Europe"),
    ("SE", "Sweden", "🇸🇪", "Europe"),
]


def seed_planned_country_metadata(db) -> None:
    """Seeds country metadata rows with NO servers so UI displays Coming Soon honestly."""
    for code, name, flag, region in PLANNED_COUNTRIES:
        exists = db.query(Country).filter(Country.code == code).first()
        if not exists:
            db.add(
                Country(
                    code=code,
                    name=name,
                    flag_emoji=flag,
                    region=region,
                    is_active=True,
                )
            )
    db.commit()


def _seed_planned_country_metadata() -> None:
    db = SessionLocal()
    try:
        seed_planned_country_metadata(db)
    finally:
        db.close()


def _bootstrap_local_proxy_if_enabled() -> None:
    """
    Optional local dev helper ONLY when LOCAL_PROXY_ENABLED=true.
    Disabled by default in production.
    """
    settings = get_settings()
    if not settings.local_proxy_enabled:
        return

    db = SessionLocal()
    try:
        code = settings.local_proxy_country_code.upper()
        country = db.query(Country).filter(Country.code == code).first()
        if not country:
            country = Country(
                code=code,
                name=settings.local_proxy_country_name,
                flag_emoji="🧪",
                region="Local Dev",
                is_active=True,
            )
            db.add(country)
            db.commit()
            db.refresh(country)

        local_id = "local-dev-01"
        server = db.query(Server).filter(Server.id == local_id).first()
        if not server:
            server = Server(
                id=local_id,
                country_id=country.id,
                name="Local Dev Proxy #1",
                city=settings.local_proxy_city,
                hostname=settings.local_proxy_host,
                port=settings.local_proxy_port,
                scheme=settings.local_proxy_scheme,
                tier="free",
                max_connections=100,
                auth_username_env="LOCAL_PROXY_AUTH_USER",
                auth_password_env="LOCAL_PROXY_AUTH_PASS",
                status="unknown",
                is_operational=False,
            )
            db.add(server)
            db.commit()
    finally:
        db.close()


async def _health_loop() -> None:
    settings = get_settings()
    while True:
        db = SessionLocal()
        try:
            await check_all_servers(db)
        except Exception as exc:
            logger.error("Health check loop error: %s", exc)
        finally:
            db.close()
        await asyncio.sleep(settings.health_check_interval_seconds)


@asynccontextmanager
async def lifespan(_: FastAPI):
    Base.metadata.create_all(bind=engine)
    _seed_planned_country_metadata()
    _bootstrap_local_proxy_if_enabled()
    task = asyncio.create_task(_health_loop())
    try:
        yield
    finally:
        task.cancel()
        with suppress(asyncio.CancelledError):
            await task


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(
        title=f"{settings.app_name} Control Plane API",
        version="1.1.0",
        description=(
            "Hosted backend control plane for GlobeVPN Chrome MV3 browser proxy extension. "
            "Manages dynamic country registry, authorized regional exit nodes, live health probing, "
            "credential rotation, and free/pro quotas."
        ),
        lifespan=lifespan,
    )

    app.add_middleware(RequestContextMiddleware)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_origin_regex=r"^chrome-extension://.*$",
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    prefix = settings.api_v1_prefix
    app.include_router(auth.router, prefix=prefix)
    app.include_router(servers.router, prefix=prefix)
    app.include_router(sessions.router, prefix=prefix)
    app.include_router(user.router, prefix=prefix)
    app.include_router(admin.router, prefix=prefix)

    @app.get("/health", tags=["System"])
    def system_health():
        return {"status": "ok", "service": settings.app_name}

    return app


app = create_app()
