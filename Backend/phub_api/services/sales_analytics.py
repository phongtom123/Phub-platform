"""Admin statistics for products, stock and invoices.

Sales figures count invoice lines of orders that are not cancelled (HUY). An invoice is not
proof of payment: payment status comes from successful THU minus successful HOAN_TIEN rows.
Stock uses the same holding rule as checkout (services/catalog_availability.py)."""
from concurrent.futures import ThreadPoolExecutor
import unicodedata
from datetime import date, datetime
from decimal import Decimal

from fastapi import HTTPException

from phub_api.models.user import User
from phub_api.repositories.sales_analytics import SalesAnalyticsRepository
from phub_api.services.catalog_availability import RESERVING_STATUSES, stock_breakdown
from phub_api.services.crm_analytics import VIETNAM_TIMEZONE, format_money, vietnam_today

# Shared and bounded like admin_order_detail: one page load issues its five independent
# reads in parallel (latency-bound, tiny payloads) without exhausting the connection pool.
ANALYTICS_READS = ThreadPoolExecutor(max_workers=5, thread_name_prefix="sales-analytics")

ZERO = Decimal("0")
LOW_STOCK_THRESHOLD = 5
ACTIVE, PAUSED, HIDDEN = 1, 2, 0
OTHER_CATEGORY = ("KHAC", "Khác")
NO_BRAND = "Chưa có thương hiệu"

INVOICE_STATUS_LABELS = {
    "PAID": "Đã thanh toán đủ",
    "PARTIAL": "Thanh toán một phần",
    "UNPAID": "Chưa thanh toán",
    "CANCELLED": "Đơn đã hủy",
}
PAYMENT_METHOD_LABELS = {"TIEN_MAT": "Tiền mặt", "CHUYEN_KHOAN": "Chuyển khoản", "THE": "Thẻ", "VI_DIEN_TU": "Ví điện tử"}
CHANNEL_LABELS = {"ONLINE": "Trực tuyến", "TAI_QUAY": "Tại quầy"}
SOURCE_LABELS = {"TU_DONG": "Tự động khi đặt hàng", "QUAN_TRI": "Nhân viên lập"}
PRICE_RANGES = [
    ("LT_1M", "Dưới 1 triệu", ZERO, Decimal("1000000")),
    ("1M_5M", "1 - 5 triệu", Decimal("1000000"), Decimal("5000000")),
    ("5M_10M", "5 - 10 triệu", Decimal("5000000"), Decimal("10000000")),
    ("10M_20M", "10 - 20 triệu", Decimal("10000000"), Decimal("20000000")),
    ("GTE_20M", "Từ 20 triệu", Decimal("20000000"), None),
]


def money(value) -> Decimal:
    return Decimal(str(value if value not in (None, "") else 0))


def percent(part, whole) -> float:
    return round(float(Decimal(str(part)) / Decimal(str(whole)) * 100), 1) if whole else 0.0


def local_datetime(raw) -> datetime | None:
    if not raw:
        return None
    try:
        value = datetime.fromisoformat(str(raw).replace("Z", "+00:00"))
    except ValueError:
        return None
    # Timestamp-without-timezone columns store Vietnamese local time.
    return (value if value.tzinfo else value.replace(tzinfo=VIETNAM_TIMEZONE)).astimezone(VIETNAM_TIMEZONE)


def period_bucket(value: datetime, period: str) -> tuple[str, str]:
    if period == "quarter":
        quarter = (value.month - 1) // 3 + 1
        return f"{value.year}-Q{quarter}", f"Quý {quarter}/{value.year}"
    if period == "year":
        return f"{value.year}", f"Năm {value.year}"
    return f"{value.year}-{value.month:02d}", f"Tháng {value.month:02d}/{value.year}"


