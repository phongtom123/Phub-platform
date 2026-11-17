// PostgreSQL fixture only; never reads .env or connects to hosted databases.
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path');
const {randomUUID}=require('node:crypto');
const {PGlite}=require(process.env.PHUB_PGLITE_MODULE || '@electric-sql/pglite');
const root=path.resolve(__dirname,'../migrations');
const chain=[
 '001_initial_schema.sql','20261004_customer_orders.sql','20261006_customer_checkout.sql',
 '20261023_customer_support.sql','20261028132157_admin_operations.sql',
 '20261102071529_customer_demo_payments.sql','20261102080347_automatic_checkout_invoice.sql',
 '20261102081903_bypass_business_payments.sql','20261102130239_stock_based_cart_quantity.sql',
 '20261102140733_multi_warehouse_customer_checkout.sql','20261102145332_checkout_total_warehouse_stock.sql',
 '20261102151044_reserve_stock_after_invoice_or_payment.sql',
 '20261104071915_unpaid_invoice_deadline_24h.sql','20261104073822_payment_deadline_read_compatibility.sql',
 '20261104075616_customer_store_pickup.sql','20261109135628_customer_voucher_choices.sql',
 '20261117134210_voucher_product_categories.sql','20261117140011_voucher_fulfillment_scope.sql'
];
(async()=>{
 const db=await PGlite.create();
 try{
  await db.exec('create role anon;create role authenticated;create role service_role bypassrls;grant usage on schema public to service_role;');
  for(const name of chain){
   if(name.includes('voucher_choices')) await db.exec('alter table public."KHACH_HANG" add column luu_tru_luc timestamptz;');
   await db.exec(fs.readFileSync(path.join(root,name),'utf8').replace(/\r\n/g,'\n'));
  }
  for(const name of chain.slice(-2)) await db.exec(fs.readFileSync(path.join(root,name),'utf8'));
  const call=async(fn,args)=>(await db.query('select '+fn+'('+args.map((_,i)=>'$'+(i+1)).join(',')+') r',args)).rows[0].r;
  await db.exec([
   'insert into public."KHO"(ma_kho,ten_kho,dia_chi) values(1,\'One\',\'Test\'),(2,\'Two\',\'Test\')',
   'insert into public."NHAN_VIEN"(ma_nhan_vien,loai_nhan_vien,ho_ten) values(\'NV\',\'ADMIN\',\'Staff\')',
   'insert into public."KHACH_HANG"(ma_kh,ten_kh) values(\'KH\',\'Customer\')',
   'insert into public."TAI_KHOAN"(ma_tk,ten_tai_khoan,mat_khau_hash,ma_nhan_vien,ma_kh) values(\'STAFF\',\'staff\',\'disabled\',\'NV\',null)',
   'insert into public."LOAI_SP"(ma_loai_sp,ten_loai_sp) values(\'L_LINHKIEN\',\'Components\'),(\'L_DESKTOP\',\'PC\'),(\'OTHER\',\'Other\')',
   'insert into public."LOAI_SP_CON"(ma_loai_sp_con,ma_loai_sp,ten_loai_sp_con) values(\'C\',\'L_LINHKIEN\',\'CPU\'),(\'P\',\'L_DESKTOP\',\'Gaming\'),(\'O\',\'OTHER\',\'Other\')',
   'insert into public."SAN_PHAM"(ma_sp,sku,ten_sp,ma_loai_sp,ma_loai_sp_con,gia_ban_hien_tai) values(\'SP1\',\'S1\',\'Component1\',\'L_LINHKIEN\',\'C\',100),(\'SP2\',\'S2\',\'Component2\',\'L_LINHKIEN\',\'C\',200),(\'SP3\',\'PC\',\'PC\',\'L_DESKTOP\',\'P\',1000),(\'SP4\',\'OTHER\',\'Other\',\'OTHER\',\'O\',500)',
   'insert into public."TON_KHO"(ma_kho,sku,so_luong_ton) select w,sku,case when w=1 and sku=\'S1\' then 1 else 100 end from generate_series(1,2) w cross join public."SAN_PHAM"',
   'insert into public."CHUONG_TRINH_KHUYEN_MAI"(ma_ctkm,ten_chuong_trinh,ngay_bat_dau,ngay_ket_thuc,trang_thai,nguoi_tao,ngay_tao) values(1,\'Program\',now()-interval \'1 day\',now()+interval \'1 day\',\'HOAT_DONG\',\'NV\',now())',
   'insert into public."VOUCHER"(ma_ctkm,ma_code,loai_giam,gia_tri_giam,gia_tri_don_toi_thieu,gioi_han_moi_khach,trang_thai,ngay_tao,ma_loai_sp_ap_dung) values(1,\'COMP10\',\'PHAN_TRAM\',10,0,99,\'HOAT_DONG\',now(),\'L_LINHKIEN\'),(1,\'PC10\',\'PHAN_TRAM\',10,0,99,\'HOAT_DONG\',now(),\'L_DESKTOP\'),(1,\'ALL10\',\'PHAN_TRAM\',10,0,99,\'HOAT_DONG\',now(),null),(1,\'MIN500\',\'PHAN_TRAM\',10,500,99,\'HOAT_DONG\',now(),\'L_LINHKIEN\'),(1,\'FIXED500\',\'SO_TIEN\',500,0,99,\'HOAT_DONG\',now(),\'L_LINHKIEN\')'
  ].join(';'));
  await db.exec('set role service_role');
  const lines=[{sku:'S1',quantity:2},{sku:'S2',quantity:1},{sku:'PC',quantity:1},{sku:'OTHER',quantity:1}];
  const quote=(code,items=lines,fn='customer_quote_categories_v1')=>call('public.'+fn,['KH',JSON.stringify({items,voucher_code:code}),null,false,'reserve_on_order','exclusive',10,'VND',1,'invoice','Asia/Ho_Chi_Minh']);
  const comp=(await quote('COMP10')).quote;
  assert.ok(comp,'scoped quote must succeed');
  assert.equal(comp.discount_total,'40.00');
  assert.equal(comp.items.find(l=>l.sku==='PC').discount,'0.00');
  assert.equal(comp.items.find(l=>l.sku==='OTHER').discount,'0.00');
  assert.equal(comp.items.find(l=>l.sku==='S1').category_id,'L_LINHKIEN');
  assert.equal((await quote('PC10')).quote.discount_total,'100.00');
  assert.equal((await quote('ALL10')).quote.discount_total,'190.00');
  assert.equal((await quote('FIXED500')).quote.discount_total,'400.00');
  assert.equal((await quote('MIN500')).error.code,'VOUCHER_MINIMUM_NOT_MET');
  assert.equal((await quote('COMP10',[{sku:'PC',quantity:1}])).error.code,'VOUCHER_MINIMUM_NOT_MET');
  assert.equal((await quote('COMP10',[{sku:'S1',quantity:1},{sku:'PC',quantity:1}],'customer_checkout_v2')).quote.discount_total,'10.00');
  const choices=(await call('public.customer_voucher_choices_v2',['KH','Asia/Ho_Chi_Minh'])).items;
  assert.equal(choices.find(v=>v.code==='ALL10').category_id,null);
  assert.equal(choices.find(v=>v.code==='COMP10').category_id,'L_LINHKIEN');
  assert.ok(!(await call('public.customer_voucher_choices_v1',['KH','Asia/Ho_Chi_Minh'])).items.some(v=>'category_id' in v),'legacy voucher response remains compatible');
  const legacy=(await quote('COMP10',lines,'customer_checkout_multi_warehouse_v1')).quote;
  assert.equal(legacy.discount_total,'40.00');
  assert.ok(legacy.items.every(l=>!('category_id' in l)),'legacy quote response remains compatible');
  const payload={items:comp.items.map(l=>({sku:l.sku,quantity:l.quantity,warehouse_id:l.warehouse_id,expected_unit_price:l.unit_price})),voucher_code:'COMP10',expected_discount:comp.discount_total,expected_total:comp.total,recipient:{name:'Customer',phone:'0901234567',address_line:'Test',ward:'Test',province:'Test'}};
  const key=randomUUID();
  const create=()=>call('public.customer_checkout_fulfillment_v1',['KH',JSON.stringify(payload),key,true,'reserve_on_order','exclusive',10,'VND',1,'invoice','Asia/Ho_Chi_Minh']);
  const created=await create();assert.ok(created.order,JSON.stringify(created));
  const id=created.order.id;
  const stored=(await db.query('select sku,giam_gia_voucher::text discount,so_luong from public."CT_DON_HANG" where ma_donhang=$1 order by sku,ma_kho_xuat',[id])).rows;
  assert.equal(stored.filter(l=>l.sku==='S1').length,2);
  assert.equal(stored.filter(l=>l.sku==='S1').reduce((s,l)=>s+Number(l.discount),0),20);
  assert.equal(stored.find(l=>l.sku==='PC').discount,'0.00');
  const invoice=(await db.query('select tong_tien_giam::text discount,tong_tien_thue::text tax,tong_tien_sau_thue::text total from public."HOA_DON" where ma_donhang=$1',[id])).rows[0];
  assert.deepEqual(invoice,{discount:'40.00',tax:'186.00',total:'2046.00'});
  assert.equal((await create()).replayed,true);
  const pickup=await call('public.customer_checkout_fulfillment_v1',['KH',JSON.stringify({...payload,
   fulfillment_method:'TAI_CUA_HANG',recipient:{name:'Customer',phone:'0901234567'}}),randomUUID(),true,
   'reserve_on_order','exclusive',10,'VND',1,'invoice','Asia/Ho_Chi_Minh']);
  assert.ok(pickup.order,JSON.stringify(pickup));
  const pickupInvoice=(await db.query('select h.tong_tien_giam::text discount,h.tong_tien_sau_thue::text total,d.phuong_thuc_nhan method from public."HOA_DON" h join public."DON_HANG" d using(ma_donhang) where d.ma_donhang=$1',[pickup.order.id])).rows[0];
  assert.deepEqual(pickupInvoice,{discount:'40.00',total:'2046.00',method:'TAI_CUA_HANG'});
  const prices={S1:'100.00',S2:'200.00',PC:'1000.00',OTHER:'500.00'};
  const counter=await call('public.admin_operation_v1',['STAFF','orders','create',randomUUID(),null,JSON.stringify({customer_id:'KH',recipient:'Customer',voucher_code:'PC10',lines:lines.map(l=>({...l,warehouse_id:2,unit_price:prices[l.sku]}))})]);
  const counterStored=(await db.query('select sku,giam_gia_voucher::text discount from public."CT_DON_HANG" where ma_donhang=$1',[counter.data[0].ma_donhang])).rows;
  assert.equal(counterStored.find(l=>l.sku==='PC').discount,'100.00');
  assert.equal(counterStored.find(l=>l.sku==='S1').discount,'0.00');
  await assert.rejects(db.exec('update public."VOUCHER" set ma_loai_sp_ap_dung=\'OTHER\' where ma_code=\'ALL10\''),/voucher_supported_category/);
  await db.exec('reset role;set role anon');
  await assert.rejects(call('customer_order_private.voucher_category_scope_v1',['[]',null]),/permission denied/);
  console.log('PASS: mixed baskets, three scopes, eligible minimum, amount cap, no-match rejection, pooled and legacy checkout, VAT invoice, counter sale, replay, permissions, migration replay.');
 }finally{await db.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
