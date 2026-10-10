// Always creates an isolated local PostgreSQL cluster. No Supabase credentials.
// Install embedded-postgres outside the repo; set PHUB_EMBEDDED_POSTGRES_MODULE
// to that package's dist/index.js file URL. No external database URL is accepted.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile, mkdtemp } from "node:fs/promises";
import net from "node:net";
import os from "node:os";
import path from "node:path";

const { default: EmbeddedPostgres } = await import(process.env.PHUB_EMBEDDED_POSTGRES_MODULE || "embedded-postgres");
const root = new URL("../", import.meta.url);
const dataDir = await mkdtemp(path.join(os.tmpdir(), "phub-order-db-check-"));
const listener = net.createServer();
await new Promise(resolve => listener.listen(0, "127.0.0.1", resolve));
const port = listener.address().port;
await new Promise(resolve => listener.close(resolve));
const database = new EmbeddedPostgres({
  databaseDir: dataDir, port, user: "postgres", password: randomUUID(),
  persistent: true, createPostgresUser: false, postgresFlags: ["-h", "127.0.0.1"],
  onLog: () => {}, onError: message => console.error(String(message).slice(0, 500)),
});
const clients = [];
let sql;
let checks = 0;
const passed = name => { checks++; console.log("PASS:", name); };
const recipient = { name: "Test Customer", phone: "0901234567", address_line: "Test address", province: "Test province", ward: "Test ward" };
const body = (quantity = 1) => ({ recipient, note: null, items: [{ sku: "SKU-A", warehouse_id: -900001, quantity, expected_unit_price: "0.10" }] });
async function connection() {
  const client = database.getPgClient();
  await client.connect(); clients.push(client); return client;
}
async function reset(stock = 4) {
  await sql.query(`TRUNCATE customer_order_private.idempotency, public."CT_DON_HANG", public."DON_HANG", public."TON_KHO", public."SAN_PHAM", public."KHO", public."LOAI_SP" RESTART IDENTITY CASCADE;
    INSERT INTO public."LOAI_SP" VALUES ('CAT-A',1);
    INSERT INTO public."SAN_PHAM" VALUES ('SP-A','SKU-A','Product A','CAT-A','Unit',0.10,1), ('SP-B','SKU-B','Product B','CAT-A','Unit',0.20,1);
    INSERT INTO public."KHO" VALUES (-900001,1),(-900002,1);`);
  await sql.query(`INSERT INTO public."TON_KHO"(ma_kho,sku,so_luong_ton) VALUES (-900001,'SKU-A',$1),(-900001,'SKU-B',$1),(-900002,'SKU-A',$1)`, [stock]);
}
async function rpc(payload, key = randomUUID(), client = sql, overrides = {}) {
  const { rows } = await client.query("SELECT public.customer_create_order_v1($1::uuid,$2::jsonb,$3,$4,$5::numeric,$6,$7::integer,$8) AS result", [
    key, JSON.stringify(payload), overrides.stockPolicy || "reserve_on_order", overrides.priceTaxMode || "exclusive",
    overrides.taxRate ?? "10", "VND", 1, overrides.taxApplication || "invoice",
  ]);
  return rows[0].result;
}
async function counts() {
  return (await sql.query(`SELECT (SELECT count(*)::int FROM public."DON_HANG") AS orders,
    (SELECT count(*)::int FROM public."CT_DON_HANG") AS lines,
    (SELECT count(*)::int FROM customer_order_private.idempotency) AS keys`)).rows[0];
}
async function stock() { return (await sql.query(`SELECT so_luong_ton FROM public."TON_KHO" WHERE ma_kho=-900001 AND sku='SKU-A'`)).rows[0].so_luong_ton; }
async function expectFailure(payload, code, options = {}) {
  const before = await counts();
  const result = await rpc(payload, undefined, sql, options);
  assert.equal(result.error?.code, code);
  assert.deepEqual(await counts(), before);
}

