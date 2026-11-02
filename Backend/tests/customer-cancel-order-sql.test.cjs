/** Isolated PostgreSQL RAM test for customer order cancellation. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { PGlite } = require(process.env.PHUB_PGLITE_MODULE || '@electric-sql/pglite');
const root = path.resolve(__dirname, '../..');

async function main() {
  const db = await PGlite.create();
  try {
    await db.exec('create role anon; create role authenticated; create role service_role bypassrls; grant usage on schema public to service_role;');
    await db.exec(fs.readFileSync(path.join(root, 'Backend/migrations/001_initial_schema.sql'), 'utf8'));
    await db.exec(fs.readFileSync(path.join(root, 'Backend/migrations/20261004_customer_orders.sql'), 'utf8'));
    await db.exec(fs.readFileSync(path.join(root, 'Backend/migrations/20261006_customer_checkout.sql'), 'utf8'));
    await db.exec(fs.readFileSync(path.join(root, 'Backend/migrations/20261028142727_canonical_employee_role_and_account_rpc.sql'), 'utf8'));
    await db.exec(fs.readFileSync(path.join(root, 'Backend/migrations/20261102071529_customer_demo_payments.sql'), 'utf8'));
    await db.exec(fs.readFileSync(path.join(root, 'Backend/migrations/20261102080347_automatic_checkout_invoice.sql'), 'utf8'));
    await db.exec(fs.readFileSync(path.join(root, 'Backend/migrations/20261102081903_bypass_business_payments.sql'), 'utf8'));
    await db.exec(fs.readFileSync(path.join(root, 'Backend/migrations/20261102100000_customer_cancel_order.sql'), 'utf8'));

    // Insert sample customer, account, warehouse, product, order
    await db.exec(`
      insert into public."KHACH_HANG"(ma_kh, ten_kh, sdt, dia_chi_chi_tiet_md, tinh_thanh_md, xa_phuong_md)
      values ('KH1', 'Khach 1', '0901234567', '123 Le Loi', 'TP HCM', 'Phuong 1'),
             ('KH2', 'Khach 2', '0909999999', '456 Tran Phu', 'Ha Noi', 'Phuong 2');
      insert into public."TAI_KHOAN"(ma_tk, ten_tai_khoan, email, mat_khau_hash, ma_kh, trang_thai)
      values ('TK-KH1', 'khach1', 'kh1@test.local', 'hash', 'KH1', 1),
             ('TK-KH2', 'khach2', 'kh2@test.local', 'hash', 'KH2', 1);
      insert into public."KHO"(ma_kho, ten_kho, dia_chi, trang_thai) values (1, 'Kho 1', '123 Kho Hang', 1);
      insert into public."LOAI_SP"(ma_loai_sp, ten_loai_sp, trang_thai) values ('L1', 'Loai 1', 1);
      insert into public."LOAI_SP_CON"(ma_loai_sp_con, ma_loai_sp, ten_loai_sp_con, trang_thai) values ('L1-C1', 'L1', 'Loai con 1', 1);
      insert into public."SAN_PHAM"(ma_sp, sku, ten_sp, ma_loai_sp, ma_loai_sp_con, gia_ban_hien_tai, trang_thai, don_vi)
      values ('SP1', 'SKU1', 'Laptop Test', 'L1', 'L1-C1', 10000000.00, 1, 'Chiec');
      insert into public."TON_KHO"(ma_kho, sku, so_luong_ton) values (1, 'SKU1', 10);
    `);

    // Create Order 1 (unpaid, status MOI)
    await db.exec(`
      insert into public."DON_HANG"(ma_donhang, ma_kh, kenh_ban, trang_thai, thoi_gian_dat, ten_nguoi_nhan, sdt_nguoi_nhan, dia_chi_chi_tiet, tinh_thanh, xa_phuong)
      values ('DH-UNPAID', 'KH1', 'ONLINE', 'MOI', now(), 'Khach 1', '0901234567', '123 Le Loi', 'TP HCM', 'Phuong 1');
      insert into public."CT_DON_HANG"(ma_donhang, sku, ma_kho_xuat, ten_sp_luc_ban, don_vi_luc_ban, so_luong, don_gia, giam_gia, giam_gia_voucher, thue_suat, tien_thue, thanh_tien)
      values ('DH-UNPAID', 'SKU1', 1, 'Laptop Test', 'Chiec', 2, 10000000.00, 0, 0, 10, 0, 20000000.00);
    `);

    // Create Order 2 (paid via bypass, status DANG_CHUAN_BI)
    await db.exec(`
      insert into public."DON_HANG"(ma_donhang, ma_kh, kenh_ban, trang_thai, thoi_gian_dat, ten_nguoi_nhan, sdt_nguoi_nhan, dia_chi_chi_tiet, tinh_thanh, xa_phuong)
      values ('DH-PAID', 'KH1', 'ONLINE', 'DANG_CHUAN_BI', now(), 'Khach 1', '0901234567', '123 Le Loi', 'TP HCM', 'Phuong 1');
      insert into public."CT_DON_HANG"(ma_donhang, sku, ma_kho_xuat, ten_sp_luc_ban, don_vi_luc_ban, so_luong, don_gia, giam_gia, giam_gia_voucher, thue_suat, tien_thue, thanh_tien)
      values ('DH-PAID', 'SKU1', 1, 'Laptop Test', 'Chiec', 1, 10000000.00, 0, 0, 10, 0, 10000000.00);
      insert into public."THANH_TOAN"(ma_donhang, so_tien, loai_giao_dich, phuong_thuc, trang_thai, ma_giao_dich, thoi_gian, la_bypass, ma_tk_ghi_nhan)
      values ('DH-PAID', 10000000.00, 'THU', 'CHUYEN_KHOAN', 'THANH_CONG', 'BYPASS-TX-1', now(), true, 'TK-KH1');
    `);

    // Create Order 3 (dispatched, status DA_XUAT_KHO)
    await db.exec(`
      insert into public."DON_HANG"(ma_donhang, ma_kh, kenh_ban, trang_thai, thoi_gian_dat, thoi_gian_xuat_kho, ten_nguoi_nhan, sdt_nguoi_nhan, dia_chi_chi_tiet, tinh_thanh, xa_phuong)
      values ('DH-DISPATCHED', 'KH1', 'ONLINE', 'DA_XUAT_KHO', now(), now(), 'Khach 1', '0901234567', '123 Le Loi', 'TP HCM', 'Phuong 1');
    `);

    await db.exec('set role service_role');
    const cancel = async (kh, dh, reason = null) => {
      const res = await db.query('select public.customer_cancel_order_v1($1, $2, $3) as r', [kh, dh, reason]);
      return res.rows[0].r;
    };

    // Test 1: Cancel unpaid order
    let res = await cancel('KH1', 'DH-UNPAID', 'Doi y khong mua nua');
    assert.ok(res.order, 'Must return order detail');
    assert.equal(res.order.id, 'DH-UNPAID');
    assert.equal(res.order.status, 'HUY');

    const checkUnpaid = (await db.query(`select trang_thai from public."DON_HANG" where ma_donhang = 'DH-UNPAID'`)).rows[0];
    assert.equal(checkUnpaid.trang_thai, 'HUY');

    const txUnpaid = (await db.query(`select * from public."THANH_TOAN" where ma_donhang = 'DH-UNPAID'`)).rows;
    assert.equal(txUnpaid.length, 0, 'No refund transaction should be created for unpaid order');

    // Test 2: Cancel paid order
    res = await cancel('KH1', 'DH-PAID');
    assert.ok(res.order);
    assert.equal(res.order.id, 'DH-PAID');
    assert.equal(res.order.status, 'HUY');

    const checkPaid = (await db.query(`select trang_thai from public."DON_HANG" where ma_donhang = 'DH-PAID'`)).rows[0];
    assert.equal(checkPaid.trang_thai, 'HUY');

    const txPaid = (await db.query(`select * from public."THANH_TOAN" where ma_donhang = 'DH-PAID' order by thoi_gian desc`)).rows;
    assert.equal(txPaid.length, 2, 'Must have 1 collection and 1 refund transaction');
    const refund = txPaid[0];
    assert.equal(refund.loai_giao_dich, 'HOAN_TIEN');
    assert.equal(Number(refund.so_tien), 10000000);
    assert.equal(refund.trang_thai, 'THANH_CONG');
    assert.equal(refund.la_bypass, true);
    assert.equal(refund.ma_tk_ghi_nhan, 'TK-KH1');

    // Test 3: Cancelling already cancelled order fails
    res = await cancel('KH1', 'DH-PAID');
    assert.equal(res.error?.code, 'ORDER_ALREADY_CANCELLED');

    // Test 4: Cancelling dispatched order fails
    res = await cancel('KH1', 'DH-DISPATCHED');
    assert.equal(res.error?.code, 'ORDER_NOT_CANCELABLE');

    // Test 5: Customer KH2 cannot cancel KH1's order
    res = await cancel('KH2', 'DH-DISPATCHED');
    assert.equal(res.error?.code, 'ORDER_NOT_FOUND');

    console.log('Customer cancel order SQL tests passed successfully!');
  } finally {
    await db.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
