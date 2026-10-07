from decimal import Decimal
from enum import Enum
from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field, field_serializer, field_validator, model_validator


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


class StockStatus(str, Enum):
    IN_STOCK = "in-stock"
    OUT_OF_STOCK = "out-of-stock"


class CatalogQuery(BaseModel):
    model_config = ConfigDict(extra="forbid")

    q: str | None = Field(default=None, max_length=100, description="Tìm chuỗi trong tên hoặc SKU, không phân biệt hoa/thường; ký tự đặc biệt được tìm nguyên văn.")
    category_id: list[Identifier] = Field(default_factory=list, max_length=20, description="Mã LOAI_SP; lặp tham số để chọn nhiều loại. Các loại được kết hợp bằng OR.")
    brand: str | None = Field(default=None, max_length=100, description="Giá trị thuong_hieu từ /api/catalog/brands; so khớp chính xác.")
    min_price: Decimal | None = Field(default=None, ge=0, max_digits=18, decimal_places=2, description="Giá thấp nhất, bao gồm mức này; giá trước thuế.")
    max_price: Decimal | None = Field(default=None, ge=0, max_digits=18, decimal_places=2, description="Giá cao nhất, bao gồm mức này; phải >= min_price.")
    color: str | None = Field(default=None, max_length=100, description="Màu từ thông số sản phẩm, không phân biệt hoa/thường. __unspecified__ chọn sản phẩm chưa ghi màu.")
    stock_status: StockStatus | None = Field(default=None, description="Còn/hết hàng khả dụng trong kho hoạt động, sau lượng giữ của đơn MOI/XAC_NHAN/DANG_CHUAN_BI; kiểm tra lại khi checkout.")
    page: int = Field(default=1, ge=1, le=2_147_483_647)
    page_size: int = Field(default=20, ge=1, le=100)
    sort: CatalogSort = Field(default=CatalogSort.DEFAULT, description="Mặc định theo mã sản phẩm; giá bằng nhau được sắp tiếp theo mã sản phẩm.")

    @field_validator("q", "brand", "color", mode="before")
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

    @model_validator(mode="after")
    def valid_price_range(self):
        if self.min_price is not None and self.max_price is not None and self.min_price > self.max_price:
            raise ValueError("Giá thấp nhất không được lớn hơn giá cao nhất.")
        return self


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
        "id": "SP001", "sku": "MSI-001", "name": "Laptop MSI Modern",
        "category": {"id": "LAPTOP", "name": "Laptop"}, "brand": "MSI",
        "price": "15990000.00", "currency": "VND", "description": "Laptop học tập",
        "unit": "Cai", "warranty_months": 24,
        "images": [{"url": "https://example.com/msi.jpg", "alt": "Laptop MSI Modern"}],
        "specifications": [{"label": "RAM", "value": "16 GB"}],
        "specifications_text": "RAM: 16 GB",
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
    color: str | None = None
    stock_status: StockStatus | None = Field(default=None, description="Trả trạng thái khả dụng khi dùng bộ lọc tồn kho; null khi chưa kiểm tra tồn.")

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


class ColorOption(BaseModel):
    value: str
    label: str


class ColorList(BaseModel):
    items: list[ColorOption]


class ErrorDetail(BaseModel):
    field: str
    message: str


class ErrorBody(BaseModel):
    code: str
    message: str
    details: list[ErrorDetail] = Field(default_factory=list)


class ErrorResponse(BaseModel):
    error: ErrorBody
