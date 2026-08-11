from __future__ import annotations

import time

from prometheus_client import Counter, Gauge, Histogram
from starlette.middleware.base import BaseHTTPMiddleware

HTTP_REQUESTS = Counter(
    "studia_http_requests_total", "HTTP requests", ("method", "route", "status")
)
HTTP_LATENCY = Histogram(
    "studia_http_request_duration_seconds", "HTTP request latency", ("method", "route")
)
AI_REQUESTS = Counter(
    "studia_ai_requests_total", "AI provider attempts", ("provider", "model", "outcome")
)
AI_LATENCY = Histogram(
    "studia_ai_request_duration_seconds", "AI provider latency", ("provider", "model")
)

# Point-in-time gauges, refreshed from the `background_jobs` table each time
# /metrics is scraped (see `refresh_job_metrics` in app.main) rather than
# incremented in-process -- multiple worker/API replicas would otherwise
# each report only their own partial view.
QUEUE_DEPTH = Gauge("studia_queue_depth", "Jobs currently queued")
QUEUE_OLDEST_JOB_AGE = Gauge(
    "studia_queue_oldest_job_age_seconds", "Age of the oldest still-queued job"
)
JOBS_RUNNING = Gauge("studia_jobs_running", "Jobs currently running")
JOBS_FAILED = Gauge("studia_jobs_failed", "Jobs in a retryable failed state")
JOBS_DEAD_LETTER = Gauge("studia_jobs_dead_letter", "Jobs in the dead-letter state")

DB_POOL_SIZE = Gauge("studia_db_pool_size", "Configured SQLAlchemy connection pool size")
DB_POOL_CHECKED_OUT = Gauge("studia_db_pool_checked_out", "Connections currently checked out of the pool")
SLOW_QUERIES = Counter("studia_slow_queries_total", "Queries slower than SLOW_QUERY_MS")

AUTH_FAILURES = Counter("studia_auth_failures_total", "Failed login/register attempts", ("reason",))


class MetricsMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        started = time.perf_counter()
        status = 500
        try:
            response = await call_next(request)
            status = response.status_code
            return response
        finally:
            route = request.scope.get("route")
            path = getattr(route, "path", "unmatched")
            HTTP_REQUESTS.labels(request.method, path, str(status)).inc()
            HTTP_LATENCY.labels(request.method, path).observe(time.perf_counter() - started)
