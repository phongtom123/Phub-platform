import logging

from fastapi.exceptions import RequestValidationError
from fastapi.routing import APIRoute
from httpx import RequestError
from postgrest.exceptions import APIError
from starlette.exceptions import HTTPException

from ..catalog.errors import error_response
from ..catalog.schemas import ErrorDetail
from ..payments.errors import PaymentError


logger = logging.getLogger(__name__)


class OrderError(Exception):
    def __init__(self, status_code, code, message, details=None):
        super().__init__(message)
        self.status_code, self.code, self.message = status_code, code, message
        self.details = details or []


class OrderRoute(APIRoute):
    """Normalize only order errors; do not change existing application handlers."""

    def get_route_handler(self):
        original = super().get_route_handler()

        async def handler(request):
            try:
                return await original(request)
            except RequestValidationError as exc:
                details = [ErrorDetail(
                    field=".".join(str(part) for part in item["loc"] if part not in ("body", "header")),
                    message=item["msg"],
                ) for item in exc.errors()]
                return error_response(422, "VALIDATION_ERROR", "Thông tin đặt hàng không hợp lệ.", details)
            except (OrderError, PaymentError) as exc:
                return error_response(exc.status_code, exc.code, exc.message, getattr(exc, "details", []))
            except RequestError:
                # Retrying with the SAME key is safe even after an ambiguous timeout.
                logger.warning("Order database connection failed")
                return error_response(503, "DATA_SERVICE_UNAVAILABLE", "Dịch vụ dữ liệu tạm thời không khả dụng. Hãy thử lại với cùng Idempotency-Key.")
            except APIError as exc:
                code = str(exc.code or "")
                logger.warning("Order database request failed: %s", code)
                if code in {"PGRST202", "42883", "42P01"}:
                    return error_response(503, "ORDER_DATABASE_NOT_READY", "Chưa triển khai migration đặt hàng trên database.")
                if code in {"40001", "40P01"}:
                    return error_response(409, "RETRYABLE_CONFLICT", "Có yêu cầu đồng thời. Hãy thử lại với cùng Idempotency-Key.")
                if code.startswith(("08", "53")) or code in {"PGRST000", "PGRST001", "PGRST002", "55P03", "57014", "57P01", "57P02", "57P03"} or (code.isdigit() and 500 <= int(code) < 600):
                    return error_response(503, "DATA_SERVICE_UNAVAILABLE", "Dịch vụ dữ liệu tạm thời không khả dụng.")
                return error_response(500, "INTERNAL_ERROR", "Không thể xử lý yêu cầu đặt hàng.")
            except HTTPException as exc:
                code, message = {401: ("AUTHENTICATION_REQUIRED", "Bạn cần đăng nhập để đặt hàng."), 403: ("ACCESS_DENIED", "Tài khoản không được phép đặt hàng.")}.get(exc.status_code, ("REQUEST_ERROR", "Yêu cầu đặt hàng không thể thực hiện."))
                response = error_response(exc.status_code, code, message)
                if exc.status_code == 401 and exc.headers and "WWW-Authenticate" in exc.headers:
                    response.headers["WWW-Authenticate"] = exc.headers["WWW-Authenticate"]
                return response
            except Exception:
                # Do not log recipient information, SDK response bodies, or keys.
                logger.warning("Order request failed")
                return error_response(500, "INTERNAL_ERROR", "Không thể xử lý yêu cầu đặt hàng.")

        async def no_store(request):
            response = await handler(request)
            response.headers["Cache-Control"] = "no-store"
            return response

        return no_store
