import json
import re
import unicodedata
from decimal import Decimal

from postgrest.exceptions import APIError
from supabase import Client
from .availability import available_skus, rows as all_rows

from .schemas import (
    Brand, CatalogProduct, CatalogQuery, CatalogSort, Category,
    Pagination, ProductImage, ProductPage, Specification, ColorOption, StockStatus,
)


# Explicit public columns. Cast money to text before JSON to avoid float rounding.
PRODUCT_COLUMNS = (
    "ma_sp,sku,ten_sp,thuong_hieu,gia_ban_hien_tai::text,mo_ta,"
    "thong_so_ky_thuat,don_vi,bao_hanh_thang,duong_dan_anh,"
    "category:LOAI_SP!inner(ma_loai_sp,ten_loai_sp,trang_thai)"
)
BATCH_SIZE = 500


def quoted(value: str) -> str:
    """PostgREST quoted literal, including commas, parentheses and backslashes."""
    return json.dumps(value, ensure_ascii=False)


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
        # Do not misinterpret colons inside unsupported/malformed JSON as labels.
        return [Specification(label="Thông số", value=raw)]
    lines = [line.strip() for line in raw.splitlines() if line.strip()]
    pairs = [line.partition(":") for line in lines]
    if pairs and all(separator and label.strip() and value.strip() for label, separator, value in pairs):
        return [Specification(label=label.strip(), value=value.strip()) for label, _, value in pairs]
    return [Specification(label="Thông số", value=raw)]


def product_color(raw):
    specs = specifications_from_text(raw)
    # Mixed free text may contain a standalone color line, without all lines
    # being specifications. Do not invent color from product names or images.
    if isinstance(raw, str) and not raw.lstrip().startswith(("{", "[")):
        specs += [Specification(label=label.strip(), value=value.strip())
                  for label, separator, value in (line.partition(":") for line in raw.splitlines())
                  if separator and label.strip() and value.strip()]
    for spec in specs:
        label = "".join(c for c in unicodedata.normalize("NFD", spec.label.casefold()) if not unicodedata.combining(c))
        if label.strip() in {"mau", "mau sac", "color", "colour"}:
            return spec.value.strip() or None
    return None


