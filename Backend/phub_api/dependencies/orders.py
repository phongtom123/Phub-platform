from fastapi import Depends

from phub_api.config.database import get_supabase
from phub_api.repositories.orders import OrderRepository
from phub_api.services.orders import OrderService


def get_repository(db=Depends(get_supabase)):
    return OrderRepository(db)


def get_service(repository: OrderRepository = Depends(get_repository)) -> OrderService:
    return OrderService(repository)
