"""Admin-only product images. No browser Supabase key or caller-controlled object path."""
from io import BytesIO
import logging
import os
from uuid import uuid4
import warnings

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from PIL import Image, ImageOps, UnidentifiedImageError
from pydantic import BaseModel
from starlette.concurrency import run_in_threadpool
from storage3.utils import StorageException

from .api_contracts import READ_ERRORS, error_response
from .auth import check_origin, require_admin
from .supabase import get_supabase

router = APIRouter(prefix="/api/admin/media", tags=["Admin · Hình ảnh"])
logger = logging.getLogger(__name__)
MAX_BYTES = 5 * 1024 * 1024
MAX_SIDE = 4096
MIME_FORMATS = {"image/jpeg": "JPEG", "image/png": "PNG", "image/webp": "WEBP"}


class UploadedImage(BaseModel):
    bucket: str
    path: str
    url: str
    content_type: str
    size: int
    width: int
    height: int


def normalize_image(data: bytes, content_type: str) -> tuple[bytes, int, int]:
    """Decode and re-encode: reject spoofed/corrupt images, strip embedded metadata."""
    try:
        with warnings.catch_warnings():
            warnings.simplefilter("error", Image.DecompressionBombWarning)
            with Image.open(BytesIO(data)) as probe:
                if probe.format != MIME_FORMATS[content_type]:
                    raise HTTPException(415, "Nội dung ảnh không khớp định dạng khai báo.")
                if max(probe.size) > MAX_SIDE:
                    raise HTTPException(422, "Ảnh không được vượt quá 4096 × 4096 pixel.")
                if getattr(probe, "is_animated", False):
                    raise HTTPException(422, "Chỉ hỗ trợ ảnh tĩnh JPG, PNG hoặc WebP.")
                probe.verify()
            with Image.open(BytesIO(data)) as source:
                image = ImageOps.exif_transpose(source).convert("RGBA" if source.has_transparency_data else "RGB")
                output = BytesIO()
                image.save(output, format="WEBP", quality=85, method=4)
                encoded = output.getvalue()
                if len(encoded) > MAX_BYTES:
                    raise HTTPException(413, "Ảnh sau xử lý vượt quá 5 MB.")
                return encoded, image.width, image.height
    except (UnidentifiedImageError, OSError, ValueError, SyntaxError, EOFError, Image.DecompressionBombError, Image.DecompressionBombWarning):
        raise HTTPException(422, "File ảnh bị hỏng hoặc không phải hình ảnh hợp lệ.") from None


def store_image(data: bytes, content_type: str, db) -> UploadedImage:
    encoded, width, height = normalize_image(data, content_type)
    bucket = os.getenv("SUPABASE_MEDIA_BUCKET", "media").strip()
    if not bucket:
        raise HTTPException(503, "Chưa cấu hình bucket hình ảnh.")
    try:
        info = db.storage.get_bucket(bucket)
        if not info.public:
            # Never make an existing private bucket public as a side effect of uploading.
            raise HTTPException(503, "Bucket hình ảnh phải là public để hiển thị ảnh sản phẩm. Kiểm tra cấu hình Storage.")
        files = db.storage.from_(bucket)
        path = f"products/{uuid4().hex}.webp"
        files.upload(path=path, file=encoded, file_options={
            "content-type": "image/webp", "cache-control": "31536000", "upsert": "false",
        })
        url = files.get_public_url(path)
    except StorageException as exc:
        logger.warning("Media storage failed error_type=%s", type(exc).__name__)
        raise HTTPException(503, "Không tải được ảnh lên Storage. Kiểm tra bucket media, quyền và cấu hình Supabase.") from None
    return UploadedImage(bucket=bucket, path=path, url=url, content_type="image/webp",
                         size=len(encoded), width=width, height=height)


@router.post("/images", status_code=201, response_model=UploadedImage,
             summary="Tải ảnh sản phẩm lên Supabase Storage (ADMIN)",
             responses={**READ_ERRORS, 413: error_response(413, "Ảnh vượt quá 5 MB."),
                        415: error_response(415, "Chỉ hỗ trợ JPG, PNG hoặc WebP.")},
             openapi_extra={"requestBody": {
                 "required": True, "description": "Nội dung file nhị phân, không phải JSON/multipart. Tối đa 5 MB, 4096 × 4096 pixel; ảnh tĩnh được chuẩn hóa WebP.",
                 "content": {mime: {"schema": {"type": "string", "format": "binary"}} for mime in MIME_FORMATS},
             }})
async def upload_image(request: Request, response: Response, user=Depends(require_admin), db=Depends(get_supabase)):
    check_origin(request)
    response.headers["Cache-Control"] = "no-store"
    content_type = request.headers.get("content-type", "").split(";")[0].strip().lower()
    if content_type not in MIME_FORMATS:
        raise HTTPException(415, "Chỉ hỗ trợ JPG, PNG hoặc WebP.")
    length = request.headers.get("content-length", "")
    if length.isdigit() and int(length) > MAX_BYTES:
        raise HTTPException(413, "Dung lượng ảnh không được vượt quá 5 MB.")
    data = bytearray()
    async for chunk in request.stream():
        if len(data) + len(chunk) > MAX_BYTES:
            raise HTTPException(413, "Dung lượng ảnh không được vượt quá 5 MB.")
        data.extend(chunk)
    if not data:
        raise HTTPException(422, "Hãy chọn một file ảnh.")
    return await run_in_threadpool(store_image, bytes(data), content_type, db)
