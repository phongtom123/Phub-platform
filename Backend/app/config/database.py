import os
from functools import lru_cache

import httpx
from supabase import Client, ClientOptions, create_client

from app.config import settings
from app.config.database_transport import DatabaseTransport


@lru_cache
def get_http_client() -> httpx.Client:
    return httpx.Client(
        transport=DatabaseTransport(),
        timeout=httpx.Timeout(connect=2.0, read=4.0, write=10.0, pool=1.0),
        follow_redirects=False,
    )


@lru_cache
def get_supabase() -> Client:
    url = os.getenv("SUPABASE_URL", "")
    key = os.getenv("SUPABASE_SECRET_KEY", "")
    if not url or not key or "your-project" in url or key.startswith("replace-"):
        raise RuntimeError("Configure SUPABASE_URL and SUPABASE_SECRET_KEY in Backend/.env")
    return create_client(url, key, options=ClientOptions(
        httpx_client=get_http_client(), auto_refresh_token=False, persist_session=False,
    ))


def close_supabase() -> None:
    if get_http_client.cache_info().currsize:
        get_http_client().close()
    get_supabase.cache_clear()
    get_http_client.cache_clear()


class LazyClient:

    def __getattr__(self, name: str):
        return getattr(get_supabase(), name)


supabase = LazyClient()
