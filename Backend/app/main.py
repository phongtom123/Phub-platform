from contextlib import asynccontextmanager

from fastapi import FastAPI
from app.api.catalog import router as catalog_router
from app.api.legacy import router as legacy_router
from app.api.auth import router as auth_router
from app.api.tables import router as tables_router
from app.middleware.cors import register_cors
from app.api.orders import router as orders_router
from app.api.payments import router as payments_router
from app.api.commerce import router as commerce_router
from app.api.health import router as health_router
from app.api.admin_accounts import router as admin_accounts_router
from app.api.media import router as media_router
from app.middleware.errors import register_errors
from app.config.database import close_supabase
from app.api.documentation import DESCRIPTION, TAGS, install_openapi


@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        yield
    finally:
        close_supabase()


app = FastAPI(
    lifespan=lifespan,
    title="Phub Platform API",
    version="0.3.0",
    description=DESCRIPTION,
    openapi_tags=TAGS + [
        {"name": "Customer Orders", "description": "Customer order creation and idempotent retries."},
        {"name": "Customer Payments", "description": "Customer payment requests and status."},
        {"name": "Customer Shopping", "description": "Customer profile, cart, checkout and order history."},
    ],
    swagger_ui_parameters={"defaultModelsExpandDepth": -1, "docExpansion": "none", "filter": True,
                           "displayRequestDuration": True, "withCredentials": True, "persistAuthorization": False},
)

register_cors(app)

app.include_router(catalog_router)
app.include_router(auth_router)
app.include_router(tables_router)
app.include_router(orders_router)
app.include_router(payments_router)
app.include_router(commerce_router)
app.include_router(health_router)
app.include_router(admin_accounts_router)
app.include_router(media_router)
app.include_router(legacy_router)
register_errors(app)


install_openapi(app)
