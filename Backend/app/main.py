from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .catalog.router import router as catalog_router
from .auth import router as auth_router
from .tables import router as tables_router
from .config import frontend_origins
from .errors import register_errors
from .supabase import get_supabase
from .resources import public_columns
from .documentation import DESCRIPTION, TAGS, install_openapi


app = FastAPI(
    title="Phub Platform API",
    version="0.3.0",
    description=DESCRIPTION,
    openapi_tags=TAGS,
    swagger_ui_parameters={"defaultModelsExpandDepth": -1, "docExpansion": "none", "filter": True,
                           "displayRequestDuration": True, "withCredentials": True, "persistAuthorization": False},
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=frontend_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(catalog_router)
app.include_router(auth_router)
app.include_router(tables_router)
register_errors(app)

@app.get("/api/health", tags=["Health"])
def health_check() -> dict[str, str]:
    """Application liveness, not a database readiness check."""
    return {"status": "ok"}


@app.get("/api/products", deprecated=True, tags=["Public Catalog"])
def legacy_products(db=Depends(get_supabase)):
    """Keep the old array endpoint, with public fields and active records only."""
    columns = [c["name"] + ("::text" if c["type"].startswith("decimal") else "") for c in public_columns("products")]
    result = db.table("SAN_PHAM").select(",".join(columns) + ",category:LOAI_SP!inner(trang_thai)").eq("trang_thai", 1).eq("category.trang_thai", 1).order("ma_sp").limit(20).execute()
    return [{key: value for key, value in row.items() if key != "category"} for row in result.data]


install_openapi(app)
