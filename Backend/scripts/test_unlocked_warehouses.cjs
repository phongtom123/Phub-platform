// Isolated PostgreSQL upgrade checks; no connection to the real database.
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { PGlite } = require(process.env.PHUB_PGLITE_MODULE || '@electric-sql/pglite');

(async () => {
  const db = new PGlite();
  try {
    const migrate = name => db.exec(fs.readFileSync(path.resolve(__dirname, '../migrations', name), 'utf8'));
    const scalar = async (sql, args = []) => (await db.query(sql, args)).rows[0].r;
    await db.exec('create role anon; create role authenticated; create role service_role bypassrls;');
    for (const name of ['001_initial_schema.sql', '20261004_customer_orders.sql', '20261006_customer_checkout.sql',
      '20261023_customer_support.sql', '20261028132157_admin_operations.sql', '20261029162141_warehouse_receipts.sql',
      '20261030020310_business_report.sql']) await migrate(name);
    await db.exec(`insert into "KHO"(ma_kho,ten_kho,dia_chi,trang_thai) values(1,'First','Test',1),(2,'Central','Test',1),(3,'Third','Test',1),(4,'Inactive','Test',0);
      insert into "NHAN_VIEN"(ma_nhan_vien,loai_nhan_vien,ho_ten,ma_kho) values('AD','ADMIN','Admin',null),('NV1','NHAN_VIEN','Staff1',1),('NV2','NHAN_VIEN','Staff2',2);
      insert into "TAI_KHOAN"(ma_tk,ten_tai_khoan,mat_khau_hash,ma_nhan_vien) values('A','admin','disabled','AD'),('W1','staff1','disabled','NV1'),('W2','staff2','disabled','NV2');
      insert into "KHACH_HANG"(ma_kh,ten_kh) values('C','Customer');
      insert into "NHA_CUNG_CAP"(ma_ncc,ten_ncc) values(1,'Supplier');
      insert into "LOAI_SP" values('L','Category',1);
      insert into "LOAI_SP_CON"(ma_loai_sp_con,ten_loai_sp_con,ma_loai_sp) values('SC','Sub','L');
      insert into "SAN_PHAM"(ma_sp,sku,ten_sp,ma_loai_sp,ma_loai_sp_con,gia_ban_hien_tai,don_vi) values('P','S','Product','L','SC',100,'unit');
      insert into "TON_KHO"(ma_kho,sku,so_luong_ton) values(1,'S',100),(2,'S',1),(3,'S',50),(4,'S',999);`);
    await migrate('20261030023519_receipt_sale_pricing.sql');
    await migrate('20261030034222_fixed_operating_warehouse.sql');
    await migrate('20261030151651_simplify_receipt_pricing.sql');
    const before = await scalar(`select jsonb_build_object('warehouses',(select jsonb_agg(to_jsonb(w) order by ma_kho) from "KHO" w),'stock',(select jsonb_agg(to_jsonb(i) order by ma_kho,sku) from "TON_KHO" i),'employees',(select jsonb_agg(to_jsonb(n) order by ma_nhan_vien) from "NHAN_VIEN" n)) as r`);
    await migrate('20261101162759_unlock_warehouses.sql');
    const after = await scalar(`select jsonb_build_object('warehouses',(select jsonb_agg(to_jsonb(w) order by ma_kho) from "KHO" w),'stock',(select jsonb_agg(to_jsonb(i) order by ma_kho,sku) from "TON_KHO" i),'employees',(select jsonb_agg(to_jsonb(n) order by ma_nhan_vien) from "NHAN_VIEN" n)) as r`);
    assert.deepEqual(after,before,'unlocking must not rewrite records, stock, statuses or assignments');
    assert.equal(await scalar("select count(*)::int as r from pg_trigger where not tgisinternal and tgname='fixed_warehouse'"),0);
    assert.equal(await scalar("select count(*)::int as r from pg_trigger where not tgisinternal and tgname='transfers_retired'"),2);
    await db.exec('set role service_role');
    assert.equal((await scalar("select admin_ops.warehouse_actor('W1') as r")).warehouse,1);
    assert.equal((await scalar("select admin_ops.pricing_actor('W1') as r")).warehouse,1);
    const command = (actor, portal, action, id, body, key=randomUUID()) => scalar('select public.priced_receipt_v1($1,$2,$3,$4,$5,$6) as r',[actor,portal,action,key,id,body]);
    const body = warehouse_id => ({warehouse_id,supplier_id:1,lines:[{sku:'S',quantity:2,unit_price:'100',markup_rate:'0',taxes:[]}]});
    const receipt1 = (await command('A','ADMIN','create',null,body(1))).data[0].ma_phieu_nhap;
    const receipt3 = (await command('A','ADMIN','create',null,body(3))).data[0].ma_phieu_nhap;
    assert.ok(receipt1 && receipt3);
    const quote = await scalar("select public.receipt_pricing_preview_v1('A',$1) as r",[receipt1]);
    await assert.rejects(()=>scalar("select public.receipt_pricing_preview_v1('W2',$1) as r",[receipt1]),/NOT_FOUND/);
    await assert.rejects(()=>command('W2','WAREHOUSE','confirm',receipt1,{pricing_version:quote.version}),/NOT_FOUND/);
    const key=randomUUID(),confirm={_expected_status:'NHAP',pricing_version:quote.version};
    await command('A','ADMIN','confirm',receipt1,confirm,key);
    const replay=await command('A','ADMIN','confirm',receipt1,confirm,key);
    assert.equal(replay.replayed,true);
    assert.equal(await scalar(`select so_luong_ton as r from "TON_KHO" where ma_kho=1 and sku='S'`),102);
    assert.equal(await scalar(`select so_luong_ton as r from "TON_KHO" where ma_kho=2 and sku='S'`),1,'receipt stock only changes its own warehouse');
    await assert.rejects(()=>command('A','ADMIN','create',null,body(4)),/VALIDATION_ERROR|NOT_FOUND/);
    await db.exec(`update "KHO" set ten_kho='Renamed' where ma_kho=3; update "NHAN_VIEN" set ma_kho=3 where ma_nhan_vien='NV1';`);
    assert.equal((await scalar("select admin_ops.warehouse_actor('W1') as r")).warehouse,3);
    const checkout=async(quantity,create=false)=>scalar(`select public.customer_checkout_v2('C',$1,$2,$3,'reserve_on_order','exclusive',10,'VND',1,'invoice','Asia/Ho_Chi_Minh') as r`,[create?{items:[{sku:'S',quantity,warehouse_id:3,expected_unit_price:'100.00'}],recipient:{name:'Test',phone:'0901234567',address_line:'Test',province:'Test',ward:'Test'},expected_discount:'0.00',expected_total:`${quantity*100}.00`}:{items:[{sku:'S',quantity}]},create?randomUUID():null,create]);
    assert.equal((await checkout(2)).quote.items[0].warehouse_id,1,'checkout can allocate outside warehouse 2');
    const placed=await checkout(2,true);
    assert.ok(placed.order,'an order can be created in warehouse 3');
    assert.equal(await scalar(`select ma_kho_xuat as r from "CT_DON_HANG" where ma_donhang=$1`,[placed.order.id]),3);
    assert.equal((await checkout(500)).error.code,'INSUFFICIENT_STOCK','inactive warehouse 4 cannot supply orders');
    await assert.rejects(()=>db.exec(`insert into "PHIEU_CHUYEN_KHO"(ma_kho_xuat,ma_kho_nhan,ngay_tao,trang_thai,nguoi_tao) values(1,3,now(),'NHAP','AD')`),/TRANSFER_DISABLED/);
    console.log('PASS: all warehouses unlocked, records preserved, receipt confirmation/idempotency, staff ownership, inactive warehouse rejection, multi-warehouse checkout, transfers remain retired');
  } finally { await db.close(); }
})().catch(error=>{console.error(error);process.exitCode=1;});
