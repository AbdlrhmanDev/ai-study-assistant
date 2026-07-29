from starlette.requests import Request

from app.core import security


def _fake_request() -> Request:
    return Request({"type": "http", "client": ("127.0.0.1", 12345), "headers": []})


def test_storage_uri_defaults_to_memory(monkeypatch):
    # get_settings() is an lru_cache singleton -- mutate the cached instance
    # in place rather than the cache, and let monkeypatch restore it after.
    monkeypatch.setattr(security.get_settings(), "redis_url", "")

    assert security._rate_limit_storage_uri() == "memory://"


def test_storage_uri_uses_redis_when_configured(monkeypatch):
    monkeypatch.setattr(security.get_settings(), "redis_url", "redis://localhost:6379/0")

    assert security._rate_limit_storage_uri() == "redis://localhost:6379/0"


def test_check_auth_rate_limit_fails_open_on_storage_error(monkeypatch):
    def _raise(*_args, **_kwargs):
        raise ConnectionError("redis unreachable")

    monkeypatch.setattr(security._auth_limiter_strategy, "test", _raise)

    # Should not raise -- a storage outage must not block every login attempt.
    security.check_auth_rate_limit(_fake_request())


def test_record_auth_failure_fails_open_on_storage_error(monkeypatch):
    def _raise(*_args, **_kwargs):
        raise ConnectionError("redis unreachable")

    monkeypatch.setattr(security._auth_limiter_strategy, "hit", _raise)

    # Should not raise even though the counter couldn't be recorded.
    security.record_auth_failure(_fake_request())
