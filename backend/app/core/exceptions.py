from __future__ import annotations

import structlog
from fastapi import FastAPI, Request
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from ..shared.responses import error_body

logger = structlog.get_logger("study_assistant")


class AppError(Exception):
    def __init__(self, message: str, status_code: int = 400, details: object = None):
        self.message = message
        self.status_code = status_code
        self.details = details
        super().__init__(message)


def _request_id(request: Request) -> str | None:
    return getattr(request.state, "request_id", None)


async def app_error_handler(request: Request, error: AppError) -> JSONResponse:
    return JSONResponse(
        error_body(error.message, error.details, _request_id(request)),
        status_code=error.status_code,
    )


async def validation_error_handler(
    request: Request, error: RequestValidationError
) -> JSONResponse:
    # error.errors() includes a raw exception object in ctx["error"] for any
    # validator that raises a plain ValueError (e.g. the "at least one field
    # required" validators) -- plain json.dumps can't serialize that, so it
    # must go through jsonable_encoder (which stringifies it) like FastAPI's
    # own default handler does, not straight into JSONResponse.
    return JSONResponse(
        error_body("Validation failed", jsonable_encoder(error.errors()), _request_id(request)),
        status_code=422,
    )


async def unhandled_exception_handler(request: Request, error: Exception) -> JSONResponse:
    logger.error(
        "unhandled_exception",
        method=request.method,
        path=request.url.path,
        exc_info=error,
    )
    return JSONResponse(
        error_body("Internal server error", request_id=_request_id(request)),
        status_code=500,
    )


def register_exception_handlers(app: FastAPI) -> None:
    app.add_exception_handler(AppError, app_error_handler)
    app.add_exception_handler(RequestValidationError, validation_error_handler)
    app.add_exception_handler(Exception, unhandled_exception_handler)
