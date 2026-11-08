from fastapi import Depends, Response

from phub_api.config.database import get_supabase
from phub_api.dependencies.auth import require_admin
from phub_api.models.user import User
from phub_api.repositories.crm_analytics import CrmAnalyticsRepository
from phub_api.services.crm_analytics import CrmAnalyticsService


def get_analytics_service(response: Response, user: User = Depends(require_admin), db=Depends(get_supabase)):
    response.headers["Cache-Control"] = "no-store"
    return CrmAnalyticsService(CrmAnalyticsRepository(db), user)

