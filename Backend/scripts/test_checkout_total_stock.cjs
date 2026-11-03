// Isolated PostgreSQL: no .env, real account, order, payment or cloud writes.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {randomUUID}=require('node:crypto');
const {PGlite}=require(process.env.PHUB_PGLITE_MODULE||'@electric-sql/pglite');
(async()=>{
 const db=new PGlite();
 try{
  const migrate=name=>db.exec(fs.readFileSync(path.join(__dirname,'../migrations',name),'utf8'));
  const scalar=async(sql,args=[]) => (await db.query(sql,args)).rows[0].r;
  await db.exec('create role anon; create role authenticated; create role service_role bypassrls;');
  for(const file of ['001_initial_schema.sql','20261004_customer_orders.sql','20261006_customer_checkout.sql','20261102080347_automatic_checkout_invoice.sql'])await migrate(file);
  await db.exec(`insert into "KHO"(ma_kho,ten_kho,dia_chi,trang_thai) values(1,'One','Test',1),(2,'Two','Test',1),(3,'Inactive','Test',0);
   insert into "KHACH_HANG"(ma_kh,ten_kh) values('C','Customer');
   insert into "LOAI_SP" values('L','Category',1);
   insert into "LOAI_SP_CON"(ma_loai_sp_con,ten_loai_sp_con,ma_loai_sp) values('SC','Sub','L');
   insert into "SAN_PHAM"(ma_sp,sku,ten_sp,ma_loai_sp,ma_loai_sp_con,gia_ban_hien_tai,don_vi) values('P','S','Product','L','SC',100,'unit');
   insert into "TON_KHO"(ma_kho,sku,so_luong_ton) values(1,'S',20),(2,'S',1300),(3,'S',9999);`);
  await migrate('20261102145332_checkout_total_warehouse_stock.sql');
  // Re-running must preserve the function and its restricted EXECUTE grants.
  await migrate('20261102145332_checkout_total_warehouse_stock.sql');
  await db.exec('set role service_role');
  const checkout=(body,create=false,key=null)=>scalar("select public.customer_checkout_v2('C',$1,$2,$3,'reserve_on_order','exclusive',10,'VND',1,'invoice','Asia/Ho_Chi_Minh') as r",[body,key,create]);
  const request=quote=>({recipient:{name:'Test',phone:'0901234567',address_line:'Test',province:'Test',ward:'Test'},expected_discount:quote.discount_total,expected_total:quote.total,items:quote.items.map(l=>({sku:l.sku,quantity:l.quantity,warehouse_id:l.warehouse_id,expected_unit_price:l.unit_price}))});
  let quote=(await checkout({items:[{sku:'S',quantity:2}]})).quote;
  await checkout(request(quote),true,randomUUID()); // reserves two, leaves physical stock unchanged
  assert.equal((await checkout({items:[{sku:'S',quantity:1319}]})).error.code,'INSUFFICIENT_STOCK');
  quote=(await checkout({items:[{sku:'S',quantity:1318}]})).quote;
  assert.deepEqual(quote.items.map(l=>[l.warehouse_id,l.quantity]),[[1,18],[2,1300]]);
  assert.equal(quote.total,'131800.00');
  const body=request(quote),key=randomUUID(),placed=await checkout(body,true,key);
  assert.ok(placed.order,JSON.stringify(placed));
  assert.equal((await checkout(body,true,key)).replayed,true);
  assert.equal(await scalar('select count(*)::int as r from "DON_HANG"'),2);
  const invoice=(await db.query('select tong_tien_truoc_thue::text as net,tong_tien_thue::text as vat,tong_tien_sau_thue::text as total from "HOA_DON" where ma_donhang=$1',[placed.order.id])).rows[0];
  assert.deepEqual(invoice,{net:'131800.00',vat:'13180.00',total:'144980.00'});
  assert.equal((await checkout({items:[{sku:'S',quantity:1}]})).error.code,'INSUFFICIENT_STOCK','reserved stock cannot be sold twice');
  assert.equal(await scalar('select sum(so_luong_ton)::int as r from "TON_KHO"'),11319,'checkout reserves, never decrements physical stock');
  console.log('PASS: aggregate stock, reservations, inactive warehouses, quantity >1000, split order, invoice VAT, idempotency and no overselling');
 }finally{await db.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
