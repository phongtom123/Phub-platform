from uuid import UUID
from urllib.parse import urlsplit

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


class UploadedImage(BaseModel):
    media_id: str
    bucket: str
    path: str
    url: str
    content_type: str
    size: int
    width: int
    height: int


class GalleryItem(BaseModel):
    model_config = ConfigDict(extra="forbid")
    media_id: UUID | None = None
    url: str | None = Field(default=None, min_length=1, max_length=2000)

    @field_validator("url")
    @classmethod
    def image_url(cls, value):
        if value is None:
            return value
        value = value.strip()
        if not value or any(ord(char) < 32 for char in value) or "\\" in value:
            raise ValueError("URL ảnh không hợp lệ.")
        parsed = urlsplit(value)
        relative = value.startswith("/") and not value.startswith("//")
        if not relative and not (parsed.scheme in {"http", "https"} and parsed.hostname and not parsed.username and not parsed.password):
            raise ValueError("Dùng URL http/https hoặc đường dẫn bắt đầu bằng /.")
        return value

    @model_validator(mode="after")
    def exactly_one_source(self):
        if (self.media_id is None) == (self.url is None):
            raise ValueError("Mỗi ảnh phải có đúng một media_id hoặc URL.")
        return self


class GalleryUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    items: list[GalleryItem] = Field(max_length=20)
    expected_ids: list[UUID] = Field(max_length=1000)
    expected_legacy_url: str | None = Field(max_length=2000)

    @model_validator(mode="after")
    def unique_sources(self):
        sources = [(item.media_id, item.url) for item in self.items]
        if len(set(sources)) != len(sources):
            raise ValueError("Không được thêm ảnh trùng lặp.")
        return self


class GalleryImage(BaseModel):
    media_id: UUID
    url: str
    alt_text: str | None = None
    position: int
    primary: bool


class ProductGallery(BaseModel):
    product_id: str
    legacy_url: str | None
    images: list[GalleryImage]
