"""Deterministic, fictional examples for docs, not a seed script or real records."""
from .resources import RESOURCES, public_columns

VALUES = {
    "ma_kho": 1, "ten_kho": "Kho trung tâm", "dia_chi": "Địa chỉ minh họa",
    "ma_nhan_vien": "NV001", "ho_ten": "Nhân viên minh họa", "loai_nhan_vien": "ADMIN",
    "email": "example@example.com", "sdt": "0900000000", "luong": "15000000.00",
    "ma_tk": "TK001", "ten_tai_khoan": "example.admin", "ma_kh": "KH001", "ten_kh": "Khách hàng minh họa",
    "ma_loai_sp": "CPU", "ten_loai_sp": "Vi xử lý", "ma_sp": "SP001", "sku": "INTEL-I5-14400F",
    "ten_sp": "Intel Core i5-14400F", "thuong_hieu": "Intel", "gia_ban_hien_tai": "2500000.00",
    "mo_ta": "Nội dung minh họa", "thong_so_ky_thuat": "Socket: LGA1700", "don_vi": "Cai",
    "bao_hanh_thang": 36, "duong_dan_anh": "https://example.com/cpu.jpg",
    "so_luong_ton": 10, "ma_ncc": 1, "ten_ncc": "Nhà cung cấp linh kiện minh họa",
    "ma_phieu_nhap": 1, "ma_phieu_code": "PN-0001", "so_luong_nhap": 2, "gia_nhap": "2000000.00",
    "nguoi_tao": "NV001", "ma_phieu_chuyen": 1, "ma_kho_xuat": 1, "ma_kho_nhan": 2, "so_luong": 2,
    "ma_donhang": "DH001", "kenh_ban": "ONLINE", "ten_nguoi_nhan": "Khách hàng minh họa",
    "sdt_nguoi_nhan": "0900000000", "ma_ct_donhang": 1, "ten_sp_luc_ban": "Intel Core i5-14400F",
    "don_vi_luc_ban": "Cai", "don_gia": "2500000.00", "giam_gia": "0.00", "giam_gia_voucher": "50000.00",
    "thue_suat": "0.00", "tien_thue": "0.00", "thanh_tien": "4950000.00",
    "ma_hoadon": "HD001", "tong_tien_giam": "50000.00", "tong_tien_truoc_thue": "4950000.00",
    "tong_tien_thue": "0.00", "tong_tien_sau_thue": "4950000.00", "nguoi_lap": "NV001",
    "ma_thanh_toan": 1, "so_tien": "4950000.00", "loai_giao_dich": "THU", "phuong_thuc": "CHUYEN_KHOAN",
    "ma_giao_dich": "EXAMPLE-TXN-001", "ma_ctkm": 1, "ten_chuong_trinh": "Ưu đãi linh kiện minh họa",
    "ngay_bat_dau": "2026-10-05T00:00:00+07:00", "ngay_ket_thuc": "2026-11-05T00:00:00+07:00",
    "ma_voucher": 1, "ma_code": "PC10", "loai_giam": "PHAN_TRAM", "gia_tri_giam": "10.00",
    "giam_toi_da": "50000.00", "gia_tri_don_toi_thieu": "1000000.00",
    "gioi_han_tong_luot": 100, "gioi_han_moi_khach": 1, "ma_su_dung": 1, "so_tien_giam": "50000.00",
}
SESSION_EXAMPLE = {"account_id": "TK001", "username": "example.admin", "role": "ADMIN",
                   "name": "Nhân viên minh họa", "customer_id": None, "employee_id": "NV001", "warehouse_id": None}


def row_example(name: str) -> dict:
    row = {}
    for column in public_columns(name):
        field, kind = column["name"], column["type"]
        if field in VALUES:
            value = VALUES[field]
        elif column["default"] is not None:
            value = str(column["default"]) + ".00" if kind.startswith("decimal") else column["default"]
        elif not column["required"]:
            value = None
        elif kind == "int":
            value = 1
        elif kind == "datetime":
            value = "2026-10-05T08:00:00+07:00"
        elif kind.startswith("decimal"):
            value = "0.00"
        else:
            value = "Ví dụ"
        row[field] = value
    if name == "accounts":
        row["ma_kh"] = None
    if name == "employees":
        row["ma_kho"] = None
    if name == "payments":
        row["trang_thai"] = "THANH_CONG"
    return row


def payload_example(name: str, patch: bool = False) -> dict:
    from .resources import payload_model
    row = row_example(name)
    fields = payload_model(name, patch).model_fields
    if patch:
        preferred = {"warehouses": "ten_kho", "employees": "ho_ten", "accounts": "email", "customers": "ten_kh",
                     "categories": "ten_loai_sp", "products": "duong_dan_anh", "suppliers": "ten_ncc",
                     "promotions": "ten_chuong_trinh", "vouchers": "trang_thai"}
        field = preferred[name]
        return {field: "TAM_DUNG" if name == "vouchers" else row[field]}
    result = {field: row[field] for field in fields if field in row}
    if name == "accounts":
        result["password"] = "Replace_with_your_password"
    return result


def key_example(name: str) -> list:
    row = row_example(name)
    return [row[field] for field in RESOURCES[name].keys]
