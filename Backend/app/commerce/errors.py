import logging

from fastapi.exceptions import RequestValidationError
from fastapi.routing import APIRoute
from httpx import RequestError
from postgrest.exceptions import APIError
from starlette.exceptions import HTTPException

from ..catalog.errors import error_response
from ..catalog.schemas import ErrorDetail
from ..orders.errors import OrderError
from ..payments.errors import PaymentError


logger = logging.getLogger(__name__)


class CommerceRoute(APIRoute):
    def get_route_handler(self):
        original = super().get_route_handler()

        async def handler(request):
            try:
                response = await original(request)
            except RequestValidationError as exc:
                details = [ErrorDetail(field=".".join(str(part) for part in item["loc"] if part not in ("body", "path", "query", "header")), message=item["msg"]) for item in exc.errors()]
                response = error_response(422, "VALIDATION_ERROR", "Thông tin mua hàng không hợp lệ.", details)
            except (PaymentError, OrderError) as exc:
                response = error_response(exc.status_code, exc.code, exc.message, getattr(exc, "details", []))
            except RequestError:
                logger.warning("Customer shopping connection failed")
                response = error_response(503, "DATA_SERVICE_UNAVAILABLE", "Dịch vụ dữ liệu tạm thời không khả dụng. Nếu đã gửi đơn, hãy thử lại với cùng Idempotency-Key.")
            except APIError as exc:
                logger.warning("Customer shopping database request failed")
                code = str(exc.code or "")
                if code in {"PGRST202", "42883", "42P01", "42703"}:
                    response = error_response(503, "CHECKOUT_DATABASE_NOT_READY", "Chưa triển khai migration checkout trên database.")
                elif code in {"40001", "40P01"}:
                    response = error_response(409, "RETRYABLE_CONFLICT", "Có yêu cầu đồng thời. Hãy thử lại với cùng Idempotency-Key.")
                elif code.startswith(("08", "53")) or code in {"PGRST000", "PGRST001", "PGRST002", "55P03", "57014", "57P01", "57P02", "57P03"} or (code.isdigit() and 500 <= int(code) < 600):
                    response = error_response(503, "DATA_SERVICE_UNAVAILABLE", "Dịch vụ dữ liệu tạm thời không khả dụng.")
                else:
                    response = error_response(500, "INTERNAL_ERROR", "Không thể xử lý yêu cầu mua hàng.")
            except HTTPException as exc:
                code, message = {401: ("AUTHENTICATION_REQUIRED", "Bạn cần đăng nhập để mua hàng."), 403: ("ACCESS_DENIED", "Tài khoản không được phép mua hàng.")}.get(exc.status_code, ("REQUEST_ERROR", "Yêu cầu không thể thực hiện."))
                response = error_response(exc.status_code, code, message)
                if exc.status_code == 401 and exc.headers and "WWW-Authenticate" in exc.headers:
                    response.headers["WWW-Authenticate"] = exc.headers["WWW-Authenticate"]
            except Exception:
                logger.warning("Customer shopping request failed")
                response = error_response(500, "INTERNAL_ERROR", "Không thể xử lý yêu cầu mua hàng.")
            response.headers["Cache-Control"] = "no-store"
            return response

        return handler
