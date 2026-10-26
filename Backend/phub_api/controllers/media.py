from fastapi import APIRouter, Depends, HTTPException, Request, Response
from starlette.concurrency import run_in_threadpool

from phub_api.dependencies.auth import require_admin, require_customer_user
from phub_api.dependencies.media import get_service
from phub_api.dependencies.origin import check_origin
from phub_api.schemas.api_contracts import READ_ERRORS, error_response
from phub_api.schemas.media import UploadedImage
from phub_api.services import media
from phub_api.services.media import MIME_FORMATS


customer_router = APIRouter(prefix="/api/customer", tags=["Customer Shopping"])

router = APIRouter(prefix="/api/admin/media", tags=["Admin · Hình ảnh"])

@router.post("/images", status_code=201, response_model=UploadedImage,
             summary="Tải ảnh sản phẩm lên Supabase Storage (ADMIN)",
             responses={**READ_ERRORS, 413: error_response(413, "Ảnh vượt quá 5 MB."),
                        415: error_response(415, "Chỉ hỗ trợ JPG, PNG hoặc WebP.")},
             openapi_extra={"requestBody": {
                 "required": True, "description": "Nội dung file nhị phân, không phải JSON/multipart. Tối đa 5 MB, 4096 × 4096 pixel; ảnh tĩnh được chuẩn hóa WebP.",
                 "content": {mime: {"schema": {"type": "string", "format": "binary"}} for mime in MIME_FORMATS},
             }})
async def upload_image(request: Request, response: Response, user=Depends(require_admin), service: media.MediaService = Depends(get_service)):
    check_origin(request)
    response.headers["Cache-Control"] = "no-store"
    content_type = request.headers.get("content-type", "").split(";")[0].strip().lower()
    if content_type not in media.MIME_FORMATS:
        raise HTTPException(415, "Chỉ hỗ trợ JPG, PNG hoặc WebP.")
    length = request.headers.get("content-length", "")
    if length.isdigit() and int(length) > media.MAX_BYTES:
        raise HTTPException(413, "Dung lượng ảnh không được vượt quá 5 MB.")
    data = bytearray()
    async for chunk in request.stream():
        if len(data) + len(chunk) > media.MAX_BYTES:
            raise HTTPException(413, "Dung lượng ảnh không được vượt quá 5 MB.")
        data.extend(chunk)
    if not data:
        raise HTTPException(422, "Hãy chọn một file ảnh.")
    return await run_in_threadpool(service.store_image, bytes(data), content_type)


@customer_router.post("/me/avatar", status_code=201, response_model=UploadedImage,
                      summary="Tải ảnh đại diện cho tài khoản khách đang đăng nhập",
                      responses={**READ_ERRORS, 413: error_response(413, "Ảnh vượt quá 5 MB."),
                                 415: error_response(415, "Chỉ hỗ trợ JPG, PNG hoặc WebP.")},
                      openapi_extra={"requestBody": {
                          "required": True, "description": "File ảnh nhị phân JPG, PNG hoặc WebP; tối đa 5 MB.",
                          "content": {mime: {"schema": {"type": "string", "format": "binary"}} for mime in MIME_FORMATS},
                      }})
async def upload_avatar(request: Request, response: Response, user=Depends(require_customer_user),
                        service: media.MediaService = Depends(get_service)):
    check_origin(request)
    response.headers["Cache-Control"] = "no-store"
    content_type = request.headers.get("content-type", "").split(";")[0].strip().lower()
    if content_type not in media.MIME_FORMATS:
        raise HTTPException(415, "Chỉ hỗ trợ JPG, PNG hoặc WebP.")
    length = request.headers.get("content-length", "")
    if length.isdigit() and int(length) > media.MAX_BYTES:
        raise HTTPException(413, "Dung lượng ảnh không được vượt quá 5 MB.")
    data = bytearray()
    async for chunk in request.stream():
        if len(data) + len(chunk) > media.MAX_BYTES:
            raise HTTPException(413, "Dung lượng ảnh không được vượt quá 5 MB.")
        data.extend(chunk)
    if not data:
        raise HTTPException(422, "Hãy chọn một file ảnh.")
    return await run_in_threadpool(service.store_avatar, bytes(data), content_type, user.account_id)
