from contextlib import asynccontextmanager

from fastapi import FastAPI
from phub_api.controllers.catalog import router as catalog_router
from phub_api.controllers.legacy import router as legacy_router
from phub_api.controllers.auth import router as auth_router
from phub_api.controllers.tables import router as tables_router
from phub_api.middleware.cors import register_cors
from phub_api.controllers.orders import router as orders_router
from phub_api.controllers.payments import router as payments_router
from phub_api.controllers.commerce import router as commerce_router
from phub_api.controllers.health import router as health_router
from phub_api.controllers.admin_accounts import router as admin_accounts_router
from phub_api.controllers.media import router as media_router
from phub_api.middleware.errors import register_errors
from phub_api.config.database import close_supabase
from phub_api.config.openapi import DESCRIPTION, TAGS, install_openapi


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
