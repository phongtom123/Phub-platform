-- Normalize numeric business identifiers and all their relational references.
-- Filename matches the version recorded in the remote Supabase migration history.
-- Existing records are updated in place. Prices, quantities and statuses are unchanged.
-- Historical seed warehouse identifiers are resolved by warehouse name, not by
-- assigning new warehouse IDs. Snapshot JSON is updated only at items[].warehouse_id.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '45s';
select pg_advisory_xact_lock(hashtextextended('phub.normalize_positive_identifiers.v1', 0));

create temporary table positive_id_roots (
    table_name text primary key,
    column_name text not null
) on commit drop;
insert into positive_id_roots values
    ('CHUONG_TRINH_KHUYEN_MAI', 'ma_ctkm'),
    ('CT_DON_HANG', 'ma_ct_donhang'),
    ('KHO', 'ma_kho'),
    ('NHA_CUNG_CAP', 'ma_ncc'),
    ('PHIEU_CHUYEN_KHO', 'ma_phieu_chuyen'),
    ('PHIEU_NHAP', 'ma_phieu_nhap'),
    ('SU_DUNG_VOUCHER', 'ma_su_dung'),
    ('THANH_TOAN', 'ma_thanh_toan'),
    ('VOUCHER', 'ma_voucher');

create temporary table positive_id_bindings (
    schema_name text not null,
    table_name text not null,
    column_name text not null,
    domain_name text not null,
    primary key (schema_name, table_name, column_name)
) on commit drop;
insert into positive_id_bindings
select 'public', table_name, column_name, table_name from positive_id_roots;
insert into positive_id_bindings
select child_ns.nspname, child.relname, child_col.attname, root.table_name
from pg_constraint fk
join pg_class parent on parent.oid = fk.confrelid
join pg_namespace parent_ns on parent_ns.oid = parent.relnamespace
join positive_id_roots root on root.table_name = parent.relname
join pg_class child on child.oid = fk.conrelid
join pg_namespace child_ns on child_ns.oid = child.relnamespace
cross join lateral unnest(fk.conkey, fk.confkey) keys(child_number, parent_number)
join pg_attribute parent_col on parent_col.attrelid = parent.oid
    and parent_col.attnum = keys.parent_number and parent_col.attname = root.column_name
join pg_attribute child_col on child_col.attrelid = child.oid
    and child_col.attnum = keys.child_number
where fk.contype = 'f' and parent_ns.nspname = 'public'
on conflict do nothing;
insert into positive_id_bindings values
    ('admin_ops', 'stock_events', 'warehouse_id', 'KHO');

-- Lock the complete relationship set before computing mappings or touching rows.
do $$
declare t record;
begin
    for t in
        select distinct schema_name, table_name from positive_id_bindings
        union select 'customer_order_private', 'idempotency'
        order by 1, 2
    loop
        execute format('lock table %I.%I in access exclusive mode', t.schema_name, t.table_name);
    end loop;
end $$;
set constraints all deferred;

create temporary table positive_id_map (
    domain_name text not null,
    old_id bigint not null check (old_id <= 0),
    new_id bigint not null check (new_id > 0),
    primary key (domain_name, old_id),
    unique (domain_name, new_id)
) on commit drop;

do $$
declare r record; ceiling_id bigint; legacy_id bigint; target_id integer;
    target_count integer; target_name text;
