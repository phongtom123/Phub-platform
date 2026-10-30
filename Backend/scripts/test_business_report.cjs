// One isolated in-memory SQL check; never accepts a cloud connection.
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path');
const { PGlite } = require(process.env.PHUB_PGLITE_MODULE || '@electric-sql/pglite');
(async()=>{
 const db = new PGlite();
 try {
  await db.exec('create role anon; create role authenticated; create role service_role bypassrls;');
  const root=path.resolve(__dirname,'..');
  for (const file of ['001_initial_schema.sql','20261023_customer_support.sql','20261028132157_admin_operations.sql','20261030020310_business_report.sql']) await db.exec(fs.readFileSync(path.join(root,'migrations',file),'utf8'));
  await db.exec(`insert into "KHO"(ma_kho,ten_kho,dia_chi) values(-1,'Test','Test');
   insert into "NHAN_VIEN"(ma_nhan_vien,loai_nhan_vien,ho_ten) values('NV1','ADMIN','Admin');
   insert into "TAI_KHOAN"(ma_tk,ten_tai_khoan,mat_khau_hash,ma_nhan_vien) values('A','admin','disabled','NV1');
   insert into "NHA_CUNG_CAP"(ma_ncc,ten_ncc) values(1,'Supplier');
   insert into "LOAI_SP" values('L','Category',1);
   insert into "LOAI_SP_CON"(ma_loai_sp_con,ten_loai_sp_con,ma_loai_sp) values('SC','Sub','L');
   insert into "SAN_PHAM"(ma_sp,sku,ten_sp,ma_loai_sp,ma_loai_sp_con,gia_ban_hien_tai,don_vi) values('P','SKU1','Product','L','SC',300,'unit');
   insert into "PHIEU_NHAP"(ma_phieu_nhap,ma_phieu_code,ma_ncc,ma_kho,ngay_tao,ngay_nhap,nguoi_tao,trang_thai) values
    (1,'PN1',1,-1,'2026-09-01','2026-09-01','NV1','DA_NHAP'),(2,'PN2',1,-1,'2026-09-25','2026-09-25','NV1','DA_NHAP'),
    (3,'PN3',1,-1,'2026-10-20','2026-10-20','NV1','DA_NHAP'),(4,'DRAFT',1,-1,'2026-10-01',null,'NV1','NHAP');
   insert into "CT_PHIEU_NHAP" values(1,'SKU1',10,100),(2,'SKU1',10,200),(3,'SKU1',10,900),(4,'SKU1',999,99999);
   insert into "DON_HANG"(ma_donhang,kenh_ban,trang_thai,thoi_gian_dat,thoi_gian_xuat_kho,thoi_gian_hoan_thanh) values
    ('OLD','ONLINE','HOAN_THANH','2026-09-14','2026-09-15','2026-09-15'),('SALE','ONLINE','HOAN_THANH','2026-09-29','2026-09-30','2026-10-10');
   insert into "CT_DON_HANG"(ma_donhang,sku,ma_kho_xuat,ten_sp_luc_ban,don_vi_luc_ban,so_luong,don_gia,giam_gia,giam_gia_voucher,thue_suat,tien_thue,thanh_tien) values
    ('OLD','SKU1',-1,'Product','unit',2,200,0,0,0,0,400),('SALE','SKU1',-1,'Product','unit',3,300,10,20,10,87,957);
   insert into "TON_KHO"(ma_kho,sku,so_luong_ton) values(-1,'SKU1',25);
   delete from admin_ops.stock_events;
   insert into "THANH_TOAN"(ma_donhang,so_tien,loai_giao_dich,phuong_thuc,trang_thai,thoi_gian) values('SALE',957,'THU','TIEN_MAT','THANH_CONG','2026-10-10');
   set role service_role;`);
  const report=async(start='2026-10-01',end='2026-10-31')=>(await db.query('select public.admin_business_report_v1($1,$2,$3) as r',['A',start,end])).rows[0].r;
  let r=await report();
  assert.equal(r.net_revenue,'870.00'); assert.equal(r.tax,'87.00'); assert.equal(r.discounts,'30.00');
  assert.equal(r.cost,'466.67'); assert.equal(r.gross_profit,'403.33'); assert.equal(r.margin,'46.36');
  assert.equal(r.quantity,3); assert.equal(r.order_count,1); assert.equal(r.collected,'957.00'); assert.deepEqual(r.warnings,[]);
  assert.equal(r.products[0].gross_profit,'403.33'); assert.equal(r.daily.find(day=>day.day==='2026-10-10').gross_profit,'403.33');
  r=await report('2026-08-01','2026-08-31'); assert.equal(r.cost,'0.00'); assert.equal(r.gross_profit,'0.00'); assert.equal(r.margin,null);
  await db.exec(`insert into "THANH_TOAN"(ma_donhang,so_tien,loai_giao_dich,phuong_thuc,trang_thai,thoi_gian) values('SALE',50,'HOAN_TIEN','TIEN_MAT','THANH_CONG','2026-10-25');`);
  r=await report(); assert.equal(r.cost,'466.67');assert.equal(r.gross_profit,null);assert.equal(r.margin,null);assert.equal(r.collected,'907.00');assert.ok(r.warnings.includes('UNALLOCATED_REFUNDS'));
  await db.exec('update "TON_KHO" set so_luong_ton=26 where sku=\'SKU1\';');
  r=await report();assert.equal(r.cost,null);assert.equal(r.gross_profit,null);assert.equal(r.costed_lines,0);assert.ok(r.warnings.includes('INCOMPLETE_COST_HISTORY'));
  await assert.rejects(()=>report('2024-01-01','2026-10-31'),/VALIDATION_ERROR/);
  await db.exec('set role anon'); await assert.rejects(()=>report(),/permission denied/);
  console.log('PASS: moving average, old-period dispatch, future purchases excluded, discounts/tax, no join multiplication, empty period, unallocated refunds, unknown stock, date bound, service-only RPC');
 } finally { await db.close(); }
})().catch(error=>{console.error(error);process.exitCode=1;});
