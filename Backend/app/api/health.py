from fastapi import APIRouter

from app.controllers import health
from app.schemas.health import HealthResponse

router = APIRouter(tags=["Health"])

router.get("/api/health", response_model=HealthResponse, summary="Kiểm tra tiến trình API đang hoạt động")(health.health)
