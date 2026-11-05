/** Isolated PostgreSQL verification of the service-only Admin order timeline. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { PGlite } = require(process.env.PHUB_PGLITE_MODULE || "@electric-sql/pglite");

const root = path.resolve(__dirname, "../..");
const read = relative => fs.readFileSync(path.join(root, relative), "utf8");

async function main() {
  const db = await PGlite.create();
  try {
    await db.exec("create role anon; create role authenticated; create role service_role bypassrls; grant usage on schema public to service_role;");
    await db.exec(read("Backend/migrations/001_initial_schema.sql"));
    await db.exec(`
      insert into public."NHAN_VIEN" (ma_nhan_vien, loai_nhan_vien, ho_ten, trang_thai)
      values ('NV1', 'ADMIN', 'Admin Timeline', 1), ('NV2', 'ADMIN', 'Admin Inactive', 1);
      insert into public."TAI_KHOAN" (ma_tk, ten_tai_khoan, mat_khau_hash, ma_nhan_vien, trang_thai)
      values ('AD1', 'admin.timeline', '!test-only', 'NV1', 1),
             ('AD2', 'admin.inactive', '!test-only', 'NV2', 2);

      create schema admin_ops;
      revoke all on schema admin_ops from public, anon, authenticated;
      grant usage on schema admin_ops to service_role;
      create table admin_ops.requests (
        actor text not null,
        key uuid not null,
        hash text not null,
        result jsonb,
        resource text not null,
        action text not null,
        record_id text,
        created_at timestamptz not null default now(),
        primary key (actor, key)
      );
      alter table admin_ops.requests enable row level security;
      revoke all on admin_ops.requests from public, anon, authenticated;
      grant select, insert, update on admin_ops.requests to service_role;
      grant select on public."TAI_KHOAN", public."NHAN_VIEN" to service_role;

      create function admin_ops.actor(p_actor text) returns text
      language plpgsql security invoker set search_path='' set timezone='UTC' as $$
      declare employee text;
      begin
        select n.ma_nhan_vien into employee
        from public."TAI_KHOAN" a join public."NHAN_VIEN" n using(ma_nhan_vien)
        where a.ma_tk=p_actor and a.trang_thai=1 and n.trang_thai=1 and n.loai_nhan_vien='ADMIN'
        for share of a,n;
        if employee is null then raise exception 'ADMIN_FORBIDDEN'; end if;
        return employee;
      end $$;
      grant execute on function admin_ops.actor(text) to service_role;
    `);
    await db.exec(read("Backend/migrations/20261104100000_admin_order_history.sql"));

    await db.exec(`
      insert into admin_ops.requests(actor,key,hash,result,resource,action,record_id,created_at) values
      ('AD1','11111111-1111-4111-8111-111111111111','SECRET-HASH',
       '{"data":[{"ma_donhang":"ORDER-1","trang_thai":"XAC_NHAN","secret":"PRIVATE"}],"replayed":false}',
       'orders','confirm','ORDER-1','2026-11-04T01:00:00Z'),
      ('AD1','22222222-2222-4222-8222-222222222222','PENDING-HASH',null,
       'orders','prepare','ORDER-1','2026-11-04T02:00:00Z'),
      ('AD1','33333333-3333-4333-8333-333333333333','OTHER-ORDER-HASH',
       '{"data":[{"ma_donhang":"ORDER-2","trang_thai":"HUY"}],"replayed":false}',
       'orders','cancel','ORDER-2','2026-11-04T03:00:00Z'),
      ('AD1','44444444-4444-4444-8444-444444444444','OTHER-RESOURCE-HASH',
       '{"data":[{"trang_thai":"XAC_NHAN"}],"replayed":false}',
       'receipts','confirm','ORDER-1','2026-11-04T04:00:00Z');

      -- A replay uses the same actor/key and cannot create a second event.
      insert into admin_ops.requests(actor,key,hash,result,resource,action,record_id)
      values ('AD1','11111111-1111-4111-8111-111111111111','SECRET-HASH',
              '{"data":[{"trang_thai":"XAC_NHAN"}],"replayed":true}',
              'orders','confirm','ORDER-1')
      on conflict(actor,key) do nothing;
    `);

    await db.exec("set role service_role");
    const history = (await db.query(
      "select public.admin_order_history_v1($1,$2) result", ["AD1", "ORDER-1"],
    )).rows[0].result;
    assert.equal(history.length, 1, "only one completed, matching order command is returned");
    assert.deepEqual(Object.keys(history[0]).sort(), [
      "action", "actor_id", "actor_name", "key", "occurred_at", "to_status",
    ]);
    assert.equal(history[0].key, "11111111-1111-4111-8111-111111111111");
    assert.equal(history[0].actor_id, "AD1");
    assert.equal(history[0].actor_name, "Admin Timeline");
    assert.equal(history[0].action, "confirm");
    assert.equal(history[0].to_status, "XAC_NHAN");
    const serialized = JSON.stringify(history);
    for (const privateValue of ["SECRET-HASH", "PRIVATE", "replayed", "ma_donhang", "result", "hash"])
      assert.ok(!serialized.includes(privateValue), `projection must not expose ${privateValue}`);

    await db.exec("reset role; set role anon");
    await assert.rejects(
      db.query("select public.admin_order_history_v1('AD1','ORDER-1')"),
      error => error.code === "42501",
    );
    await db.exec("reset role; set role authenticated");
    await assert.rejects(
      db.query("select public.admin_order_history_v1('AD1','ORDER-1')"),
      error => error.code === "42501",
    );

    await db.exec("reset role; set role service_role");
    await assert.rejects(
      db.query("select public.admin_order_history_v1('AD2','ORDER-1')"),
      error => error.message.includes("ADMIN_FORBIDDEN"),
    );

    console.log("PASS: order history scope, completed/idempotent events, safe projection, role grants and active-Admin recheck in isolated PGlite PostgreSQL.");
  } finally {
    await db.close();
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
