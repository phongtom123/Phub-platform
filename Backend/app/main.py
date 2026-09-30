from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from .supabase import supabase


app = FastAPI(
    title="Phub Platform API",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

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

# @app.get("/api/health")
# async def health_check() -> dict[str, str]:
#     return {"status": "ok"}
