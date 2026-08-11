"""SessionMiddleware's Origin allow-list check (app/core/security.py):
CSRF protection for the SameSite=None session cookie used in production
(frontend and backend are separate cross-site Railway services). Exercised
directly against the middleware's `dispatch` rather than over real HTTP,
since a genuine login flow needs its own DB connection that the test
fixtures deliberately don't set up (see test_auth.py's module docstring).
"""

from starlette.requests import Request
from starlette.responses import PlainTextResponse

import pytest

from app.core import security
from app.core.security import SessionMiddleware, _cookie_name, get_settings


class _FakeSessionContext:
    async def __aenter__(self):
        return object()

    async def __aexit__(self, *_args):
        return None


@pytest.fixture(autouse=True)
def _isolate_session_storage(monkeypatch):
    """These are CSRF unit tests; session persistence is not under test."""
    monkeypatch.setattr(security, "get_sessionmaker", lambda: _FakeSessionContext)
    monkeypatch.setattr(
        security.session_repository,
        "get_active",
        lambda *_args, **_kwargs: _async_none(),
    )


async def _async_none():
    return None


def _request(*, has_session_cookie: bool, origin: str | None, method: str = "POST") -> Request:
    headers: list[tuple[bytes, bytes]] = []
    if has_session_cookie:
        headers.append((b"cookie", f"{_cookie_name()}=sometoken".encode()))
    if origin is not None:
        headers.append((b"origin", origin.encode()))
    scope = {
        "type": "http",
        "method": method,
        "path": "/api/v1/ai/documents",
        "client": ("127.0.0.1", 1),
        "headers": headers,
    }
    return Request(scope)


async def _call_next_stub(request: Request) -> PlainTextResponse:
    return PlainTextResponse("ok")


async def test_csrf_check_rejects_disallowed_origin(monkeypatch):
    monkeypatch.setattr(get_settings(), "node_env", "production")
    request = _request(has_session_cookie=True, origin="https://evil.example")

    response = await SessionMiddleware(app=None).dispatch(request, _call_next_stub)

    assert response.status_code == 403


async def test_csrf_check_rejects_missing_origin(monkeypatch):
    monkeypatch.setattr(get_settings(), "node_env", "production")
    request = _request(has_session_cookie=True, origin=None)

    response = await SessionMiddleware(app=None).dispatch(request, _call_next_stub)

    assert response.status_code == 403


async def test_csrf_check_allows_matching_origin(monkeypatch):
    monkeypatch.setattr(get_settings(), "node_env", "production")
    allowed_origin = get_settings().origins[0]
    request = _request(has_session_cookie=True, origin=allowed_origin)

    response = await SessionMiddleware(app=None).dispatch(request, _call_next_stub)

    assert response.status_code == 200


async def test_csrf_check_skipped_without_session_cookie(monkeypatch):
    """No existing session cookie -- nothing to protect (e.g. the request
    is a fresh, unauthenticated call), so the Origin check doesn't apply."""
    monkeypatch.setattr(get_settings(), "node_env", "production")
    request = _request(has_session_cookie=False, origin="https://evil.example")

    response = await SessionMiddleware(app=None).dispatch(request, _call_next_stub)

    assert response.status_code == 200


async def test_csrf_check_skipped_outside_production(monkeypatch):
    monkeypatch.setattr(get_settings(), "node_env", "development")
    request = _request(has_session_cookie=True, origin="https://evil.example")

    response = await SessionMiddleware(app=None).dispatch(request, _call_next_stub)

    assert response.status_code == 200


async def test_csrf_check_skipped_for_safe_methods(monkeypatch):
    monkeypatch.setattr(get_settings(), "node_env", "production")
    request = _request(has_session_cookie=True, origin="https://evil.example", method="GET")

    response = await SessionMiddleware(app=None).dispatch(request, _call_next_stub)

    assert response.status_code == 200
