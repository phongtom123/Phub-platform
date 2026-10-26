"""Catalog use cases and public formatting, independent of the HTTP transport."""
from decimal import Decimal
import json
import unicodedata

from phub_api.models.errors import CatalogError
from phub_api.repositories.catalog import CatalogRepository
from phub_api.schemas.catalog import (
    Brand,
    CatalogProduct,
    CatalogQuery,
    Category,
    CategoryTree,
    ColorOption,
    Pagination,
    ProductImage,
    ProductPage,
    Specification,
    StockStatus,
    Subcategory,
    clean_text,
)
from phub_api.services.catalog_availability import available_skus

def specifications_from_text(raw: str | None) -> list[Specification]:
    if not raw or not raw.strip():
        return []
    try:
        parsed = json.loads(raw)
    except (ValueError, TypeError):
        parsed = None
    if isinstance(parsed, (dict, list)) and not parsed:
        return []
    if isinstance(parsed, dict) and parsed and all(isinstance(v, (str, int, float, bool)) for v in parsed.values()):
        return [Specification(label=str(key), value=str(value)) for key, value in parsed.items()]
    if isinstance(parsed, list) and parsed and all(
        isinstance(item, dict) and isinstance(item.get("label"), str) and isinstance(item.get("value"), str)
        for item in parsed
    ):
        return [Specification(label=item["label"], value=item["value"]) for item in parsed]
    if parsed is not None or raw.lstrip().startswith(("{", "[")):
        return [Specification(label="Thông số", value=raw)]
    lines = [line.strip() for line in raw.splitlines() if line.strip()]
    pairs = [line.partition(":") for line in lines]
    if pairs and all(separator and label.strip() and value.strip() for label, separator, value in pairs):
        return [Specification(label=label.strip(), value=value.strip()) for label, _, value in pairs]
    return [Specification(label="Thông số", value=raw)]


def product_color(raw):
    specs = specifications_from_text(raw)
    if isinstance(raw, str) and not raw.lstrip().startswith(("{", "[")):
        specs += [Specification(label=label.strip(), value=value.strip())
                  for label, separator, value in (line.partition(":") for line in raw.splitlines())
                  if separator and label.strip() and value.strip()]
    for spec in specs:
        label = "".join(c for c in unicodedata.normalize("NFD", spec.label.casefold()) if not unicodedata.combining(c))
        if label.strip() in {"mau", "mau sac", "color", "colour"}:
            return spec.value.strip() or None
    return None



class CatalogService:
    def __init__(self, repository: CatalogRepository):
        self.repository = repository
        self.currency = repository.currency

    def product_from_row(self, row: dict) -> CatalogProduct:
        category = row["category"]
        subcategory = row["subcategory"]
        raw_specs = row.get("thong_so_ky_thuat")
        images = []
        seen_urls = set()
        media_rows = row.get("product_media")
        if isinstance(media_rows, list):
            media_rows = sorted(
                media_rows,
                key=lambda media: (
                    not bool(media.get("la_anh_chinh")),
                    media.get("thu_tu") if isinstance(media.get("thu_tu"), int) else 2_147_483_647,
                    str(media.get("ma_media", "")),
                ),
            )
            for media in media_rows:
                if not isinstance(media, dict):
                    continue
                url = media.get("url")
                if not isinstance(url, str) or not url.strip() or url.strip() in seen_urls:
                    continue
                url = url.strip()
                seen_urls.add(url)
                alt = media.get("alt_text")
                images.append(ProductImage(url=url, alt=alt.strip() if isinstance(alt, str) and alt.strip() else row["ten_sp"]))
        legacy_image = row.get("duong_dan_anh")
        if not images and isinstance(legacy_image, str) and legacy_image.strip():
            images.append(ProductImage(url=legacy_image.strip(), alt=row["ten_sp"]))
        return CatalogProduct(
            id=row["ma_sp"], sku=row["sku"], name=row["ten_sp"],
            category=Category(id=category["ma_loai_sp"], name=category["ten_loai_sp"]),
            subcategory=Subcategory(id=subcategory["ma_loai_sp_con"], name=subcategory["ten_loai_sp_con"]),
            brand=row.get("thuong_hieu"), price=Decimal(str(row["gia_ban_hien_tai"])),
            currency=self.currency, description=row.get("mo_ta"), unit=row["don_vi"],
            warranty_months=row["bao_hanh_thang"],
            images=images,
            specifications=specifications_from_text(raw_specs), specifications_text=raw_specs,
            color=product_color(raw_specs),
        )

    def list_products(self, filters: CatalogQuery) -> ProductPage:
        if filters.color or filters.stock_status:
            products = [self.product_from_row(row) for row in self.repository.products(filters)]
            if filters.color:
                products = [product for product in products if
                            (product.color is None if filters.color == "__unspecified__" else
                             product.color is not None and product.color.casefold() == filters.color.casefold())]
            if filters.stock_status:
                available = available_skus(self.repository, [product.sku for product in products])
                for product in products:
                    product.stock_status = StockStatus.IN_STOCK if product.sku in available else StockStatus.OUT_OF_STOCK
                products = [product for product in products if product.stock_status == filters.stock_status]
            total = len(products)
            start = (filters.page - 1) * filters.page_size
            items = products[start:start + filters.page_size]
        else:
            rows, total = self.repository.page(filters)
            if total is None:
                raise RuntimeError("Catalog exact count missing")
            items = [self.product_from_row(row) for row in rows]
        return ProductPage(items=items, pagination=Pagination(
            page=filters.page, page_size=filters.page_size, total=total,
            total_pages=(total + filters.page_size - 1) // filters.page_size,
        ))

    def get_product(self, product_id: str) -> CatalogProduct:
        try:
            identifier = clean_text(product_id)
        except ValueError:
            raise CatalogError(422, "VALIDATION_ERROR", "Mã sản phẩm không hợp lệ.") from None
        if not identifier:
            raise CatalogError(422, "VALIDATION_ERROR", "Mã sản phẩm không hợp lệ.")
        row = self.repository.find(identifier)
        if row is None:
            raise CatalogError(404, "PRODUCT_NOT_FOUND", "Không tìm thấy sản phẩm.")
        return self.product_from_row(row)

    def list_categories(self) -> list[CategoryTree]:
        parents, children = self.repository.categories()
        children_by_parent = {}
        for row in children:
            children_by_parent.setdefault(row["ma_loai_sp"], []).append(
                Subcategory(id=row["ma_loai_sp_con"], name=row["ten_loai_sp_con"]))
        return [CategoryTree(id=row["ma_loai_sp"], name=row["ten_loai_sp"],
                             children=children_by_parent.get(row["ma_loai_sp"], [])) for row in parents]

    def list_brands(self) -> list[Brand]:
        names = {row["thuong_hieu"] for row in self.repository.brand_rows()
                 if row.get("thuong_hieu") and row["thuong_hieu"].strip()}
        return [Brand(name=name) for name in sorted(names, key=lambda name: (name.casefold(), name))]

    def list_colors(self) -> list[ColorOption]:
        names, unknown = {}, False
        for row in self.repository.specification_rows():
            color = product_color(row.get("thong_so_ky_thuat"))
            if color:
                names.setdefault(color.casefold(), color)
            else:
                unknown = True
        options = [ColorOption(value=value, label=value) for _, value in sorted(names.items())]
        if unknown:
            options.append(ColorOption(value="__unspecified__", label="Chưa có thông tin màu sắc"))
        return options

    def legacy_products(self):
        return [{key: value for key, value in row.items() if key != "category"}
                for row in self.repository.legacy_products()]
