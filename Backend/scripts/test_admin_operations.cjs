// Isolated PostgreSQL integration checks. Never accepts a cloud database URL.
// PHUB_PG_MODULE=/path/to/pg node scripts/test_admin_operations.cjs
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { Client } = require(process.env.PHUB_PG_MODULE || "pg");
const { randomUUID } = require("node:crypto");
const config = {
  host: "127.0.0.1",
  port: Number(process.env.PHUB_TEST_PG_PORT || 55432),
  user: "postgres",
  database: "postgres",
};
const name = "phub_ops_test_" + randomUUID().replaceAll("-", "");
const root = path.resolve(__dirname, "..");
const admin = new Client(config);
let db;
async function main() {
  await admin.connect();
  for (const role of ["anon", "authenticated", "service_role"]) {
    if (
      !(await admin.query("select 1 from pg_roles where rolname=$1", [role]))
        .rowCount
    )
      await admin.query(
        `create role ${role} ${role === "service_role" ? "bypassrls" : ""}`,
      );
  }
  await admin.query(`create database ${name}`);
  db = new Client({ ...config, database: name });
  await db.connect();
  for (const file of [
    "001_initial_schema.sql",
    "20261015032210_add_product_subcategories.sql",
    "20261023_customer_support.sql",
    "20261028132157_admin_operations.sql",
  ]) {
    if (file.includes('admin_operations') && process.env.PHUB_TEST_AWARE_DATES === '1') await db.query(`alter table "DON_HANG" alter column thoi_gian_dat type timestamptz using thoi_gian_dat at time zone 'UTC', alter column thoi_gian_xuat_kho type timestamptz using thoi_gian_xuat_kho at time zone 'UTC', alter column thoi_gian_hoan_thanh type timestamptz using thoi_gian_hoan_thanh at time zone 'UTC'`);
    if (file.startsWith("202610150"))
      await db.query(
        `insert into "LOAI_SP" values ('L_DESKTOP','Desktop',1),('L_LINHKIEN','Components',1),('SEED_L001','Phones',1),('SEED_L002','Laptops',1),('SEED_L003','Monitors',1),('SEED_L004','Accessories',1)`,
      );
    await db.query(
      fs.readFileSync(path.join(root, "migrations", file), "utf8"),
    );
  }
  await db.query(`insert into "KHO"(ma_kho,ten_kho,dia_chi) values(-1,'Kho A','A'),(-2,'Kho B','B');
 insert into "NHAN_VIEN"(ma_nhan_vien,loai_nhan_vien,ho_ten) values('NV1','ADMIN','Admin');
 insert into "KHACH_HANG"(ma_kh,ten_kh) values('KH1','Khách test');
 insert into "TAI_KHOAN"(ma_tk,ten_tai_khoan,mat_khau_hash,ma_nhan_vien) values('AD1','admin','disabled','NV1');
 insert into "LOAI_SP" values('L1','Linh kiện',1);
 insert into "LOAI_SP_CON"(ma_loai_sp_con,ten_loai_sp_con,ma_loai_sp) values('SC1','CPU','L1');
 insert into "SAN_PHAM"(ma_sp,sku,ten_sp,ma_loai_sp,ma_loai_sp_con,gia_ban_hien_tai,don_vi) values('SP1','SKU1','Sản phẩm','L1','SC1',100,'Cái');
 insert into "NHA_CUNG_CAP"(ma_ncc,ten_ncc) values(-1,'Supplier');
 grant usage,select on all sequences in schema public to service_role;`);
  await db.query("set role service_role");
  const call = async (
    resource,
    action,
    id,
    data = {},
    key = randomUUID(),
    expected = null,
  ) =>
    (
      await db.query(
        "select public.admin_operation_v1($1,$2,$3,$4,$5,$6) as result",
        [
          "AD1",
          resource,
          action,
          key,
          id,
          { ...data, _expected_status: expected },
        ],
      )
    ).rows[0].result;
  const reject = async (fn, code) =>
    assert.rejects(fn, (e) => e.message === code);
  const quantity = async (wh) =>
    Number(
      (
        await db.query(
          'select so_luong_ton from "TON_KHO" where ma_kho=$1 and sku=$2',
          [wh, "SKU1"],
        )
      ).rows[0]?.so_luong_ton || 0,
    );
  const receiptKey = randomUUID(),
    receiptData = {
      warehouse_id: -1,
      supplier_id: -1,
      lines: [{ sku: "SKU1", quantity: 10, unit_price: "50" }],
    };
  const receipt = (
    await call("receipts", "create", null, receiptData, receiptKey)
  ).data[0];
  assert.equal(
    (await call("receipts", "create", null, receiptData, receiptKey)).replayed,
    true,
  );
  await reject(
    () =>
      call(
        "receipts",
        "create",
        null,
        { ...receiptData, note: "different" },
        receiptKey,
      ),
    "IDEMPOTENCY_CONFLICT",
  );
  const confirmKey = randomUUID();
  await call(
    "receipts",
    "confirm",
    String(receipt.ma_phieu_nhap),
    {},
    confirmKey,
    "NHAP",
  );
  await call(
    "receipts",
    "confirm",
    String(receipt.ma_phieu_nhap),
    {},
    confirmKey,
    "NHAP",
  );
  assert.equal(await quantity(-1), 10);
  await reject(
    () => call("receipts", "confirm", String(receipt.ma_phieu_nhap)),
    "STATE_CONFLICT",
  );
  const order = (
    await call("orders", "create", null, {
      recipient: "Khách test",
      lines: [
        { sku: "SKU1", quantity: 4, warehouse_id: -1, unit_price: "100" },
      ],
    })
  ).data[0];
  assert.equal(await quantity(-1), 10); // Physical stock remains until dispatch.
  await reject(
    () =>
      call("inventory", "adjust", null, {
        warehouse_id: -1,
        sku: "SKU1",
        expected_quantity: 10,
        quantity: 3,
        reason: "Kiểm kê thực tế",
      }),
    "INSUFFICIENT_STOCK",
  );
  const transfer = (
    await call("transfers", "create", null, {
      warehouse_id: -1,
      destination_id: -2,
      lines: [{ sku: "SKU1", quantity: 7 }],
    })
  ).data[0];
  await reject(
    () => call("transfers", "dispatch", String(transfer.ma_phieu_chuyen)),
    "INSUFFICIENT_STOCK",
  );
  assert.equal(await quantity(-1), 10);
  await call("transfers", "lines", String(transfer.ma_phieu_chuyen), {
    lines: [{ sku: "SKU1", quantity: 3 }],
  });
  const dispatchKey = randomUUID();
  await call(
    "transfers",
    "dispatch",
    String(transfer.ma_phieu_chuyen),
    {},
    dispatchKey,
  );
  await call(
    "transfers",
    "dispatch",
    String(transfer.ma_phieu_chuyen),
    {},
    dispatchKey,
  );
  assert.equal(await quantity(-1), 7);
  await call("transfers", "receive", String(transfer.ma_phieu_chuyen));
  assert.equal(await quantity(-2), 3);
  await reject(
    () => call("transfers", "receive", String(transfer.ma_phieu_chuyen)),
    "STATE_CONFLICT",
  );
  await call("orders", "confirm", order.ma_donhang, {}, randomUUID(), "MOI");
  await reject(
    () => call("orders", "prepare", order.ma_donhang, {}, randomUUID(), "MOI"),
    "STATE_CONFLICT",
  );
  await call("orders", "prepare", order.ma_donhang);
  await call("orders", "dispatch", order.ma_donhang);
  assert.equal(await quantity(-1), 3);
  await reject(
    () => call("orders", "complete", order.ma_donhang),
    "PAYMENT_REQUIRED",
  );
  await call("orders", "invoice", order.ma_donhang);
  const invoice = (
    await db.query('select * from "HOA_DON" where ma_donhang=$1', [
      order.ma_donhang,
    ])
  ).rows[0];
  assert.equal(invoice.tong_tien_sau_thue, "440.00");
  await reject(
    () =>
      call("orders", "payment", order.ma_donhang, {
        amount: "441",
        method: "TIEN_MAT",
      }),
    "PAYMENT_LIMIT",
  );
  const paymentKey = randomUUID();
  await call(
    "orders",
    "payment",
    order.ma_donhang,
    { amount: "440", method: "TIEN_MAT" },
    paymentKey,
  );
  await call(
    "orders",
    "payment",
    order.ma_donhang,
    { amount: "440", method: "TIEN_MAT" },
    paymentKey,
  );
  await call("orders", "complete", order.ma_donhang);
  await call("orders", "refund", order.ma_donhang, {
    amount: "40",
    method: "TIEN_MAT",
  });
  await reject(
    () =>
      call("orders", "refund", order.ma_donhang, {
        amount: "401",
        method: "TIEN_MAT",
      }),
    "PAYMENT_LIMIT",
  );
  await reject(
    () =>
      call("inventory", "adjust", null, {
        warehouse_id: -1,
        sku: "SKU1",
        expected_quantity: 4,
        quantity: 5,
        reason: "Kiểm kê thực tế",
      }),
    "STOCK_CHANGED",
  );
  await call("inventory", "adjust", null, {
    warehouse_id: -1,
    sku: "SKU1",
    expected_quantity: 3,
    quantity: 5,
    reason: "Kiểm kê thực tế",
  });
  assert.equal(await quantity(-1), 5);
  for (const kind of [
    "summary",
    "notifications",
    "search",
    "settings",
    "history",
  ]) {
    const result = (
      await db.query("select admin_read_v1($1,$2,$3) r", [
        "AD1",
        kind,
        { q: "SKU", start: "2020-01-01", end: "2020-01-30" },
      ])
    ).rows[0].r;
    assert.notEqual(result, null);
  }
  assert.equal(
    (await db.query("select count(*) from admin_ops.stock_events")).rows[0]
      .count,
    "6",
  );
  const connections = [
    new Client({ ...config, database: name }),
    new Client({ ...config, database: name }),
  ];
  await Promise.all(
    connections.map(async (c) => {
      await c.connect();
      await c.query("set role service_role");
    }),
  );
  try {
    const concurrent = (c, resource, action, id, data, key = randomUUID()) =>
      c.query("select admin_operation_v1($1,$2,$3,$4,$5,$6) r", [
        "AD1",
        resource,
        action,
        key,
        id,
        { ...data, _expected_status: null },
      ]);
    const key = randomUUID();
    const same = await Promise.all(
      connections.map((c) =>
        concurrent(c, "receipts", "create", null, receiptData, key),
      ),
    );
    assert.equal(same.filter((r) => r.rows[0].r.replayed).length, 1);
    const oversell = await Promise.allSettled(
      connections.map((c) =>
        concurrent(c, "orders", "create", null, {
          recipient: "Concurrent",
          lines: [
            { sku: "SKU1", quantity: 4, warehouse_id: -1, unit_price: "100" },
          ],
        }),
      ),
    );
    assert.equal(oversell.filter((r) => r.status === "fulfilled").length, 1);
    assert.equal(
      oversell.find((r) => r.status === "rejected").reason.message,
      "INSUFFICIENT_STOCK",
    );
    const held = oversell.find((r) => r.status === "fulfilled").value.rows[0].r
      .data[0];
    await call("orders", "cancel", held.ma_donhang);
    const refunds = await Promise.allSettled(
      connections.map((c) =>
        concurrent(c, "orders", "refund", order.ma_donhang, {
          amount: "300",
          method: "TIEN_MAT",
        }),
      ),
    );
    assert.equal(refunds.filter((r) => r.status === "fulfilled").length, 1);
    assert.equal(
      refunds.find((r) => r.status === "rejected").reason.message,
      "PAYMENT_LIMIT",
    );
  } finally {
    await Promise.all(connections.map((c) => c.end()));
  }
  const cancelInvoice = (
    await call("orders", "create", null, {
      recipient: "Cancel invoice",
      lines: [
        { sku: "SKU1", quantity: 1, warehouse_id: -1, unit_price: "100" },
      ],
    })
  ).data[0];
  await call("orders", "confirm", cancelInvoice.ma_donhang);
  await call("orders", "invoice", cancelInvoice.ma_donhang);
  await call("orders", "cancel", cancelInvoice.ma_donhang);
  assert.equal(
    (
      await db.query('select count(*) from "HOA_DON" where ma_donhang=$1', [
        cancelInvoice.ma_donhang,
      ])
    ).rows[0].count,
    "1",
  );
  await db.query(`insert into "CHUONG_TRINH_KHUYEN_MAI"(ma_ctkm,ten_chuong_trinh,ngay_bat_dau,ngay_ket_thuc,trang_thai,nguoi_tao,ngay_tao) values(-1,'Test','2000-01-01','2100-01-01','HOAT_DONG','NV1',now());
 insert into "VOUCHER"(ma_voucher,ma_ctkm,ma_code,loai_giam,gia_tri_giam,trang_thai,ngay_tao) values(-1,-1,'TEST','PHAN_TRAM',10,'HOAT_DONG',now());
 insert into "TAI_KHOAN"(ma_tk,ten_tai_khoan,mat_khau_hash,ma_kh) values('CUS1','customer','disabled','KH1');
 insert into "PHAN_HOI"(ma_phan_hoi,ma_kh,tieu_de,noi_dung) values('00000000-0000-4000-8000-000000000001','KH1','Hỗ trợ','Test');`);
  const voucherBody = {
    recipient: "Voucher",
    customer_id: "KH1",
    voucher_code: "TEST",
    lines: [{ sku: "SKU1", quantity: 1, warehouse_id: -1, unit_price: "100" }],
  };
  const discounted = (await call("orders", "create", null, voucherBody))
    .data[0];
  await call("orders", "cancel", discounted.ma_donhang);
  await reject(
    () => call("orders", "create", null, voucherBody),
    "VOUCHER_UNAVAILABLE",
  );
  const ticketId = "00000000-0000-4000-8000-000000000001";
  await db.query("select admin_update_feedback_thread_v1($1,$2,$3)", [
    "AD1",
    ticketId,
    { phan_hoi_quan_ly: "Phản hồi đầu tiên" },
  ]);
  await db.query("select admin_update_feedback_thread_v1($1,$2,$3)", [
    "AD1",
    ticketId,
    { phan_hoi_quan_ly: "Phản hồi thứ hai" },
  ]);
  const msgKey = randomUUID();
  await db.query("select customer_feedback_messages_v1($1,$2,1,$3,$4)", [
    "CUS1",
    ticketId,
    "Khách hỏi lại",
    msgKey,
  ]);
  await db.query("select customer_feedback_messages_v1($1,$2,1,$3,$4)", [
    "CUS1",
    ticketId,
    "Khách hỏi lại",
    msgKey,
  ]);
  const thread = (
    await db.query(
      "select customer_feedback_messages_v1($1,$2,1,null,null) r",
      ["CUS1", ticketId],
    )
  ).rows[0].r;
  assert.equal(thread.total, 3);
  assert.equal(thread.data[2].author, "Bạn");
  await db.query("reset role; set role anon");
  await db.query("reset role");
  await db.query(`insert into "DON_HANG"(ma_donhang,kenh_ban,trang_thai,thoi_gian_dat) values('TZ-TEST','ONLINE','HUY','2020-01-01 18:30:00+00')`);
  await db.query('set role service_role');
  const daySummary=(await db.query('select admin_read_v1($1,$2,$3) r',['AD1','summary',{start:'2020-01-02',end:'2020-01-02'}])).rows[0].r;
  assert.equal(daySummary.orders.find(row=>row.day==='2020-01-02')?.value,1);
  await db.query('set role anon');
  await assert.rejects(
    () =>
      db.query(
        `select admin_operation_v1('AD1','orders','create',gen_random_uuid(),null,'{}')`,
      ),
    /permission denied/,
  );
  console.log(
    "PASS: real PostgreSQL transactions, state guards, exact money, reservations, replay, rollback, ledger and grants.",
  );
}
main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (db) await db.end();
    try {
      await admin.query(`drop database if exists ${name} with (force)`);
    } finally {
      await admin.end();
    }
  });
