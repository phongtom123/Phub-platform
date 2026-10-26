"""Public availability derived from existing tables; no database writes or DDL."""
import json
from collections import defaultdict
from postgrest.exceptions import APIError

BATCH_SIZE = 500
SKU_BATCH_SIZE = 50
RESERVING_STATUSES = ("MOI", "XAC_NHAN", "DANG_CHUAN_BI")


def rows(query_factory):
    start = 0
    while True:
        try:
            # SDK builders mutate their query parameters; rebuild each page.
            batch = query_factory().range(start, start + BATCH_SIZE - 1).execute().data
        except APIError as exc:
            if exc.code == "PGRST103" and start > 0:
                return
            raise
        yield from batch
        if len(batch) < BATCH_SIZE:
            return
        start += BATCH_SIZE


def available_skus(client, skus, active_status):
    available = set()
    identifiers = sorted(set(skus))
    for start in range(0, len(identifiers), SKU_BATCH_SIZE):
        values = "(" + ",".join(json.dumps(sku, ensure_ascii=False) for sku in identifiers[start:start + SKU_BATCH_SIZE]) + ")"
        reserved = defaultdict(int)
        def reservation_query():
            return (client.table("CT_DON_HANG")
                 .select("sku,ma_kho_xuat,so_luong,order:DON_HANG!inner(trang_thai)")
                 .filter("sku", "in", values).in_("order.trang_thai", RESERVING_STATUSES)
                 .order("ma_ct_donhang"))
        for row in rows(reservation_query):
            reserved[(row["sku"], row["ma_kho_xuat"])] += int(row["so_luong"])
        def stock_query():
            return (client.table("TON_KHO").select("sku,ma_kho,so_luong_ton,warehouse:KHO!inner(trang_thai)")
                 .filter("sku", "in", values).eq("warehouse.trang_thai", active_status)
                 .order("ma_kho").order("sku"))
        for row in rows(stock_query):
            if int(row["so_luong_ton"]) - reserved[(row["sku"], row["ma_kho"])] > 0:
                available.add(row["sku"])
    return available
