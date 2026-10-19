from app.repositories.commerce import CommerceRepository


def get_repository():
    from app.config.database import supabase
    return CommerceRepository(supabase)
