from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from .supabase import supabase
from .catalog.router import router as catalog_router
from .orders.router import router as orders_router
from .payments.router import router as payments_router
from .commerce.router import router as commerce_router
from .health import router as health_router
from .runtime import frontend_origins


app = FastAPI(
    title="Phub Platform API",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=frontend_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(catalog_router)
app.include_router(orders_router)
app.include_router(payments_router)
app.include_router(commerce_router)
app.include_router(health_router)

@app.get("/api/products")
async def get_products():
    try:
        response = (
            supabase.table("SAN_PHAM")
            .select("*")
            .limit(20)
            .execute()
        )
        return response.data
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