begin
    for r in select * from positive_id_roots order by table_name loop
        execute format(
            'select greatest(coalesce(max(%1$I::bigint),0),coalesce(max(abs(%1$I::bigint)),0)) from public.%2$I',
            r.column_name, r.table_name
        ) into ceiling_id;
        execute format(
            'insert into pg_temp.positive_id_map(domain_name,old_id,new_id)
             select $1, old_id,
                case when old_id=0 or exists(
                    select 1 from public.%1$I occupied where occupied.%2$I::bigint=-bad.old_id
                ) then $2+row_number() over(order by old_id) else -old_id end
             from (select %2$I::bigint old_id from public.%1$I where %2$I<=0) bad',
            r.table_name, r.column_name
        ) using r.table_name, ceiling_id;
    end loop;
    if exists(select 1 from positive_id_map where new_id>2147483647) then
        raise exception 'A replacement identifier exceeds the integer range; no data was changed';
    end if;

    -- These historical seed warehouses were renamed to positive IDs previously.
    -- The stored checkout items provide a further authoritative cross-check below.
    for legacy_id in
        select distinct warehouse_id::bigint from admin_ops.stock_events where warehouse_id<0
        union
        select distinct (item->>'warehouse_id')::bigint
        from customer_order_private.idempotency i
        cross join lateral jsonb_array_elements(i.receipt->'items') item
        where item->>'warehouse_id' ~ '^-[0-9]+$'
    loop
        if exists(select 1 from positive_id_map where domain_name='KHO' and old_id=legacy_id) then
            continue;
        end if;
        target_name := case legacy_id
            when -900001 then '[SEED] Kho trung tâm'
            when -900002 then '[SEED] Kho chi nhánh A'
            when -900003 then '[SEED] Kho chi nhánh B'
            else null
        end;
        if target_name is null then
            raise exception 'Unknown historical warehouse identifier %; resolve its warehouse before retrying', legacy_id;
        end if;
        select count(*), min(ma_kho) into target_count,target_id
        from public."KHO" where ten_kho=target_name and ma_kho>0;
        if target_count<>1 then
            raise exception 'Historical warehouse % does not have exactly one matching current warehouse', legacy_id;
        end if;
        insert into positive_id_map values('KHO',legacy_id,target_id);
    end loop;

    if exists(
        select 1 from customer_order_private.idempotency i
        cross join lateral jsonb_array_elements(i.receipt->'items') item
        join positive_id_map m on m.domain_name='KHO' and m.old_id::text=item->>'warehouse_id'
        where not exists(
            select 1 from public."CT_DON_HANG" line
            where line.ma_donhang=i.order_id and line.sku=item->>'sku'
              and line.ma_kho_xuat=m.new_id
        )
    ) then
        raise exception 'Cached warehouse mapping disagrees with the actual order line; no data was changed';
    end if;
end $$;

-- Preserve exact expected rows so the final check can detect any unintended
-- change, including timestamps, monetary values, stock quantities and JSON fields.
create temporary table positive_id_expected (
    schema_name text not null,
    table_name text not null,
    row_data jsonb not null
) on commit drop;
do $$
declare t record;
begin
    for t in
        select distinct schema_name,table_name from positive_id_bindings
        union select 'customer_order_private','idempotency'
    loop
        execute format(
            'insert into pg_temp.positive_id_expected select $1,$2,to_jsonb(t) from %I.%I t',
            t.schema_name,t.table_name
        ) using t.schema_name,t.table_name;
    end loop;
end $$;

-- Bypass only business triggers during this ID-only repair. Foreign-key triggers
-- remain enabled, and their deferred checks are forced before triggers are restored.
create temporary table positive_id_triggers on commit drop as
select n.nspname as schema_name,c.relname as table_name,t.tgname,t.tgenabled
from pg_trigger t
join pg_class c on c.oid=t.tgrelid
join pg_namespace n on n.oid=c.relnamespace
where not t.tgisinternal and t.tgenabled<>'D'
  and exists(select 1 from positive_id_bindings b
             where b.schema_name=n.nspname and b.table_name=c.relname);
do $$
declare t record;
begin
    for t in select * from positive_id_triggers order by schema_name,table_name,tgname loop
        execute format('alter table %I.%I disable trigger %I',t.schema_name,t.table_name,t.tgname);
    end loop;
end $$;

create temporary table positive_id_changes (
    schema_name text,table_name text,column_name text,changed_rows bigint
) on commit drop;
do $$
declare b record; actual_rows bigint; expected_rows bigint;
begin
    for b in select * from positive_id_bindings order by schema_name,table_name,column_name loop
        execute format(
            'update %I.%I t set %I=m.new_id from pg_temp.positive_id_map m
             where m.domain_name=$1 and t.%I=m.old_id',
            b.schema_name,b.table_name,b.column_name,b.column_name
        ) using b.domain_name;
        get diagnostics actual_rows=row_count;
        update positive_id_expected e
        set row_data=jsonb_set(e.row_data,array[b.column_name],to_jsonb(m.new_id))
        from positive_id_map m
        where e.schema_name=b.schema_name and e.table_name=b.table_name
          and m.domain_name=b.domain_name
          and e.row_data->>b.column_name=m.old_id::text;
        get diagnostics expected_rows=row_count;
        if actual_rows<>expected_rows then
            raise exception 'Unexpected affected-row count for %.%.%',b.schema_name,b.table_name,b.column_name;
        end if;
        insert into positive_id_changes values(b.schema_name,b.table_name,b.column_name,actual_rows);
    end loop;
end $$;

