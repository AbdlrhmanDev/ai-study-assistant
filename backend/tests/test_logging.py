import logging

from app.core.logging import NOISY_THIRD_PARTY_LOGGERS, _redact_processor, configure_logging


def test_provider_sdk_debug_logs_are_suppressed():
    configure_logging()

    for logger_name in NOISY_THIRD_PARTY_LOGGERS:
        assert logging.getLogger(logger_name).getEffectiveLevel() >= logging.WARNING


def test_redaction_covers_infrastructure_secret_keys():
    event = _redact_processor(None, "info", {
        "s3_secret_access_key": "leak-me-not",
        "redis_url": "redis://user:pass@host:6379/0",
        "session_secret": "super-secret",
        "database_url": "postgresql://user:pass@host/db",
        "safe_field": "keep this",
    })
    assert event["s3_secret_access_key"] == "[REDACTED]"
    assert event["redis_url"] == "[REDACTED]"
    assert event["session_secret"] == "[REDACTED]"
    assert event["database_url"] == "[REDACTED]"
    assert event["safe_field"] == "keep this"


def test_redaction_scrubs_connection_strings_and_bearer_tokens_in_free_text():
    event = _redact_processor(None, "info", {
        "error": "connection failed: postgresql://admin:hunter2@db.internal:5432/prod",
        "detail": "rejected header Authorization: Bearer abc123.def456-ghi",
    })
    assert "hunter2" not in event["error"]
    assert "[REDACTED]" in event["error"]
    assert "abc123" not in event["detail"]
    assert "[REDACTED]" in event["detail"]


def test_redaction_nested_dicts_and_lists():
    event = _redact_processor(None, "info", {
        "details": {"password": "hunter2", "nested": [{"api_key": "sk-live-123"}]},
    })
    assert event["details"]["password"] == "[REDACTED]"
    assert event["details"]["nested"][0]["api_key"] == "[REDACTED]"
