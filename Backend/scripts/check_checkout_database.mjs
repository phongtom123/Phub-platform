// Isolated real PostgreSQL. Never reads .env, accepts a shared DB URL or writes Supabase.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtemp, readFile } from "node:fs/promises";
import net from "node:net";
import os from "node:os";
import path from "node:path";

const { default: EmbeddedPostgres } = await import(
  process.env.PHUB_EMBEDDED_POSTGRES_MODULE || "embedded-postgres"
);
const root = new URL("../", import.meta.url);
const directory = await mkdtemp(path.join(os.tmpdir(), "phub-checkout-check-"));
const listener = net.createServer();
await new Promise((resolve) => listener.listen(0, "127.0.0.1", resolve));
const port = listener.address().port;
await new Promise((resolve) => listener.close(resolve));
const database = new EmbeddedPostgres({
  databaseDir: directory,
  port,
  user: "postgres",
  password: randomUUID(),
  persistent: true,
  createPostgresUser: false,
  postgresFlags: ["-h", "127.0.0.1"],
  onLog: () => {},
  onError: (message) => console.error(String(message).slice(0, 300)),
});
const clients = [];
let sql;
let checks = 0;
const passed = (name) => {
  checks++;
  console.log("PASS:", name);
};
const recipient = {
  name: "Test Customer",
  phone: "0901234567",
  address_line: "Test address",
  province: "Test province",
  ward: "Test ward",
};
async function connection() {
  const client = database.getPgClient();
  await client.connect();
  clients.push(client);
  return client;
}
async function reset(stock = 10) {
  await sql.query(`TRUNCATE customer_order_private.idempotency,public."DON_HANG",public."CT_DON_HANG",public."TON_KHO",public."SAN_PHAM",public."LOAI_SP",public."KHO",public."KHACH_HANG",public."VOUCHER",public."CHUONG_TRINH_KHUYEN_MAI",public."SU_DUNG_VOUCHER" RESTART IDENTITY CASCADE;
    INSERT INTO public."KHACH_HANG"(ma_kh,ten_kh) VALUES('KH-A','Customer A'),('KH-B','Customer B');
    INSERT INTO public."LOAI_SP" VALUES('CAT-A',1);
    INSERT INTO public."SAN_PHAM" VALUES('SP-A','SKU-A','Product A','CAT-A','Unit',0.10,1),('SP-B','SKU-B','Product B','CAT-A','Unit',0.03,1),('SP-C','SKU-C','Product C','CAT-A','Unit',0.01,1);
    INSERT INTO public."KHO" VALUES(-900002,1),(-900001,1);
    INSERT INTO public."CHUONG_TRINH_KHUYEN_MAI" VALUES(1,timezone('Asia/Ho_Chi_Minh',now())-interval '1 day',timezone('Asia/Ho_Chi_Minh',now())+interval '1 day','HOAT_DONG');
    INSERT INTO public."VOUCHER" VALUES(1,1,'SAVE10','PHAN_TRAM',10,NULL,0,100,100,'HOAT_DONG');`);
  await sql.query(
    `INSERT INTO public."TON_KHO"(ma_kho,sku,so_luong_ton) SELECT k.ma_kho,p.sku,$1 FROM public."KHO" k CROSS JOIN public."SAN_PHAM" p`,
    [stock],
  );
}
async function counts() {
  return (
    await sql.query(
      `SELECT (SELECT count(*)::int FROM public."DON_HANG") AS orders,(SELECT count(*)::int FROM public."CT_DON_HANG") AS lines,(SELECT count(*)::int FROM public."SU_DUNG_VOUCHER") AS uses,(SELECT count(*)::int FROM customer_order_private.idempotency) AS keys`,
    )
  ).rows[0];
}
async function rpc(
  request,
  {
    customer = "KH-A",
    create = false,
    key = null,
    client = sql,
    timezone = "Asia/Ho_Chi_Minh",
  } = {},
) {
  return (
    await client.query(
      "SELECT public.customer_checkout_v2($1,$2::jsonb,$3::uuid,$4,$5,$6,$7::numeric,$8,$9::integer,$10,$11) AS result",
      [
        customer,
        JSON.stringify(request),
        key,
        create,
        "reserve_on_order",
        "exclusive",
        "10",
        "VND",
        1,
        "invoice",
        timezone,
      ],
    )
  ).rows[0].result;
}
const cart = (quantity = 2, voucher_code = null) => ({
  items: [{ sku: "SKU-A", quantity }],
  voucher_code,
});
function commit(quote) {
  return {
    recipient,
    note: null,
    voucher_code: quote.voucher_code,
    expected_discount: quote.discount_total,
    expected_total: quote.total,
    items: quote.items.map((line) => ({
      sku: line.sku,
      quantity: line.quantity,
      warehouse_id: line.warehouse_id,
      expected_unit_price: line.unit_price,
    })),
  };
}
async function quote(request = cart(), options) {
  const result = await rpc(request, options);
  assert.ok(result.quote, JSON.stringify(result.error));
  return result.quote;
}
async function fail(request, code, options) {
  const before = await counts();
  const result = await rpc(request, options);
  assert.equal(result.error?.code, code);
  assert.deepEqual(await counts(), before);
}
async function read(
  customer = "KH-A",
  orderId = null,
  page = 1,
  pageSize = 20,
) {
  return (
    await sql.query(
      "SELECT public.customer_read_orders_v2($1,$2,$3,$4,$5) AS result",
      [customer, orderId, page, pageSize, "VND"],
    )
  ).rows[0].result;
}

