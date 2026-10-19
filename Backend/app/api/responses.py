from app.schemas.catalog import ErrorResponse


def documented_error(code: str, message: str, details=None):
    return {
        "model": ErrorResponse,
        "description": message,
        "content": {"application/json": {"example": {
            "error": {"code": code, "message": message, "details": details or []},
        }}},
    }
