from datetime import date, datetime, timedelta, timezone
from decimal import Decimal, ROUND_HALF_UP

from fastapi import HTTPException

from phub_api.models.user import User
from phub_api.repositories.crm_analytics import CrmAnalyticsRepository
from phub_api.services.crm_survey_metrics import survey_insights as build_survey_insights

VIETNAM_TIMEZONE = timezone(timedelta(hours=7))


def vietnam_today() -> date:
    return datetime.now(VIETNAM_TIMEZONE).date()


def format_money(val: Decimal | int | float) -> str:
    return str(Decimal(str(val)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP))


def normalize_city(raw_city: str | None) -> str:
    if not raw_city:
        return "Chưa xác định"
    s = raw_city.strip()
    lower_s = s.lower()
    if lower_s in ("tphcm", "tp hcm", "tp.hcm", "tp. hcm", "tp hồ chí minh", "thành phố hồ chí minh", "tp. hồ chí minh", "hồ chí minh", "hcm"):
        return "TP. Hồ Chí Minh"
    if lower_s in ("hà nội", "ha noi", "tp hà nội", "tp. hà nội", "thành phố hà nội", "hn"):
        return "TP. Hà Nội"
    if lower_s in ("đà nẵng", "da nang", "tp đà nẵng", "tp. đà nẵng"):
        return "TP. Đà Nẵng"
    if lower_s in ("cần thơ", "can tho", "tp cần thơ", "tp. cần thơ"):
        return "TP. Cần Thơ"
    if lower_s in ("hải phòng", "hai phong", "tp hải phòng", "tp. hải phòng"):
        return "TP. Hải Phòng"
    if lower_s in ("bình dương", "binh duong"):
        return "Bình Dương"
    if lower_s in ("đồng nai", "dong nai"):
        return "Đồng Nai"
    if len(s) <= 2 or lower_s in ("fdsf", "dsds", "test", "abc"):
        return "Khu vực khác"
    return s.title() if s.islower() else s


