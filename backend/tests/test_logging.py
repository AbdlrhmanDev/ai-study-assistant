import logging

from app.core.logging import NOISY_THIRD_PARTY_LOGGERS, configure_logging


def test_provider_sdk_debug_logs_are_suppressed():
    configure_logging()

    for logger_name in NOISY_THIRD_PARTY_LOGGERS:
        assert logging.getLogger(logger_name).getEffectiveLevel() >= logging.WARNING
