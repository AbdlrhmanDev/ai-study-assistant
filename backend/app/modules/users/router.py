"""No routes yet: the Express app never had a dedicated /users resource, and
profile management is reachable at /auth/me (see modules.auth.router) for
frontend compatibility. Kept present, unmounted, as a home for future
first-class /users endpoints."""

from fastapi import APIRouter

router = APIRouter(prefix="/users", tags=["users"])
