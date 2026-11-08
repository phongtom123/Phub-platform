from decimal import Decimal
from postgrest.exceptions import APIError
from phub_api.repositories.pagination import rows


class CrmAnalyticsRepository:
    def __init__(self, db):
        self.db = db
        self._order_lines_cache = {}

    def customers(self):
        try:
            def qf():
                return self.db.table("KHACH_HANG").select(
                    "ma_kh, ten_kh, sdt, dia_chi_chi_tiet_md, tinh_thanh_md, xa_phuong_md, ngay_sinh, ngay_tao, gioi_tinh"
                ).order("ma_kh")
            return list(rows(qf))
        except APIError as exc:
            if exc.code != "42703" or "gioi_tinh" not in str(exc.message):
                raise
            def qf_fallback():
                return self.db.table("KHACH_HANG").select(
                    "ma_kh, ten_kh, sdt, dia_chi_chi_tiet_md, tinh_thanh_md, xa_phuong_md, ngay_sinh, ngay_tao"
                ).order("ma_kh")
            return list(rows(qf_fallback))

    def completed_orders(self, start=None, end=None, status_scope="ACTIVE"):
        def qf():
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
                query = query.lte(time_col, f"{end}T23:59:59.999999+07:00")
            return query.order("ma_donhang")

        orders = list(rows(qf))
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
                def chunk_qf(c=chunk):
                    return self.db.table("CT_DON_HANG").select(
                        "ma_donhang, sku, so_luong, don_gia, giam_gia, giam_gia_voucher, thanh_tien"
                    ).in_("ma_donhang", c).order("ma_ct_donhang")
                all_lines.extend(list(rows(chunk_qf)))
            if cache_key is not None:
                self._order_lines_cache[cache_key] = all_lines
            return all_lines

        def qf():
            query = self.db.table("CT_DON_HANG").select(
                "ma_donhang, sku, so_luong, don_gia, giam_gia, giam_gia_voucher, thanh_tien"
            )
            if order_ids is not None:
                query = query.in_("ma_donhang", order_ids)
            return query.order("ma_ct_donhang")

        result = list(rows(qf))
        if cache_key is not None:
            self._order_lines_cache[cache_key] = result
        return result

    def products(self):
        return list(rows(lambda: self.db.table("SAN_PHAM").select("sku, ten_sp, ma_loai_sp").order("sku")))

    def categories(self):
        return list(rows(lambda: self.db.table("LOAI_SP").select("ma_loai_sp, ten_loai_sp").order("ma_loai_sp")))

    def surveys(self):
        return list(rows(lambda: self.db.table("KHAO_SAT").select("*").order("ma_khao_sat")))

    def survey_responses(self):
        # Return submitted answers and their question metadata; scoring belongs to the service.
        guis = list(rows(lambda: self.db.table("GUI_KHAO_SAT").select(
            "ma_gui,ma_khao_sat,ma_kh,hoan_thanh_luc,ngay_gui"
        ).order("ma_gui")))
        submitted = [g for g in guis if g.get("hoan_thanh_luc")]
        if not submitted:
            return []
        answers = list(rows(lambda: self.db.table("TRA_LOI_KHAO_SAT").select(
            "ma_tra_loi,ma_gui,ma_cau_hoi,diem,noi_dung"
        ).order("ma_tra_loi")))
        khs = {k["ma_kh"]: k for k in rows(lambda: self.db.table("KHACH_HANG")
               .select("ma_kh,ten_kh").order("ma_kh"))}
        qs = {q["ma_cau_hoi"]: q for q in rows(lambda: self.db.table("CAU_HOI_KHAO_SAT")
              .select("ma_cau_hoi,loai_cau_hoi,nhom_noi_dung").order("ma_cau_hoi"))}
        submissions = {
            g["ma_gui"]: {
                "ma_bai_nop": g["ma_gui"], "ma_khao_sat": g.get("ma_khao_sat"),
                "ma_kh": g["ma_kh"], "ten_nguoi_gui": khs.get(g["ma_kh"], {}).get("ten_kh"),
                "ngay_gui": g["hoan_thanh_luc"], "answers": [],
            }
            for g in submitted
        }
        for a in answers:
            submission = submissions.get(a.get("ma_gui"))
            if submission is None:
                continue
            q = qs.get(a.get("ma_cau_hoi"), {})
            submission["answers"].append({
                "diem": a.get("diem"), "noi_dung": a.get("noi_dung"),
                "loai_cau_hoi": q.get("loai_cau_hoi"), "nhom_noi_dung": q.get("nhom_noi_dung"),
            })
        return list(submissions.values())

