"""Pooled Supabase HTTP transport with bounded retries for reads only."""
import logging
import random
import time

import httpx

logger = logging.getLogger(__name__)
READ_FAILURES = (
    httpx.ConnectError, httpx.ConnectTimeout, httpx.ReadError,
    httpx.ReadTimeout, httpx.RemoteProtocolError,
)
READ_STATUSES = {502, 503, 504}


class DatabaseTransport(httpx.BaseTransport):
    """Never replay POST/PATCH/PUT/DELETE, including transaction RPCs.

    The budget limits starting another attempt, not the duration of an entire
    API endpoint. HTTPX timeouts also apply to each network operation.
    """

    def __init__(self, transport=None, *, attempts=3, budget=8.0):
        self.transport = transport if transport is not None else httpx.HTTPTransport(
            http2=False, retries=0,
            limits=httpx.Limits(max_connections=20, max_keepalive_connections=10, keepalive_expiry=5),
        )
        self.attempts = attempts
        self.budget = budget

    def handle_request(self, request: httpx.Request) -> httpx.Response:
        # Avoid replaying even a GET that carries a body.
        if request.method not in {"GET", "HEAD"} or request.read():
            return self.transport.handle_request(request)
        started = time.monotonic()
        original_timeout = request.extensions.get("timeout")
        try:
            for attempt in range(1, self.attempts + 1):
                remaining = max(0.001, self.budget - (time.monotonic() - started))
                if original_timeout is not None:
                    request.extensions["timeout"] = {
                        key: min(value, remaining) if value is not None else remaining
                        for key, value in original_timeout.items()
                    }
                response = None
                failure = None
                try:
                    response = self.transport.handle_request(request)
                    # Read here so a broken response stream is covered by retry.
                    response.read()
                    if response.status_code not in READ_STATUSES:
                        return response
                    reason = f"HTTP_{response.status_code}"
                except READ_FAILURES as exc:
                    if response is not None:
                        response.close()
                        response = None
                    if attempt == self.attempts or time.monotonic() - started >= self.budget:
                        raise
                    reason = type(exc).__name__
                    failure = exc
                delay = min(0.25 * 2 ** (attempt - 1), 1.0) + random.uniform(0, 0.1)
                if attempt == self.attempts or time.monotonic() - started + delay >= self.budget:
                    if response is not None:
                        return response
                    # Preserve the actual exception type for diagnostics.
                    assert failure is not None
                    raise failure
                if response is not None:
                    response.close()
                # No query strings, exception text, bodies, keys or cookies in logs.
                logger.warning(
                    "Database read retry attempt=%d reason=%s host=%s elapsed_ms=%d",
                    attempt, reason, request.url.host, round((time.monotonic() - started) * 1000),
                )
                time.sleep(delay)
        finally:
            if original_timeout is not None:
                request.extensions["timeout"] = original_timeout

    def close(self):
        self.transport.close()
