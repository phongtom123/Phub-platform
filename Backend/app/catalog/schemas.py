from decimal import Decimal
from enum import Enum
from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field, field_serializer, field_validator


def clean_text(value: str) -> str:
    value = value.strip()
    if any(ord(char) < 32 or ord(char) == 127 for char in value):
        raise ValueError("Không được chứa ký tự điều khiển.")
    return value


Identifier = Annotated[str, Field(min_length=1, max_length=100)]


class CatalogSort(str, Enum):
    DEFAULT = "default"
    PRICE_ASC = "price-asc"
    PRICE_DESC = "price-desc"


class CatalogQuery(BaseModel):
    model_config = ConfigDict(extra="forbid")

    q: str | None = Field(default=None, max_length=100, description="Tìm chuỗi trong tên hoặc SKU, không phân biệt hoa/thường; ký tự đặc biệt được tìm nguyên văn.")
    category_id: list[Identifier] = Field(default_factory=list, max_length=20, description="Mã LOAI_SP; lặp tham số để chọn nhiều loại. Các loại được kết hợp bằng OR.")
    brand: str | None = Field(default=None, max_length=100, description="Giá trị thuong_hieu từ /api/catalog/brands; so khớp chính xác.")
    page: int = Field(default=1, ge=1, le=2_147_483_647)
    page_size: int = Field(default=20, ge=1, le=100)
    sort: CatalogSort = Field(default=CatalogSort.DEFAULT, description="Mặc định theo mã sản phẩm; giá bằng nhau được sắp tiếp theo mã sản phẩm.")

    @field_validator("q", "brand", mode="before")
    @classmethod
    def normalize_optional_text(cls, value):
        if isinstance(value, str):
            return clean_text(value) or None
        return value

    @field_validator("category_id", mode="before")
    @classmethod
    def normalize_categories(cls, values):
        if isinstance(values, list):
            return list(dict.fromkeys(clean_text(value) for value in values))
        return values


class Category(BaseModel):
    id: str
    name: str


class Brand(BaseModel):
    name: str


class ProductImage(BaseModel):
    url: str
    alt: str


class Specification(BaseModel):
    label: str
    value: str


class CatalogProduct(BaseModel):
    model_config = ConfigDict(json_schema_extra={"examples": [{
        "id": "SP001", "sku": "INTEL-I5-14400F", "name": "Intel Core i5-14400F",
        "category": {"id": "CPU", "name": "Vi xử lý"}, "brand": "Intel",
        "price": "2500000.00", "currency": "VND", "description": "Vi xử lý cho PC",
        "unit": "Cai", "warranty_months": 36,
        "images": [{"url": "https://example.com/cpu.jpg", "alt": "Intel Core i5-14400F"}],
        "specifications": [{"label": "Socket", "value": "LGA1700"}],
        "specifications_text": "Socket: LGA1700",
    }]})

    id: str
    sku: str
    name: str
    category: Category
    brand: str | None
    price: Decimal = Field(ge=0, max_digits=18, decimal_places=2, description="Giá bán hiện tại; JSON trả chuỗi thập phân, ví dụ 15990000.00.")
    currency: str = Field(pattern=r"^[A-Z]{3}$", description="Mã tiền tệ; mặc định VND, có thể cấu hình CATALOG_CURRENCY.")
    description: str | None
    unit: str
    warranty_months: int = Field(ge=0)
    images: list[ProductImage]
    specifications: list[Specification]
    specifications_text: str | None = Field(description="Nội dung gốc của thong_so_ky_thuat, giữ nguyên khi dữ liệu là văn bản tự do.")

    @field_serializer("price", when_used="json")
    def serialize_price(self, value: Decimal) -> str:
        return format(value, ".2f")


class Pagination(BaseModel):
    page: int
    page_size: int
    total: int = Field(ge=0)
    total_pages: int = Field(ge=0)


class ProductPage(BaseModel):
    model_config = ConfigDict(json_schema_extra={"examples": [{
        "items": [], "pagination": {"page": 1, "page_size": 20, "total": 0, "total_pages": 0},
    }]})

    items: list[CatalogProduct]
    pagination: Pagination


class CategoryList(BaseModel):
    items: list[Category]


class BrandList(BaseModel):
    items: list[Brand]


class ErrorDetail(BaseModel):
    field: str
    message: str


class ErrorBody(BaseModel):
    code: str
    message: str
    details: list[ErrorDetail] = Field(default_factory=list)


class ErrorResponse(BaseModel):
    error: ErrorBody
