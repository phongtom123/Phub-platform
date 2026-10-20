import logging

from fastapi.exceptions import RequestValidationError
from fastapi.routing import APIRoute
from httpx import RequestError
from postgrest.exceptions import APIError
from starlette.exceptions import HTTPException
from starlette.responses import JSONResponse

from phub_api.models.errors import CatalogError
from phub_api.schemas.catalog import ErrorBody, ErrorDetail, ErrorResponse


logger = logging.getLogger(__name__)


def error_response(status_code, code, message, details=None):
    body = ErrorResponse(error=ErrorBody(code=code, message=message, details=details or []))
    return JSONResponse(status_code=status_code, content=body.model_dump(mode="json"))


class CatalogRoute(APIRoute):

    def get_route_handler(self):
        original = super().get_route_handler()

        async def handler(request):
            try:
                return await original(request)
            except RequestValidationError as exc:
                details = [
                    ErrorDetail(
                        field=".".join(str(part) for part in item["loc"] if part not in ("query", "path")),
                        message=item["msg"],
                    )
                    for item in exc.errors()
                ]
                return error_response(422, "VALIDATION_ERROR", "Tham số không hợp lệ.", details)
            except CatalogError as exc:
                return error_response(exc.status_code, exc.code, exc.message)
            except RequestError:
                logger.exception("Catalog data service connection failed")
                return error_response(503, "DATA_SERVICE_UNAVAILABLE", "Dịch vụ dữ liệu tạm thời không khả dụng.")
            except APIError as exc:
                logger.exception("Catalog data query failed")
                code = str(exc.code or "")
                unavailable = (
                    code in {"PGRST000", "PGRST001", "PGRST002", "57P01", "57P02", "57P03"}
                    or code.startswith(("08", "53"))
                    or (code.isdigit() and 500 <= int(code) < 600)
                )
                if unavailable:
                    return error_response(503, "DATA_SERVICE_UNAVAILABLE", "Dịch vụ dữ liệu tạm thời không khả dụng.")
                return error_response(500, "INTERNAL_ERROR", "Không thể xử lý yêu cầu catalog.")
            except HTTPException as exc:
                return error_response(exc.status_code, "REQUEST_ERROR", "Yêu cầu catalog không thể thực hiện.")
            except Exception:
                logger.exception("Catalog request failed")
                return error_response(500, "INTERNAL_ERROR", "Không thể xử lý yêu cầu catalog.")

        return handler
