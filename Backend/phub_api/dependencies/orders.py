from phub_api.repositories.orders import OrderRepository


def get_repository():
    from phub_api.config.database import supabase
    return OrderRepository(supabase)