try {
  await database.initialise(); await database.start(); sql = await connection();
  console.log("Isolated PostgreSQL:", (await sql.query("SHOW server_version")).rows[0].server_version);
  await sql.query(await readFile(new URL("tests/fixtures/order_schema.sql", root), "utf8"));
  const beforeColumns = await sql.query("SELECT table_name,column_name,data_type,column_default,is_identity FROM information_schema.columns WHERE table_schema='public' ORDER BY table_name,ordinal_position");
  await sql.query(await readFile(new URL("migrations/20261004_customer_orders.sql", root), "utf8"));
  assert.deepEqual((await sql.query("SELECT table_name,column_name,data_type,column_default,is_identity FROM information_schema.columns WHERE table_schema='public' ORDER BY table_name,ordinal_position")).rows, beforeColumns.rows);
  passed("Migration compiles without changing existing table columns or generators");

  await reset();
  const key = randomUUID();
  const first = await rpc(body(3), key);
  assert.equal(first.replayed, false);
  assert.equal(first.order.total, "0.30");
  assert.equal(first.order.tax_total, "0.00");
  assert.equal(first.order.tax_application, "invoice");
  assert.equal(first.order.items[0].tax_rate, "10.00");
  assert.equal(await stock(), 4);
  assert.deepEqual(await counts(), { orders: 1, lines: 1, keys: 1 });
  assert.equal((await sql.query(`SELECT don_gia::text,tien_thue::text,thue_suat::text,thanh_tien::text FROM public."CT_DON_HANG"`)).rows[0].tien_thue, "0.00");
  passed("Exact decimal totals, recipient, deferred VAT and unchanged physical stock");
  await sql.query(`UPDATE public."SAN_PHAM" SET ten_sp='Changed',don_vi='Changed unit',gia_ban_hien_tai=9 WHERE sku='SKU-A'; UPDATE public."KHO" SET trang_thai=0 WHERE ma_kho=-900001;`);
  const replay = await rpc(body(3), key);
  assert.equal(replay.replayed, true);
  assert.deepEqual(replay.order, first.order);
  assert.equal((await sql.query(`SELECT ten_sp_luc_ban FROM public."CT_DON_HANG"`)).rows[0].ten_sp_luc_ban, "Product A");
  const conflict = await rpc(body(2), key);
  assert.equal(conflict.error.code, "IDEMPOTENCY_CONFLICT");
  assert.deepEqual(await counts(), { orders: 1, lines: 1, keys: 1 });
  passed("Snapshots and cached replay survive product/warehouse changes; changed payload conflicts");

  await reset();
  const multiple = body();
  multiple.items.push({ sku: "SKU-B", warehouse_id: -900001, quantity: 2, expected_unit_price: "0.20" });
  const multiKey = randomUUID();
  const multi = await rpc(multiple, multiKey);
  multiple.items.reverse(); multiple.items[1].expected_unit_price = "0.1";
  const reordered = await rpc(multiple, multiKey);
  assert.equal(multi.order.total, "0.50");
  assert.equal(reordered.replayed, true); assert.deepEqual(reordered.order, multi.order);
  passed("Multi-line totals and canonical line order/decimal representation");

  const cases = [
    ["unknown SKU", "PRODUCT_NOT_AVAILABLE", async payload => { payload.items[0].sku = "UNKNOWN"; }],
    ["inactive product", "PRODUCT_NOT_AVAILABLE", async () => { await sql.query(`UPDATE public."SAN_PHAM" SET trang_thai=0 WHERE sku='SKU-A'`); }],
    ["inactive category", "PRODUCT_NOT_AVAILABLE", async () => { await sql.query(`UPDATE public."LOAI_SP" SET trang_thai=0`); }],
    ["missing warehouse", "WAREHOUSE_NOT_AVAILABLE", async payload => { payload.items[0].warehouse_id = 99; }],
    ["inactive warehouse", "WAREHOUSE_NOT_AVAILABLE", async () => { await sql.query(`UPDATE public."KHO" SET trang_thai=0 WHERE ma_kho=-900001`); }],
    ["price changed", "PRICE_CHANGED", async payload => { payload.items[0].expected_unit_price = "0.11"; }],
    ["missing inventory", "INSUFFICIENT_STOCK", async () => { await sql.query(`DELETE FROM public."TON_KHO" WHERE sku='SKU-A' AND ma_kho=-900001`); }],
    ["insufficient stock", "INSUFFICIENT_STOCK", async payload => { payload.items[0].quantity = 5; }],
    ["fractional quantity", "VALIDATION_ERROR", async payload => { payload.items[0].quantity = 1.5; }],
    ["duplicate line", "VALIDATION_ERROR", async payload => { payload.items.push({ ...payload.items[0] }); }],
    ["missing recipient", "VALIDATION_ERROR", async payload => { delete payload.recipient; }],
  ];
  for (const [name, code, mutate] of cases) {
    await reset(); const payload = structuredClone(body()); await mutate(payload);
    await expectFailure(payload, code); passed(`${name}: correct error and no partial writes`);
  }
  for (const options of [{ taxRate: "8" }, { taxApplication: "order" }, { stockPolicy: "deduct_now" }, { priceTaxMode: "inclusive" }]) {
    await reset(); await expectFailure(body(), "ORDER_CONFIGURATION_REQUIRED", options);
  }
  passed("Unsupported stock/tax policies fail without writes");

  await reset();
  await sql.query(`UPDATE public."SAN_PHAM" SET gia_ban_hien_tai=9999999999999999.99 WHERE sku='SKU-A'`);
  const large = body(2); large.items[0].expected_unit_price = "9999999999999999.99";
  await expectFailure(large, "AMOUNT_OUT_OF_RANGE");
  passed("Amount overflow is rejected before storing money");

  await reset();
  const failedKey = randomUUID(); const bad = body(); bad.items[0].expected_unit_price = "0.11";
  assert.equal((await rpc(bad, failedKey)).error.code, "PRICE_CHANGED");
  assert.equal((await rpc(body(), failedKey)).replayed, false);
  passed("A failed attempt rolls back the key so the corrected request can succeed");

  for (const status of ["MOI", "XAC_NHAN", "DANG_CHUAN_BI"]) {
    await reset(); const reserved = await rpc(body(3));
    await sql.query(`UPDATE public."DON_HANG" SET trang_thai=$1 WHERE ma_donhang=$2`, [status, reserved.order.id]);
    await expectFailure(body(2), "INSUFFICIENT_STOCK");
  }
  passed("All pending fulfillment states reserve stock");
  await reset(); const canceled = await rpc(body(4));
  await sql.query(`UPDATE public."DON_HANG" SET trang_thai='HUY' WHERE ma_donhang=$1`, [canceled.order.id]);
  assert.equal((await rpc(body(4))).replayed, false); assert.equal(await stock(), 4);
  passed("Cancellation releases the reservation without changing physical stock");
  await reset(); const dispatched = await rpc(body(3));
  await sql.query("BEGIN");
  await sql.query(`UPDATE public."TON_KHO" SET so_luong_ton=so_luong_ton-3 WHERE ma_kho=-900001 AND sku='SKU-A'`);
  await sql.query(`UPDATE public."DON_HANG" SET trang_thai='DA_XUAT_KHO' WHERE ma_donhang=$1`, [dispatched.order.id]);
  await sql.query("COMMIT");
  await expectFailure(body(2), "INSUFFICIENT_STOCK");
  assert.equal((await rpc(body())).replayed, false); assert.equal(await stock(), 1);
  passed("Simulated atomic warehouse dispatch avoids double subtraction of reserved stock");

  await reset();
  await sql.query(`CREATE FUNCTION public.fail_test_line() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'test-only line failure' USING ERRCODE='23514'; END $$;
    CREATE TRIGGER test_failure BEFORE INSERT ON public."CT_DON_HANG" FOR EACH ROW EXECUTE FUNCTION public.fail_test_line();`);
  await assert.rejects(rpc(body()), error => error.code === "23514");
  assert.deepEqual(await counts(), { orders: 0, lines: 0, keys: 0 });
  await sql.query(`DROP TRIGGER test_failure ON public."CT_DON_HANG"; DROP FUNCTION public.fail_test_line();`);
  passed("Unexpected detail insert failure rolls back order, details and idempotency key");

  const left = await connection(); const right = await connection();
  for (const sameKey of [false, true]) {
    await reset(1);
    await sql.query("BEGIN");
    await sql.query(`SELECT 1 FROM public."TON_KHO" WHERE sku='SKU-A' AND ma_kho=-900001 FOR UPDATE`);
    const sharedKey = randomUUID();
    const pending = [rpc(body(), sharedKey, left), rpc(body(), sameKey ? sharedKey : randomUUID(), right)];
    // Barrier: ensure both independent sessions have entered the RPC before release.
    for (let attempt = 0; attempt < 100; attempt++) {
      const active = (await sql.query("SELECT count(*)::int AS count FROM pg_stat_activity WHERE pid<>pg_backend_pid() AND state='active' AND query LIKE 'SELECT public.customer_create_order_v1%'")).rows[0].count;
      if (active === 2) break;
      if (attempt === 99) throw new Error("Concurrent requests did not reach the barrier");
      await new Promise(resolve => setTimeout(resolve, 20));
    }
    await sql.query("COMMIT");
    const results = await Promise.all(pending);
    if (sameKey) {
      assert.deepEqual(results.map(result => result.replayed).sort(), [false, true]);
      assert.deepEqual(results[0].order, results[1].order);
    } else {
      assert.equal(results.filter(result => result.order).length, 1);
      assert.equal(results.find(result => result.error).error.code, "INSUFFICIENT_STOCK");
    }
    assert.deepEqual(await counts(), { orders: 1, lines: 1, keys: 1 }); assert.equal(await stock(), 1);
    passed(sameKey ? "Concurrent identical keys create exactly one order and replay" : "Concurrent customers competing for the last unit create exactly one order");
  }

  await reset(); await left.query("SET ROLE service_role");
  assert.equal((await rpc(body(), undefined, left)).replayed, false);
  await left.query("RESET ROLE");
  for (const role of ["anon", "authenticated"]) {
    await left.query(`SET ROLE ${role}`);
    await assert.rejects(rpc(body(), undefined, left), error => error.code === "42501");
    await assert.rejects(left.query("SELECT * FROM customer_order_private.idempotency"), error => error.code === "42501");
    await left.query("RESET ROLE");
  }
  passed("RPC and private idempotency data are available to service_role only");
  console.log(`Completed ${checks} isolated PostgreSQL checks. No shared database was used.`);
} finally {
  if (sql) await sql.query("ROLLBACK").catch(() => {});
  await Promise.all(clients.map(client => client.end().catch(() => {})));
  await database.stop();
  // Leave the uniquely generated temp directory for inspection; never recursively delete paths.
}
