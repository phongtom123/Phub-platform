// Runs only against an isolated in-memory PostgreSQL database, never Supabase.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {randomUUID}=require('node:crypto');
const {PGlite}=require(process.env.PHUB_PGLITE_MODULE||'@electric-sql/pglite');
(async()=>{
 const db=new PGlite();
 try{
  await require('./test_payment_deadline.cjs').run(db);
  const scalar=async(sql,args=[]) => (await db.query(sql,args)).rows[0].r;
  const before=await scalar('select count(*)::int as r from "DON_HANG"');
  await db.exec(fs.readFileSync(path.join(__dirname,'../migrations/20261104075616_customer_store_pickup.sql'),'utf8'));
  assert.equal(await scalar('select count(*)::int as r from "DON_HANG" where phuong_thuc_nhan is null'),before,'do not invent fulfillment for historical orders');
  const body={fulfillment_method:'TAI_CUA_HANG',recipient:{name:'Pickup Customer',phone:'0901234567'},note:null,voucher_code:null,
   items:[{sku:'S',quantity:1,warehouse_id:1,expected_unit_price:'100.00'}],expected_discount:'0.00',expected_total:'100.00'};
  const call=(request,key,customer='C',name='customer_checkout_fulfillment_v1')=>scalar(`select public.${name}($1,$2,$3,true,'reserve_on_order','exclusive',10,'VND',1,'invoice','Asia/Ho_Chi_Minh') as r`,[customer,request,key]);
  const key=randomUUID(),result=await call(body,key);
  assert.ok(result.order,JSON.stringify(result));
  assert.equal(result.order.fulfillment_method,'TAI_CUA_HANG');
  assert.deepEqual(result.order.recipient,body.recipient,'do not fabricate a store/shipping address');
  assert.equal(await scalar('select phuong_thuc_nhan as r from "DON_HANG" where ma_donhang=$1',[result.order.id]),'TAI_CUA_HANG');
  assert.equal(await scalar('select dia_chi_chi_tiet as r from "DON_HANG" where ma_donhang=$1',[result.order.id]),null);
  assert.equal(await scalar('select kenh_ban as r from "DON_HANG" where ma_donhang=$1',[result.order.id]),'ONLINE');
  assert.equal(await scalar('select tong_tien_sau_thue::text as r from "HOA_DON" where ma_donhang=$1',[result.order.id]),'110.00');
  assert.equal(await scalar(`select extract(epoch from han_thanh_toan-(thoi_gian_lap at time zone 'UTC'))::int as r from "HOA_DON" where ma_donhang=$1`,[result.order.id]),86400);
  assert.equal(await scalar('select count(*)::int as r from "THANH_TOAN" where ma_donhang=$1',[result.order.id]),0,'pickup is not a payment');
  assert.equal(await scalar('select so_luong_ton as r from "TON_KHO" where sku=\'S\''),1000,'no physical stock deduction');
  const replay=await call(body,key);assert.equal(replay.replayed,true);assert.deepEqual(replay.order,result.order);
  assert.equal((await call(body,key,'OTHER')).error.code,'IDEMPOTENCY_CONFLICT');
  const delivery={...body,fulfillment_method:'GIAO_HANG',recipient:{...body.recipient,address_line:'Address',province:'Province',ward:'Ward'}};
  assert.equal((await call(delivery,key)).error.code,'IDEMPOTENCY_CONFLICT');
  for(const request of [{...body,fulfillment_method:'OTHER'},{...body,fulfillment_method:null},
    {...body,recipient:delivery.recipient},{...body,fulfillment_method:'GIAO_HANG'},
    {...body,recipient:{...body.recipient,phone:'invalid'}}]){
    assert.equal((await call(request,randomUUID())).error.code,'VALIDATION_ERROR');
  }
  const {fulfillment_method,...oldDelivery}=delivery;
  const oldKey=randomUUID(),old=await call(oldDelivery,oldKey,'C','customer_checkout_multi_warehouse_v1');
  assert.ok(old.order); assert.equal((await call(delivery,oldKey)).replayed,true,'legacy delivery idempotency survives new RPC');
  const shipped=await call(delivery,randomUUID());assert.ok(shipped.order);
  assert.equal(shipped.order.fulfillment_method,'GIAO_HANG');
  const detail=await scalar("select public.customer_read_orders_v4('C',$1,1,20,'VND') as r",[result.order.id]);
  assert.equal(detail.order.fulfillment_method,'TAI_CUA_HANG');assert.equal(detail.order.recipient.address_line,null);
  assert.equal((await scalar("select public.customer_read_orders_v3('C',$1,1,20,'VND') as r",[result.order.id])).order.fulfillment_method,undefined,'old read contracts unchanged');
  assert.equal((await scalar("select public.customer_read_orders_v4('OTHER',$1,1,20,'VND') as r",[result.order.id])).error.code,'ORDER_NOT_FOUND');
  assert.equal(await scalar("select has_function_privilege('anon','public.customer_checkout_fulfillment_v1(text,jsonb,uuid,boolean,text,text,numeric,text,integer,text,text)','execute') as r"),false);
  console.log('PASS: pickup contact only, one new column, online channel, atomic invoice/deadline/reservation, no payment/physical stock change, replay/conflicts, shipping compatibility, ownership and privileges');
 }finally{await db.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
