#!/bin/sh
# Runs migrations, then starts the API. A container's outbound networking
# (DNS in particular) can stall completely for the first several seconds
# right at boot -- long enough to blow past the deploy platform's
# healthcheck window -- and that kind of hang isn't something Python-level
# cancellation (asyncio.wait_for etc.) can bound: once a blocking syscall is
# running in a thread-pool worker, only killing the process actually
# unsticks it. `timeout` does exactly that at the OS level, so a stalled
# attempt gets killed and retried instead of hanging silently forever.
set -e

attempt=1
max_attempts=6

until timeout -k 5 25 alembic upgrade head; do
    if [ "$attempt" -ge "$max_attempts" ]; then
        echo "[entrypoint] alembic upgrade head did not succeed after $max_attempts attempts, giving up" >&2
        exit 1
    fi
    echo "[entrypoint] migration attempt $attempt timed out or failed, retrying..." >&2
    attempt=$((attempt + 1))
    sleep 3
done

exec uvicorn app.main:app --host 0.0.0.0 --port "${PORT:-5000}"
