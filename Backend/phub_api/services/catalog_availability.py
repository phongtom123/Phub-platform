"""Availability read model: actual reservation checks remain atomic in checkout RPC."""
from collections import defaultdict
import json

SKU_BATCH_SIZE = 50
RESERVING_STATUSES = ("MOI", "XAC_NHAN", "DANG_CHUAN_BI")


def available_skus(repository, skus):
    return {sku for sku, quantity in available_quantities(repository, skus).items() if quantity > 0}


def stock_breakdown(stock_rows, reservation_rows):
    """Per SKU in active warehouses: physical units, units held by reserving orders, available units.

    A line holds stock only while its order is reserving and already has an invoice or a
    successful THU payment; stock rows must already be limited to active warehouses."""
    reserved = defaultdict(int)
    for row in reservation_rows:
        order = row.get("order")
        if not isinstance(order, dict):
            raise ValueError("Missing stock reservation evidence")
        if order.get("invoice") or order.get("payments"):
            reserved[(row["sku"], row["ma_kho_xuat"])] += int(row["so_luong"])
    result = {}
    for row in stock_rows:
        physical = int(row["so_luong_ton"])
        held = min(physical, reserved[(row["sku"], row["ma_kho"])])
        entry = result.setdefault(row["sku"], {"physical": 0, "held": 0, "available": 0})
        entry["physical"] += physical
        entry["held"] += held
        entry["available"] += physical - held
    return result


def available_quantities(repository, skus):
    available = dict.fromkeys(skus, 0)
    identifiers = sorted(set(skus))
    for start in range(0, len(identifiers), SKU_BATCH_SIZE):
        values = "(" + ",".join(json.dumps(sku, ensure_ascii=False) for sku in identifiers[start:start + SKU_BATCH_SIZE]) + ")"
        reservations = list(repository.reservations(values, RESERVING_STATUSES))
        breakdown = stock_breakdown(repository.stock(values), reservations)
        for sku, entry in breakdown.items():
            if sku in available:
                available[sku] += entry["available"]
    return available
