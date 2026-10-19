from app.repositories.orders import OrderRepository


def get_repository():
    from app.config.database import supabase
    return OrderRepository(supabase)
