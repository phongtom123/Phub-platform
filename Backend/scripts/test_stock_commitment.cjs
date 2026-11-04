// Isolated PostgreSQL only: no environment secrets, cloud connections or real transactions.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {randomUUID}=require('node:crypto');
const {PGlite}=require(process.env.PHUB_PGLITE_MODULE||'@electric-sql/pglite');
(async()=>{
 const db=new PGlite();
 try{
  // Text-rewriting migrations compare function bodies normalized to LF.
  const migrate=name=>db.exec(fs.readFileSync(path.join(__dirname,'../migrations',name),'utf8').replace(/\r\n/g,'\n'));
  const scalar=async(sql,args=[]) => (await db.query(sql,args)).rows[0].r;
  await db.exec('create role anon; create role authenticated; create role service_role bypassrls;');
  for(const name of ['001_initial_schema.sql','20261004_customer_orders.sql','20261006_customer_checkout.sql','20261023_customer_support.sql','20261028132157_admin_operations.sql','20261102080347_automatic_checkout_invoice.sql','20261102130239_stock_based_cart_quantity.sql','20261102140733_multi_warehouse_customer_checkout.sql','20261102145332_checkout_total_warehouse_stock.sql'])await migrate(name);
  await db.exec(`insert into "KHO"(ma_kho,ten_kho,dia_chi,trang_thai) values(1,'One','Test',1);
   insert into "KHACH_HANG"(ma_kh,ten_kh) values('C','Customer');
   insert into "NHAN_VIEN"(ma_nhan_vien,ho_ten,loai_nhan_vien) values('AD','Admin','ADMIN');
   insert into "TAI_KHOAN"(ma_tk,ten_tai_khoan,mat_khau_hash,ma_nhan_vien) values('A','admin','disabled','AD');
   insert into "LOAI_SP" values('L','Category',1);
   insert into "LOAI_SP_CON"(ma_loai_sp_con,ten_loai_sp_con,ma_loai_sp) values('SC','Sub','L');
   insert into "SAN_PHAM"(ma_sp,sku,ten_sp,ma_loai_sp,ma_loai_sp_con,gia_ban_hien_tai,don_vi) values('P','S','Product','L','SC',100,'unit'),('P2','T','Automatic','L','SC',100,'unit');
   insert into "TON_KHO"(ma_kho,sku,so_luong_ton) values(1,'S',100),(1,'T',5);
   insert into "DON_HANG"(ma_donhang,ma_kh,kenh_ban,trang_thai,thoi_gian_dat) values('D1','C','ONLINE','MOI',now()),('D2','C','ONLINE','MOI',now()),('D3','C','ONLINE','DANG_CHUAN_BI',now());
   insert into "CT_DON_HANG"(ma_donhang,sku,ma_kho_xuat,ten_sp_luc_ban,don_vi_luc_ban,so_luong,don_gia,thue_suat,tien_thue,thanh_tien)
   values('D1','S',1,'Product','unit',90,100,10,0,9000),('D2','S',1,'Product','unit',90,100,10,0,9000),('D3','S',1,'Product','unit',10,100,10,0,1000);`);
  const before=await scalar('select count(*)::int as r from "DON_HANG"');
  await migrate('20261102151044_reserve_stock_after_invoice_or_payment.sql');
  await migrate('20261102151044_reserve_stock_after_invoice_or_payment.sql');
  await db.exec('set role service_role');
  const available=()=>scalar("select admin_ops.available(1,'S') as r");
  const quote=quantity=>scalar("select public.customer_checkout_multi_warehouse_v1('C',$1,null,false,'reserve_on_order','exclusive',10,'VND',1,'invoice','Asia/Ho_Chi_Minh') as r",[{items:[{sku:'S',quantity}]}]);
  const invoice=id=>db.query(`insert into "HOA_DON"(ma_hoadon,ma_donhang,thoi_gian_lap,tong_tien_truoc_thue,tong_tien_thue,tong_tien_sau_thue,nguoi_lap)
   select 'HD-'||$1,$1,now(),sum(so_luong*don_gia),sum(so_luong*don_gia)*0.1,sum(so_luong*don_gia)*1.1,'AD' from "CT_DON_HANG" where ma_donhang=$1`,[id]);
  const payment=(id,status,type='THU')=>scalar('insert into "THANH_TOAN"(ma_donhang,so_tien,loai_giao_dich,phuong_thuc,trang_thai,thoi_gian) values($1,100,$2,\'TIEN_MAT\',$3,now()) returning ma_thanh_toan as r',[id,type,status]);
  const command=(id,action)=>scalar("select public.admin_operation_v1('A','orders',$1,$2,$3,'{}') as r",[action,randomUUID(),id]);
  assert.equal(await available(),100,'uninvoiced/unpaid drafts do not reserve');
  assert.ok((await quote(100)).quote,'quotes ignore uncommitted drafts');
  assert.equal(await scalar('select count(*)::int as r from "DON_HANG"'),before,'quote never creates an order');
  assert.equal(await scalar('select count(*)::int as r from "HOA_DON"'),0,'quote never creates an invoice');
  await invoice('D1');assert.equal(await available(),10);
  await assert.rejects(()=>invoice('D2'),/INSUFFICIENT_STOCK/);
  assert.equal(await scalar('select count(*)::int as r from "HOA_DON"'),1,'failed invoice rolls back');
  const pending=await payment('D2','CHO_XU_LY');await payment('D3','THAT_BAI');await payment('D3','THANH_CONG','HOAN_TIEN');
  assert.equal(await available(),10,'pending/failed/refund payments never reserve');
  await assert.rejects(()=>db.query('update "THANH_TOAN" set trang_thai=\'THANH_CONG\' where ma_thanh_toan=$1',[pending]),/INSUFFICIENT_STOCK/);
  assert.equal(await scalar('select trang_thai as r from "THANH_TOAN" where ma_thanh_toan=$1',[pending]),'CHO_XU_LY');
  await payment('D1','THANH_CONG');assert.equal(await available(),10,'invoice and payment reserve once');
  await payment('D1','THANH_CONG','HOAN_TIEN');
  await command('D1','cancel');assert.equal(await available(),100,'cancelled order releases its reservation');
  await db.query('update "THANH_TOAN" set trang_thai=\'THANH_CONG\' where ma_thanh_toan=$1',[pending]);
  assert.equal(await available(),10,'successful payment without invoice reserves stock');
  await invoice('D2');assert.equal(await available(),10,'later invoice does not reserve twice');
  await assert.rejects(()=>command('D3','dispatch'),/INVOICE_REQUIRED/);
  assert.equal(await scalar('select so_luong_ton as r from "TON_KHO" where sku=\'S\''),100,'no physical deduction before dispatch');
  await invoice('D3');assert.equal(await available(),0);
  await command('D3','dispatch');assert.equal(await scalar('select so_luong_ton as r from "TON_KHO" where sku=\'S\''),90);
  assert.equal(await available(),0,'dispatch converts reservation to physical deduction once');
  assert.equal((await quote(1)).error.code,'INSUFFICIENT_STOCK');
  const key=randomUUID(),body={items:[{sku:'T',quantity:3,warehouse_id:1,expected_unit_price:'100.00'}],recipient:{name:'Test',phone:'0901234567',address_line:'Test',province:'Test',ward:'Test'},expected_discount:'0.00',expected_total:'300.00'};
  const place=()=>scalar("select public.customer_checkout_multi_warehouse_v1('C',$1,$2,true,'reserve_on_order','exclusive',10,'VND',1,'invoice','Asia/Ho_Chi_Minh') as r",[body,key]);
  const placed=await place();assert.ok(placed.order,JSON.stringify(placed));
  assert.equal((await place()).replayed,true);
  assert.equal(await scalar("select admin_ops.available(1,'T') as r"),2,'explicit order creates its invoice and reservation atomically');
  assert.equal(await scalar('select tong_tien_sau_thue::text as r from "HOA_DON" where ma_donhang=$1',[placed.order.id]),'330.00');
  console.log('PASS: cart/quote/draft do not reserve; invoice or successful collection reserves once; insufficient finance activation rolls back; cancellation releases; dispatch requires commitment');
 }finally{await db.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
