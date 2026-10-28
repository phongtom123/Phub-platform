from fastapi import Depends

from phub_api.config.database import get_supabase
from phub_api.repositories.commerce import CommerceRepository
from phub_api.services.commerce import CommerceService


def get_repository(db=Depends(get_supabase)):
    return CommerceRepository(db)


def get_service(repository: CommerceRepository = Depends(get_repository)) -> CommerceService:
    return CommerceService(repository)
