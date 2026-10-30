from fastapi import Depends
from phub_api.config.database import get_supabase
from phub_api.dependencies.auth import current_user
from phub_api.repositories.pricing import PricingRepository
from phub_api.services.pricing import PricingService

def get_service(user=Depends(current_user), db=Depends(get_supabase)):
    return PricingService(PricingRepository(db), user)
