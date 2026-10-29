from io import BytesIO
from uuid import uuid4
import logging
import os
import warnings

from PIL import Image, ImageOps, UnidentifiedImageError
from fastapi import HTTPException
from postgrest.exceptions import APIError
from storage3.utils import StorageException

from phub_api.repositories.media import MediaRepository
from phub_api.schemas.media import GalleryUpdate, ProductGallery, UploadedImage

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


def store_image(data: bytes, content_type: str, repository: MediaRepository, folder: str = "products") -> UploadedImage:
    encoded, width, height = normalize_image(data, content_type)
    bucket = os.getenv("SUPABASE_MEDIA_BUCKET", "media").strip()
    if not bucket:
        raise HTTPException(503, "Chưa cấu hình bucket hình ảnh.")
    try:
        if not repository.is_public(bucket):
            raise HTTPException(503, "Bucket hình ảnh phải là public để hiển thị ảnh sản phẩm. Kiểm tra cấu hình Storage.")
        path = f"{folder}/{uuid4().hex}.webp"
        url = repository.upload(bucket, path, encoded)
    except StorageException as exc:
        logger.warning("Media storage failed error_type=%s", type(exc).__name__)
        raise HTTPException(503, "Không tải được ảnh lên Storage. Kiểm tra bucket media, quyền và cấu hình Supabase.") from None
    try:
        media = repository.register({
            "storage_bucket": bucket,
            "storage_path": path,
            "url": url,
            "mime_type": "image/webp",
            "kich_thuoc_bytes": len(encoded),
            "chieu_rong": width,
            "chieu_cao": height,
        })
    except (APIError, RuntimeError):
        try:
            repository.remove(bucket, path)
        except StorageException:
            logger.error("Could not roll back unregistered media object path=%s", path)
        raise HTTPException(503, "Không lưu được metadata ảnh. Kiểm tra migration MEDIA trên Supabase.") from None
    return UploadedImage(media_id=str(media["ma_media"]), bucket=bucket, path=path, url=url,
                         content_type="image/webp", size=len(encoded), width=width, height=height)


class MediaService:
    def __init__(self, repository: MediaRepository):
        self.repository = repository

    def store_image(self, data: bytes, content_type: str) -> UploadedImage:
        return store_image(data, content_type, self.repository)

    def gallery(self, product_id: str) -> ProductGallery:
        try:
            rows = self.repository.product_gallery(product_id)
        except APIError as exc:
            if str(exc.code) in {"PGRST200", "42P01", "42703"}:
                raise HTTPException(503, "Chưa có cấu trúc MEDIA. Cần chạy migration shared_media.") from None
            raise
        if not rows:
            raise HTTPException(404, "Không tìm thấy sản phẩm.")
        row = rows[0]
        images = sorted(row.get("images") or [], key=lambda image: (
            not bool(image["la_anh_chinh"]), image["thu_tu"], str(image["ma_media"])))
        return ProductGallery(product_id=row["ma_sp"], legacy_url=row.get("duong_dan_anh"), images=[{
            "media_id": image["ma_media"], "url": image["url"], "alt_text": image.get("alt_text"),
            "position": image["thu_tu"], "primary": image["la_anh_chinh"],
        } for image in images])

    def save_gallery(self, product_id: str, body: GalleryUpdate) -> ProductGallery:
        try:
            result = self.repository.save_gallery(product_id, body.model_dump(mode="json"))
        except APIError as exc:
            if str(exc.code) == "PGRST202":
                raise HTTPException(503, "Backend/database chưa hỗ trợ lưu nhiều ảnh. Cần chạy migration product_gallery.") from None
            if str(exc.code) == "PT404":
                raise HTTPException(404, "Không tìm thấy sản phẩm.") from None
            if str(exc.code) == "PT409":
                raise HTTPException(409, "Gallery đã thay đổi ở nơi khác. Hãy tải lại ảnh trước khi lưu.") from None
            if str(exc.code) == "PT422":
                raise HTTPException(422, "Ảnh bị trùng, không tồn tại, là avatar hoặc thuộc sản phẩm khác.") from None
            raise
        return ProductGallery.model_validate(result)

    def store_avatar(self, data: bytes, content_type: str, account_id: str) -> UploadedImage:
        uploaded = store_image(data, content_type, self.repository, "avatars")
        try:
            if not self.repository.set_avatar(account_id, uploaded.media_id):
                raise RuntimeError("Account avatar update returned no row")
        except (APIError, RuntimeError):
            try:
                self.repository.unregister(uploaded.media_id)
                self.repository.remove(uploaded.bucket, uploaded.path)
            except (APIError, StorageException):
                logger.error("Could not roll back unlinked avatar media_id=%s", uploaded.media_id)
            raise HTTPException(503, "Không gán được ảnh đại diện cho tài khoản.") from None
        return uploaded
