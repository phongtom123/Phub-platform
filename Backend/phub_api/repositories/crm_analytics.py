from decimal import Decimal


class CrmAnalyticsRepository:
    def __init__(self, db):
        self.db = db
        self._order_lines_cache = {}

    def customers(self):
        try:
            return self.db.table("KHACH_HANG").select(
                "ma_kh, ten_kh, sdt, dia_chi_chi_tiet_md, tinh_thanh_md, xa_phuong_md, ngay_sinh, ngay_tao, gioi_tinh"
            ).execute().data or []
        except Exception:
            return self.db.table("KHACH_HANG").select(
                "ma_kh, ten_kh, sdt, dia_chi_chi_tiet_md, tinh_thanh_md, xa_phuong_md, ngay_sinh, ngay_tao"
            ).execute().data or []

    def completed_orders(self, start=None, end=None, status_scope="ACTIVE"):
        query = self.db.table("DON_HANG").select(
            "ma_donhang, ma_kh, thoi_gian_dat, thoi_gian_hoan_thanh, trang_thai, tinh_thanh, dia_chi_chi_tiet, xa_phuong"
        )
        if status_scope == "COMPLETED":
            query = query.eq("trang_thai", "HOAN_THANH")
        else:
            query = query.neq("trang_thai", "HUY")

        time_col = "thoi_gian_hoan_thanh" if status_scope == "COMPLETED" else "thoi_gian_dat"
        if start:
            query = query.gte(time_col, f"{start}T00:00:00+07:00")
        if end:
            query = query.lte(time_col, f"{end}T23:59:59+07:00")
        orders = query.execute().data or []
        if not orders:
            return []

        order_ids = [o["ma_donhang"] for o in orders]
        lines = self.order_lines(order_ids)
        totals: dict[str, Decimal] = {}
        for l in lines:
            oid = l.get("ma_donhang")
            amt = l.get("thanh_tien")
            if amt is None:
                qty = Decimal(str(l.get("so_luong") or 0))
                price = Decimal(str(l.get("don_gia") or 0))
                disc1 = Decimal(str(l.get("giam_gia") or 0))
                disc2 = Decimal(str(l.get("giam_gia_voucher") or 0))
                line_total = (qty * price) - disc1 - disc2
            else:
                line_total = Decimal(str(amt))
            totals[oid] = totals.get(oid, Decimal("0")) + line_total

        for o in orders:
            o["tong_tien"] = str(totals.get(o["ma_donhang"], Decimal("0")))
        return orders

    def order_lines(self, order_ids=None):
        if order_ids is not None and not order_ids:
            return []

        cache_key = tuple(sorted(order_ids)) if order_ids is not None else None
        if cache_key is not None and cache_key in self._order_lines_cache:
            return self._order_lines_cache[cache_key]

        # Batch chunking: Ngăn chặn lỗi HTTP 414 (URI Too Long) khi số lượng đơn hàng lớn
        CHUNK_SIZE = 150
        if order_ids is not None and len(order_ids) > CHUNK_SIZE:
            all_lines = []
            for i in range(0, len(order_ids), CHUNK_SIZE):
                chunk = order_ids[i:i + CHUNK_SIZE]
                chunk_data = self.db.table("CT_DON_HANG").select(
                    "ma_donhang, sku, so_luong, don_gia, giam_gia, giam_gia_voucher, thanh_tien"
                ).in_("ma_donhang", chunk).execute().data or []
                all_lines.extend(chunk_data)
            if cache_key is not None:
                self._order_lines_cache[cache_key] = all_lines
            return all_lines

        query = self.db.table("CT_DON_HANG").select(
            "ma_donhang, sku, so_luong, don_gia, giam_gia, giam_gia_voucher, thanh_tien"
        )
        if order_ids is not None:
            query = query.in_("ma_donhang", order_ids)
        result = query.execute().data or []
        if cache_key is not None:
            self._order_lines_cache[cache_key] = result
        return result

    def products(self):
        return self.db.table("SAN_PHAM").select(
            "sku, ten_sp, ma_loai_sp"
        ).execute().data

    def categories(self):
        return self.db.table("LOAI_SP").select(
            "ma_loai_sp, ten_loai_sp"
        ).execute().data

    def surveys(self):
        try:
            return self.db.table("KHAO_SAT").select("*").execute().data or []
        except Exception:
            return []

    def survey_responses(self):
        try:
            answers = self.db.table("TRA_LOI_KHAO_SAT").select("*").execute().data or []
            if not answers:
                return []
            guis = {g["ma_gui"]: g for g in (self.db.table("GUI_KHAO_SAT").select("*").execute().data or [])}
            khs = {k["ma_kh"]: k for k in (self.db.table("KHACH_HANG").select("ma_kh, ten_kh").execute().data or [])}
            qs = {q["ma_cau_hoi"]: q for q in (self.db.table("CAU_HOI_KHAO_SAT").select("*").execute().data or [])}

            submissions = {}
            for a in answers:
                mg = a.get("ma_gui")
                if not mg:
                    continue
                gui = guis.get(mg, {})
                kh_id = gui.get("ma_kh")
                kh_name = khs.get(kh_id, {}).get("ten_kh", "Khách hàng")
                if mg not in submissions:
                    submissions[mg] = {
                        "ma_bai_nop": mg,
                        "ma_khao_sat": a.get("ma_khao_sat"),
                        "ma_kh": kh_id,
                        "ten_nguoi_gui": kh_name,
                        "diem_san_pham": None,
                        "diem_dich_vu": None,
                        "diem_tong_the": None,
                        "y_kien_dong_gop": None,
                        "ngay_gui": gui.get("hoan_thanh_luc") or gui.get("ngay_gui"),
                    }
                q = qs.get(a.get("ma_cau_hoi"), {})
                if a.get("diem") is not None:
                    score = int(a["diem"])
                    submissions[mg]["diem_tong_the"] = score
                    nhom = q.get("nhom_noi_dung")
                    if nhom == "SAN_PHAM":
                        submissions[mg]["diem_san_pham"] = score
                    elif nhom == "DICH_VU":
                        submissions[mg]["diem_dich_vu"] = score
                    else:
                        submissions[mg]["diem_san_pham"] = submissions[mg]["diem_san_pham"] or score
                        submissions[mg]["diem_dich_vu"] = submissions[mg]["diem_dich_vu"] or score
                if a.get("noi_dung"):
                    submissions[mg]["y_kien_dong_gop"] = a["noi_dung"]

            for sub in submissions.values():
                d_tong = sub["diem_tong_the"] or 5
                sub["diem_tong_the"] = d_tong
                sub["diem_san_pham"] = sub["diem_san_pham"] or d_tong
                sub["diem_dich_vu"] = sub["diem_dich_vu"] or d_tong

            return list(submissions.values())
        except Exception:
            return []

