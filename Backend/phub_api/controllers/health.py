from fastapi import APIRouter, Response

from phub_api.schemas.health import HealthResponse


router = APIRouter(tags=["Health"])

@router.get("/api/health", response_model=HealthResponse, summary="Kiểm tra tiến trình API đang hoạt động")
def health(response: Response):
    response.headers["Cache-Control"] = "no-store"
    return {"status": "ok"}