update customer_order_private.idempotency i
set receipt=jsonb_set(i.receipt,'{items}',(
    select jsonb_agg(
        case when m.old_id is null then item
             else jsonb_set(item,'{warehouse_id}',to_jsonb(m.new_id)) end order by ordinal
    )
    from jsonb_array_elements(i.receipt->'items') with ordinality items(item,ordinal)
    left join positive_id_map m on m.domain_name='KHO' and m.old_id::text=item->>'warehouse_id'
))
where exists(
    select 1 from jsonb_array_elements(i.receipt->'items') item
    join positive_id_map m on m.domain_name='KHO' and m.old_id::text=item->>'warehouse_id'
);
update positive_id_expected e
set row_data=jsonb_set(e.row_data,'{receipt,items}',(
    select jsonb_agg(
        case when m.old_id is null then item
             else jsonb_set(item,'{warehouse_id}',to_jsonb(m.new_id)) end order by ordinal
    )
    from jsonb_array_elements(e.row_data->'receipt'->'items') with ordinality items(item,ordinal)
    left join positive_id_map m on m.domain_name='KHO' and m.old_id::text=item->>'warehouse_id'
))
where e.schema_name='customer_order_private' and e.table_name='idempotency'
  and exists(
    select 1 from jsonb_array_elements(e.row_data->'receipt'->'items') item
    join positive_id_map m on m.domain_name='KHO' and m.old_id::text=item->>'warehouse_id'
);

set constraints all immediate;
do $$
declare t record; differences bigint; negatives bigint;
begin
    for t in select distinct schema_name,table_name from positive_id_expected loop
        execute format(
            'select count(*) from (
                (select row_data from pg_temp.positive_id_expected where schema_name=$1 and table_name=$2
                 except all select to_jsonb(t) from %1$I.%2$I t)
                union all
                (select to_jsonb(t) from %1$I.%2$I t
                 except all select row_data from pg_temp.positive_id_expected where schema_name=$1 and table_name=$2)
             ) differences',
            t.schema_name,t.table_name
        ) into differences using t.schema_name,t.table_name;
        if differences<>0 then
            raise exception 'Unexpected data change in %.%; rolling back',t.schema_name,t.table_name;
        end if;
    end loop;
    for t in select * from positive_id_bindings loop
        execute format('select count(*) from %I.%I where %I<=0',t.schema_name,t.table_name,t.column_name) into negatives;
        if negatives<>0 then
            raise exception 'Non-positive identifiers remain in %.%.%',t.schema_name,t.table_name,t.column_name;
        end if;
    end loop;
    for t in select * from positive_id_triggers order by schema_name,table_name,tgname loop
        execute format('alter table %I.%I %s trigger %I',t.schema_name,t.table_name,
            case t.tgenabled when 'A' then 'enable always' when 'R' then 'enable replica' else 'enable' end,t.tgname);
    end loop;
end $$;

-- Reject newly inserted negative/zero primary identifiers while leaving all API
-- permissions, RLS policies, column types and existing foreign keys unchanged.
do $$
declare r record; constraint_name text; seq_name text; highest_id bigint;
    seq_last bigint; seq_called boolean; next_id bigint;
begin
    for r in select * from positive_id_roots order by table_name loop
        constraint_name := 'phub_positive_'||r.column_name;
        if not exists(select 1 from pg_constraint
                      where conrelid=format('public.%I',r.table_name)::regclass and conname=constraint_name) then
            execute format('alter table public.%I add constraint %I check (%I>0)',
                           r.table_name,constraint_name,r.column_name);
        end if;
        seq_name := pg_get_serial_sequence(format('public.%I',r.table_name),r.column_name);
        if seq_name is not null then
            execute format('select coalesce(max(%I::bigint),0) from public.%I',r.column_name,r.table_name) into highest_id;
            execute format('select last_value,is_called from %s',seq_name) into seq_last,seq_called;
            next_id := greatest(highest_id+1,seq_last+case when seq_called then 1 else 0 end,1);
            -- RESTART is transactional, unlike setval(), so a failed repair or
            -- rollback-only rehearsal leaves the sequence state unchanged.
            execute format('alter sequence %s increment by 1 minvalue 1 no cycle restart with %s',seq_name,next_id);
        end if;
    end loop;
    if not exists(select 1 from pg_constraint where conrelid='admin_ops.stock_events'::regclass
                  and conname='phub_positive_warehouse_id') then
        alter table admin_ops.stock_events add constraint phub_positive_warehouse_id check(warehouse_id>0);
    end if;
    if not exists(select 1 from pg_constraint where conrelid='admin_ops.stock_events'::regclass
                  and conname='phub_positive_event_id') then
        alter table admin_ops.stock_events add constraint phub_positive_event_id check(id>0);
    end if;
end $$;
commit;
