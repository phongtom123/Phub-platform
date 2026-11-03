"""Real, isolated PostgreSQL checkout/invoice checks. Never loads .env or cloud data."""
import json
import os
from pathlib import Path
import shutil
import socket
import subprocess
import tempfile
from uuid import uuid4

import psycopg2


def main(extra_checks=None):
    binary_dir = Path(os.environ.get("PHUB_POSTGRES_BIN", "C:/Program Files/PostgreSQL/18/bin"))
    initdb = shutil.which("initdb") or str(binary_dir / "initdb.exe")
    pg_ctl = shutil.which("pg_ctl") or str(binary_dir / "pg_ctl.exe")
    root = Path(__file__).resolve().parents[1]
    with socket.socket() as listener:
        listener.bind(("127.0.0.1", 0))
        port = listener.getsockname()[1]
    with tempfile.TemporaryDirectory(prefix="phub-auto-invoice-") as temp:
        cluster = str(Path(temp) / "data")
        subprocess.run([initdb, "-D", cluster, "-A", "trust", "--no-locale", "--encoding=UTF8", "-U", "postgres"], check=True, capture_output=True)
        subprocess.run([pg_ctl, "-D", cluster, "-l", str(Path(temp) / "postgres.log"), "-o", f"-h 127.0.0.1 -p {port}", "-w", "start"], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=30)
        try:
            with psycopg2.connect(host="127.0.0.1", port=port, user="postgres", dbname="postgres") as db:
                db.autocommit = True
                with db.cursor() as sql:
                    def execute(statement, args=None):
                        sql.execute(statement, args)
                        return sql.fetchone()[0] if sql.description else None

                    def migrate(name):
                        execute((root / "migrations" / name).read_text(encoding="utf-8"))

                    execute("create role anon; create role authenticated; create role service_role bypassrls;")
                    for name in ["001_initial_schema.sql", "20261004_customer_orders.sql", "20261006_customer_checkout.sql"]:
                        migrate(name)
                    execute('''
                        insert into "KHO"(ma_kho,ten_kho,dia_chi,trang_thai) values(1,'Test','Test',1);
                        insert into "KHACH_HANG"(ma_kh,ten_kh) values('C','Customer');
                        insert into "NHAN_VIEN"(ma_nhan_vien,ho_ten,loai_nhan_vien) values('A','Promotion fixture','ADMIN');
                        insert into "LOAI_SP" values('L','Category',1);
                        insert into "LOAI_SP_CON"(ma_loai_sp_con,ten_loai_sp_con,ma_loai_sp) values('SC','Sub','L');
                        insert into "SAN_PHAM"(ma_sp,sku,ten_sp,ma_loai_sp,ma_loai_sp_con,gia_ban_hien_tai,don_vi)
                          values('P','S','Product','L','SC',10000.10,'unit'),('P2','T','Rounding','L','SC',0.05,'unit');
                        insert into "TON_KHO"(ma_kho,sku,so_luong_ton) values(1,'S',100),(1,'T',100);
                        insert into "CHUONG_TRINH_KHUYEN_MAI"(ma_ctkm,ten_chuong_trinh,ngay_bat_dau,ngay_ket_thuc,trang_thai,nguoi_tao,ngay_tao)
                          values(1,'Test',now()-interval '1 day',now()+interval '1 day','HOAT_DONG','A',now());
                        insert into "VOUCHER"(ma_voucher,ma_ctkm,ma_code,loai_giam,gia_tri_giam,gia_tri_don_toi_thieu,trang_thai,ngay_tao)
                          values(1,1,'SAVE10','PHAN_TRAM',10,0,'HOAT_DONG',now());
                    ''')

                    def checkout(request, create=False, key=None):
                        return execute("select public.customer_checkout_v2('C',%s::jsonb,%s,%s,'reserve_on_order','exclusive',10,'VND',1,'invoice','Asia/Ho_Chi_Minh')", (json.dumps(request), str(key) if key else None, create))

                    def request(quote):
                        return {
                            "recipient": {"name": "Test Customer", "phone": "0901234567", "address_line": "123 Test", "ward": "Ward", "province": "City"},
                            "voucher_code": quote["voucher_code"], "expected_discount": quote["discount_total"], "expected_total": quote["total"],
                            "items": [{"sku": line["sku"], "quantity": line["quantity"], "warehouse_id": line["warehouse_id"], "expected_unit_price": line["unit_price"]} for line in quote["items"]],
                        }

                    cart = {"items": [{"sku": "S", "quantity": 2}, {"sku": "T", "quantity": 1}]}
                    old = checkout(request(checkout(cart)["quote"]), True, uuid4())["order"]
                    migrate("20261102080347_automatic_checkout_invoice.sql")
                    migrate("20261102130239_stock_based_cart_quantity.sql")
                    assert execute('select count(*) from "HOA_DON"') == 0, "No historical backfill"
                    assert execute('select sum(tien_thue) from "CT_DON_HANG" where ma_donhang=%s', (old["id"],)) == 0
                    execute("set role service_role")
                    quote = checkout(cart)["quote"]
                    assert execute('select count(*) from "HOA_DON"') == 0, "Quotes never issue invoices"
                    key = uuid4()
                    body = request(quote)
                    placed = checkout(body, True, key)
                    assert not placed.get("error"), placed
                    order_id = placed["order"]["id"]
                    execute('select 1')
                    sql.execute('select nguon_lap,nguoi_lap,tong_tien_truoc_thue::text,tong_tien_thue::text,tong_tien_sau_thue::text,dia_chi_nguoi_mua from "HOA_DON" where ma_donhang=%s', (order_id,))
                    assert sql.fetchone() == ("TU_DONG", None, "20000.25", "2000.03", "22000.28", "123 Test, Ward, City")
                    assert execute('select sum(thanh_tien)=(select tong_tien_sau_thue from "HOA_DON" where ma_donhang=%s) from "CT_DON_HANG" where ma_donhang=%s', (order_id, order_id))
                    assert execute('select trang_thai from "DON_HANG" where ma_donhang=%s', (order_id,)) == "MOI"
                    assert execute('select count(*) from "THANH_TOAN"') == 0, "Issuance does not collect money"
                    replay = checkout(body, True, key)
                    assert replay["replayed"] and replay["order"] == placed["order"]
                    assert execute('select count(*) from "HOA_DON" where ma_donhang=%s', (order_id,)) == 1
                    voucher_cart = {"items": [{"sku": "S", "quantity": 1}], "voucher_code": "SAVE10"}
                    voucher_order = checkout(request(checkout(voucher_cart)["quote"]), True, uuid4())["order"]
                    sql.execute('select tong_tien_giam::text,tong_tien_truoc_thue::text,tong_tien_thue::text,tong_tien_sau_thue::text from "HOA_DON" where ma_donhang=%s', (voucher_order["id"],))
                    assert sql.fetchone() == ("1000.01", "9000.09", "900.01", "9900.10")
                    execute('update "TON_KHO" set so_luong_ton=5000 where sku=\'S\'')
                    large_cart = {"items": [{"sku": "S", "quantity": 1234}]}
                    large_quote = checkout(large_cart)
                    assert "quote" in large_quote, large_quote
                    large_key = uuid4()
                    large_body = request(large_quote["quote"])
                    large_order = checkout(large_body, True, large_key)
                    assert large_order["order"]["items"][0]["quantity"] == 1234, large_order
                    assert checkout(large_body, True, large_key)["replayed"]
                    assert checkout({"items": [{"sku": "S", "quantity": 5001}]})["error"]["code"] == "INSUFFICIENT_STOCK"
                    for invalid in [0, -6, 1.5, 2147483648]:
                        assert checkout({"items": [{"sku": "S", "quantity": invalid}]})["error"]["code"] == "VALIDATION_ERROR"
                    before = execute('select count(*) from "DON_HANG"')
                    execute("reset role")
                    execute('''create function public.reject_test_invoice() returns trigger language plpgsql as $$ begin raise exception 'ORDER_CONFIGURATION_REQUIRED'; end $$;
                        create trigger reject_test_invoice before insert on "HOA_DON" for each row execute function public.reject_test_invoice();''')
                    execute("set role service_role")
                    failed_key = uuid4()
                    failed = checkout(body, True, failed_key)
                    assert failed["error"]["code"] == "ORDER_CONFIGURATION_REQUIRED", failed
                    assert execute('select count(*) from "DON_HANG"') == before, "Invoice failure must roll back the order"
                    assert execute('select count(*) from customer_order_private.idempotency where key=%s', (str(failed_key),)) == 0
                    assert not execute("select has_function_privilege('anon','public.customer_checkout_v2(text,jsonb,uuid,boolean,text,text,numeric,text,integer,text,text)','EXECUTE')")
                    assert not execute("select has_table_privilege('authenticated','public.\"HOA_DON\"','INSERT')")
                    if extra_checks:
                        extra_checks(execute, migrate, request, db.dsn)
                    print("PASS: real PostgreSQL automatic invoice, stock-checked quantities above 1000, invalid quantities rejected, per-line tax rounding, voucher, atomic rollback, idempotent retry, old data preserved, no fake employee/payment, service-only access")
        finally:
            subprocess.run([pg_ctl, "-D", cluster, "-m", "immediate", "-w", "stop"], check=True, capture_output=True)


if __name__ == "__main__":
    main()
