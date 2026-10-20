from phub_api.repositories.commerce import CommerceRepository


def get_repository():
    from phub_api.config.database import supabase
    return CommerceRepository(supabase)
