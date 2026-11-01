from fastapi import HTTPException


def require_warehouse_id(value):
    """Validate an identifier; existence, active state and ownership are checked by the caller/RPC."""
    if type(value) is not int or not -(2**31) <= value < 2**31:
        raise HTTPException(422, "Chọn một kho hợp lệ.")
