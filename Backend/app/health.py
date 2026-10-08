from typing import Literal

from fastapi import APIRouter, Response
from pydantic import BaseModel

router = APIRouter(tags=["Health"])


class HealthResponse(BaseModel):
    status: Literal["ok"]


@router.get("/api/health", response_model=HealthResponse, summary="Kiểm tra tiến trình API đang hoạt động")
def health(response: Response):
    """Health check cho Render; không gọi database, tạo đơn hoặc kiểm tra phiên.

    HTTP 200 chỉ xác nhận tiến trình hoạt động, không xác nhận auth/migration đã nối.
    """
    response.headers["Cache-Control"] = "no-store"
    return {"status": "ok"}
