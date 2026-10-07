import os
from functools import lru_cache

from supabase import Client, create_client

from . import config  # Loads Backend/.env, regardless of the working directory.


@lru_cache
def get_supabase() -> Client:
    url = os.getenv("SUPABASE_URL", "")
    key = os.getenv("SUPABASE_SECRET_KEY", "")
    if not url or not key or "your-project" in url or key.startswith("replace-"):
        raise RuntimeError("Configure SUPABASE_URL and SUPABASE_SECRET_KEY in Backend/.env")
    return create_client(url, key)


class LazyClient:
    """Keep catalog/seed compatibility without connecting during application import."""

    def __getattr__(self, name: str):
        return getattr(get_supabase(), name)


supabase = LazyClient()