class CrmAnalyticsService:
    def __init__(self, repository: CrmAnalyticsRepository, actor: User):
        self.repository = repository
        self.actor = actor

    def require_admin(self):
        if self.actor.role != "ADMIN":
            raise HTTPException(403, "Chỉ quản trị viên mới có quyền xem thống kê CRM.")

    def customer_insights(self, period: str = "month", start: date | None = None, end: date | None = None, status_scope: str = "ACTIVE"):
        self.require_admin()
        if start and end and start > end:
            raise HTTPException(422, "Ngày bắt đầu phải trước ngày kết thúc.")

        today = vietnam_today()
        customers = self.repository.customers() or []
        orders = self.repository.completed_orders(
            start=start.isoformat() if start else None,
            end=end.isoformat() if end else None,
            status_scope=status_scope,
        ) or []

        order_ids = [o["ma_donhang"] for o in orders if o.get("ma_donhang")]
        lines = self.repository.order_lines(order_ids) or []
        products = {p["sku"]: p for p in (self.repository.products() or [])}
        categories = {c["ma_loai_sp"]: c.get("ten_loai_sp") or c["ma_loai_sp"] for c in (self.repository.categories() or [])}

        # 1. Demographics: Gender & Age
        total_customers = len(customers)
        gender_counts = {"NAM": 0, "NU": 0, "KHAC": 0, "CHUA_XAC_DINH": 0}
        age_counts = {
            "Dưới 18": 0,
            "18 - 24": 0,
            "25 - 34": 0,
            "35 - 44": 0,
            "Từ 45 trở lên": 0,
            "Chưa có ngày sinh": 0,
        }

        customer_meta = {}
        for c in customers:
            cid = c.get("ma_kh")
            # Gender
            g = (c.get("gioi_tinh") or "").strip().upper()
            if g in ("NAM", "NU", "KHAC"):
                g_key = g
            else:
                g_key = "CHUA_XAC_DINH"
            gender_counts[g_key] += 1

            # Age
            b_str = c.get("ngay_sinh")
            ag_name = "Chưa có ngày sinh"
            if b_str:
                try:
                    b_date = date.fromisoformat(str(b_str)[:10])
                    age = today.year - b_date.year - ((today.month, today.day) < (b_date.month, b_date.day))
                    if age < 18:
                        ag_name = "Dưới 18"
                    elif age <= 24:
                        ag_name = "18 - 24"
                    elif age <= 34:
                        ag_name = "25 - 34"
                    elif age <= 44:
                        ag_name = "35 - 44"
                    else:
                        ag_name = "Từ 45 trở lên"
                except Exception:
                    ag_name = "Chưa có ngày sinh"

            age_counts[ag_name] += 1
            if cid:
                customer_meta[cid] = {"age_group": ag_name, "gender_key": g_key}

        gender_list = [
            {"label": "Nam", "value": gender_counts["NAM"], "percentage": round((gender_counts["NAM"] / total_customers * 100), 1) if total_customers else 0.0},
            {"label": "Nữ", "value": gender_counts["NU"], "percentage": round((gender_counts["NU"] / total_customers * 100), 1) if total_customers else 0.0},
            {"label": "Khác", "value": gender_counts["KHAC"], "percentage": round((gender_counts["KHAC"] / total_customers * 100), 1) if total_customers else 0.0},
            {"label": "Chưa xác định", "value": gender_counts["CHUA_XAC_DINH"], "percentage": round((gender_counts["CHUA_XAC_DINH"] / total_customers * 100), 1) if total_customers else 0.0},
        ]

        age_list = [
            {"group": k, "value": v, "percentage": round((v / total_customers * 100), 1) if total_customers else 0.0}
            for k, v in age_counts.items()
        ]

        # 2. Revenue & Order Line Metrics
        order_line_map: dict[str, list] = {}
        for line in lines:
            order_line_map.setdefault(line["ma_donhang"], []).append(line)

        order_revenue_map: dict[str, Decimal] = {}
        customer_spending: dict[str, Decimal] = {}
        total_revenue = Decimal("0")

        # Top product & category maps
        sku_metrics: dict[str, dict] = {}
        cat_metrics: dict[str, dict] = {}

        for line in lines:
            sku = line.get("sku") or ""
            qty = int(line.get("so_luong") or 0)
            price = Decimal(str(line.get("don_gia") or 0))
            disc = Decimal(str(line.get("giam_gia") or 0))
            v_disc = Decimal(str(line.get("giam_gia_voucher") or 0))
            line_rev = max(Decimal("0"), qty * price - disc - v_disc)

            oid = line.get("ma_donhang")
            order_revenue_map[oid] = order_revenue_map.get(oid, Decimal("0")) + line_rev

            prod = products.get(sku, {})
            p_name = prod.get("ten_sp") or sku
            cat_id = prod.get("ma_loai_sp") or "KHAC"
            cat_name = categories.get(cat_id) or cat_id

            if sku not in sku_metrics:
                sku_metrics[sku] = {"sku": sku, "name": p_name, "category_name": cat_name, "quantity_sold": 0, "revenue": Decimal("0")}
            sku_metrics[sku]["quantity_sold"] += qty
            sku_metrics[sku]["revenue"] += line_rev

            if cat_id not in cat_metrics:
                cat_metrics[cat_id] = {"category_id": cat_id, "category_name": cat_name, "quantity_sold": 0, "revenue": Decimal("0")}
            cat_metrics[cat_id]["quantity_sold"] += qty
            cat_metrics[cat_id]["revenue"] += line_rev

        active_buyer_set = set()
        for o in orders:
            oid = o["ma_donhang"]
            cid = o.get("ma_kh")
            rev = order_revenue_map.get(oid)
            if rev is None:
                rev = Decimal(str(o.get("tong_tien") or 0))
            total_revenue += rev
            if cid:
                active_buyer_set.add(cid)
                customer_spending[cid] = customer_spending.get(cid, Decimal("0")) + rev

        # 2. Category demand & preferences from actual purchases (LOAI_SP & CT_DON_HANG)
        interest_counts: dict[str, int] = {}
        for cat_id, data in cat_metrics.items():
            name = data["category_name"]
            c_qty = data["quantity_sold"]
            if c_qty > 0:
                interest_counts[name] = c_qty

        total_int_count = sum(interest_counts.values())
        if total_int_count > 0:
            interest_list = [
                {"category": k, "count": v, "percentage": round((v / total_int_count * 100), 1)}
                for k, v in sorted(interest_counts.items(), key=lambda x: x[1], reverse=True)[:6]
            ]
        else:
            interest_list = []

        # 3. Timeline / Spending by month, quarter, year
        # Use date field matching status_scope: thoi_gian_hoan_thanh for COMPLETED, thoi_gian_dat for ACTIVE
        time_field = "thoi_gian_hoan_thanh" if status_scope == "COMPLETED" else "thoi_gian_dat"
        timeline_groups: dict[str, dict] = {}
        for o in orders:
            oid = o["ma_donhang"]
            dt_raw = str(o.get(time_field) or o.get("thoi_gian_dat") or o.get("thoi_gian_hoan_thanh") or "")
            if not dt_raw:
                continue
            rev = order_revenue_map.get(oid, Decimal(str(o.get("tong_tien") or 0)))

            try:
                dt = datetime.fromisoformat(dt_raw.replace("Z", "+00:00"))
                # Legacy timestamp-without-timezone columns store Vietnamese local time.
                if dt.tzinfo is None:
                    dt = dt.replace(tzinfo=VIETNAM_TIMEZONE)
                dt = dt.astimezone(VIETNAM_TIMEZONE)
            except Exception:
                continue

            if period == "quarter":
                q = (dt.month - 1) // 3 + 1
                key = f"{dt.year}-Q{q}"
                label = f"Quý {q}/{dt.year}"
            elif period == "year":
                key = f"{dt.year}"
                label = f"Năm {dt.year}"
            else:  # month
                key = f"{dt.year}-{dt.month:02d}"
                label = f"Tháng {dt.month:02d}/{dt.year}"

            if key not in timeline_groups:
                timeline_groups[key] = {"period": key, "label": label, "order_count": 0, "revenue": Decimal("0")}
            timeline_groups[key]["order_count"] += 1
            timeline_groups[key]["revenue"] += rev

        timeline = []
        for k in sorted(timeline_groups.keys()):
            item = timeline_groups[k]
            oc = item["order_count"]
            r = item["revenue"]
            avg_sp = (r / oc) if oc > 0 else Decimal("0")
            timeline.append({
                "period": item["period"],
                "label": item["label"],
                "order_count": oc,
                "revenue": format_money(r),
                "avg_spending": format_money(avg_sp),
            })

        # 4. Customer Segments
        active_buyers_count = len(active_buyer_set)
        vip_spending = Decimal("20000000")
        pot_spending = Decimal("5000000")

        seg_counts = {
            "VIP": {"count": 0, "revenue": Decimal("0"), "label": "Khách hàng VIP (≥ 20 triệu)"},
            "POTENTIAL": {"count": 0, "revenue": Decimal("0"), "label": "Khách hàng Tiềm năng (5 - 20 triệu)"},
            "STANDARD": {"count": 0, "revenue": Decimal("0"), "label": "Khách hàng Tiêu chuẩn (< 5 triệu)"},
        }

        for cid, spent in customer_spending.items():
            if spent >= vip_spending:
                seg_counts["VIP"]["count"] += 1
                seg_counts["VIP"]["revenue"] += spent
            elif spent >= pot_spending:
                seg_counts["POTENTIAL"]["count"] += 1
                seg_counts["POTENTIAL"]["revenue"] += spent
            else:
                seg_counts["STANDARD"]["count"] += 1
                seg_counts["STANDARD"]["revenue"] += spent

        segments = [
            {
                "segment": data["label"],
                "count": data["count"],
                "percentage": round((data["count"] / active_buyers_count * 100), 1) if active_buyers_count else 0.0,
                "revenue": format_money(data["revenue"]),
            }
            for data in seg_counts.values()
        ]

        # 5. Top Categories and Top Products
        top_cats = sorted(cat_metrics.values(), key=lambda x: x["revenue"], reverse=True)
        top_cats_list = [
            {
                "category_id": c["category_id"],
                "category_name": c["category_name"],
                "quantity_sold": c["quantity_sold"],
                "revenue": format_money(c["revenue"]),
                "percentage": round(float((c["revenue"] / total_revenue * 100)), 1) if total_revenue > Decimal("0") else 0.0,
            }
            for c in top_cats[:8]
        ]

        top_prods = sorted(sku_metrics.values(), key=lambda x: x["revenue"], reverse=True)
        top_prods_list = [
            {
                "sku": p["sku"],
                "name": p["name"],
                "category_name": p["category_name"],
                "quantity_sold": p["quantity_sold"],
                "revenue": format_money(p["revenue"]),
            }
            for p in top_prods[:10]
        ]

        # Cross-dimension analysis: Breakdowns by Age Group and Gender
        order_age_map = {}
        order_gender_map = {}
        for o in orders:
            cid = o.get("ma_kh")
            c_meta = customer_meta.get(cid)
            order_age_map[o["ma_donhang"]] = c_meta["age_group"] if c_meta else "Chưa có ngày sinh"
            order_gender_map[o["ma_donhang"]] = c_meta["gender_key"] if c_meta else "CHUA_XAC_DINH"

        age_group_details = [
            {
                "group": "Tất cả",
                "customer_count": total_customers,
                "customer_percentage": 100.0,
                "active_buyers": active_buyers_count,
                "total_orders": len(orders),
                "revenue": format_money(total_revenue),
                "gender": gender_list,
                "top_categories": top_cats_list,
                "top_products": top_prods_list,
            }
        ]

        for ag in [
            "Dưới 18",
            "18 - 24",
            "25 - 34",
            "35 - 44",
            "Từ 45 trở lên",
            "Chưa có ngày sinh",
        ]:
            c_ids_in_group = set(cid for cid, m in customer_meta.items() if m["age_group"] == ag)
            c_count = len(c_ids_in_group)
            c_pct = round((c_count / total_customers * 100), 1) if total_customers else 0.0

            g_counts = {"NAM": 0, "NU": 0, "KHAC": 0, "CHUA_XAC_DINH": 0}
            for cid in c_ids_in_group:
                g_key = customer_meta[cid]["gender_key"]
                g_counts[g_key] = g_counts.get(g_key, 0) + 1

            g_list_ag = [
                {"label": "Nam", "value": g_counts["NAM"], "percentage": round((g_counts["NAM"] / c_count * 100), 1) if c_count else 0.0},
                {"label": "Nữ", "value": g_counts["NU"], "percentage": round((g_counts["NU"] / c_count * 100), 1) if c_count else 0.0},
                {"label": "Khác", "value": g_counts["KHAC"], "percentage": round((g_counts["KHAC"] / c_count * 100), 1) if c_count else 0.0},
                {"label": "Chưa xác định", "value": g_counts["CHUA_XAC_DINH"], "percentage": round((g_counts["CHUA_XAC_DINH"] / c_count * 100), 1) if c_count else 0.0},
            ]

            orders_ag = [o for o in orders if order_age_map.get(o["ma_donhang"]) == ag]
            orders_ag_count = len(orders_ag)
            buyers_ag = len(set(o.get("ma_kh") for o in orders_ag if o.get("ma_kh")))
            revenue_ag = sum(order_revenue_map.get(o["ma_donhang"], Decimal("0")) for o in orders_ag)

            cat_metrics_ag = {}
            sku_metrics_ag = {}
            for o in orders_ag:
                oid = o["ma_donhang"]
                for line in order_line_map.get(oid, []):
                    sku = line.get("sku") or ""
                    qty = int(line.get("so_luong") or 0)
                    price = Decimal(str(line.get("don_gia") or 0))
                    disc = Decimal(str(line.get("giam_gia") or 0))
                    v_disc = Decimal(str(line.get("giam_gia_voucher") or 0))
                    line_rev = max(Decimal("0"), qty * price - disc - v_disc)

                    prod = products.get(sku, {})
                    p_name = prod.get("ten_sp") or sku
                    cat_id = prod.get("ma_loai_sp") or "KHAC"
                    cat_name = categories.get(cat_id) or cat_id

                    if cat_id not in cat_metrics_ag:
                        cat_metrics_ag[cat_id] = {"category_id": cat_id, "category_name": cat_name, "quantity_sold": 0, "revenue": Decimal("0")}
                    cat_metrics_ag[cat_id]["quantity_sold"] += qty
                    cat_metrics_ag[cat_id]["revenue"] += line_rev

                    if sku not in sku_metrics_ag:
                        sku_metrics_ag[sku] = {"sku": sku, "name": p_name, "category_name": cat_name, "quantity_sold": 0, "revenue": Decimal("0")}
                    sku_metrics_ag[sku]["quantity_sold"] += qty
                    sku_metrics_ag[sku]["revenue"] += line_rev

            top_cats_ag = sorted(cat_metrics_ag.values(), key=lambda x: x["revenue"], reverse=True)
            top_cats_ag_list = [
                {
                    "category_id": c["category_id"],
                    "category_name": c["category_name"],
                    "quantity_sold": c["quantity_sold"],
                    "revenue": format_money(c["revenue"]),
                    "percentage": round(float((c["revenue"] / revenue_ag * 100)), 1) if revenue_ag > Decimal("0") else 0.0,
                }
                for c in top_cats_ag[:8]
            ]

            top_prods_ag = sorted(sku_metrics_ag.values(), key=lambda x: x["revenue"], reverse=True)
            top_prods_ag_list = [
                {
                    "sku": p["sku"],
                    "name": p["name"],
                    "category_name": p["category_name"],
                    "quantity_sold": p["quantity_sold"],
                    "revenue": format_money(p["revenue"]),
                }
                for p in top_prods_ag[:10]
            ]

            # Cross breakdown by Gender WITHIN this age group
            gender_details_ag = [
                {
                    "label": "Tất cả",
                    "key": "ALL",
                    "customer_count": c_count,
                    "customer_percentage": 100.0,
                    "active_buyers": buyers_ag,
                    "total_orders": orders_ag_count,
                    "revenue": format_money(revenue_ag),
                    "top_categories": top_cats_ag_list,
                    "top_products": top_prods_ag_list,
                }
            ]

            cat_gender_stats_ag = {}
            for g_code, g_label in [
                ("NAM", "Nam"),
                ("NU", "Nữ"),
                ("KHAC", "Khác"),
                ("CHUA_XAC_DINH", "Chưa xác định"),
            ]:
                c_ids_ag_g = set(cid for cid in c_ids_in_group if customer_meta[cid]["gender_key"] == g_code)
                c_count_ag_g = len(c_ids_ag_g)
                c_pct_ag_g = round((c_count_ag_g / c_count * 100), 1) if c_count else 0.0

                orders_ag_g = [o for o in orders_ag if customer_meta.get(o.get("ma_kh"), {}).get("gender_key") == g_code]
                orders_ag_g_count = len(orders_ag_g)
                buyers_ag_g = len(set(o.get("ma_kh") for o in orders_ag_g if o.get("ma_kh")))
                revenue_ag_g = sum(order_revenue_map.get(o["ma_donhang"], Decimal("0")) for o in orders_ag_g)

                cat_metrics_ag_g = {}
                sku_metrics_ag_g = {}
                for o in orders_ag_g:
                    oid = o["ma_donhang"]
                    for line in order_line_map.get(oid, []):
                        sku = line.get("sku") or ""
                        qty = int(line.get("so_luong") or 0)
                        price = Decimal(str(line.get("don_gia") or 0))
                        disc = Decimal(str(line.get("giam_gia") or 0))
                        v_disc = Decimal(str(line.get("giam_gia_voucher") or 0))
                        line_rev = max(Decimal("0"), qty * price - disc - v_disc)

                        prod = products.get(sku, {})
                        p_name = prod.get("ten_sp") or sku
                        cat_id = prod.get("ma_loai_sp") or "KHAC"
                        cat_name = categories.get(cat_id) or cat_id

                        if cat_id not in cat_metrics_ag_g:
                            cat_metrics_ag_g[cat_id] = {"category_id": cat_id, "category_name": cat_name, "quantity_sold": 0, "revenue": Decimal("0")}
                        cat_metrics_ag_g[cat_id]["quantity_sold"] += qty
                        cat_metrics_ag_g[cat_id]["revenue"] += line_rev

                        if sku not in sku_metrics_ag_g:
                            sku_metrics_ag_g[sku] = {"sku": sku, "name": p_name, "category_name": cat_name, "quantity_sold": 0, "revenue": Decimal("0")}
                        sku_metrics_ag_g[sku]["quantity_sold"] += qty
                        sku_metrics_ag_g[sku]["revenue"] += line_rev

                top_cats_ag_g = sorted(cat_metrics_ag_g.values(), key=lambda x: x["revenue"], reverse=True)
                top_cats_ag_g_list = [
                    {
                        "category_id": c["category_id"],
                        "category_name": c["category_name"],
                        "quantity_sold": c["quantity_sold"],
                        "revenue": format_money(c["revenue"]),
                        "percentage": round(float((c["revenue"] / revenue_ag_g * 100)), 1) if revenue_ag_g > Decimal("0") else 0.0,
                    }
                    for c in top_cats_ag_g[:8]
                ]

                top_prods_ag_g = sorted(sku_metrics_ag_g.values(), key=lambda x: x["revenue"], reverse=True)
                top_prods_ag_g_list = [
                    {
                        "sku": p["sku"],
                        "name": p["name"],
                        "category_name": p["category_name"],
                        "quantity_sold": p["quantity_sold"],
                        "revenue": format_money(p["revenue"]),
                    }
                    for p in top_prods_ag_g[:10]
                ]

                gender_details_ag.append({
                    "label": g_label,
                    "key": g_code,
                    "customer_count": c_count_ag_g,
                    "customer_percentage": c_pct_ag_g,
                    "active_buyers": buyers_ag_g,
                    "total_orders": orders_ag_g_count,
                    "revenue": format_money(revenue_ag_g),
                    "top_categories": top_cats_ag_g_list,
                    "top_products": top_prods_ag_g_list,
                })

            for o in orders_ag:
                oid = o["ma_donhang"]
                g_code = customer_meta.get(o.get("ma_kh"), {}).get("gender_key", "CHUA_XAC_DINH")
                for line in order_line_map.get(oid, []):
                    sku = line.get("sku") or ""
                    qty = int(line.get("so_luong") or 0)
                    price = Decimal(str(line.get("don_gia") or 0))
                    disc = Decimal(str(line.get("giam_gia") or 0))
                    v_disc = Decimal(str(line.get("giam_gia_voucher") or 0))
                    line_rev = max(Decimal("0"), qty * price - disc - v_disc)

                    prod = products.get(sku, {})
                    cat_id = prod.get("ma_loai_sp") or "KHAC"
                    cat_name = categories.get(cat_id) or cat_id

                    if cat_id not in cat_gender_stats_ag:
                        cat_gender_stats_ag[cat_id] = {
                            "category_id": cat_id,
                            "category_name": cat_name,
                            "total_quantity": 0,
                            "total_revenue": Decimal("0"),
                            "nam_quantity": 0,
                            "nam_revenue": Decimal("0"),
                            "nu_quantity": 0,
                            "nu_revenue": Decimal("0"),
                            "khac_quantity": 0,
                            "khac_revenue": Decimal("0"),
                            "chua_xac_dinh_quantity": 0,
                            "chua_xac_dinh_revenue": Decimal("0"),
                        }
                    item = cat_gender_stats_ag[cat_id]
                    item["total_quantity"] += qty
                    item["total_revenue"] += line_rev
                    if g_code == "NAM":
                        item["nam_quantity"] += qty
                        item["nam_revenue"] += line_rev
                    elif g_code == "NU":
                        item["nu_quantity"] += qty
                        item["nu_revenue"] += line_rev
                    elif g_code == "KHAC":
                        item["khac_quantity"] += qty
                        item["khac_revenue"] += line_rev
                    else:
                        item["chua_xac_dinh_quantity"] += qty
                        item["chua_xac_dinh_revenue"] += line_rev

            matrix_ag = [
                {
                    "category_id": c["category_id"],
                    "category_name": c["category_name"],
                    "total_quantity": c["total_quantity"],
                    "total_revenue": format_money(c["total_revenue"]),
                    "nam_quantity": c["nam_quantity"],
                    "nam_revenue": format_money(c["nam_revenue"]),
                    "nu_quantity": c["nu_quantity"],
                    "nu_revenue": format_money(c["nu_revenue"]),
                    "khac_quantity": c["khac_quantity"],
                    "khac_revenue": format_money(c["khac_revenue"]),
                    "chua_xac_dinh_quantity": c["chua_xac_dinh_quantity"],
                    "chua_xac_dinh_revenue": format_money(c["chua_xac_dinh_revenue"]),
                }
                for c in sorted(cat_gender_stats_ag.values(), key=lambda x: x["total_quantity"], reverse=True)
            ]

            age_group_details.append({
                "group": ag,
                "customer_count": c_count,
                "customer_percentage": c_pct,
                "active_buyers": buyers_ag,
                "total_orders": orders_ag_count,
                "revenue": format_money(revenue_ag),
                "gender": g_list_ag,
                "top_categories": top_cats_ag_list,
                "top_products": top_prods_ag_list,
                "by_gender": gender_details_ag,
                "gender_category_matrix": matrix_ag,
            })

        # Cross-dimension analysis: Breakdowns by Gender
        order_gender_map = {}
        for o in orders:
            cid = o.get("ma_kh")
            c_meta = customer_meta.get(cid)
            order_gender_map[o["ma_donhang"]] = c_meta["gender_key"] if c_meta else "CHUA_XAC_DINH"

        gender_details = [
            {
                "label": "Tất cả",
                "key": "ALL",
                "customer_count": total_customers,
                "customer_percentage": 100.0,
                "active_buyers": active_buyers_count,
                "total_orders": len(orders),
                "revenue": format_money(total_revenue),
                "top_categories": top_cats_list,
                "top_products": top_prods_list,
            }
        ]

        for g_code, g_label in [
            ("NAM", "Nam"),
            ("NU", "Nữ"),
            ("KHAC", "Khác"),
            ("CHUA_XAC_DINH", "Chưa xác định"),
        ]:
            c_ids_in_g = set(cid for cid, m in customer_meta.items() if m["gender_key"] == g_code)
            c_count = len(c_ids_in_g)
            c_pct = round((c_count / total_customers * 100), 1) if total_customers else 0.0

            orders_g = [o for o in orders if order_gender_map.get(o["ma_donhang"]) == g_code]
            orders_g_count = len(orders_g)
            buyers_g = len(set(o.get("ma_kh") for o in orders_g if o.get("ma_kh")))
            revenue_g = sum(order_revenue_map.get(o["ma_donhang"], Decimal("0")) for o in orders_g)

            cat_metrics_g = {}
            sku_metrics_g = {}
            for o in orders_g:
                oid = o["ma_donhang"]
                for line in order_line_map.get(oid, []):
                    sku = line.get("sku") or ""
                    qty = int(line.get("so_luong") or 0)
                    price = Decimal(str(line.get("don_gia") or 0))
                    disc = Decimal(str(line.get("giam_gia") or 0))
                    v_disc = Decimal(str(line.get("giam_gia_voucher") or 0))
                    line_rev = max(Decimal("0"), qty * price - disc - v_disc)

                    prod = products.get(sku, {})
                    p_name = prod.get("ten_sp") or sku
                    cat_id = prod.get("ma_loai_sp") or "KHAC"
                    cat_name = categories.get(cat_id) or cat_id

                    if cat_id not in cat_metrics_g:
                        cat_metrics_g[cat_id] = {"category_id": cat_id, "category_name": cat_name, "quantity_sold": 0, "revenue": Decimal("0")}
                    cat_metrics_g[cat_id]["quantity_sold"] += qty
                    cat_metrics_g[cat_id]["revenue"] += line_rev

                    if sku not in sku_metrics_g:
                        sku_metrics_g[sku] = {"sku": sku, "name": p_name, "category_name": cat_name, "quantity_sold": 0, "revenue": Decimal("0")}
                    sku_metrics_g[sku]["quantity_sold"] += qty
                    sku_metrics_g[sku]["revenue"] += line_rev

            top_cats_g = sorted(cat_metrics_g.values(), key=lambda x: x["revenue"], reverse=True)
            top_cats_g_list = [
                {
                    "category_id": c["category_id"],
                    "category_name": c["category_name"],
                    "quantity_sold": c["quantity_sold"],
                    "revenue": format_money(c["revenue"]),
                    "percentage": round(float((c["revenue"] / revenue_g * 100)), 1) if revenue_g > Decimal("0") else 0.0,
                }
                for c in top_cats_g[:8]
            ]

            top_prods_g = sorted(sku_metrics_g.values(), key=lambda x: x["revenue"], reverse=True)
            top_prods_g_list = [
                {
                    "sku": p["sku"],
                    "name": p["name"],
                    "category_name": p["category_name"],
                    "quantity_sold": p["quantity_sold"],
                    "revenue": format_money(p["revenue"]),
                }
                for p in top_prods_g[:10]
            ]

            gender_details.append({
                "label": g_label,
                "key": g_code,
                "customer_count": c_count,
                "customer_percentage": c_pct,
                "active_buyers": buyers_g,
                "total_orders": orders_g_count,
                "revenue": format_money(revenue_g),
                "top_categories": top_cats_g_list,
                "top_products": top_prods_g_list,
            })

        # Cross-Tabulation Matrix: Category x Gender
        cat_gender_stats = {}
        for line in lines:
            oid = line.get("ma_donhang")
            g_code = order_gender_map.get(oid, "CHUA_XAC_DINH")
            sku = line.get("sku") or ""
            qty = int(line.get("so_luong") or 0)
            price = Decimal(str(line.get("don_gia") or 0))
            disc = Decimal(str(line.get("giam_gia") or 0))
            v_disc = Decimal(str(line.get("giam_gia_voucher") or 0))
            line_rev = max(Decimal("0"), qty * price - disc - v_disc)

            prod = products.get(sku, {})
            cat_id = prod.get("ma_loai_sp") or "KHAC"
            cat_name = categories.get(cat_id) or cat_id

            if cat_id not in cat_gender_stats:
                cat_gender_stats[cat_id] = {
                    "category_id": cat_id,
                    "category_name": cat_name,
                    "total_quantity": 0,
                    "total_revenue": Decimal("0"),
                    "nam_quantity": 0,
                    "nam_revenue": Decimal("0"),
                    "nu_quantity": 0,
                    "nu_revenue": Decimal("0"),
                    "khac_quantity": 0,
                    "khac_revenue": Decimal("0"),
                    "chua_xac_dinh_quantity": 0,
                    "chua_xac_dinh_revenue": Decimal("0"),
                }
            item = cat_gender_stats[cat_id]
            item["total_quantity"] += qty
            item["total_revenue"] += line_rev
            if g_code == "NAM":
                item["nam_quantity"] += qty
                item["nam_revenue"] += line_rev
            elif g_code == "NU":
                item["nu_quantity"] += qty
                item["nu_revenue"] += line_rev
            elif g_code == "KHAC":
                item["khac_quantity"] += qty
                item["khac_revenue"] += line_rev
            else:
                item["chua_xac_dinh_quantity"] += qty
                item["chua_xac_dinh_revenue"] += line_rev

        gender_category_matrix = [
            {
                "category_id": c["category_id"],
                "category_name": c["category_name"],
                "total_quantity": c["total_quantity"],
                "total_revenue": format_money(c["total_revenue"]),
                "nam_quantity": c["nam_quantity"],
                "nam_revenue": format_money(c["nam_revenue"]),
                "nu_quantity": c["nu_quantity"],
                "nu_revenue": format_money(c["nu_revenue"]),
                "khac_quantity": c["khac_quantity"],
                "khac_revenue": format_money(c["khac_revenue"]),
                "chua_xac_dinh_quantity": c["chua_xac_dinh_quantity"],
                "chua_xac_dinh_revenue": format_money(c["chua_xac_dinh_revenue"]),
            }
            for c in sorted(cat_gender_stats.values(), key=lambda x: x["total_quantity"], reverse=True)
        ]

        if age_group_details:
            age_group_details[0]["by_gender"] = gender_details
            age_group_details[0]["gender_category_matrix"] = gender_category_matrix

        # Summary KPIs
        total_orders_count = len(orders)
        aov = (total_revenue / total_orders_count) if total_orders_count > 0 else Decimal("0")
        arpu = (total_revenue / active_buyers_count) if active_buyers_count > 0 else Decimal("0")

        # 6. Strategic Recommendations
        recommendations = []
        young_audience_pct = 0.0
        for ag in age_list:
            if ag["group"] in ("18 - 24", "25 - 34"):
                young_audience_pct += ag["percentage"]

        if young_audience_pct >= 40.0:
            recommendations.append({
                "type": "TARGET_AUDIENCE",
                "title": "Tập trung chiến lược vào tệp khách hàng 18 - 34 tuổi",
                "content": f"Nhóm độ tuổi 18–34 chiếm {young_audience_pct:.1f}% toàn bộ tệp khách hàng. Đây là đối tượng có nhu cầu lớn nhất về cấu hình máy tính cá nhân, gaming gear và đồ họa.",
            })

        if top_cats_list:
            top_1 = top_cats_list[0]
            recommendations.append({
                "type": "INVENTORY_INVESTMENT",
                "title": f"Ưu tiên nguồn vốn đầu tư ngành hàng {top_1['category_name']}",
                "content": f"Ngành hàng '{top_1['category_name']}' đang đóng góp {top_1['percentage']}% doanh số toàn hệ thống. Cần đẩy mạnh đàm phán với nhà cung cấp để tối ưu giá nhập và duy trì lượng tồn an toàn.",
            })

        vip_info = seg_counts["VIP"]
        if vip_info["count"] > 0:
            vip_pct = round((vip_info["count"] / active_buyers_count * 100), 1) if active_buyers_count else 0.0
            recommendations.append({
                "type": "LOYALTY_PROGRAM",
                "title": "Xây dựng chính sách ưu đãi riêng cho nhóm Khách hàng VIP",
                "content": f"Nhóm VIP chiếm {vip_pct}% số lượng người mua nhưng đóng góp doanh thu rất cao ({format_money(vip_info['revenue'])}đ). Cần triển khai chính sách thẻ thành viên, quà tặng sinh nhật và hỗ trợ kỹ thuật ưu tiên.",
            })

        # 6. Surveys & Feedback Insights
        survey_insights = build_survey_insights(self.repository.surveys(), self.repository.survey_responses())
        avg_overall = survey_insights["avg_overall_score"]
        if avg_overall is not None and avg_overall >= 4.5:
            recommendations.append({
                "type": "CSAT_EXCELLENCE",
                "title": f"Chỉ số hài lòng khách hàng đạt mức xuất sắc ({avg_overall}/5 sao)",
                "content": f"Điểm hài lòng chung đạt {avg_overall}/5 từ {survey_insights['total_ratings']} câu chấm điểm hài lòng thực tế. Chưa phân loại điểm riêng cho sản phẩm và dịch vụ.",
            })

        if not recommendations:
            recommendations.append({
                "type": "GROWTH_STRATEGY",
                "title": "Đẩy mạnh kích cầu mua sắm và hoàn thiện thông tin khách hàng",
                "content": "Khuyến khích khách hàng cập nhật ngày sinh và sở thích khi tạo tài khoản để nhận voucher ưu đãi cá nhân hóa, giúp nâng cao độ chính xác của phân tích CRM.",
            })

        # 7. Geographic Distribution by City (delivery address selected for orders/invoices)
        city_metrics: dict[str, dict] = {}
        for o in orders:
            oid = o.get("ma_donhang")
            cid = o.get("ma_kh")
            rev = order_revenue_map.get(oid, Decimal(str(o.get("tong_tien") or 0)))
            raw_city = o.get("tinh_thanh")
            city_name = normalize_city(raw_city)

            if city_name not in city_metrics:
                city_metrics[city_name] = {
                    "city": city_name,
                    "order_count": 0,
                    "customers": set(),
                    "revenue": Decimal("0"),
                }
            city_metrics[city_name]["order_count"] += 1
            if cid:
                city_metrics[city_name]["customers"].add(cid)
            city_metrics[city_name]["revenue"] += rev

        total_orders_for_city = len(orders)
        sorted_cities = sorted(city_metrics.values(), key=lambda x: x["revenue"], reverse=True)
        city_distribution = [
            {
                "city": c["city"],
                "order_count": c["order_count"],
                "customer_count": len(c["customers"]),
                "revenue": format_money(c["revenue"]),
                "percentage": round(float((c["revenue"] / total_revenue * 100)), 1) if total_revenue > Decimal("0") else 0.0,
                "order_percentage": round((c["order_count"] / total_orders_for_city * 100), 1) if total_orders_for_city else 0.0,
            }
            for c in sorted_cities
        ]

        return {
            "summary": {
                "total_customers": total_customers,
                "active_buyers": active_buyers_count,
                "total_orders": total_orders_count,
                "total_revenue": format_money(total_revenue),
                "aov": format_money(aov),
                "arpu": format_money(arpu),
                "status_scope": status_scope,
            },
            "demographics": {
                "gender": gender_list,
                "age_groups": age_list,
                "interests": interest_list,
                "by_age_group": age_group_details,
                "by_gender": gender_details,
                "gender_category_matrix": gender_category_matrix,
            },
            "spending_trends": {
                "period_type": period,
                "timeline": timeline,
                "customer_segments": segments,
            },
            "product_insights": {
                "top_categories": top_cats_list,
                "top_products": top_prods_list,
            },
            "survey_insights": survey_insights,
            "strategic_recommendations": recommendations,
            "city_distribution": city_distribution,
        }

