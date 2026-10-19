from fastapi import APIRouter, Depends

from phub_api.config.database import get_supabase
from phub_api.models.resources import public_columns

router = APIRouter()


@router.get("/api/products", deprecated=True, tags=["Public Catalog"])
def legacy_products(db=Depends(get_supabase)):
    columns = [c["name"] + ("::text" if c["type"].startswith("decimal") else "") for c in public_columns("products")]
    result = db.table("SAN_PHAM").select(",".join(columns) + ",category:LOAI_SP!inner(trang_thai)").eq("trang_thai", 1).eq("category.trang_thai", 1).order("ma_sp").limit(20).execute()
    return [{key: value for key, value in row.items() if key != "category"} for row in result.data]
