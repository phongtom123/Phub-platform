from fastapi import HTTPException
from phub_api.config.warehouse import OPERATING_WAREHOUSE_ID, WAREHOUSE_SCOPE_MESSAGE


def require_operating_warehouse(value):
    if value != OPERATING_WAREHOUSE_ID:
        raise HTTPException(422, WAREHOUSE_SCOPE_MESSAGE)
