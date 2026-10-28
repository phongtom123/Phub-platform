"""Catalog projections and database filters; public formatting is in CatalogService."""
import json
import re

from postgrest.exceptions import APIError

from phub_api.models.resources import public_columns
from phub_api.repositories.pagination import rows as all_rows
from phub_api.schemas.catalog import CatalogQuery, CatalogSort

PRODUCT_COLUMNS = (
    "ma_sp,sku,ten_sp,thuong_hieu,gia_ban_hien_tai::text,mo_ta,"
    "thong_so_ky_thuat,don_vi,bao_hanh_thang,duong_dan_anh,ma_loai_sp_con,"
    "category:LOAI_SP!inner(ma_loai_sp,ten_loai_sp,trang_thai),"
    "subcategory:LOAI_SP_CON!SAN_PHAM_loai_sp_con_fkey!inner(ma_loai_sp_con,ten_loai_sp_con,trang_thai),"
    "product_media:MEDIA!MEDIA_product_fkey(ma_media,url,alt_text,thu_tu,la_anh_chinh)"
)
BATCH_SIZE = 500


def quoted(value: str) -> str:
    return json.dumps(value, ensure_ascii=False)


class CatalogRepository:
    def __init__(self, client, currency="VND", active_status=1):
        self.client, self.currency, self.active_status = client, currency, active_status

    def active_products(self, columns: str, **options):
        return (
            self.client.table("SAN_PHAM").select(columns, **options)
            .eq("trang_thai", self.active_status)
            .eq("category.trang_thai", self.active_status)
            .eq("subcategory.trang_thai", self.active_status)
        )

    def apply_filters(self, query, filters: CatalogQuery):
        if filters.q:
            pattern = quoted(re.escape(filters.q))
            query = query.or_(f"ten_sp.imatch.{pattern},sku.imatch.{pattern}")
        category_values = ",".join(quoted(value) for value in filters.category_id)
        subcategory_values = ",".join(quoted(value) for value in filters.subcategory_id)
        if category_values and subcategory_values:
            query = query.or_(
                f"ma_loai_sp.in.({category_values}),ma_loai_sp_con.in.({subcategory_values})"
            )
        elif category_values:
            query = query.filter("ma_loai_sp", "in", f"({category_values})")
        elif subcategory_values:
            query = query.filter("ma_loai_sp_con", "in", f"({subcategory_values})")
        if filters.brand:
            query = query.eq("thuong_hieu", filters.brand)
        if filters.min_price is not None:
            query = query.gte("gia_ban_hien_tai", str(filters.min_price))
        if filters.max_price is not None:
            query = query.lte("gia_ban_hien_tai", str(filters.max_price))
        return query

    def product_query(self, filters: CatalogQuery):
        query = self.apply_filters(self.active_products(PRODUCT_COLUMNS, count="exact"), filters)
        if filters.sort != CatalogSort.DEFAULT:
            query = query.order("gia_ban_hien_tai", desc=filters.sort == CatalogSort.PRICE_DESC)
        return query.order("ma_sp")

    def products(self, filters: CatalogQuery):
        return list(all_rows(lambda: self.product_query(filters)))

    def page(self, filters: CatalogQuery):
        start = (filters.page - 1) * filters.page_size
        try:
            response = self.product_query(filters).range(start, start + filters.page_size - 1).execute()
            return response.data, response.count
        except APIError as exc:
            if exc.code != "PGRST103":
                raise
            query = self.apply_filters(self.active_products(
                "ma_sp,category:LOAI_SP!inner(trang_thai),subcategory:LOAI_SP_CON!SAN_PHAM_loai_sp_con_fkey!inner(trang_thai)",
                count="exact", head=True,
            ), filters)
            return [], query.execute().count

    def find(self, identifier):
        rows = self.active_products(PRODUCT_COLUMNS).eq("ma_sp", identifier).limit(1).execute().data
        return rows[0] if rows else None

    def categories(self):
        def parents():
            return self.client.table("LOAI_SP").select("ma_loai_sp,ten_loai_sp").eq("trang_thai", self.active_status).order("ma_loai_sp")
        def children():
            return (self.client.table("LOAI_SP_CON").select("ma_loai_sp_con,ten_loai_sp_con,ma_loai_sp")
                    .eq("trang_thai", self.active_status).order("ma_loai_sp").order("ten_loai_sp_con"))
        return list(all_rows(parents)), list(all_rows(children))

    def brand_rows(self):
        return all_rows(lambda: self.active_products(
            "ma_sp,thuong_hieu,category:LOAI_SP!inner(trang_thai),subcategory:LOAI_SP_CON!SAN_PHAM_loai_sp_con_fkey!inner(trang_thai)"
        ).order("ma_sp"))

    def specification_rows(self):
        return all_rows(lambda: self.active_products(
            "ma_sp,thong_so_ky_thuat,category:LOAI_SP!inner(trang_thai),subcategory:LOAI_SP_CON!SAN_PHAM_loai_sp_con_fkey!inner(trang_thai)"
        ).order("ma_sp"))

    def reservations(self, values, statuses):
        return all_rows(lambda: self.client.table("CT_DON_HANG")
            .select("sku,ma_kho_xuat,so_luong,order:DON_HANG!inner(trang_thai)")
            .filter("sku", "in", values).in_("order.trang_thai", statuses).order("ma_ct_donhang"))

    def stock(self, values):
        return all_rows(lambda: self.client.table("TON_KHO")
            .select("sku,ma_kho,so_luong_ton,warehouse:KHO!inner(trang_thai)")
            .filter("sku", "in", values).eq("warehouse.trang_thai", self.active_status)
            .order("ma_kho").order("sku"))

    def legacy_products(self):
        columns = [c["name"] + ("::text" if c["type"].startswith("decimal") else "") for c in public_columns("products")]
        return (self.client.table("SAN_PHAM").select(",".join(columns) + ",category:LOAI_SP!inner(trang_thai)")
                .eq("trang_thai", 1).eq("category.trang_thai", 1).order("ma_sp").limit(20).execute().data)
