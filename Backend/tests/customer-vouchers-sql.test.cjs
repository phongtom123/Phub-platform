// Isolated PostgreSQL fixtures only; no network or live database mutations.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { PGlite } = require(process.env.PHUB_PGLITE_MODULE || '@electric-sql/pglite');
const root = path.resolve(__dirname, '../migrations');
(async () => {
  const db = await PGlite.create();
  try {
    await db.exec('create role anon; create role authenticated; create role service_role;');
    for (const name of ['001_initial_schema.sql', '20261004_customer_orders.sql', '20261006_customer_checkout.sql']) {
      await db.exec(fs.readFileSync(path.join(root, name), 'utf8'));
    }
    await db.exec(`alter table public."KHACH_HANG" add column luu_tru_luc timestamptz;
      alter table public."CHUONG_TRINH_KHUYEN_MAI" alter column ngay_bat_dau type timestamp;
      alter table public."CHUONG_TRINH_KHUYEN_MAI" alter column ngay_ket_thuc type timestamp;
      insert into public."KHACH_HANG"(ma_kh,ten_kh) values ('K1','One'),('K2','Two');
      insert into public."NHAN_VIEN"(ma_nhan_vien,loai_nhan_vien,ho_ten) values ('A','ADMIN','Admin');
      insert into public."KHO"(ma_kho,ten_kho,dia_chi) values (1,'Warehouse','Test');
      insert into public."LOAI_SP"(ma_loai_sp,ten_loai_sp) values ('C','Category');
      insert into public."LOAI_SP_CON"(ma_loai_sp,ma_loai_sp_con,ten_loai_sp_con) values ('C','SC','Subcategory');
      insert into public."SAN_PHAM"(ma_sp,sku,ten_sp,ma_loai_sp,ma_loai_sp_con,gia_ban_hien_tai,don_vi) values ('P','S','Product','C','SC',1000,'Item');
      insert into public."TON_KHO"(ma_kho,sku,so_luong_ton) values (1,'S',10);
      insert into public."CHUONG_TRINH_KHUYEN_MAI"(ma_ctkm,ten_chuong_trinh,ngay_bat_dau,ngay_ket_thuc,trang_thai,nguoi_tao,ngay_tao)
        values (1,'Current',timezone('Asia/Ho_Chi_Minh',now())-interval '1 day',timezone('Asia/Ho_Chi_Minh',now())+interval '1 day','HOAT_DONG','A',now()),
        (2,'Expired',timezone('Asia/Ho_Chi_Minh',now())-interval '3 days',timezone('Asia/Ho_Chi_Minh',now())-interval '1 day','HOAT_DONG','A',now()),
        (3,'Future',timezone('Asia/Ho_Chi_Minh',now())+interval '1 day',timezone('Asia/Ho_Chi_Minh',now())+interval '3 days','HOAT_DONG','A',now());
      insert into public."VOUCHER"(ma_ctkm,ma_code,loai_giam,gia_tri_giam,giam_toi_da,gia_tri_don_toi_thieu,gioi_han_tong_luot,gioi_han_moi_khach,trang_thai,ngay_tao)
        values (1,'SAVE10','PHAN_TRAM',10,150,1000,2,1,'HOAT_DONG',now()),
        (2,'OLD','SO_TIEN',100,null,0,null,1,'HOAT_DONG',now()),
        (3,'FUTURE','SO_TIEN',100,null,0,null,1,'HOAT_DONG',now()),
        (1,'PAUSED','SO_TIEN',100,null,0,null,1,'TAM_DUNG',now());`);
    await db.exec(fs.readFileSync(path.join(root, '20261109135628_customer_voucher_choices.sql'), 'utf8'));
    const list = async customer => (await db.query('select public.customer_voucher_choices_v1($1) as body', [customer])).rows[0].body;
    const quote = async (code, customer='K1') => (await db.query(`select public.customer_checkout_v2($1,$2::jsonb,null,false,
      'reserve_on_order','exclusive',10,'VND',1,'invoice','Asia/Ho_Chi_Minh') as body`, [customer,JSON.stringify({items:[{sku:'S',quantity:2}],voucher_code:code})])).rows[0].body;
    const choices = (await list('K1')).items;
    assert.equal(choices[0].code,'SAVE10');
    assert.equal(choices.find(v=>v.code==='OLD').unavailable_reason,'EXPIRED');
    assert.equal(choices.find(v=>v.code==='FUTURE').unavailable_reason,'NOT_STARTED');
    assert.ok(!choices.some(v=>v.code==='PAUSED'));
    assert.equal((await quote('SAVE10')).quote.discount_total,'150.00');
    assert.equal((await quote('SAVE10')).quote.total,'1850.00');
    assert.equal((await quote('OLD')).error.code,'VOUCHER_NOT_AVAILABLE');
    assert.equal((await quote('FUTURE')).error.code,'VOUCHER_NOT_AVAILABLE');
    assert.equal((await db.query('select count(*)::int n from public."SU_DUNG_VOUCHER"')).rows[0].n,0,'quotes/list do not consume uses');
    for (const [id,customer] of [['D1','K1'],['D2','K2']]) {
      await db.query(`insert into public."DON_HANG"(ma_donhang,ma_kh,kenh_ban,trang_thai,thoi_gian_dat) values ($1,$2,'ONLINE','MOI',now());`, [id,customer]);
      await db.query(`insert into public."SU_DUNG_VOUCHER"(ma_voucher,ma_donhang,so_tien_giam,thoi_gian_ap_dung) select ma_voucher,$1,150,now() from public."VOUCHER" where ma_code='SAVE10'`,[id]);
      assert.equal((await quote('SAVE10',customer)).error.code,'VOUCHER_LIMIT_REACHED');
      if (id==='D1') {
        assert.equal((await list('K1')).items.find(v=>v.code==='SAVE10').unavailable_reason,'CUSTOMER_LIMIT_REACHED');
        assert.equal((await list('K2')).items.find(v=>v.code==='SAVE10').unavailable_reason,null);
      }
    }
    assert.equal((await list('K2')).items.find(v=>v.code==='SAVE10').unavailable_reason,'LIMIT_REACHED');
    assert.equal((await list('missing')).error.code,'AUTH_CUSTOMER_UNAVAILABLE');
    await db.exec(`update public."KHACH_HANG" set luu_tru_luc=now() where ma_kh='K1'`);
    assert.equal((await list('K1')).error.code,'AUTH_CUSTOMER_UNAVAILABLE');
    const acl=(await db.query(`select has_function_privilege('anon','public.customer_voucher_choices_v1(text,text)','execute') a,
      has_function_privilege('authenticated','public.customer_voucher_choices_v1(text,text)','execute') b`)).rows[0];
    assert.deepEqual(acl,{a:false,b:false});
    console.log('PASS: voucher dates, paused exclusion, percentage cap and quote totals, per-customer/global limits, identity, read-only uses, private ACL.');
  } finally { await db.close(); }
})().catch(error=>{console.error(error);process.exitCode=1;});
