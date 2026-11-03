"""Read-only reconciliation and CSV export for the user-authorized catalog batch."""
import csv
from decimal import Decimal
import json
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from phub_api.config.database import close_supabase, get_supabase


def main():
    folder = Path(__file__).resolve().parents[1] / "seeds"
    manifest = json.loads((folder / "catalog_warehouse1_20261103.json").read_text(encoding="utf-8"))
    expected = {p["sku"]: p for p in manifest["products"]}
    assert manifest["warehouse_id"] == 1 and len(expected) == 24
    db = get_supabase()
    products = db.table("SAN_PHAM").select("ma_sp,sku,ten_sp,gia_ban_hien_tai,trang_thai").in_("sku", list(expected)).execute().data
    stock = db.table("TON_KHO").select("ma_kho,sku,so_luong_ton").in_("sku", list(expected)).execute().data
    receipts = db.table("PHIEU_NHAP").select("ma_phieu_nhap,ma_phieu_code,ma_kho,ma_ncc,trang_thai,dinh_gia_da_ap_dung,ghi_chu").in_(
        "ghi_chu", [r["note"] for r in manifest["receipts"]]).execute().data
    assert len(receipts) == 3 and all(r["ma_kho"] == 1 and r["trang_thai"] == "DA_NHAP" and r["dinh_gia_da_ap_dung"] for r in receipts)
    receipt_map = {r["ma_phieu_nhap"]: r for r in receipts}
    lines = db.table("CT_PHIEU_NHAP").select("ma_phieu_nhap,sku,so_luong_nhap,gia_nhap,ty_le_loi_nhuan,thue_snapshot").in_(
        "ma_phieu_nhap", list(receipt_map)).execute().data
    suppliers = db.table("NHA_CUNG_CAP").select("ma_ncc,ten_ncc,trang_thai").in_("ma_ncc", [r["ma_ncc"] for r in receipts]).execute().data
    supplier_map = {r["ma_ncc"]: r for r in suppliers}
    assert len(products) == len(stock) == len(lines) == 24
    assert {p["sku"] for p in products} == {s["sku"] for s in stock} == {r["sku"] for r in lines} == set(expected)
    product_map = {p["sku"]: p for p in products}
    stock_map = {s["sku"]: s for s in stock}
    line_map = {r["sku"]: r for r in lines}
    report = []
    for sku, p in expected.items():
        actual, inventory, line = product_map[sku], stock_map[sku], line_map[sku]
        receipt = receipt_map[line["ma_phieu_nhap"]]
        supplier = supplier_map[receipt["ma_ncc"]]
        expected_receipt = next(r for r in manifest["receipts"] if r["group"] == p["group"])
        assert actual["trang_thai"] == 1 and Decimal(str(actual["gia_ban_hien_tai"])) == Decimal(p["sale_price_before_vat"])
        assert inventory["ma_kho"] == 1 and inventory["so_luong_ton"] == line["so_luong_nhap"] == p["quantity"]
        assert 10 <= p["quantity"] <= 50 and Decimal(str(line["gia_nhap"])) == Decimal(p["unit_cost"])
        assert Decimal(str(line["ty_le_loi_nhuan"])) == Decimal(manifest["markup_rate"])
        assert len(line["thue_snapshot"]) == 1 and line["thue_snapshot"][0]["code"] == "VAT" and Decimal(line["thue_snapshot"][0]["rate"]) == Decimal("10")
        assert supplier["trang_thai"] == 1 and supplier["ten_ncc"] == expected_receipt["supplier_name"]
        report.append([actual["ma_sp"], sku, p["name"], p["category"], 1, p["quantity"], p["unit"],
                       p["unit_cost"], p["sale_price_before_vat"], receipt["ma_phieu_nhap"], supplier["ten_ncc"]])
    target = folder / "catalog_warehouse1_20261103.csv"
    with target.open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.writer(handle)
        writer.writerow(["Mã sản phẩm", "SKU", "Tên sản phẩm", "Loại con", "Kho", "Số lượng", "Đơn vị", "Giá nhập", "Giá bán trước VAT", "Mã phiếu nhập", "Nhà cung cấp"])
        writer.writerows(report)
    print(json.dumps({"products": len(report), "units": sum(p["quantity"] for p in expected.values()),
                      "warehouse": 1, "receipt_ids": sorted(receipt_map), "csv": str(target)}, ensure_ascii=True))


if __name__ == "__main__":
    try:
        main()
    finally:
        close_supabase()
