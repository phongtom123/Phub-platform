"""Availability read model: actual reservation checks remain atomic in checkout RPC."""
from collections import defaultdict
import json

SKU_BATCH_SIZE = 50
RESERVING_STATUSES = ("MOI", "XAC_NHAN", "DANG_CHUAN_BI")


def available_skus(repository, skus):
    available = set()
    identifiers = sorted(set(skus))
    for start in range(0, len(identifiers), SKU_BATCH_SIZE):
        values = "(" + ",".join(json.dumps(sku, ensure_ascii=False) for sku in identifiers[start:start + SKU_BATCH_SIZE]) + ")"
        reserved = defaultdict(int)
        for row in repository.reservations(values, RESERVING_STATUSES):
            reserved[(row["sku"], row["ma_kho_xuat"])] += int(row["so_luong"])
        for row in repository.stock(values):
            if int(row["so_luong_ton"]) - reserved[(row["sku"], row["ma_kho"])] > 0:
                available.add(row["sku"])
    return available
