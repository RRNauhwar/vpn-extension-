import os
import socket
import threading
from typing import Generator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

os.environ["DATABASE_URL"] = "sqlite:///:memory:"
os.environ["JWT_SECRET_KEY"] = "test-secret-key-for-automated-pytest-suite-64bytes-long"
os.environ["ADMIN_API_KEY"] = "test-admin-key"
os.environ["LOCAL_PROXY_ENABLED"] = "false"

from app.core.config import get_settings

get_settings.cache_clear()

from app.database.session import Base, get_db
from app.main import create_app, seed_planned_country_metadata


@pytest.fixture(scope="function")
def db_session():
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    seed_planned_country_metadata(db)
    try:
        yield db
    finally:
        db.close()
        Base.metadata.drop_all(bind=engine)


@pytest.fixture(scope="function")
def client(db_session) -> Generator[TestClient, None, None]:
    app = create_app()

    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture(scope="function")
def local_tcp_listener() -> Generator[int, None, None]:
    """Starts a real local TCP listener on an ephemeral port to verify live health probes."""
    srv = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    srv.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    srv.bind(("127.0.0.1", 0))
    srv.listen(5)
    port = srv.getsockname()[1]
    stop_event = threading.Event()

    def accept_loop():
        srv.settimeout(0.2)
        while not stop_event.is_set():
            try:
                conn, _ = srv.accept()
                conn.close()
            except socket.timeout:
                continue
            except OSError:
                break

    t = threading.Thread(target=accept_loop, daemon=True)
    t.start()
    try:
        yield port
    finally:
        stop_event.set()
        srv.close()
        t.join(timeout=1.0)
