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

    def __init__(self, transport=None, *, attempts=3, budget=8.0):
        self.transport = transport if transport is not None else httpx.HTTPTransport(
            http2=False, retries=0,
            limits=httpx.Limits(max_connections=20, max_keepalive_connections=10, keepalive_expiry=5),
        )
        self.attempts = attempts
        self.budget = budget

    def handle_request(self, request: httpx.Request) -> httpx.Response:
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
                    assert failure is not None
                    raise failure
                if response is not None:
                    response.close()
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
