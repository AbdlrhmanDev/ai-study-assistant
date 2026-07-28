from typing import Any

from fastapi import Response


def error_body(message: str, details: Any = None, request_id: str | None = None) -> dict:
    body: dict[str, Any] = {"message": message}
    if details is not None:
        body["details"] = details
    if request_id is not None:
        body["requestId"] = request_id
    return body


def no_content() -> Response:
    return Response(status_code=204)