class CatalogRepository:
    def __init__(self, client: Client, currency: str = "VND", active_status: int = 1):
        self.client = client
        self.currency = currency
        self.active_status = active_status

    def active_products(self, columns: str, **options):
        # Both product and category must be active. Never expose internal cost.
        return (
            self.client.table("SAN_PHAM").select(columns, **options)
            .eq("trang_thai", self.active_status)
            .eq("category.trang_thai", self.active_status)
        )

    def apply_filters(self, query, filters: CatalogQuery):
        if filters.q:
            # Escaped literal regex avoids LIKE's wildcard aliases %, _ and *.
            pattern = quoted(re.escape(filters.q))
            query = query.or_(f"ten_sp.imatch.{pattern},sku.imatch.{pattern}")
        if filters.category_id:
            values = ",".join(quoted(value) for value in filters.category_id)
            query = query.filter("ma_loai_sp", "in", f"({values})")
        if filters.brand:
            query = query.eq("thuong_hieu", filters.brand)
        if filters.min_price is not None:
            query = query.gte("gia_ban_hien_tai", str(filters.min_price))
        if filters.max_price is not None:
            query = query.lte("gia_ban_hien_tai", str(filters.max_price))
        return query

    def product_from_row(self, row: dict) -> CatalogProduct:
        category = row["category"]
        raw_specs = row.get("thong_so_ky_thuat")
        image = row.get("duong_dan_anh")
        return CatalogProduct(
            id=row["ma_sp"], sku=row["sku"], name=row["ten_sp"],
            category=Category(id=category["ma_loai_sp"], name=category["ten_loai_sp"]),
            brand=row.get("thuong_hieu"), price=Decimal(str(row["gia_ban_hien_tai"])),
            currency=self.currency, description=row.get("mo_ta"), unit=row["don_vi"],
            warranty_months=row["bao_hanh_thang"],
            images=[ProductImage(url=image.strip(), alt=row["ten_sp"])] if image and image.strip() else [],
            specifications=specifications_from_text(raw_specs), specifications_text=raw_specs,
            color=product_color(raw_specs),
        )

    def list_products(self, filters: CatalogQuery) -> ProductPage:
        def product_query():
            query = self.apply_filters(self.active_products(PRODUCT_COLUMNS, count="exact"), filters)
            if filters.sort != CatalogSort.DEFAULT:
                query = query.order("gia_ban_hien_tai", desc=filters.sort == CatalogSort.PRICE_DESC)
            return query.order("ma_sp")
        query = product_query()
        if filters.color or filters.stock_status:
            # Existing schema has no color/available-stock columns. Read every
            # matching row in stable batches BEFORE filtering and pagination.
            products = [self.product_from_row(row) for row in all_rows(product_query)]
            if filters.color:
                products = [product for product in products if
                            (product.color is None if filters.color == "__unspecified__" else
                             product.color is not None and product.color.casefold() == filters.color.casefold())]
            if filters.stock_status:
                available = available_skus(self.client, [product.sku for product in products], self.active_status)
                for product in products:
                    product.stock_status = StockStatus.IN_STOCK if product.sku in available else StockStatus.OUT_OF_STOCK
                products = [product for product in products if product.stock_status == filters.stock_status]
            total = len(products)
            start = (filters.page - 1) * filters.page_size
            return ProductPage(items=products[start:start + filters.page_size], pagination=Pagination(
                page=filters.page, page_size=filters.page_size, total=total,
                total_pages=(total + filters.page_size - 1) // filters.page_size))
        start = (filters.page - 1) * filters.page_size
        try:
            response = query.range(start, start + filters.page_size - 1).execute()
            rows, total = response.data, response.count
        except APIError as exc:
            if exc.code != "PGRST103":
                raise
            # PostgREST may return 416 for offsets past the filtered result set.
            count_query = self.apply_filters(
                self.active_products("ma_sp,category:LOAI_SP!inner(trang_thai)", count="exact", head=True), filters,
            )
            rows, total = [], count_query.execute().count
        if total is None:
            raise RuntimeError("Catalog exact count missing")
        return ProductPage(
            items=[self.product_from_row(row) for row in rows],
            pagination=Pagination(
                page=filters.page, page_size=filters.page_size, total=total,
                total_pages=(total + filters.page_size - 1) // filters.page_size,
            ),
        )

    def get_product(self, product_id: str) -> CatalogProduct | None:
        rows = self.active_products(PRODUCT_COLUMNS).eq("ma_sp", product_id).limit(1).execute().data
        return self.product_from_row(rows[0]) if rows else None

    def list_categories(self) -> list[Category]:
        items = []
        start = 0
        while True:
            rows = (
                self.client.table("LOAI_SP").select("ma_loai_sp,ten_loai_sp")
                .eq("trang_thai", self.active_status).order("ma_loai_sp")
                .range(start, start + BATCH_SIZE - 1).execute().data
            )
            items.extend(Category(id=row["ma_loai_sp"], name=row["ten_loai_sp"]) for row in rows)
            if len(rows) < BATCH_SIZE:
                return items
            start += BATCH_SIZE

    def list_brands(self) -> list[Brand]:
        # No brand table exists. Read all public brand strings, not just the first
        # Supabase result page, then deduplicate without any schema change/RPC.
        names = set()
        start = 0
        while True:
            rows = (
                self.active_products("ma_sp,thuong_hieu,category:LOAI_SP!inner(trang_thai)")
                .order("ma_sp").range(start, start + BATCH_SIZE - 1).execute().data
            )
            names.update(row["thuong_hieu"] for row in rows if row.get("thuong_hieu") and row["thuong_hieu"].strip())
            if len(rows) < BATCH_SIZE:
                return [Brand(name=name) for name in sorted(names, key=lambda name: (name.casefold(), name))]
            start += BATCH_SIZE

    def list_colors(self) -> list[ColorOption]:
        names = {}
        unknown = False
        for row in all_rows(lambda: self.active_products("ma_sp,thong_so_ky_thuat,category:LOAI_SP!inner(trang_thai)").order("ma_sp")):
            color = product_color(row.get("thong_so_ky_thuat"))
            if color:
                names.setdefault(color.casefold(), color)
            else:
                unknown = True
        options = [ColorOption(value=value, label=value) for _, value in sorted(names.items())]
        if unknown:
            options.append(ColorOption(value="__unspecified__", label="Chưa có thông tin màu sắc"))
        return options
