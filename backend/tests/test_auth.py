"""Auth is tested at two layers deliberately, not just via HTTP:

`SessionMiddleware` persists sessions through its own DB connection
(`get_sessionmaker()`), separate from the `db_session` fixture's
rollback-wrapped connection. A *successful* register/login/profile-update
writes `request.session["user"]`, which the middleware then tries to persist
referencing a `users.id` that only exists inside the fixture's uncommitted
transaction -- invisible to that other connection, so it would fail a
foreign-key check. Failure paths (bad password, duplicate email, missing
auth) never touch the session and are safe to exercise over real HTTP;
success paths are exercised by calling the service layer directly against a
bare `Request` with an in-memory session dict, bypassing the middleware.
"""

import uuid

import pytest
import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.requests import Request

from app.core.exceptions import AppError
from app.core.security import reset_auth_rate_limiter_for_testing
from app.modules.auth import service as auth_service
from app.modules.users.model import User


@pytest.fixture(autouse=True)
def _reset_auth_rate_limiter():
    reset_auth_rate_limiter_for_testing()
    yield


def _bare_request() -> Request:
    request = Request({"type": "http", "client": ("127.0.0.1", 1), "headers": []})
    request.scope["session"] = {}
    return request


def _unique_email() -> str:
    return f"auth-test-{uuid.uuid4()}@example.com"


@pytest_asyncio.fixture
async def registered_user(db_session: AsyncSession) -> dict:
    """A real user with a real bcrypt hash, created via the service layer
    (not the `test_user` fixture, whose password_hash isn't a valid bcrypt
    hash and can't be logged in against)."""
    request = _bare_request()
    session_user = await auth_service.register(
        db_session, request, name="Registered User", email=_unique_email(), password="correct-horse-1"
    )
    return session_user


# --------------------------------------------------------------------------
# Service layer (success paths -- bypasses SessionMiddleware)
# --------------------------------------------------------------------------


async def test_register_creates_user_and_sets_session(db_session: AsyncSession):
    request = _bare_request()
    email = _unique_email()

    result = await auth_service.register(
        db_session, request, name="Ada Lovelace", email=email, password="supersecret1"
    )

    assert result["name"] == "Ada Lovelace"
    assert result["email"] == email
    assert "password" not in result and "password_hash" not in result
    assert request.session["user"] == result


async def test_register_duplicate_email_raises(db_session: AsyncSession, registered_user: dict):
    request = _bare_request()

    with pytest.raises(AppError) as excinfo:
        await auth_service.register(
            db_session, request, name="Someone Else", email=registered_user["email"], password="supersecret1"
        )

    assert excinfo.value.status_code == 409
    assert "user" not in request.session


async def test_login_success_sets_session(db_session: AsyncSession, registered_user: dict):
    request = _bare_request()

    result = await auth_service.login(
        db_session, request, email=registered_user["email"], password="correct-horse-1"
    )

    assert result == registered_user
    assert request.session["user"] == registered_user


async def test_login_wrong_password_raises(db_session: AsyncSession, registered_user: dict):
    request = _bare_request()

    with pytest.raises(AppError) as excinfo:
        await auth_service.login(db_session, request, email=registered_user["email"], password="wrong-password")

    assert excinfo.value.status_code == 401
    assert "user" not in request.session


async def test_login_unknown_email_raises(db_session: AsyncSession):
    request = _bare_request()

    with pytest.raises(AppError) as excinfo:
        await auth_service.login(db_session, request, email=_unique_email(), password="whatever1")

    assert excinfo.value.status_code == 401


def test_logout_marks_session_for_destruction():
    request = _bare_request()
    request.session["user"] = {"id": 1, "name": "X", "email": "x@example.com"}

    auth_service.logout(request)

    assert request.state.session_action == "destroy"


async def test_update_profile_updates_name_and_session(db_session: AsyncSession, registered_user: dict):
    request = _bare_request()

    result = await auth_service.update_profile(
        db_session, request, registered_user["id"], name="New Name", email=None
    )

    assert result["name"] == "New Name"
    assert result["email"] == registered_user["email"]
    assert request.session["user"] == result


async def test_update_profile_email_conflict_raises(db_session: AsyncSession, registered_user: dict):
    request = _bare_request()
    other = await auth_service.register(
        db_session, _bare_request(), name="Other", email=_unique_email(), password="supersecret1"
    )

    with pytest.raises(AppError) as excinfo:
        await auth_service.update_profile(
            db_session, request, registered_user["id"], name=None, email=other["email"]
        )

    assert excinfo.value.status_code == 409


# --------------------------------------------------------------------------
# HTTP layer (failure paths only -- never populate the session)
# --------------------------------------------------------------------------


async def test_register_endpoint_rejects_short_password(client: AsyncClient):
    response = await client.post(
        "/api/v1/auth/register",
        json={"name": "Someone", "email": _unique_email(), "password": "short"},
    )
    assert response.status_code == 422


async def test_register_endpoint_rejects_duplicate_email(client: AsyncClient, test_user: User):
    response = await client.post(
        "/api/v1/auth/register",
        json={"name": "Dupe", "email": test_user.email, "password": "supersecret1"},
    )
    assert response.status_code == 409


async def test_login_endpoint_rejects_wrong_password(db_session: AsyncSession, client: AsyncClient):
    registered = await auth_service.register(
        db_session, _bare_request(), name="HTTP User", email=_unique_email(), password="correct-horse-1"
    )

    response = await client.post(
        "/api/v1/auth/login", json={"email": registered["email"], "password": "wrong-password"}
    )
    assert response.status_code == 401


async def test_login_endpoint_rejects_unknown_email(client: AsyncClient):
    response = await client.post(
        "/api/v1/auth/login", json={"email": _unique_email(), "password": "whatever1"}
    )
    assert response.status_code == 401


async def test_me_endpoint_returns_null_user_when_unauthenticated(client: AsyncClient):
    response = await client.get("/api/v1/auth/me")
    assert response.status_code == 200
    assert response.json()["user"] is None


async def test_update_profile_endpoint_requires_auth(client: AsyncClient):
    response = await client.patch("/api/v1/auth/me", json={"name": "New Name"})
    assert response.status_code == 401


async def test_update_profile_endpoint_rejects_empty_payload(authed_client: AsyncClient):
    # Fails pydantic validation before the handler body runs, so this never
    # reaches service.update_profile / touches the session -- safe to hit
    # over HTTP unlike the success-path tests (see module docstring).
    response = await authed_client.patch("/api/v1/auth/me", json={})
    assert response.status_code == 422
