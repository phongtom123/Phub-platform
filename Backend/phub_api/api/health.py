from fastapi import APIRouter

from phub_api.controllers import health
from phub_api.schemas.health import HealthResponse

router = APIRouter(tags=["Health"])

router.get("/api/health", response_model=HealthResponse, summary="Kiểm tra tiến trình API đang hoạt động")(health.health)
