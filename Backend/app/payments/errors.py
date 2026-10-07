import logging

from fastapi.exceptions import RequestValidationError
from fastapi.routing import APIRoute
from httpx import RequestError
from postgrest.exceptions import APIError
from starlette.exceptions import HTTPException

from ..catalog.errors import error_response
from ..catalog.schemas import ErrorDetail


logger = logging.getLogger(__name__)


class PaymentError(Exception):
    def __init__(self, status_code, code, message):
        super().__init__(message)
        self.status_code, self.code, self.message = status_code, code, message


class PaymentRoute(APIRoute):
    """Keep payment error handling scoped, with no transaction/token logging."""

    def get_route_handler(self):
        original = super().get_route_handler()

        async def handler(request):
            try:
                response = await original(request)
            except RequestValidationError as exc:
                details = [ErrorDetail(
                    field=".".join(str(part) for part in item["loc"] if part not in ("path", "query", "header", "body")),
                    message=item["msg"],
                ) for item in exc.errors()]
                response = error_response(422, "VALIDATION_ERROR", "Thông tin tra cứu thanh toán không hợp lệ.", details)
            except PaymentError as exc:
                response = error_response(exc.status_code, exc.code, exc.message)
            except RequestError:
                logger.warning("Payment data connection failed")
                response = error_response(503, "DATA_SERVICE_UNAVAILABLE", "Dịch vụ dữ liệu tạm thời không khả dụng.")
            except APIError as exc:
                code = str(exc.code or "")
                # Do not log SDK bodies, raw SQL messages or provider references.
                logger.warning("Payment database request failed")
                if code in {"42P01", "42703", "PGRST200", "PGRST204", "PGRST205"}:
                    response = error_response(503, "PAYMENT_SCHEMA_NOT_READY", "Cấu trúc dữ liệu thanh toán chưa sẵn sàng.")
                elif code.startswith(("08", "53")) or code in {"PGRST000", "PGRST001", "PGRST002", "40001", "40P01", "55P03", "57014", "57P01", "57P02", "57P03"} or (code.isdigit() and 500 <= int(code) < 600):
                    response = error_response(503, "DATA_SERVICE_UNAVAILABLE", "Dịch vụ dữ liệu tạm thời không khả dụng.")
                else:
                    response = error_response(500, "INTERNAL_ERROR", "Không thể tra cứu thanh toán.")
            except HTTPException as exc:
                code, message = {
                    401: ("AUTHENTICATION_REQUIRED", "Bạn cần đăng nhập để tra cứu thanh toán."),
                    403: ("ACCESS_DENIED", "Tài khoản không được phép tra cứu thanh toán."),
                }.get(exc.status_code, ("REQUEST_ERROR", "Yêu cầu tra cứu không thể thực hiện."))
                response = error_response(exc.status_code, code, message)
                if exc.status_code == 401 and exc.headers and "WWW-Authenticate" in exc.headers:
                    response.headers["WWW-Authenticate"] = exc.headers["WWW-Authenticate"]
            except Exception:
                logger.warning("Payment request failed")
                response = error_response(500, "INTERNAL_ERROR", "Không thể tra cứu thanh toán.")
            response.headers["Cache-Control"] = "no-store"
            return response

        return handler
