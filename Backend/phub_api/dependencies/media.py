from fastapi import Depends

from phub_api.config.database import get_supabase
from phub_api.repositories.media import MediaRepository
from phub_api.services.media import MediaService


def get_repository(db=Depends(get_supabase)) -> MediaRepository:
    return MediaRepository(db)


def get_service(repository: MediaRepository = Depends(get_repository)) -> MediaService:
    return MediaService(repository)
