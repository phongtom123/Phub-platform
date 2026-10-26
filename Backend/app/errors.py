"""Stable errors without leaking database internals or submitted passwords."""
import logging

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from httpx import RequestError
from postgrest.exceptions import APIError

logger = logging.getLogger(__name__)


def register_errors(app: FastAPI) -> None:
    @app.exception_handler(APIError)
    async def database_error(request: Request, exc: APIError):
        code = str(exc.code)
        if code == "23505":
            return JSONResponse({"detail": "Mã hoặc dữ liệu duy nhất đã tồn tại."}, status_code=409)
        if code in {"23503", "23514", "23502", "22P02", "22007", "22003"}:
            return JSONResponse({"detail": "Dữ liệu vi phạm ràng buộc hoặc khóa ngoại."}, status_code=422)
        logger.warning("Database request failed: code=%s", code)
        return JSONResponse({"detail": "Chưa thể truy cập dữ liệu. Kiểm tra cấu hình và schema Supabase."}, status_code=503)

    @app.exception_handler(RequestError)
    async def connection_error(request: Request, exc: RequestError):
        return JSONResponse({"detail": "Không kết nối được Supabase."}, status_code=503)

    @app.exception_handler(RuntimeError)
    async def configuration_error(request: Request, exc: RuntimeError):
        logger.warning("Backend configuration or runtime error (%s)", type(exc).__name__)
        return JSONResponse({"detail": "Backend chưa được cấu hình đầy đủ. Kiểm tra Backend/.env."}, status_code=503)

    @app.exception_handler(RequestValidationError)
    async def validation_error(request: Request, exc: RequestValidationError):
        details = [{"loc": list(error["loc"]), "msg": error["msg"], "type": error["type"]} for error in exc.errors()]
        return JSONResponse({"detail": details}, status_code=422)