try {
  await database.initialise();
  await database.start();
  sql = await connection();
  for (const name of [
    "tests/fixtures/order_schema.sql",
    "tests/fixtures/commerce_schema.sql",
    "migrations/20261004_customer_orders.sql",
  ]) {
    await sql.query(await readFile(new URL(name, root), "utf8"));
  }
  const before = (
    await sql.query(
      "SELECT table_name,column_name,column_default,is_identity FROM information_schema.columns WHERE table_schema='public' ORDER BY table_name,ordinal_position",
    )
  ).rows;
  await sql.query(
    await readFile(
      new URL("migrations/20261006_customer_checkout.sql", root),
      "utf8",
    ),
  );
  assert.deepEqual(
    (
      await sql.query(
        "SELECT table_name,column_name,column_default,is_identity FROM information_schema.columns WHERE table_schema='public' ORDER BY table_name,ordinal_position",
      )
    ).rows,
    before,
  );
  passed("Migration compiles without changing shared columns or generators");
  await reset();
  const q = await quote();
  assert.equal(q.total, "0.20");
  assert.equal(q.items[0].warehouse_id, -900002);
  assert.equal(q.tax_total, "0.00");
  assert.deepEqual(await counts(), { orders: 0, lines: 0, uses: 0, keys: 0 });
  passed(
    "Quote uses exact money, deterministic available warehouse and writes nothing",
  );
  const discounted = await quote(cart(2, " save10 "));
  assert.equal(discounted.total, "0.18");
  assert.equal(discounted.discount_total, "0.02");
  assert.equal(discounted.voucher_code, "SAVE10");
  const request = commit(discounted);
  const key = randomUUID();
  const result = await rpc(request, { create: true, key });
  assert.equal(result.order.total, "0.18");
  assert.equal(result.order.tax_total, "0.00");
  assert.deepEqual(await counts(), { orders: 1, lines: 1, uses: 1, keys: 1 });
  assert.equal(
    (await sql.query(`SELECT ma_kh FROM public."DON_HANG"`)).rows[0].ma_kh,
    "KH-A",
  );
  assert.equal(
    (await sql.query(`SELECT min(so_luong_ton) AS stock FROM public."TON_KHO"`))
      .rows[0].stock,
    10,
  );
  passed(
    "Customer order, line discount, voucher use and key commit together without stock deduction",
  );
  await sql.query(
    `UPDATE public."SAN_PHAM" SET gia_ban_hien_tai=9;UPDATE public."VOUCHER" SET trang_thai='TAM_DUNG';`,
  );
  const replay = await rpc(request, { create: true, key });
  assert.equal(replay.replayed, true);
  assert.deepEqual(replay.order, result.order);
  await fail(request, "IDEMPOTENCY_CONFLICT", {
    create: true,
    key,
    customer: "KH-B",
  });
  passed(
    "Idempotent receipt is stable after changes and cannot replay another customer's order",
  );
  const detail = await read("KH-A", result.order.id);
  assert.equal(detail.order.total, "0.18");
  assert.equal(detail.order.items[0].discount, "0.02");
  assert.equal(
    (await read("KH-B", result.order.id)).error.code,
    "ORDER_NOT_FOUND",
  );
  assert.equal((await read("KH-A", "ABSENT")).error.code, "ORDER_NOT_FOUND");
  assert.equal((await read("KH-A")).pagination.total, 1);
  assert.deepEqual((await read("KH-B")).items, []);
  assert.deepEqual((await read("KH-A", null, 2, 1)).items, []);
  passed("List/detail total snapshots and pagination are ownership scoped");
  await reset(1);
  const split = {
    recipient,
    note: null,
    voucher_code: null,
    expected_discount: "0.00",
    expected_total: "0.20",
    items: [
      {
        sku: "SKU-A",
        warehouse_id: -900001,
        quantity: 1,
        expected_unit_price: "0.10",
      },
      {
        sku: "SKU-A",
        warehouse_id: -900002,
        quantity: 1,
        expected_unit_price: "0.10",
      },
    ],
  };
  const splitKey = randomUUID();
  const splitResult = await rpc(split, { create: true, key: splitKey });
  assert.equal(splitResult.order.total, "0.20");
  assert.equal(splitResult.order.items.length, 2);
  assert.deepEqual(
    (
      await rpc(
        { ...split, items: [...split.items].reverse() },
        { create: true, key: splitKey },
      )
    ).order,
    splitResult.order,
  );
  await fail(
    { ...split, items: [split.items[0], split.items[0]] },
    "VALIDATION_ERROR",
    { create: true, key: randomUUID() },
  );
  passed(
    "Existing explicit multi-warehouse order bodies remain valid, canonical and do not allow duplicate pairs",
  );
  const cases = [
    [
      "inactive voucher",
      "VOUCHER_NOT_AVAILABLE",
      `UPDATE public."VOUCHER" SET trang_thai='TAM_DUNG'`,
    ],
    [
      "inactive program",
      "VOUCHER_NOT_AVAILABLE",
      `UPDATE public."CHUONG_TRINH_KHUYEN_MAI" SET trang_thai='TAM_DUNG'`,
    ],
    [
      "expired program",
      "VOUCHER_NOT_AVAILABLE",
      `UPDATE public."CHUONG_TRINH_KHUYEN_MAI" SET ngay_ket_thuc=timezone('Asia/Ho_Chi_Minh',now())-interval '1 hour'`,
    ],
    [
      "future program",
      "VOUCHER_NOT_AVAILABLE",
      `UPDATE public."CHUONG_TRINH_KHUYEN_MAI" SET ngay_bat_dau=timezone('Asia/Ho_Chi_Minh',now())+interval '1 hour'`,
    ],
    [
      "minimum amount",
      "VOUCHER_MINIMUM_NOT_MET",
      `UPDATE public."VOUCHER" SET gia_tri_don_toi_thieu=1`,
    ],
    [
      "no global uses",
      "VOUCHER_LIMIT_REACHED",
      `UPDATE public."VOUCHER" SET gioi_han_tong_luot=0`,
    ],
    [
      "no customer uses",
      "VOUCHER_LIMIT_REACHED",
      `UPDATE public."VOUCHER" SET gioi_han_moi_khach=0`,
    ],
    [
      "invalid percent",
      "ORDER_CONFIGURATION_REQUIRED",
      `UPDATE public."VOUCHER" SET gia_tri_giam=101`,
    ],
  ];
  for (const [name, code, mutation] of cases) {
    await reset();
    await sql.query(mutation);
    await fail(cart(2, "SAVE10"), code);
    passed(name);
  }
  await reset();
  await fail(cart(2, "MISSING"), "VOUCHER_NOT_AVAILABLE");
  passed("Unknown voucher fails with no writes");
  await reset();
  await sql.query(
    `UPDATE public."VOUCHER" SET gia_tri_giam=50,giam_toi_da=0.03`,
  );
  assert.equal((await quote(cart(2, "SAVE10"))).discount_total, "0.03");
  await sql.query(
    `UPDATE public."VOUCHER" SET loai_giam='SO_TIEN',gia_tri_giam=99`,
  );
  assert.equal((await quote(cart(2, "SAVE10"))).total, "0.00");
  passed("Percentage cap and fixed discount cannot exceed subtotal");
  await reset();
  await sql.query(`UPDATE public."VOUCHER" SET gia_tri_giam=33`);
  const mixed = {
    items: [
      { sku: "SKU-C", quantity: 1 },
      { sku: "SKU-A", quantity: 1 },
      { sku: "SKU-B", quantity: 1 },
    ],
    voucher_code: "SAVE10",
  };
  const cents = await quote(mixed);
  assert.equal(cents.subtotal, "0.14");
  assert.equal(cents.discount_total, "0.05");
  assert.equal(cents.total, "0.09");
  const centsResult = await rpc(commit(cents), {
    create: true,
    key: randomUUID(),
  });
  assert.ok(centsResult.order);
  assert.equal(
    (
      await sql.query(
        `SELECT sum(giam_gia_voucher)::text AS discount,sum(thanh_tien)::text AS total FROM public."CT_DON_HANG"`,
      )
    ).rows[0].discount,
    "0.05",
  );
  passed(
    "Cumulative cent allocation exactly matches order discount and stored line totals",
  );
  await reset();
  const stale = commit(await quote(cart(2, "SAVE10")));
  await sql.query(`UPDATE public."VOUCHER" SET gia_tri_giam=50`);
  await fail(stale, "CHECKOUT_CHANGED", { create: true, key: randomUUID() });
  passed(
    "Changed voucher total requires fresh confirmation and rolls back the key",
  );
  await reset();
  const price = commit(await quote());
  await sql.query(
    `UPDATE public."SAN_PHAM" SET gia_ban_hien_tai=1 WHERE sku='SKU-A'`,
  );
  await fail(price, "PRICE_CHANGED", { create: true, key: randomUUID() });
  passed("Changed price fails atomically");
  await reset(1);
  await fail(cart(2), "INSUFFICIENT_STOCK");
  passed("No single warehouse has sufficient availability");
  await reset();
  const held = commit(await quote(cart(9)));
  await rpc(held, { create: true, key: randomUUID() });
  assert.equal((await quote(cart(2))).items[0].warehouse_id, -900001);
  await sql.query(`UPDATE public."DON_HANG" SET trang_thai='HUY'`);
  assert.equal((await quote(cart(2))).items[0].warehouse_id, -900002);
  passed("Pending lines reserve stock; cancellation releases availability");
  await reset();
  await sql.query(`UPDATE public."VOUCHER" SET gioi_han_moi_khach=1`);
  const once = commit(await quote(cart(1, "SAVE10")));
  await rpc(once, { create: true, key: randomUUID() });
  await fail(cart(1, "SAVE10"), "VOUCHER_LIMIT_REACHED");
  assert.ok((await rpc(cart(1, "SAVE10"), { customer: "KH-B" })).quote);
  await sql.query(
    `UPDATE public."SU_DUNG_VOUCHER" SET trang_thai='DA_HUY',thoi_gian_huy=timezone('UTC',now())`,
  );
  assert.ok((await rpc(cart(1, "SAVE10"))).quote);
  passed("Per-customer limits exclude explicit cancelled voucher uses");
  await reset();
  const broken = commit(await quote(cart(1, "SAVE10")));
  await sql.query(
    `CREATE FUNCTION public.checkout_test_fail() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'test insert failure'; END $$;CREATE TRIGGER checkout_test_failure BEFORE INSERT ON public."SU_DUNG_VOUCHER" FOR EACH ROW EXECUTE FUNCTION public.checkout_test_fail();`,
  );
  await assert.rejects(rpc(broken, { create: true, key: randomUUID() }));
  assert.deepEqual(await counts(), { orders: 0, lines: 0, uses: 0, keys: 0 });
  await sql.query(
    `DROP TRIGGER checkout_test_failure ON public."SU_DUNG_VOUCHER";DROP FUNCTION public.checkout_test_fail();`,
  );
  passed("Voucher insert failure rolls back order, lines and idempotency key");
  await reset();
  await sql.query(`UPDATE public."VOUCHER" SET gioi_han_tong_luot=1`);
  const last = commit(await quote(cart(1, "SAVE10")));
  const one = await connection(),
    two = await connection(),
    barrier = await connection();
  await barrier.query("BEGIN");
  await barrier.query(
    `SELECT 1 FROM public."VOUCHER" WHERE ma_voucher=1 FOR UPDATE`,
  );
  const contenders = [
    rpc(last, { create: true, key: randomUUID(), client: one }),
    rpc(last, {
      create: true,
      key: randomUUID(),
      customer: "KH-B",
      client: two,
    }),
  ];
  await new Promise((resolve) => setTimeout(resolve, 100));
  await barrier.query("COMMIT");
  const outcomes = await Promise.all(contenders);
  assert.equal(outcomes.filter((value) => value.order).length, 1);
  assert.equal(
    outcomes.filter((value) => value.error?.code === "VOUCHER_LIMIT_REACHED")
      .length,
    1,
  );
  assert.equal((await counts()).uses, 1);
  passed(
    "Concurrent customers contesting the last voucher use have exactly one winner",
  );
  await reset();
  const same = commit(await quote(cart(1, "SAVE10"))),
    sameKey = randomUUID();
  const duplicates = await Promise.all([
    rpc(same, { create: true, key: sameKey, client: one }),
    rpc(same, { create: true, key: sameKey, client: two }),
  ]);
  assert.deepEqual(duplicates.map((value) => value.replayed).sort(), [
    false,
    true,
  ]);
  assert.deepEqual(await counts(), { orders: 1, lines: 1, uses: 1, keys: 1 });
  passed(
    "Concurrent same key creates exactly one customer order and voucher use",
  );
  await sql.query("SET ROLE anon");
  await assert.rejects(rpc(cart()));
  await assert.rejects(read());
  await sql.query("RESET ROLE");
  await sql.query("SET ROLE authenticated");
  await assert.rejects(rpc(cart()));
  await sql.query("RESET ROLE");
  passed(
    "Anonymous and authenticated DB roles cannot invoke service-only checkout/read RPCs",
  );
  console.log(
    `${checks} checkout PostgreSQL checks passed; isolated cluster only.`,
  );
} finally {
  for (const client of clients.reverse()) {
    await client.end().catch(() => {});
  }
  await database.stop().catch(() => {});
}