def period_start(value: date, period: str) -> date:
    if period == "year":
        return date(value.year, 1, 1)
    if period == "quarter":
        return date(value.year, (value.month - 1) // 3 * 3 + 1, 1)
    return date(value.year, value.month, 1)


def next_period(value: date, period: str) -> date:
    step = 12 if period == "year" else 3 if period == "quarter" else 1
    month = value.month - 1 + step
    return date(value.year + month // 12, month % 12 + 1, 1)


def continuous_periods(first: date, last: date, period: str):
    """Every bucket from first to last inclusive, so a chart never hides empty periods."""
    current, last = period_start(first, period), period_start(last, period)
    while current <= last:
        yield period_bucket(datetime(current.year, current.month, 1), period)
        current = next_period(current, period)


STATUS_CODES = {"ACTIVE": {ACTIVE}, "PAUSED": {PAUSED}, "HIDDEN": {HIDDEN}, "ALL": {ACTIVE, PAUSED, HIDDEN}}


def search_key(text) -> str:
    """Case- and accent-insensitive search text ("Điện thoại" matches "dien thoai")."""
    decomposed = unicodedata.normalize("NFD", str(text or "").replace("đ", "d").replace("Đ", "D"))
    return "".join(ch for ch in decomposed if not unicodedata.combining(ch)).casefold()


def breakdown(groups: dict, labels: dict, order=None):
    """groups: key -> {"count", "amount"}; ordered by `order` keys first, then amount desc."""
    total_count = sum(item["count"] for item in groups.values())
    total_amount = sum((item["amount"] for item in groups.values()), ZERO)
    keys = [k for k in (order or []) if k in groups] + sorted(
        (k for k in groups if k not in (order or [])), key=lambda k: groups[k]["amount"], reverse=True)
    return [{
        "key": key,
        "label": labels.get(key, key or "Chưa xác định"),
        "count": groups[key]["count"],
        "amount": format_money(groups[key]["amount"]),
        "percentage": percent(groups[key]["count"], total_count),
        "amount_percentage": percent(groups[key]["amount"], total_amount),
    } for key in keys]


class SalesAnalyticsService:
    def __init__(self, repository: SalesAnalyticsRepository, actor: User):
        self.repository = repository
        self.actor = actor

    def product_invoice_insights(self, period: str = "month", start: date | None = None, end: date | None = None):
        if self.actor.role != "ADMIN":
            raise HTTPException(403, "Chỉ quản trị viên mới có quyền xem thống kê sản phẩm và hóa đơn.")
        if start and end and start > end:
            raise HTTPException(422, "Ngày bắt đầu phải trước ngày kết thúc.")

        reads = {
            "products": ANALYTICS_READS.submit(self.repository.products),
            "categories": ANALYTICS_READS.submit(self.repository.categories),
            "stock": ANALYTICS_READS.submit(self.repository.stock),
            "reservations": ANALYTICS_READS.submit(self.repository.reservations, RESERVING_STATUSES),
            "invoices": ANALYTICS_READS.submit(self.repository.invoices, start=start.isoformat() if start else None,
                                               end=end.isoformat() if end else None),
        }
        try:
            products = reads["products"].result() or []
            categories = {c["ma_loai_sp"]: c for c in (reads["categories"].result() or [])}
            stock = stock_breakdown(reads["stock"].result() or [], reads["reservations"].result() or [])
            invoices = reads["invoices"].result() or []
        finally:
            for future in reads.values():
                future.cancel()

        valid = [inv for inv in invoices if (inv.get("order") or {}).get("trang_thai") != "HUY"]
        cancelled = [inv for inv in invoices if (inv.get("order") or {}).get("trang_thai") == "HUY"]
        # Lines and payments arrive embedded in each invoice's order; cancelled orders are ignored.
        lines = [{**line, "ma_donhang": inv["ma_donhang"]} for inv in valid for line in (inv["order"].get("lines") or [])]
        payments = [{**pay, "ma_donhang": inv["ma_donhang"]} for inv in valid for pay in (inv["order"].get("payments") or [])]

        product_by_sku = {p["sku"]: p for p in products}
        category_name = lambda cid: (categories.get(cid) or {}).get("ten_loai_sp") or cid

        # ---- Payments: net collected per order and successful THU by method ----
        net_paid: dict[str, Decimal] = {}
        method_groups: dict[str, dict] = {}
        for pay in payments:
            if pay.get("trang_thai") != "THANH_CONG":
                continue
            amount = money(pay.get("so_tien"))
            oid = pay.get("ma_donhang")
            if pay.get("loai_giao_dich") == "HOAN_TIEN":
                net_paid[oid] = net_paid.get(oid, ZERO) - amount
                continue
            net_paid[oid] = net_paid.get(oid, ZERO) + amount
            group = method_groups.setdefault(pay.get("phuong_thuc") or "", {"count": 0, "amount": ZERO})
            group["count"] += 1
            group["amount"] += amount

        # ---- Line sales per order / sku ----
        order_items: dict[str, int] = {}
        sku_sales: dict[str, dict] = {}
        for line in lines:
            qty = int(line.get("so_luong") or 0)
            revenue = max(ZERO, qty * money(line.get("don_gia")) - money(line.get("giam_gia")) - money(line.get("giam_gia_voucher")))
            sku = line.get("sku") or ""
            order_items[line.get("ma_donhang")] = order_items.get(line.get("ma_donhang"), 0) + qty
            entry = sku_sales.setdefault(sku, {"quantity": 0, "revenue": ZERO, "name": line.get("ten_sp_luc_ban")})
            entry["quantity"] += qty
            entry["revenue"] += revenue

        # ---- Invoices: status, channels, sources, timeline ----
        status_groups: dict[str, dict] = {}
        channel_groups: dict[str, dict] = {}
        source_groups: dict[str, dict] = {}
        timeline: dict[str, dict] = {}
        first_issued = None
        totals = {"total": ZERO, "pre_tax": ZERO, "tax": ZERO, "discount": ZERO, "collected": ZERO, "outstanding": ZERO}

        def add(groups, key, amount):
            group = groups.setdefault(key, {"count": 0, "amount": ZERO})
            group["count"] += 1
            group["amount"] += amount

        for inv in cancelled:
            add(status_groups, "CANCELLED", money(inv.get("tong_tien_sau_thue")))
        for inv in valid:
            oid = inv["ma_donhang"]
            total = money(inv.get("tong_tien_sau_thue"))
            paid = net_paid.get(oid, ZERO)
            status = "PAID" if paid >= total else "PARTIAL" if paid > ZERO else "UNPAID"
            add(status_groups, status, total)
            add(channel_groups, (inv.get("order") or {}).get("kenh_ban") or "", total)
            add(source_groups, inv.get("nguon_lap") or "", total)
            totals["total"] += total
            totals["pre_tax"] += money(inv.get("tong_tien_truoc_thue"))
            totals["tax"] += money(inv.get("tong_tien_thue"))
            totals["discount"] += money(inv.get("tong_tien_giam"))
            totals["collected"] += max(ZERO, paid)
            totals["outstanding"] += max(ZERO, total - paid)

            issued = local_datetime(inv.get("thoi_gian_lap"))
            if issued is None:
                continue
            first_issued = min(first_issued, issued.date()) if first_issued else issued.date()
            key, label = period_bucket(issued, period)
            point = timeline.setdefault(key, {"period": key, "label": label, "invoice_count": 0, "pre_tax": ZERO,
                                              "tax": ZERO, "total": ZERO, "collected": ZERO, "items_sold": 0})
            point["invoice_count"] += 1
            point["pre_tax"] += money(inv.get("tong_tien_truoc_thue"))
            point["tax"] += money(inv.get("tong_tien_thue"))
            point["total"] += total
            point["collected"] += max(ZERO, paid)
            point["items_sold"] += order_items.get(oid, 0)

        items_sold = sum(order_items.values())
        # Every period from the range start (or first invoice) to the range end (or today): empty periods show 0.
        empty = lambda key, label: {"period": key, "label": label, "invoice_count": 0, "pre_tax": ZERO, "tax": ZERO,
                                    "total": ZERO, "collected": ZERO, "items_sold": 0}
        first_period = start or first_issued
        series = [timeline.get(key) or empty(key, label)
                  for key, label in continuous_periods(first_period, end or vietnam_today(), period)] if first_period else []
        status_count = lambda key: status_groups.get(key, {}).get("count", 0)

        # ---- Products, categories, brands ----
        def product_row(sku, product):
            sales = sku_sales.get(sku, {})
            held = stock.get(sku, {})
            cid = (product or {}).get("ma_loai_sp")
            return {
                "sku": sku,
                "name": (product or {}).get("ten_sp") or sales.get("name") or sku,
                "category_name": category_name(cid) if cid else OTHER_CATEGORY[1],
                "brand": (product or {}).get("thuong_hieu") or None,
                "price": format_money(money((product or {}).get("gia_ban_hien_tai"))),
                "quantity_sold": sales.get("quantity", 0),
                "revenue": format_money(sales.get("revenue", ZERO)),
                "available_units": held.get("available", 0),
                "held_units": held.get("held", 0),
            }

        active = [p for p in products if p.get("trang_thai") == ACTIVE]
        available = lambda sku: stock.get(sku, {}).get("available", 0)
        inventory_value = sum((available(p["sku"]) * money(p.get("gia_ban_hien_tai")) for p in active), ZERO)
        total_revenue = sum((s["revenue"] for s in sku_sales.values()), ZERO)

        category_stats: dict[str, dict] = {
            cid: {"category_id": cid, "category_name": c.get("ten_loai_sp") or cid, "product_count": 0, "available_units": 0,
                  "inventory_value": ZERO, "quantity_sold": 0, "revenue": ZERO}
            for cid, c in categories.items() if c.get("trang_thai") == ACTIVE
        }

        def category_entry(cid):
            cid = cid or OTHER_CATEGORY[0]
            return category_stats.setdefault(cid, {
                "category_id": cid, "category_name": category_name(cid) if cid in categories else OTHER_CATEGORY[1],
                "product_count": 0, "available_units": 0, "inventory_value": ZERO, "quantity_sold": 0, "revenue": ZERO})

        brand_stats: dict[str, dict] = {}
        for product in active:
            entry = category_entry(product.get("ma_loai_sp"))
            entry["product_count"] += 1
            entry["available_units"] += available(product["sku"])
            entry["inventory_value"] += available(product["sku"]) * money(product.get("gia_ban_hien_tai"))
            brand = brand_stats.setdefault(product.get("thuong_hieu") or NO_BRAND, {"product_count": 0, "quantity_sold": 0, "revenue": ZERO})
            brand["product_count"] += 1
        for sku, sales in sku_sales.items():
            product = product_by_sku.get(sku) or {}
            entry = category_entry(product.get("ma_loai_sp"))
            entry["quantity_sold"] += sales["quantity"]
            entry["revenue"] += sales["revenue"]
            brand = brand_stats.setdefault(product.get("thuong_hieu") or NO_BRAND, {"product_count": 0, "quantity_sold": 0, "revenue": ZERO})
            brand["quantity_sold"] += sales["quantity"]
            brand["revenue"] += sales["revenue"]

        sold = sorted((sku for sku, s in sku_sales.items() if s["quantity"] > 0),
                      key=lambda sku: (sku_sales[sku]["quantity"], sku_sales[sku]["revenue"]), reverse=True)
        slow = sorted((p for p in active if available(p["sku"]) > 0 and sku_sales.get(p["sku"], {}).get("quantity", 0) == 0),
                      key=lambda p: (available(p["sku"]) * money(p.get("gia_ban_hien_tai")), available(p["sku"])), reverse=True)
        low = sorted((p for p in active if available(p["sku"]) <= LOW_STOCK_THRESHOLD),
                     key=lambda p: (available(p["sku"]), -sku_sales.get(p["sku"], {}).get("quantity", 0), p["sku"]))

        def categories_for(group_products, sold_skus):
            """Category breakdown for one segment (a price range or a brand); totals equal the segment's row."""
            stats: dict[str, dict] = {}

            def entry(cid):
                cid = cid or OTHER_CATEGORY[0]
                return stats.setdefault(cid, {
                    "category_id": cid, "category_name": category_name(cid) if cid in categories else OTHER_CATEGORY[1],
                    "product_count": 0, "available_units": 0, "inventory_value": ZERO, "quantity_sold": 0, "revenue": ZERO})
            for product in group_products:
                row = entry(product.get("ma_loai_sp"))
                row["product_count"] += 1
                row["available_units"] += available(product["sku"])
                row["inventory_value"] += available(product["sku"]) * money(product.get("gia_ban_hien_tai"))
            for sku in sold_skus:
                row = entry((product_by_sku.get(sku) or {}).get("ma_loai_sp"))
                row["quantity_sold"] += sku_sales[sku]["quantity"]
                row["revenue"] += sku_sales[sku]["revenue"]
            group_revenue = sum((row["revenue"] for row in stats.values()), ZERO)
            return [{**row, "inventory_value": format_money(row["inventory_value"]), "revenue": format_money(row["revenue"]),
                     "revenue_percentage": percent(row["revenue"], group_revenue)}
                    for row in sorted(stats.values(), key=lambda r: (r["revenue"], r["quantity_sold"], r["product_count"]), reverse=True)]

        # Price ranges cover products on sale, by current price; their sales are those products' sales.
        price_counts = []
        for key, label, low_bound, high_bound in PRICE_RANGES:
            members = [p for p in active if money(p.get("gia_ban_hien_tai")) >= low_bound
                       and (high_bound is None or money(p.get("gia_ban_hien_tai")) < high_bound)]
            price_counts.append({"key": key, "label": label, "count": len(members), "percentage": percent(len(members), len(active)),
                                 "categories": categories_for(members, [p["sku"] for p in members if p["sku"] in sku_sales])})

        # Brands: products on sale for counts/stock, every sold SKU of the brand for sales (same as the brand row).
        brand_of = lambda sku: (product_by_sku.get(sku) or {}).get("thuong_hieu") or NO_BRAND
        top_brand_names = [name for name, _ in sorted(brand_stats.items(), key=lambda kv: (kv[1]["revenue"], kv[1]["product_count"]), reverse=True)[:8]]

        valid_count = len(valid)
        return {
            "range": {"start": start, "end": end, "period_type": period},
            "product_summary": {
                "total_products": sum(1 for p in products if p.get("trang_thai") != HIDDEN),
                "active_products": len(active),
                "paused_products": sum(1 for p in products if p.get("trang_thai") == PAUSED),
                "hidden_products": sum(1 for p in products if p.get("trang_thai") == HIDDEN),
                "total_categories": sum(1 for c in categories.values() if c.get("trang_thai") == ACTIVE),
                "physical_units": sum(e["physical"] for e in stock.values()),
                "held_units": sum(e["held"] for e in stock.values()),
                "available_units": sum(e["available"] for e in stock.values()),
                "out_of_stock_products": sum(1 for p in active if available(p["sku"]) == 0),
                "low_stock_products": sum(1 for p in active if 0 < available(p["sku"]) <= LOW_STOCK_THRESHOLD),
                "low_stock_threshold": LOW_STOCK_THRESHOLD,
                "inventory_value": format_money(inventory_value),
            },
            "invoice_summary": {
                "total_invoices": len(invoices),
                "valid_invoices": valid_count,
                "cancelled_invoices": len(cancelled),
                "total_amount": format_money(totals["total"]),
                "pre_tax_amount": format_money(totals["pre_tax"]),
                "tax_amount": format_money(totals["tax"]),
                "discount_amount": format_money(totals["discount"]),
                "avg_invoice_value": format_money(totals["total"] / valid_count if valid_count else ZERO),
                "collected_amount": format_money(totals["collected"]),
                "outstanding_amount": format_money(totals["outstanding"]),
                "paid_invoices": status_count("PAID"),
                "partial_invoices": status_count("PARTIAL"),
                "unpaid_invoices": status_count("UNPAID"),
                "items_sold": items_sold,
            },
            "invoice_status": breakdown(status_groups, INVOICE_STATUS_LABELS, order=list(INVOICE_STATUS_LABELS)),
            "payment_methods": breakdown(method_groups, PAYMENT_METHOD_LABELS),
            "sales_channels": breakdown(channel_groups, CHANNEL_LABELS),
            "invoice_sources": breakdown(source_groups, SOURCE_LABELS),
            "timeline": [{**p, "pre_tax": format_money(p["pre_tax"]), "tax": format_money(p["tax"]), "total": format_money(p["total"]),
                          "collected": format_money(p["collected"])} for p in series],
            "categories": [{**c, "inventory_value": format_money(c["inventory_value"]), "revenue": format_money(c["revenue"]),
                            "revenue_percentage": percent(c["revenue"], total_revenue)}
                           for c in sorted(category_stats.values(), key=lambda c: (c["revenue"], c["quantity_sold"], c["product_count"]), reverse=True)],
            "top_products": [product_row(sku, product_by_sku.get(sku)) for sku in sold[:10]],
            "slow_products": [product_row(p["sku"], p) for p in slow[:10]],
            "low_stock_products": [product_row(p["sku"], p) for p in low[:15]],
            "price_ranges": price_counts,
            "top_brands": [{"brand": name, "product_count": brand_stats[name]["product_count"], "quantity_sold": brand_stats[name]["quantity_sold"],
                            "revenue": format_money(brand_stats[name]["revenue"]), "revenue_percentage": percent(brand_stats[name]["revenue"], total_revenue),
                            "categories": categories_for([p for p in active if (p.get("thuong_hieu") or NO_BRAND) == name],
                                                         [sku for sku in sku_sales if brand_of(sku) == name])}
                           for name in top_brand_names],
        }

    def product_sales(self, sku: str, period: str = "month", start: date | None = None, end: date | None = None):
        if self.actor.role != "ADMIN":
            raise HTTPException(403, "Chỉ quản trị viên mới có quyền xem thống kê sản phẩm và hóa đơn.")
        if start and end and start > end:
            raise HTTPException(422, "Ngày bắt đầu phải trước ngày kết thúc.")
        reads = {
            "product": ANALYTICS_READS.submit(self.repository.product, sku),
            "sales": ANALYTICS_READS.submit(self.repository.product_sales, sku, start.isoformat() if start else None,
                                            end.isoformat() if end else None),
            "stock": ANALYTICS_READS.submit(self.repository.stock, sku),
            "reservations": ANALYTICS_READS.submit(self.repository.reservations, RESERVING_STATUSES, sku),
        }
        try:
            product = reads["product"].result()
            sales = reads["sales"].result() or []
            stock_rows = reads["stock"].result() or []
            reservations = reads["reservations"].result() or []
        finally:
            for future in reads.values():
                future.cancel()
        if product is None and not sales:
            raise HTTPException(404, "Không tìm thấy sản phẩm.")

        # ---- Stock per active warehouse, same holding rule as checkout ----
        warehouses: dict[int, dict] = {}
        for row in stock_rows:
            entry = stock_breakdown([row], reservations).get(sku, {"physical": 0, "held": 0, "available": 0})
            warehouses[row["ma_kho"]] = {
                "warehouse_id": row["ma_kho"], "name": (row.get("warehouse") or {}).get("ten_kho") or f"Kho #{row['ma_kho']}",
                "physical_units": entry["physical"], "held_units": entry["held"], "available_units": entry["available"], "quantity_sold": 0,
            }

        # ---- Sales by period, channel and source warehouse ----
        buckets: dict[str, dict] = {}
        channels: dict[str, dict] = {}
        orders: set = set()
        quantity, revenue = 0, ZERO
        first_sale = None
        for line in sales:
            order = line.get("order") or {}
            issued = local_datetime((order.get("invoice") or {}).get("thoi_gian_lap"))
            qty = int(line.get("so_luong") or 0)
            amount = max(ZERO, qty * money(line.get("don_gia")) - money(line.get("giam_gia")) - money(line.get("giam_gia_voucher")))
            quantity += qty
            revenue += amount
            orders.add(order.get("ma_donhang"))
            channel = channels.setdefault(order.get("kenh_ban") or "", {"quantity": 0, "revenue": ZERO})
            channel["quantity"] += qty
            channel["revenue"] += amount
            warehouse_id = line.get("ma_kho_xuat")
            if warehouse_id is not None:
                warehouses.setdefault(warehouse_id, {
                    "warehouse_id": warehouse_id, "name": f"Kho #{warehouse_id} (không hoạt động)",
                    "physical_units": 0, "held_units": 0, "available_units": 0, "quantity_sold": 0,
                })["quantity_sold"] += qty
            if issued is None:
                continue
            first_sale = min(first_sale, issued.date()) if first_sale else issued.date()
            key, _ = period_bucket(issued, period)
            bucket = buckets.setdefault(key, {"quantity": 0, "revenue": ZERO, "orders": set()})
            bucket["quantity"] += qty
            bucket["revenue"] += amount
            bucket["orders"].add(order.get("ma_donhang"))

        first = start or first_sale
        timeline = []
        if first is not None:
            for key, label in continuous_periods(first, end or vietnam_today(), period):
                bucket = buckets.get(key, {"quantity": 0, "revenue": ZERO, "orders": set()})
                timeline.append({"period": key, "label": label, "quantity": bucket["quantity"],
                                 "revenue": format_money(bucket["revenue"]), "invoice_count": len(bucket["orders"])})

        category = (product or {}).get("category") or {}
        return {
            "sku": sku,
            "name": (product or {}).get("ten_sp") or next((l.get("ten_sp_luc_ban") for l in sales if l.get("ten_sp_luc_ban")), sku),
            "category_name": category.get("ten_loai_sp") or OTHER_CATEGORY[1],
            "brand": (product or {}).get("thuong_hieu") or None,
            "price": format_money(money(product.get("gia_ban_hien_tai"))) if product else None,
            "status": product.get("trang_thai") if product else None,
            "range": {"start": start, "end": end, "period_type": period},
            "summary": {
                "quantity_sold": quantity,
                "revenue": format_money(revenue),
                "invoice_count": len(orders),
                "avg_unit_price": format_money(revenue / quantity if quantity else ZERO),
                "physical_units": sum(w["physical_units"] for w in warehouses.values()),
                "held_units": sum(w["held_units"] for w in warehouses.values()),
                "available_units": sum(w["available_units"] for w in warehouses.values()),
            },
            "timeline": timeline,
            "channels": [{"key": key, "label": CHANNEL_LABELS.get(key, key or "Chưa xác định"), "quantity": c["quantity"],
                          "revenue": format_money(c["revenue"])}
                         for key, c in sorted(channels.items(), key=lambda kv: kv[1]["quantity"], reverse=True)],
            "warehouses": sorted(warehouses.values(), key=lambda w: (-w["available_units"], -w["quantity_sold"], w["warehouse_id"])),
        }

    def product_stock(self, view: str = "products", status: str = "ACTIVE", category: str | None = None, q: str | None = None,
                      start: date | None = None, end: date | None = None, page: int = 1, page_size: int = 20):
        """Full, filterable product lists behind the four product/stock summary tiles."""
        if self.actor.role != "ADMIN":
            raise HTTPException(403, "Chỉ quản trị viên mới có quyền xem thống kê sản phẩm và hóa đơn.")
        if start and end and start > end:
            raise HTTPException(422, "Ngày bắt đầu phải trước ngày kết thúc.")
        reads = {
            "products": ANALYTICS_READS.submit(self.repository.products),
            "categories": ANALYTICS_READS.submit(self.repository.categories),
            "stock": ANALYTICS_READS.submit(self.repository.stock),
            "reservations": ANALYTICS_READS.submit(self.repository.reservations, RESERVING_STATUSES),
            "sales": ANALYTICS_READS.submit(self.repository.product_sales, None, start.isoformat() if start else None,
                                            end.isoformat() if end else None),
        }
        try:
            products = reads["products"].result() or []
            categories = {c["ma_loai_sp"]: c for c in (reads["categories"].result() or [])}
            stock_rows = reads["stock"].result() or []
            reservations = reads["reservations"].result() or []
            sales = reads["sales"].result() or []
        finally:
            for future in reads.values():
                future.cancel()

        stock = stock_breakdown(stock_rows, reservations)
        sold: dict[str, int] = {}
        earned: dict[str, Decimal] = {}
        for line in sales:
            qty = int(line.get("so_luong") or 0)
            sold[line.get("sku")] = sold.get(line.get("sku"), 0) + qty
            earned[line.get("sku")] = earned.get(line.get("sku"), ZERO) + max(
                ZERO, qty * money(line.get("don_gia")) - money(line.get("giam_gia")) - money(line.get("giam_gia_voucher")))

        needle = search_key(q.strip()) if q and q.strip() else ""
        statuses = STATUS_CODES[status]
        rows = []
        for product in products:
            if product.get("trang_thai") not in statuses or (category and product.get("ma_loai_sp") != category):
                continue
            if needle and needle not in search_key(product.get("ten_sp")) and needle not in search_key(product.get("sku")):
                continue
            entry = stock.get(product["sku"], {"physical": 0, "held": 0, "available": 0})
            if view == "low" and entry["available"] > LOW_STOCK_THRESHOLD:
                continue
            price = money(product.get("gia_ban_hien_tai"))
            cid = product.get("ma_loai_sp") or OTHER_CATEGORY[0]
            rows.append({
                "sku": product["sku"], "name": product.get("ten_sp") or product["sku"], "category_id": cid,
                "category_name": (categories.get(cid) or {}).get("ten_loai_sp") or OTHER_CATEGORY[1],
                "brand": product.get("thuong_hieu") or None, "price": price, "status": product.get("trang_thai"),
                "physical_units": entry["physical"], "held_units": entry["held"], "available_units": entry["available"],
                "inventory_value": entry["available"] * price, "quantity_sold": sold.get(product["sku"], 0),
                "revenue": earned.get(product["sku"], ZERO),
            })

        if view == "stock":
            rows.sort(key=lambda r: (-r["available_units"], -r["physical_units"], r["name"]))
        elif view == "low":
            rows.sort(key=lambda r: (r["available_units"], -r["quantity_sold"], r["sku"]))
        elif view == "sales":
            rows.sort(key=lambda r: (-r["quantity_sold"], -r["revenue"], search_key(r["name"])))
        elif view == "value":
            rows.sort(key=lambda r: (-r["inventory_value"], -r["available_units"], r["name"]))
        else:
            rows.sort(key=lambda r: (search_key(r["name"]), r["sku"]))

        total_value = sum((r["inventory_value"] for r in rows), ZERO)
        selected = {r["sku"] for r in rows}
        warehouses = []
        by_warehouse: dict[int, list] = {}
        for row in stock_rows:
            if row["sku"] in selected:
                by_warehouse.setdefault(row["ma_kho"], []).append(row)
        for warehouse_id, group in sorted(by_warehouse.items()):
            totals = stock_breakdown(group, reservations).values()
            warehouses.append({
                "warehouse_id": warehouse_id, "name": (group[0].get("warehouse") or {}).get("ten_kho") or f"Kho #{warehouse_id}",
                "physical_units": sum(e["physical"] for e in totals), "held_units": sum(e["held"] for e in totals),
                "available_units": sum(e["available"] for e in totals),
            })
        warehouses.sort(key=lambda w: (-w["available_units"], w["warehouse_id"]))

        first = (page - 1) * page_size
        return {
            "view": view, "status": status, "category": category, "q": q.strip() if q and q.strip() else None,
            "start": start, "end": end, "page": page, "page_size": page_size, "total": len(rows),
            "low_stock_threshold": LOW_STOCK_THRESHOLD,
            "totals": {
                "products": len(rows),
                "physical_units": sum(r["physical_units"] for r in rows),
                "held_units": sum(r["held_units"] for r in rows),
                "available_units": sum(r["available_units"] for r in rows),
                "inventory_value": format_money(total_value),
            },
            "warehouses": warehouses,
            "categories": [{"category_id": cid, "category_name": c.get("ten_loai_sp") or cid}
                           for cid, c in sorted(categories.items(), key=lambda kv: search_key(kv[1].get("ten_loai_sp") or kv[0]))
                           if c.get("trang_thai") == ACTIVE],
            "items": [{**r, "price": format_money(r["price"]), "inventory_value": format_money(r["inventory_value"]),
                       "revenue": format_money(r["revenue"]),
                       "value_percentage": percent(r["inventory_value"], total_value)} for r in rows[first:first + page_size]],
        }
