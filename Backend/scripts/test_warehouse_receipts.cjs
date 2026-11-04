// Isolated PostgreSQL integration test. Never accepts a cloud database URL.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {randomUUID} = require('node:crypto');
const {Client} = require(process.env.PHUB_PG_MODULE || 'pg');
const config={host:'127.0.0.1',port:Number(process.env.PHUB_TEST_PG_PORT||55432),user:'postgres'};
const database='phub_receipts_test_'+randomUUID().replaceAll('-','');
const root=path.resolve(__dirname,'..');
const admin=new Client({...config,database:'postgres'});
let db; const peers=[];
async function main(){
 await admin.connect();
 for(const role of ['anon','authenticated','service_role'])if(!(await admin.query('select 1 from pg_roles where rolname=$1',[role])).rowCount)await admin.query(`create role ${role} ${role==='service_role'?'bypassrls':''}`);
 await admin.query(`create database ${database}`);db=new Client({...config,database});await db.connect();
 for(const file of ['001_initial_schema.sql','20261023_customer_support.sql','20261028132157_admin_operations.sql','20261029162141_warehouse_receipts.sql'])await db.query(fs.readFileSync(path.join(root,'migrations',file),'utf8'));
 await db.query(`insert into "KHO"(ma_kho,ten_kho,dia_chi) values(-1,'Assigned','A'),(-2,'Other','B');
 insert into "NHAN_VIEN"(ma_nhan_vien,loai_nhan_vien,ho_ten,ma_kho) values('NV1','NHAN_VIEN','Staff',-1),('NV2','NHAN_VIEN','Other staff',-2),('NV3','ADMIN','Admin',null);
 insert into "TAI_KHOAN"(ma_tk,ten_tai_khoan,mat_khau_hash,ma_nhan_vien) values('STAFF','staff','disabled','NV1'),('OTHER','other','disabled','NV2'),('ADMIN','admin','disabled','NV3');
 insert into "NHA_CUNG_CAP"(ma_ncc,ten_ncc) values(0,'Supplier');
 insert into "LOAI_SP" values('L1','Components',1);
 insert into "LOAI_SP_CON"(ma_loai_sp_con,ten_loai_sp_con,ma_loai_sp) values('SC1','CPU','L1');
 insert into "SAN_PHAM"(ma_sp,sku,ten_sp,ma_loai_sp,ma_loai_sp_con,gia_ban_hien_tai,don_vi) values('SP1','SKU1','Product','L1','SC1',100,'unit');
 grant usage,select on all sequences in schema public to service_role;`);
 await db.query('set role service_role');
 const call=async(action,id,body,key=randomUUID(),actor='STAFF',connection=db)=>(await connection.query('select public.warehouse_receipt_v1($1,$2,$3,$4,$5) as r',[actor,action,key,id,body])).rows[0].r;
 const read=async(kind,query={},actor='STAFF')=>(await db.query('select public.warehouse_read_v1($1,$2,$3) as r',[actor,kind,query])).rows[0].r;
 const reject=async(operation,message)=>assert.rejects(operation,error=>error.message===message);
 const quantity=async()=>Number((await db.query('select coalesce((select so_luong_ton from "TON_KHO" where ma_kho=-1 and sku=\'SKU1\'),0) as n')).rows[0].n);
 const body={supplier_id:0,note:'Receiving',lines:[{sku:'SKU1',quantity:3,unit_price:'10.25'}]};
 const key=randomUUID();let draft=await call('create',null,body,key);
 assert.equal(draft.receipt.ma_kho,-1);assert.equal(draft.receipt.nguoi_tao,'NV1');assert.equal(draft.receipt.trang_thai,'NHAP');assert.equal(await quantity(),0);
 assert.equal((await call('create',null,body,key)).replayed,true);
 await reject(()=>call('create',null,{...body,note:'different'},key),'IDEMPOTENCY_CONFLICT');
 await reject(()=>call('create',null,body,randomUUID(),'ADMIN'),'WAREHOUSE_FORBIDDEN');
 const id=draft.receipt.ma_phieu_nhap;
 assert.equal((await read('receipt',{id})).version,draft.version);
 await reject(()=>read('receipt',{id},'OTHER'),'NOT_FOUND');
 await reject(()=>call('confirm',id,{expected_version:draft.version},randomUUID(),'OTHER'),'NOT_FOUND');
 assert.equal((await read('receipts')).total,1);assert.equal((await read('receipts',{},'OTHER')).total,0);
 const oldVersion=draft.version;
 draft=await call('update',id,{...body,note:'Edited',expected_version:oldVersion});
 assert.notEqual(draft.version,oldVersion);
 await reject(()=>call('confirm',id,{expected_version:oldVersion}),'DOCUMENT_CHANGED');
 await reject(()=>call('update',id,{...body,lines:[{sku:'MISSING',quantity:1,unit_price:'1'}],expected_version:draft.version}),'VALIDATION_ERROR');
 assert.equal((await read('receipt',{id})).version,draft.version,'failed replacements roll back header and lines');
 for(let i=0;i<6;i++){const connection=new Client({...config,database});await connection.connect();await connection.query('set role service_role');peers.push(connection);}
 const confirmKey=randomUUID();
 const repeated=await Promise.all(peers.map(connection=>call('confirm',id,{expected_version:draft.version},confirmKey,'STAFF',connection)));
 assert.equal(repeated.filter(result=>!result.replayed).length,1);assert.equal(await quantity(),3);
 assert.equal((await read('history')).total,1,'one stock event for one confirmation');
 assert.equal((await read('history',{},'OTHER')).total,0);
 await reject(()=>call('confirm',id,{expected_version:draft.version}),'STATE_CONFLICT');
 await reject(()=>call('update',id,{...body,expected_version:draft.version}),'STATE_CONFLICT');
 const canceled=await call('create',null,body);await call('cancel',canceled.receipt.ma_phieu_nhap,{expected_version:canceled.version});
 assert.equal(await quantity(),3);await reject(()=>call('confirm',canceled.receipt.ma_phieu_nhap,{expected_version:canceled.version}),'STATE_CONFLICT');
 const raced=await call('create',null,body);
 const race=await Promise.allSettled([
  call('confirm',raced.receipt.ma_phieu_nhap,{expected_version:raced.version},randomUUID(),'STAFF',peers[0]),
  peers[1].query('select public.admin_operation_v1($1,$2,$3,$4,$5,$6)',['ADMIN','receipts','confirm',randomUUID(),String(raced.receipt.ma_phieu_nhap),{_expected_status:'NHAP'}]),
 ]);
 assert.equal(race.filter(result=>result.status==='fulfilled').length,1,'admin and staff cannot confirm the same document twice');assert.equal(await quantity(),6);
 const events=await read('history');assert.equal(events.total,2);assert.ok(events.data.every(event=>event.after_quantity-event.before_quantity===3));
 for(const role of ['anon','authenticated'])assert.equal((await db.query('select has_function_privilege($1,\'public.warehouse_receipt_v1(text,text,uuid,int,jsonb)\',\'EXECUTE\') as allowed',[role])).rows[0].allowed,false);
 await db.query('reset role');await db.query('update "NHAN_VIEN" set trang_thai=0 where ma_nhan_vien=\'NV1\'');await db.query('set role service_role');
 await reject(()=>read('history'),'WAREHOUSE_FORBIDDEN');
 console.log('PASS: real PostgreSQL create/edit/cancel/confirm; warehouse isolation; stale version and rollback; 6 concurrent retries; admin/staff race; exact stock/audit; service-only RPC; revoked employee.');
}
main().catch(error=>{console.error(error);process.exitCode=1}).finally(async()=>{await Promise.all(peers.map(client=>client.end().catch(()=>{})));await db?.end().catch(()=>{});await admin.query(`drop database if exists ${database} with(force)`).catch(()=>{});await admin.end().catch(()=>{});});
