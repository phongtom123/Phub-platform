from io import BytesIO
import logging
import os
from uuid import uuid4
import warnings

from fastapi import HTTPException
from PIL import Image, ImageOps, UnidentifiedImageError
from storage3.utils import StorageException

from phub_api.schemas.media import UploadedImage

logger = logging.getLogger(__name__)
MAX_BYTES = 5 * 1024 * 1024
MAX_SIDE = 4096
MIME_FORMATS = {"image/jpeg": "JPEG", "image/png": "PNG", "image/webp": "WEBP"}


def normalize_image(data: bytes, content_type: str) -> tuple[bytes, int, int]:
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
