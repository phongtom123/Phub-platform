// Real PostgreSQL semantics in an isolated in-memory database. No Supabase writes.
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const {PGlite} = require(process.env.PHUB_PGLITE_MODULE || '@electric-sql/pglite');
(async()=>{
  const db=new PGlite();
  try {
    const migrate=name=>db.exec(fs.readFileSync(path.resolve(__dirname,'../migrations',name),'utf8'));
    const scalar=async(sql,args=[])=>(await db.query(sql,args)).rows[0].r;
    await db.exec('create role anon;create role authenticated;create role service_role bypassrls;');
    for(const name of ['001_initial_schema.sql','20261004_customer_orders.sql','20261006_customer_checkout.sql','20261023_customer_support.sql',
      '20261028132157_admin_operations.sql','20261029162141_warehouse_receipts.sql','20261030020310_business_report.sql'])await migrate(name);
    await db.exec(`insert into "KHO"(ma_kho,ten_kho,dia_chi) values(1,'First','Test'),(2,'Central','Test'),(4,'Fourth','Test');
      insert into "NHAN_VIEN"(ma_nhan_vien,loai_nhan_vien,ho_ten) values('AD','ADMIN','Admin');
      insert into "TAI_KHOAN"(ma_tk,ten_tai_khoan,mat_khau_hash,ma_nhan_vien) values('A','admin','disabled','AD');
      insert into "NHA_CUNG_CAP"(ma_ncc,ten_ncc) values(1,'Supplier');insert into "LOAI_SP" values('L','Category',1);
      insert into "LOAI_SP_CON"(ma_loai_sp_con,ten_loai_sp_con,ma_loai_sp) values('SC','Sub','L');
      insert into "SAN_PHAM"(ma_sp,sku,ten_sp,ma_loai_sp,ma_loai_sp_con,gia_ban_hien_tai,don_vi) values('P','S','Product','L','SC',500,'unit');
      insert into "PHIEU_NHAP"(ma_phieu_nhap,ma_phieu_code,ma_ncc,ma_kho,ngay_tao,ngay_nhap,nguoi_tao,trang_thai) values
      (1,'PN1',1,1,'2026-10-01','2026-10-01','AD','DA_NHAP'),(2,'PN2',1,2,'2026-10-01','2026-10-01','AD','DA_NHAP'),(4,'PN4',1,4,'2026-10-01','2026-10-01','AD','DA_NHAP');
      insert into "CT_PHIEU_NHAP"(ma_phieu_nhap,sku,so_luong_nhap,gia_nhap) values(1,'S',10,100),(2,'S',10,200),(4,'S',10,300);
      insert into "DON_HANG"(ma_donhang,kenh_ban,trang_thai,thoi_gian_dat,thoi_gian_xuat_kho,thoi_gian_hoan_thanh) values
      ('SALE1','ONLINE','HOAN_THANH','2026-11-01T01:00Z','2026-11-01T02:00Z','2026-11-01T03:00Z'),
      ('SALE2','ONLINE','HOAN_THANH','2026-11-01T01:00Z','2026-11-01T02:00Z','2026-11-01T03:00Z'),
      ('SALE4','ONLINE','HOAN_THANH','2026-11-01T01:00Z','2026-11-01T02:00Z','2026-11-01T03:00Z'),
      ('PENDING4','ONLINE','DANG_CHUAN_BI','2026-11-01T01:00Z',null,null),('SPLIT','ONLINE','DANG_CHUAN_BI','2026-11-01T01:00Z',null,null);
      insert into "CT_DON_HANG"(ma_donhang,sku,ma_kho_xuat,ten_sp_luc_ban,don_vi_luc_ban,so_luong,don_gia,giam_gia,giam_gia_voucher,thue_suat,tien_thue,thanh_tien) values
      ('SALE1','S',1,'Product','unit',2,500,0,0,0,0,1000),('SALE2','S',2,'Product','unit',1,500,0,0,0,0,500),('SALE4','S',4,'Product','unit',1,500,0,0,0,0,500),
      ('PENDING4','S',4,'Product','unit',1,5500000,0,0,0,0,5500000),('SPLIT','S',1,'Product','unit',1,500,0,0,0,0,500),('SPLIT','S',4,'Product','unit',1,500,0,0,0,0,500);
      insert into "TON_KHO"(ma_kho,sku,so_luong_ton) values(1,'S',8),(2,'S',9),(4,'S',9);delete from admin_ops.stock_events;
      insert into "THANH_TOAN"(ma_donhang,so_tien,loai_giao_dich,phuong_thuc,trang_thai,thoi_gian) values
      ('PENDING4',5500000,'THU','TIEN_MAT','THANH_CONG','2026-11-01T16:38:30'),
      ('SPLIT',1000,'THU','TIEN_MAT','THANH_CONG','2026-11-01T04:00'),
      ('PENDING4',500,'THU','TIEN_MAT','CHO_XU_LY','2026-11-01T04:00'),
      ('PENDING4',500,'THU','TIEN_MAT','THAT_BAI','2026-11-01T04:00');`);
    await migrate('20261030023519_receipt_sale_pricing.sql');
    await migrate('20261030034222_fixed_operating_warehouse.sql');
    await migrate('20261030154352_report_stock_adjustment_timeline.sql');
    await migrate('20261101162759_unlock_warehouses.sql');
    await migrate('20261101164437_business_report_warehouse_scope.sql');
    await db.exec('set role service_role');
    const report=(warehouse=null,day='2026-11-01')=>scalar("select public.admin_business_report_v2('A',$1::date,$1::date,$2) as r",[day,warehouse]);
    const all=await report();
    assert.equal(all.scope,'ALL_WAREHOUSES');assert.equal(all.warehouse_id,null);
    assert.equal(all.collected,'5501000.00','paid, incomplete orders count in cash, mixed-warehouse payment only once');
    assert.equal(all.net_revenue,'2000.00','paid, incomplete orders never inflate sales revenue');
    assert.equal(all.order_count,3);assert.equal(all.cost,'700.00','same SKU uses its own warehouse cost');
    assert.equal(all.gross_profit,'1300.00');assert.deepEqual(all.warnings,[]);
    const fourth=await report(4);
    assert.equal(fourth.scope,'WAREHOUSE');assert.equal(fourth.warehouse_id,4);
    assert.equal(fourth.collected,'5500000.00');assert.equal(fourth.net_revenue,'500.00');assert.equal(fourth.cost,'300.00');
    assert.equal((await report(2)).collected,'0.00');assert.equal((await report(1)).cost,'200.00');
    assert.equal((await report(null,'2026-11-02')).collected,'0.00','Vietnam payment day boundary is respected');
    const old=await scalar("select public.admin_business_report_v1('A','2026-11-01','2026-11-01') as r");
    assert.equal(old.warehouse_id,2);assert.equal(old.net_revenue,'500.00','v1 stays compatible with the deployed older backend');
    await db.exec(`reset role; alter table "TON_KHO" disable trigger phub_stock_audit;
      update "TON_KHO" set so_luong_ton=99 where ma_kho=4; alter table "TON_KHO" enable trigger phub_stock_audit; set role service_role;`);
    assert.equal((await report()).cost,null,'unknown cost in one warehouse must not become zero in the combined report');
    assert.equal((await report(2)).cost,'200.00','unknown cost in warehouse 4 does not affect warehouse 2');
    await assert.rejects(()=>report(99),/WAREHOUSE_NOT_FOUND/);
    await assert.rejects(()=>scalar("select public.admin_business_report_v2('UNKNOWN','2026-11-01','2026-11-01',null) as r"),/ADMIN_FORBIDDEN/);
    await db.exec('reset role; set role anon');
    await assert.rejects(()=>report(),/permission denied/);
    console.log('PASS: paid preparing order cash, sales recognition, all/selected warehouses, per-warehouse costing, mixed order counted once, ignored pending/failed payments, day boundary, v1 compatibility, permissions');
  }finally{await db.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
