"""Catalog use cases and public formatting, independent of the HTTP transport."""
from decimal import Decimal
from datetime import datetime, timedelta, timezone
import json
import os
import re
import unicodedata
from urllib.parse import urlsplit
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from phub_api.models.errors import CatalogError, OrderError
from phub_api.repositories.catalog import CatalogRepository
from phub_api.schemas.catalog import (
    Brand,
    CatalogBanner,
    CatalogProduct,
    CatalogQuery,
    Category,
    CategoryTree,
    ColorOption,
    Pagination,
    ProductImage,
    ProductPage,
    ProductAvailability,
    Specification,
    StockStatus,
    Subcategory,
    clean_text,
)
from phub_api.services.catalog_availability import available_skus, available_quantities
from phub_api.config.orders import OrderSettings
from phub_api.services.catalog_facets import build_facets, filter_products

COMPONENT_REF_PATTERN = re.compile(r"^(?:(\d+)x\s+)?((?:L_LINHKIEN_|SP|SEED_SP)\w+)$")


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

    def availability(self, skus):
        try:
            settings = OrderSettings.from_env()
        except OrderError as exc:
            raise CatalogError(exc.status_code, exc.code, exc.message) from None
        quantities = available_quantities(self.repository, self.repository.public_skus(skus))
        return {"items": [{"sku": sku, "available_quantity": min(quantity, 2147483647)}
                          for sku, quantity in sorted(quantities.items())],
                "tax_rate": format(settings.tax_rate, ".2f"), "currency": settings.currency}

    def list_banners(self) -> list[CatalogBanner]:
        # Promotion timestamps are local wall times, matching checkout rules.
        zone_name = os.getenv("CHECKOUT_PROMOTION_TIMEZONE", "Asia/Ho_Chi_Minh")
        try:
            zone = ZoneInfo(zone_name)
        except ZoneInfoNotFoundError:
            # Windows may have no IANA database. Current Vietnam wall time is UTC+7.
            if zone_name not in {"Asia/Ho_Chi_Minh", "Asia/Saigon", "Asia/Bangkok"}:
                raise CatalogError(503, "DATA_SERVICE_UNAVAILABLE", "Chưa cấu hình múi giờ khuyến mãi hợp lệ.") from None
            zone = timezone(timedelta(hours=7))
        now = datetime.now(zone).replace(tzinfo=None)
        result = []
        for row in self.repository.banners(now.isoformat()):
            media = row.get("banner")
            if not isinstance(media, dict) or not media.get("url"):
                continue
            try:
                url = urlsplit(media["url"])
                valid_url = url.scheme in {"https", "http"} and bool(url.hostname) and not url.username and not url.password
            except (ValueError, TypeError):
                valid_url = False
            if not valid_url:
                continue
            title = clean_text(row["ten_chuong_trinh"])
            result.append(CatalogBanner(id=row["ma_ctkm"], title=title, image_url=media["url"],
                alt_text=clean_text(media.get("alt_text") or title),
                width=media.get("chieu_rong"), height=media.get("chieu_cao")))
        return result

    def resolve_component_specs(self, products: list[CatalogProduct]) -> list[CatalogProduct]:
        ref_ids = set()
        for product in products:
            for spec in product.specifications:
                match = COMPONENT_REF_PATTERN.match(spec.value.strip())
                if match:
                    ref_ids.add(match.group(2))
        if not ref_ids:
            return products
        names = self.repository.component_names(list(ref_ids))
        if not names:
            return products
        for product in products:
            resolved_lines = []
            changed = False
            for spec in product.specifications:
                match = COMPONENT_REF_PATTERN.match(spec.value.strip())
                if match and match.group(2) in names:
                    qty = match.group(1)
                    comp_name = names[match.group(2)]
                    spec.value = f"{qty}x {comp_name}" if qty else comp_name
                    changed = True
                resolved_lines.append(f"{spec.label}: {spec.value}")
            if changed:
                product.specifications_text = "\n".join(resolved_lines)
        return products

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
        if filters.color or filters.stock_status or filters.spec:
            products = [self.product_from_row(row) for row in self.repository.products(filters)]
            if filters.spec:
                products = filter_products(self.resolve_component_specs(products), filters.spec)
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
            items = self.resolve_component_specs(products[start:start + filters.page_size])
        else:
            rows, total = self.repository.page(filters)
            if total is None:
                raise RuntimeError("Catalog exact count missing")
            items = self.resolve_component_specs([self.product_from_row(row) for row in rows])
        return ProductPage(items=items, pagination=Pagination(
            page=filters.page, page_size=filters.page_size, total=total,
            total_pages=(total + filters.page_size - 1) // filters.page_size,
        ))

    def facets(self, filters: CatalogQuery):
        scope = filters.model_copy(update={"brand": None, "min_price": None, "max_price": None, "color": None, "stock_status": None, "spec": []})
        products = self.resolve_component_specs([self.product_from_row(row) for row in self.repository.products(scope)])
        available = available_skus(self.repository, [product.sku for product in products]) if filters.stock_status else None
        return build_facets(products, filters, available)

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
        return self.resolve_component_specs([self.product_from_row(row)])[0]

    def check_availability(self, product_id: str, quantity: int) -> ProductAvailability:
        product = self.get_product(product_id)
        available = available_quantities(self.repository, [product.sku]).get(product.sku, 0)
        return ProductAvailability(id=product.id, sku=product.sku, quantity=quantity, available=available >= quantity)

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
