// Exact import + checkout SQL in an isolated PostgreSQL WASM database.
// Does not load .env, fetch images, call HTTP or connect to Supabase.
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { PGlite } = require(process.env.PHUB_PGLITE_MODULE || '@electric-sql/pglite');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8').replace(/\r\n/g, '\n');

(async () => {
  const db = new PGlite();
  try {
    const scalar = async (sql, args = []) => (await db.query(sql, args)).rows[0].r;
    await db.exec('create role anon; create role authenticated; create role service_role bypassrls;');
    for (const name of [
      '001_initial_schema.sql', '20261004_customer_orders.sql', '20261006_customer_checkout.sql',
      '20261023_customer_support.sql', '20261028132157_admin_operations.sql',
      '20261029162141_warehouse_receipts.sql', '20261030020310_business_report.sql',
      '20261030023519_receipt_sale_pricing.sql', '20261030034222_fixed_operating_warehouse.sql',
      '20261030151651_simplify_receipt_pricing.sql', '20261101162759_unlock_warehouses.sql',
      '20261102080347_automatic_checkout_invoice.sql', '20261102130239_stock_based_cart_quantity.sql',
      '20261102140733_multi_warehouse_customer_checkout.sql', '20261102145332_checkout_total_warehouse_stock.sql',
      '20261102151044_reserve_stock_after_invoice_or_payment.sql',
    ]) {
      await db.exec(read(`migrations/${name}`));
      // The historical single-warehouse migration requires warehouse 2 before
      // the later unlock migration can remove that restriction.
      if (name === '001_initial_schema.sql') await db.exec(`insert into "KHO"(ma_kho,ten_kho,dia_chi) values(1,'Fixture one','Test'),(2,'Fixture two','Test');`);
    }
    await db.exec(`
      insert into "NHAN_VIEN"(ma_nhan_vien,ho_ten,loai_nhan_vien) values('FIXTURE_ADMIN','Admin','ADMIN');
      insert into "TAI_KHOAN"(ma_tk,ten_tai_khoan,email,mat_khau_hash,ma_nhan_vien)
        values('FIXTURE_ACCOUNT','fixture_admin','admin123@gmail.com','disabled fixture','FIXTURE_ADMIN');
      insert into "KHACH_HANG"(ma_kh,ten_kh) values('C','Fixture Customer');
      insert into "LOAI_SP" values('L_LINHKIEN','Components',1),('SEED_L004','Accessories',1);
      insert into "LOAI_SP_CON" values('OLD_SUB','Existing subcategory','L_LINHKIEN',1);
      insert into "SAN_PHAM"(ma_sp,sku,ten_sp,ma_loai_sp,ma_loai_sp_con,gia_ban_hien_tai,don_vi)
        values('OLD','OLD','Existing product','L_LINHKIEN','OLD_SUB',100,'unit');
      insert into "TON_KHO"(ma_kho,sku,so_luong_ton) values(1,'OLD',7),(2,'OLD',99);
      insert into "NHA_CUNG_CAP"(ma_ncc,ten_ncc) values
        (101,'[SEED] Nhà cung cấp 1'),(102,'[SEED] Nhà cung cấp 2'),(103,'[SEED] Nhà cung cấp 3');
    `);
    const manifest = JSON.parse(read('seeds/catalog_warehouse1_20261103.json'));
    const importSql = read('seeds/catalog_warehouse1_20261103.sql');
    const existing = await scalar(`select jsonb_agg(to_jsonb(t) order by ma_kho,sku) as r from "TON_KHO" t`);
    await db.exec(importSql);
    assert.equal(await scalar('select count(*)::int as r from "PHIEU_NHAP"'), 3);
    assert.equal(await scalar('select count(*)::int as r from "PHIEU_NHAP" where ma_kho=1 and trang_thai=\'DA_NHAP\' and dinh_gia_da_ap_dung'), 3);
    assert.equal(await scalar('select sum(so_luong_nhap)::int as r from "CT_PHIEU_NHAP"'), 675);
    assert.equal(await scalar('select count(*)::int as r from "MEDIA" where ma_sp is not null and la_anh_chinh'), 24);
    assert.deepEqual(await scalar(`select jsonb_agg(to_jsonb(t) order by ma_kho,sku) as r from "TON_KHO" t where sku='OLD'`), existing);
    for (const product of manifest.products) {
      const row = await scalar('select jsonb_build_object(\'qty\',t.so_luong_ton,\'warehouse\',t.ma_kho,\'price\',s.gia_ban_hien_tai::text) as r from "TON_KHO" t join "SAN_PHAM" s using(sku) where sku=$1', [product.sku]);
      assert.equal(row.warehouse, 1); assert.equal(row.qty, product.quantity);
      assert.equal(Number(row.price), Number(product.sale_price_before_vat));
    }
    const snapshot = () => scalar(`select jsonb_build_object('stock',(select jsonb_agg(to_jsonb(t) order by ma_kho,sku) from "TON_KHO" t),
      'receipts',(select count(*) from "PHIEU_NHAP"),'orders',(select count(*) from "DON_HANG"),
      'invoices',(select count(*) from "HOA_DON"),'history',(select count(*) from admin_ops.stock_events)) as r`);
    let before = await snapshot(); await db.exec(importSql);
    assert.deepEqual(await snapshot(), before, 'replaying import must not add stock/receipts/history');

    const product = manifest.products[0], sku = product.sku;
    const available = () => scalar('select admin_ops.available(1,$1)::int as r', [sku]);
    const checkout = (body, create = false, key = null) => scalar(
      "select public.customer_checkout_multi_warehouse_v1('C',$1,$2,$3,'reserve_on_order','exclusive',10,'VND',1,'invoice','Asia/Ho_Chi_Minh') as r", [body, key, create]);
    const quoted = await checkout({items: [{sku, quantity: 2}]});
    assert.ok(quoted.quote, JSON.stringify(quoted));
    assert.deepEqual(await snapshot(), before, 'quote must not create documents or change stock');
    assert.equal(await available(), product.quantity);
    const quote = quoted.quote;
    const body = {recipient: {name:'Fixture Customer',phone:'0901234567',address_line:'Test',province:'Test',ward:'Test'},
      voucher_code: quote.voucher_code, expected_discount: quote.discount_total, expected_total: quote.total,
      items: quote.items.map(line => ({sku:line.sku,quantity:line.quantity,warehouse_id:line.warehouse_id,expected_unit_price:line.unit_price}))};
    const key = randomUUID(), placed = await checkout(body, true, key);
    assert.ok(placed.order, JSON.stringify(placed));
    const orderId = placed.order.id;
    assert.equal(await scalar('select count(*)::int as r from "HOA_DON" where ma_donhang=$1', [orderId]), 1);
    assert.equal(await scalar('select ma_kho_xuat::int as r from "CT_DON_HANG" where ma_donhang=$1', [orderId]), 1);
    assert.equal(await scalar('select so_luong_ton::int as r from "TON_KHO" where ma_kho=1 and sku=$1', [sku]), product.quantity, 'invoice reserves without physically deducting');
    assert.equal(await available(), product.quantity-2);
    assert.equal(Number(await scalar('select tong_tien_sau_thue::text as r from "HOA_DON" where ma_donhang=$1', [orderId])), Number(product.sale_price_before_vat)*2*1.1);
    assert.equal(await scalar('select count(*)::int as r from "THANH_TOAN" where ma_donhang=$1', [orderId]), 0, 'invoice does not imply payment');
    before = await snapshot();
    assert.equal((await checkout(body, true, key)).replayed, true);
    assert.deepEqual(await snapshot(), before, 'checkout replay must not duplicate invoice/order/reservation');
    assert.equal((await checkout({items: [{sku,quantity:product.quantity-1}]})).error.code, 'INSUFFICIENT_STOCK');
    await db.exec(importSql);
    assert.deepEqual(await snapshot(), before, 'replaying import after a purchase must not reset any stock or commitment');
    console.log('PASS: exact 24-SKU import, 675 units only in warehouse 1, 3 priced receipts, preserved old data, idempotent import, read-only quote, automatic invoice, reservation without physical deduction, VAT, no fake payment, idempotent checkout, overselling rejected');
  } finally { await db.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
