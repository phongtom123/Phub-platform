"""Real PostgreSQL allocation/concurrency checks. No .env or cloud writes."""
from concurrent.futures import ThreadPoolExecutor
import json
from uuid import uuid4

import psycopg2

from test_automatic_checkout_invoice import main


def check(execute, migrate, request, dsn):
    execute('reset role; drop trigger reject_test_invoice on "HOA_DON"; drop function public.reject_test_invoice();')
    migrate("20261102140733_multi_warehouse_customer_checkout.sql")
    execute('''
        insert into "KHO"(ma_kho,ten_kho,dia_chi,trang_thai)
          values(11,'First','Test',1),(12,'Second','Test',1),(13,'Third','Test',1),
                (14,'Fourth','Test',1),(15,'Inactive','Test',0);
        insert into "SAN_PHAM"(ma_sp,sku,ten_sp,ma_loai_sp,ma_loai_sp_con,gia_ban_hien_tai,don_vi)
          values('POOL','POOL','Pooled product','L','SC',100.10,'unit'),
                ('ROUND','ROUND','Rounding product','L','SC',0.05,'unit'),
                ('SHIFT','SHIFT','Reallocation product','L','SC',1,'unit'),
                ('RACE','RACE','Concurrent product','L','SC',1,'unit');
        insert into "TON_KHO"(ma_kho,sku,so_luong_ton) values
          (11,'POOL',39),(12,'POOL',39),(13,'POOL',60),(14,'POOL',50),(15,'POOL',1000),
          (11,'ROUND',1),(12,'ROUND',1),(13,'ROUND',1),
          (11,'SHIFT',3),(12,'SHIFT',3),(11,'RACE',4),(12,'RACE',4);
        insert into "DON_HANG"(ma_donhang,ma_kh,kenh_ban,trang_thai,thoi_gian_dat)
          values('HELD-21','C','ONLINE','MOI',now()),('HELD-2','C','ONLINE','DANG_CHUAN_BI',now());
        insert into "CT_DON_HANG"(ma_donhang,sku,ma_kho_xuat,ten_sp_luc_ban,don_vi_luc_ban,so_luong,don_gia,giam_gia,giam_gia_voucher,thue_suat,tien_thue,thanh_tien)
          values('HELD-21','POOL',11,'Pooled product','unit',21,100.10,0,0,10,0,2102.10),
                ('HELD-2','POOL',14,'Pooled product','unit',2,100.10,0,0,10,0,200.20);
        insert into "VOUCHER"(ma_voucher,ma_ctkm,ma_code,loai_giam,gia_tri_giam,gia_tri_don_toi_thieu,trang_thai,ngay_tao)
          values(2,1,'POOLCENT','SO_TIEN',0.01,0,'HOAT_DONG',now());
        set role service_role;
    ''')

    def call(body, create=False, key=None, legacy=False):
        function = "customer_checkout_v2" if legacy else "customer_checkout_multi_warehouse_v1"
        return execute(f"select public.{function}('C',%s::jsonb,%s,%s,'reserve_on_order','exclusive',10,'VND',1,'invoice','Asia/Ho_Chi_Minh')", (json.dumps(body), str(key) if key else None, create))

    quote = call({"items": [{"sku": "POOL", "quantity": 165}]})
    assert "quote" in quote, quote
    allocations = [{"warehouse_id": 11, "quantity": 18}, {"warehouse_id": 12, "quantity": 39},
                   {"warehouse_id": 13, "quantity": 60}, {"warehouse_id": 14, "quantity": 48}]
    assert len(quote["quote"]["items"]) == 1, "Customer cart remains one line per SKU"
    assert quote["quote"]["items"][0]["allocations"] == allocations
    assert call({"items": [{"sku": "POOL", "quantity": 166}]})["error"]["code"] == "INSUFFICIENT_STOCK"
    legacy = request(quote["quote"])
    assert call(legacy, True, uuid4(), legacy=True)["error"]["code"] == "INSUFFICIENT_STOCK", "Legacy explicit warehouse path is preserved"
    key = uuid4()
    body = request(quote["quote"])
    body["items"][0]["warehouse_id"] = 15  # A stale/forged hint must not allocate the inactive warehouse.
    result = call(body, True, key)
    assert "order" in result, result
    order_id = result["order"]["id"]
    assert result["order"]["items"][0]["allocations"] == allocations
    actual = execute('''select jsonb_agg(jsonb_build_object('warehouse_id',ma_kho_xuat,'quantity',so_luong) order by ma_kho_xuat)
                        from "CT_DON_HANG" where ma_donhang=%s''', (order_id,))
    assert actual == allocations
    assert execute('select sum(so_luong_ton) from "TON_KHO" where sku=\'POOL\' and ma_kho<>15') == 188
    assert call(body, True, key)["replayed"]
    assert execute('select count(*) from "HOA_DON" where ma_donhang=%s', (order_id,)) == 1
    assert execute('select sum(thanh_tien)=(select tong_tien_sau_thue from "HOA_DON" where ma_donhang=%s) from "CT_DON_HANG" where ma_donhang=%s', (order_id, order_id))
    assert call({"items": [{"sku": "POOL", "quantity": 1}]})["error"]["code"] == "INSUFFICIENT_STOCK"
    failed_key = uuid4()
    before = execute('select count(*) from "DON_HANG"')
    assert call(body, True, failed_key)["error"]["code"] == "INSUFFICIENT_STOCK"
    assert execute('select count(*) from "DON_HANG"') == before
    assert execute('select count(*) from customer_order_private.idempotency where key=%s', (str(failed_key),)) == 0
    execute('update "DON_HANG" set trang_thai=\'HUY\' where ma_donhang=%s', (order_id,))
    assert "quote" in call({"items": [{"sku": "POOL", "quantity": 165}]}), "Cancellation releases every allocation"

    small_quote = call({"items": [{"sku": "ROUND", "quantity": 3}], "voucher_code": "POOLCENT"})["quote"]
    small = call(request(small_quote), True, uuid4())["order"]
    assert execute('select sum(giam_gia_voucher)::text from "CT_DON_HANG" where ma_donhang=%s', (small["id"],)) == "0.01"
    assert execute('select tong_tien_sau_thue::text from "HOA_DON" where ma_donhang=%s', (small["id"],)) == "0.16"
    assert execute('select bool_and(giam_gia_voucher<=so_luong*don_gia) from "CT_DON_HANG" where ma_donhang=%s', (small["id"],))
    shift_quote = call({"items": [{"sku": "SHIFT", "quantity": 5}]})["quote"]
    execute('update "TON_KHO" set so_luong_ton=2 where sku=\'SHIFT\' and ma_kho=11')
    shifted = call(request(shift_quote), True, uuid4())["order"]
    assert shifted["items"][0]["allocations"] == [{"warehouse_id": 11, "quantity": 2}, {"warehouse_id": 12, "quantity": 3}]

    race_body = request(call({"items": [{"sku": "RACE", "quantity": 6}]})["quote"])
    def simultaneous_order(_):
        connection = psycopg2.connect(dsn)
        connection.autocommit = True
        try:
            with connection.cursor() as sql:
                sql.execute("set role service_role; set statement_timeout='10s'")
                sql.execute("select public.customer_checkout_multi_warehouse_v1('C',%s::jsonb,%s,true,'reserve_on_order','exclusive',10,'VND',1,'invoice','Asia/Ho_Chi_Minh')", (json.dumps(race_body), str(uuid4())))
                return sql.fetchone()[0]
        finally:
            connection.close()
    with ThreadPoolExecutor(max_workers=2) as executor:
        races = list(executor.map(simultaneous_order, range(2)))
    assert sum("order" in entry for entry in races) == 1, races
    assert [entry["error"]["code"] for entry in races if "error" in entry] == ["INSUFFICIENT_STOCK"], races
    assert execute('select sum(so_luong) from "CT_DON_HANG" where sku=\'RACE\'') == 6
    assert not execute("select has_function_privilege('anon','public.customer_checkout_multi_warehouse_v1(text,jsonb,uuid,boolean,text,text,numeric,text,integer,text,text)','EXECUTE')")
    print("PASS: 188 physical / 23 reserved = 165 pooled, inactive warehouses excluded, allocation rechecked, discount cents and invoice preserved, retry/rollback, cancellation release, concurrent orders cannot oversell, legacy RPC unchanged")


if __name__ == "__main__":
    main(check)
