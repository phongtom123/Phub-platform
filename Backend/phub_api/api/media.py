from fastapi import APIRouter

from phub_api.controllers import media
from phub_api.schemas.media import UploadedImage
from phub_api.services.media import MIME_FORMATS
from phub_api.schemas.api_contracts import READ_ERRORS, error_response

router = APIRouter(prefix="/api/admin/media", tags=["Admin · Hình ảnh"])

router.post("/images", status_code=201, response_model=UploadedImage,
             summary="Tải ảnh sản phẩm lên Supabase Storage (ADMIN)",
             responses={**READ_ERRORS, 413: error_response(413, "Ảnh vượt quá 5 MB."),
                        415: error_response(415, "Chỉ hỗ trợ JPG, PNG hoặc WebP.")},
             openapi_extra={"requestBody": {
                 "required": True, "description": "Nội dung file nhị phân, không phải JSON/multipart. Tối đa 5 MB, 4096 × 4096 pixel; ảnh tĩnh được chuẩn hóa WebP.",
                 "content": {mime: {"schema": {"type": "string", "format": "binary"}} for mime in MIME_FORMATS},
             }})(media.upload_image)
