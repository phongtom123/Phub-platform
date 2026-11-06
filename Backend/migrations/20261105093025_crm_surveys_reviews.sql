-- CRM surveys, age-based audience and verified-purchase product reviews.
-- Additive upgrade. Does not create demo customers or send a real survey.
begin;
set local lock_timeout='5s';
set local statement_timeout='60s';

create table public."KHAO_SAT" (
  ma_khao_sat uuid primary key,
  tieu_de varchar(200) not null check(length(btrim(tieu_de))>0),
  mo_ta text not null default '' check(length(mo_ta)<=5000),
  trang_thai varchar not null default 'NHAP' check(trang_thai in ('NHAP','DANG_MO','DONG')),
  loai_doi_tuong varchar not null check(loai_doi_tuong in ('TAT_CA','DO_TUOI','CHUA_NGAY_SINH')),
  tuoi_tu int, tuoi_den int,
  han_tra_loi timestamptz not null,
  ngay_chot_doi_tuong timestamptz,
  nguoi_tao varchar not null references public."TAI_KHOAN"(ma_tk),
  ngay_tao timestamptz not null default statement_timestamp(),
  cap_nhat_luc timestamptz not null default statement_timestamp(),
  phien_ban uuid not null default gen_random_uuid(),
  hash_tao text not null,
  phat_hanh_tu_phien_ban uuid, dong_tu_phien_ban uuid,
  check((loai_doi_tuong='DO_TUOI' and tuoi_tu is not null and tuoi_den is not null and tuoi_tu between 0 and 130 and tuoi_den between tuoi_tu and 130)
    or (loai_doi_tuong<>'DO_TUOI' and tuoi_tu is null and tuoi_den is null))
);
create index on public."KHAO_SAT"(ngay_tao desc,ma_khao_sat);
create index on public."KHAO_SAT"(nguoi_tao);

create table public."CAU_HOI_KHAO_SAT" (
  ma_cau_hoi uuid primary key default gen_random_uuid(),
  ma_khao_sat uuid not null references public."KHAO_SAT"(ma_khao_sat),
  noi_dung varchar(1000) not null check(length(btrim(noi_dung))>0),
  loai_cau_hoi varchar not null check(loai_cau_hoi in ('MOT_LUA_CHON','DIEM_1_5','VAN_BAN')),
  nhom_noi_dung varchar not null default 'CHUNG' check(nhom_noi_dung in ('CHUNG','SO_THICH','HAI_LONG')),
  bat_buoc boolean not null default true,
  thu_tu int not null check(thu_tu between 1 and 30),
  unique(ma_cau_hoi,ma_khao_sat), unique(ma_khao_sat,thu_tu)
);
create table public."LUA_CHON_KHAO_SAT" (
  ma_lua_chon uuid primary key default gen_random_uuid(),
  ma_cau_hoi uuid not null references public."CAU_HOI_KHAO_SAT"(ma_cau_hoi) on delete cascade,
  noi_dung varchar(500) not null check(length(btrim(noi_dung))>0),
  cho_phep_nhap_khac boolean not null default false,
  thu_tu int not null check(thu_tu between 1 and 20),
  unique(ma_lua_chon,ma_cau_hoi), unique(ma_cau_hoi,thu_tu)
);
create unique index one_other_option_per_question on public."LUA_CHON_KHAO_SAT"(ma_cau_hoi) where cho_phep_nhap_khac;

create table public."GUI_KHAO_SAT" (
  ma_gui uuid primary key default gen_random_uuid(),
  ma_khao_sat uuid not null references public."KHAO_SAT"(ma_khao_sat),
  ma_kh varchar not null references public."KHACH_HANG"(ma_kh),
  ngay_gui timestamptz not null default statement_timestamp(),
  hoan_thanh_luc timestamptz,
  khoa_gui_bai uuid, hash_gui_bai text,
  unique(ma_khao_sat,ma_kh), unique(ma_gui,ma_khao_sat),
  check((hoan_thanh_luc is null and khoa_gui_bai is null and hash_gui_bai is null)
    or (hoan_thanh_luc is not null and khoa_gui_bai is not null and hash_gui_bai is not null))
);
create index on public."GUI_KHAO_SAT"(ma_kh,ngay_gui desc);
create table public."TRA_LOI_KHAO_SAT" (
  ma_tra_loi uuid primary key default gen_random_uuid(),
  ma_gui uuid not null,
  ma_khao_sat uuid not null,
  ma_cau_hoi uuid not null,
  ma_lua_chon uuid,
  diem int check(diem between 1 and 5),
  noi_dung text check(length(noi_dung)<=4000),
  foreign key(ma_gui,ma_khao_sat) references public."GUI_KHAO_SAT"(ma_gui,ma_khao_sat),
  foreign key(ma_cau_hoi,ma_khao_sat) references public."CAU_HOI_KHAO_SAT"(ma_cau_hoi,ma_khao_sat),
  foreign key(ma_lua_chon,ma_cau_hoi) references public."LUA_CHON_KHAO_SAT"(ma_lua_chon,ma_cau_hoi),
  unique(ma_gui,ma_cau_hoi)
);
create index on public."TRA_LOI_KHAO_SAT"(ma_cau_hoi,ma_khao_sat);
create index on public."TRA_LOI_KHAO_SAT"(ma_lua_chon,ma_cau_hoi);
create index on public."TRA_LOI_KHAO_SAT"(ma_khao_sat);

create table public."DANH_GIA_SAN_PHAM" (
  ma_danh_gia uuid primary key default gen_random_uuid(),
  ma_kh varchar not null references public."KHACH_HANG"(ma_kh),
  ma_sp varchar not null references public."SAN_PHAM"(ma_sp),
  ma_donhang varchar not null references public."DON_HANG"(ma_donhang),
  so_sao int not null check(so_sao between 1 and 5),
  noi_dung text not null check(length(btrim(noi_dung)) between 1 and 4000),
  trang_thai varchar not null default 'CHO_DUYET' check(trang_thai in ('CHO_DUYET','HIEN_THI','AN')),
  ngay_tao timestamptz not null default statement_timestamp(),
  cap_nhat_luc timestamptz not null default statement_timestamp(),
  phien_ban uuid not null default gen_random_uuid(),
  nguoi_duyet varchar references public."TAI_KHOAN"(ma_tk),
  ngay_duyet timestamptz, duyet_tu_phien_ban uuid,
  unique(ma_kh,ma_donhang,ma_sp)
);
create index on public."DANH_GIA_SAN_PHAM"(ma_sp,trang_thai,ngay_tao desc);
create index on public."DANH_GIA_SAN_PHAM"(trang_thai,ngay_tao desc);
create index on public."DANH_GIA_SAN_PHAM"(ma_donhang);
create index on public."DANH_GIA_SAN_PHAM"(nguoi_duyet);

-- PHUB uses its own session/roles at the Python boundary. New relations are
-- accessible only to the backend service_role, never directly by browser keys.
do $permissions$
declare tab text;
begin
  foreach tab in array array['KHAO_SAT','CAU_HOI_KHAO_SAT','LUA_CHON_KHAO_SAT','GUI_KHAO_SAT','TRA_LOI_KHAO_SAT','DANH_GIA_SAN_PHAM'] loop
    execute format('alter table public.%I enable row level security',tab);
    execute format('revoke all on public.%I from public, anon, authenticated',tab);
    execute format('grant select,insert,update,delete on public.%I to service_role',tab);
  end loop;
end;
$permissions$;

create function public.crm_actor_v1(p_actor text,p_admin boolean) returns text
language plpgsql security invoker set search_path=pg_catalog as $f$
declare a public."TAI_KHOAN"%rowtype; k public."KHACH_HANG"%rowtype;
begin
  select * into a from public."TAI_KHOAN" where ma_tk=p_actor and trang_thai=1 for share;
  if not found then raise exception 'Phiên đăng nhập không còn hoạt động.' using errcode='42501'; end if;
  if p_admin then
    perform 1 from public."NHAN_VIEN" where ma_nhan_vien=a.ma_nhan_vien and trang_thai=1 and loai_nhan_vien='ADMIN' for share;
    if not found then raise exception 'Chỉ quản trị viên được thực hiện.' using errcode='42501'; end if;
    return null;
  end if;
  select * into k from public."KHACH_HANG" where ma_kh=a.ma_kh and luu_tru_luc is null for share;
  if not found or a.ma_nhan_vien is not null then raise exception 'Hồ sơ khách hàng không hoạt động.' using errcode='42501'; end if;
  return k.ma_kh;
end; $f$;

create function public.crm_survey_submit_v1(p_actor text,p_id uuid,p_key uuid,p_answers jsonb)
returns jsonb language plpgsql security invoker set search_path=pg_catalog as $f$
declare k text; s public."KHAO_SAT"%rowtype; g public."GUI_KHAO_SAT"%rowtype;
  q public."CAU_HOI_KHAO_SAT"%rowtype; o public."LUA_CHON_KHAO_SAT"%rowtype; a jsonb;
  option_id uuid; score int; content text; canonical jsonb; digest text;
begin
  k:=public.crm_actor_v1(p_actor,false);
  select * into s from public."KHAO_SAT" where ma_khao_sat=p_id for share;
  if not found then raise exception 'Không tìm thấy khảo sát.' using errcode='P0002'; end if;
  select * into g from public."GUI_KHAO_SAT" where ma_khao_sat=p_id and ma_kh=k for update;
  if not found then raise exception 'Khảo sát không được gửi cho bạn.' using errcode='P0002'; end if;
  if p_key is null or jsonb_typeof(p_answers) is distinct from 'array' or jsonb_array_length(p_answers)>30 then
    raise exception 'Bài trả lời không hợp lệ.' using errcode='23514'; end if;
  select coalesce(jsonb_agg(value order by value->>'ma_cau_hoi'),'[]'::jsonb) into canonical from jsonb_array_elements(p_answers);
  digest:=md5(canonical::text);
  if g.hoan_thanh_luc is not null then
    if g.khoa_gui_bai=p_key and g.hash_gui_bai=digest then return public.crm_survey_detail_v1(p_id,p_actor,false); end if;
    raise exception 'Bạn đã hoàn thành khảo sát này.' using errcode='40001';
  end if;
  if s.trang_thai<>'DANG_MO' or s.han_tra_loi<=statement_timestamp() then
    raise exception 'Khảo sát đã đóng hoặc hết hạn.' using errcode='23514'; end if;
  if (select count(*) from jsonb_array_elements(p_answers))<>(select count(distinct value->>'ma_cau_hoi') from jsonb_array_elements(p_answers)) then
    raise exception 'Một câu hỏi chỉ có một câu trả lời.' using errcode='23514'; end if;
  for a in select value from jsonb_array_elements(p_answers) loop
    select * into q from public."CAU_HOI_KHAO_SAT" where ma_cau_hoi=(a->>'ma_cau_hoi')::uuid and ma_khao_sat=p_id;
    if not found then raise exception 'Câu hỏi không thuộc khảo sát này.' using errcode='23514'; end if;
    option_id:=(a->>'ma_lua_chon')::uuid; score:=(a->>'diem')::int; content:=nullif(btrim(a->>'noi_dung'),'');
    if q.loai_cau_hoi='MOT_LUA_CHON' then
      select * into o from public."LUA_CHON_KHAO_SAT" where ma_lua_chon=option_id and ma_cau_hoi=q.ma_cau_hoi;
      if not found or score is not null then raise exception 'Chọn đáp án hợp lệ của câu hỏi.' using errcode='23514'; end if;
      if o.cho_phep_nhap_khac and content is null then raise exception 'Vui lòng nhập nội dung cho lựa chọn Khác.' using errcode='23514'; end if;
      if not o.cho_phep_nhap_khac and content is not null then raise exception 'Lựa chọn này không nhận văn bản bổ sung.' using errcode='23514'; end if;
    elsif q.loai_cau_hoi='DIEM_1_5' then
      if score is null or score not between 1 and 5 or option_id is not null or content is not null then raise exception 'Điểm đánh giá phải từ 1 đến 5.' using errcode='23514'; end if;
    else
      if content is null or score is not null or option_id is not null then raise exception 'Vui lòng nhập câu trả lời văn bản.' using errcode='23514'; end if;
    end if;
    insert into public."TRA_LOI_KHAO_SAT"(ma_gui,ma_khao_sat,ma_cau_hoi,ma_lua_chon,diem,noi_dung)
      values(g.ma_gui,p_id,q.ma_cau_hoi,option_id,score,content);
  end loop;
  if exists(select 1 from public."CAU_HOI_KHAO_SAT" required_q where required_q.ma_khao_sat=p_id and required_q.bat_buoc
      and not exists(select 1 from public."TRA_LOI_KHAO_SAT" answer_row where answer_row.ma_gui=g.ma_gui and answer_row.ma_cau_hoi=required_q.ma_cau_hoi)) then
    raise exception 'Vui lòng trả lời đủ các câu bắt buộc.' using errcode='23514'; end if;
  update public."GUI_KHAO_SAT" set hoan_thanh_luc=statement_timestamp(),khoa_gui_bai=p_key,hash_gui_bai=digest where ma_gui=g.ma_gui;
  return public.crm_survey_detail_v1(p_id,p_actor,false);
end; $f$;

create function public.crm_age_v1(p_birth date,p_day date) returns int
language sql immutable security invoker set search_path=pg_catalog as $f$
 select case when p_birth is null or p_birth>p_day then null else extract(year from age(p_day,p_birth))::int end
$f$;

create function public.crm_survey_detail_v1(p_id uuid,p_actor text,p_admin boolean) returns jsonb
language plpgsql security invoker set search_path=pg_catalog as $f$
declare s public."KHAO_SAT"%rowtype; k text; g public."GUI_KHAO_SAT"%rowtype;
begin
  k:=public.crm_actor_v1(p_actor,p_admin);
  select * into s from public."KHAO_SAT" where ma_khao_sat=p_id;
  if not found then raise exception 'Không tìm thấy khảo sát.' using errcode='P0002'; end if;
  if not p_admin then
    select * into g from public."GUI_KHAO_SAT" where ma_khao_sat=p_id and ma_kh=k;
    if not found or s.trang_thai='NHAP' then raise exception 'Không tìm thấy khảo sát được gửi cho bạn.' using errcode='P0002'; end if;
  end if;
  return jsonb_build_object('survey',to_jsonb(s)-'hash_tao'-'phat_hanh_tu_phien_ban'-'dong_tu_phien_ban',
    'questions',coalesce((select jsonb_agg(to_jsonb(q)||jsonb_build_object('options',coalesce((select jsonb_agg(to_jsonb(o) order by o.thu_tu)
      from public."LUA_CHON_KHAO_SAT" o where o.ma_cau_hoi=q.ma_cau_hoi),'[]'::jsonb)) order by q.thu_tu)
      from public."CAU_HOI_KHAO_SAT" q where q.ma_khao_sat=p_id),'[]'::jsonb),
    'recipient',case when p_admin then null else to_jsonb(g)-'hash_gui_bai'-'khoa_gui_bai' end,
    'answers',case when p_admin then '[]'::jsonb else coalesce((select jsonb_agg(jsonb_build_object('ma_cau_hoi',a.ma_cau_hoi,'ma_lua_chon',a.ma_lua_chon,'diem',a.diem,'noi_dung',a.noi_dung))
      from public."TRA_LOI_KHAO_SAT" a where a.ma_gui=g.ma_gui),'[]'::jsonb) end);
end; $f$;

create function public.crm_survey_write_v1(p_actor text,p_id uuid,p_action text,p_payload jsonb,p_version uuid default null)
returns jsonb language plpgsql security invoker set search_path=pg_catalog as $f$
declare s public."KHAO_SAT"%rowtype; q jsonb; o jsonb; qid uuid; pos int:=0; op int; n int; born date;
begin
  perform public.crm_actor_v1(p_actor,true);
  if p_action='create' then
    insert into public."KHAO_SAT"(ma_khao_sat,tieu_de,mo_ta,loai_doi_tuong,tuoi_tu,tuoi_den,han_tra_loi,nguoi_tao,hash_tao)
      values(p_id,btrim(p_payload->>'tieu_de'),coalesce(p_payload->>'mo_ta',''),p_payload->>'loai_doi_tuong',
        (p_payload->>'tuoi_tu')::int,(p_payload->>'tuoi_den')::int,(p_payload->>'han_tra_loi')::timestamptz,p_actor,md5(p_payload::text))
      on conflict(ma_khao_sat) do nothing returning * into s;
    if not found then
      select * into s from public."KHAO_SAT" where ma_khao_sat=p_id for update;
      if s.nguoi_tao<>p_actor or s.hash_tao<>md5(p_payload::text) then raise exception 'Mã yêu cầu đã dùng cho nội dung khác.' using errcode='40001'; end if;
      return public.crm_survey_detail_v1(p_id,p_actor,true);
    end if;
  else
    select * into s from public."KHAO_SAT" where ma_khao_sat=p_id for update;
    if not found then raise exception 'Không tìm thấy khảo sát.' using errcode='P0002'; end if;
    if (p_action='publish' and s.phat_hanh_tu_phien_ban=p_version) or (p_action='close' and s.dong_tu_phien_ban=p_version) then
      return public.crm_survey_detail_v1(p_id,p_actor,true);
    end if;
    if p_version is null or s.phien_ban<>p_version then raise exception 'Khảo sát đã thay đổi. Tải lại trước khi thao tác.' using errcode='40001'; end if;
    if p_action='close' then
      if s.trang_thai<>'DANG_MO' then raise exception 'Chỉ đóng khảo sát đã phát hành.' using errcode='23514'; end if;
      update public."KHAO_SAT" set trang_thai='DONG',cap_nhat_luc=statement_timestamp(),phien_ban=gen_random_uuid(),dong_tu_phien_ban=p_version where ma_khao_sat=p_id;
      return public.crm_survey_detail_v1(p_id,p_actor,true);
    end if;
    if s.trang_thai<>'NHAP' then raise exception 'Khảo sát đã phát hành không được sửa cấu trúc hoặc đối tượng.' using errcode='23514'; end if;
    if p_action='publish' then
      if s.han_tra_loi<=statement_timestamp() then raise exception 'Thời hạn khảo sát phải ở tương lai.' using errcode='23514'; end if;
      perform 1 from public."CAU_HOI_KHAO_SAT" where ma_khao_sat=p_id;
      if not found then raise exception 'Khảo sát cần ít nhất một câu hỏi.' using errcode='23514'; end if;
      born:=(statement_timestamp() at time zone 'Asia/Ho_Chi_Minh')::date;
      insert into public."GUI_KHAO_SAT"(ma_khao_sat,ma_kh)
        select p_id,k.ma_kh from public."KHACH_HANG" k join public."TAI_KHOAN" a on a.ma_kh=k.ma_kh
        where k.luu_tru_luc is null and a.trang_thai=1 and a.ma_nhan_vien is null
          and (s.loai_doi_tuong='TAT_CA' or s.loai_doi_tuong='CHUA_NGAY_SINH' and k.ngay_sinh is null
            or s.loai_doi_tuong='DO_TUOI' and public.crm_age_v1(k.ngay_sinh,born) between s.tuoi_tu and s.tuoi_den)
        for share of k,a
        on conflict(ma_khao_sat,ma_kh) do nothing;
      get diagnostics n=row_count;
      if n=0 then raise exception 'Chưa có khách hàng phù hợp để gửi khảo sát.' using errcode='23514'; end if;
      update public."KHAO_SAT" set trang_thai='DANG_MO',ngay_chot_doi_tuong=statement_timestamp(),cap_nhat_luc=statement_timestamp(),phien_ban=gen_random_uuid(),phat_hanh_tu_phien_ban=p_version where ma_khao_sat=p_id;
      return public.crm_survey_detail_v1(p_id,p_actor,true);
    elsif p_action<>'update' then raise exception 'Thao tác khảo sát không hợp lệ.' using errcode='23514'; end if;
    update public."KHAO_SAT" set tieu_de=btrim(p_payload->>'tieu_de'),mo_ta=coalesce(p_payload->>'mo_ta',''),
      loai_doi_tuong=p_payload->>'loai_doi_tuong',tuoi_tu=(p_payload->>'tuoi_tu')::int,tuoi_den=(p_payload->>'tuoi_den')::int,
      han_tra_loi=(p_payload->>'han_tra_loi')::timestamptz,phien_ban=gen_random_uuid(),cap_nhat_luc=statement_timestamp() where ma_khao_sat=p_id;
    delete from public."CAU_HOI_KHAO_SAT" where ma_khao_sat=p_id;
  end if;
  if jsonb_typeof(p_payload->'questions') is distinct from 'array' or jsonb_array_length(p_payload->'questions') not between 1 and 30 then
    raise exception 'Khảo sát cần 1–30 câu hỏi.' using errcode='23514'; end if;
  for q in select value from jsonb_array_elements(p_payload->'questions') loop
    pos:=pos+1;
    insert into public."CAU_HOI_KHAO_SAT"(ma_khao_sat,noi_dung,loai_cau_hoi,nhom_noi_dung,bat_buoc,thu_tu)
      values(p_id,btrim(q->>'noi_dung'),q->>'loai_cau_hoi',coalesce(q->>'nhom_noi_dung','CHUNG'),(q->>'bat_buoc')::boolean,pos) returning ma_cau_hoi into qid;
    if jsonb_typeof(q->'options') is distinct from 'array' then raise exception 'Danh sách lựa chọn không hợp lệ.' using errcode='23514'; end if;
    n:=jsonb_array_length(q->'options');
    if (q->>'loai_cau_hoi'='MOT_LUA_CHON' and n not between 2 and 20) or (q->>'loai_cau_hoi'<>'MOT_LUA_CHON' and n<>0) then
      raise exception 'Câu chọn một đáp án cần 2–20 lựa chọn; câu điểm/văn bản không có lựa chọn.' using errcode='23514'; end if;
    op:=0;
    for o in select value from jsonb_array_elements(q->'options') loop
      op:=op+1;
      insert into public."LUA_CHON_KHAO_SAT"(ma_cau_hoi,noi_dung,cho_phep_nhap_khac,thu_tu)
        values(qid,btrim(o->>'noi_dung'),coalesce((o->>'cho_phep_nhap_khac')::boolean,false),op);
    end loop;
  end loop;
  return public.crm_survey_detail_v1(p_id,p_actor,true);
end; $f$;

create function public.crm_survey_read_v1(p_actor text,p_admin boolean,p_kind text,p_id uuid default null,p_page int default 1)
returns jsonb language plpgsql security invoker set search_path=pg_catalog as $f$
declare k text; s public."KHAO_SAT"%rowtype; result jsonb; today date:=(statement_timestamp() at time zone 'Asia/Ho_Chi_Minh')::date;
begin
  k:=public.crm_actor_v1(p_actor,p_admin);
  if p_page not between 1 and 10000 then raise exception 'Trang không hợp lệ.' using errcode='23514'; end if;
  if p_kind='detail' then return public.crm_survey_detail_v1(p_id,p_actor,p_admin); end if;
  if p_kind='list' then
    with selected as (select sv.*,recipient_row.hoan_thanh_luc from public."KHAO_SAT" sv left join public."GUI_KHAO_SAT" recipient_row on recipient_row.ma_khao_sat=sv.ma_khao_sat and recipient_row.ma_kh=k
      where p_admin or (recipient_row.ma_gui is not null and sv.trang_thai<>'NHAP')),
    items as (select ma_khao_sat,tieu_de,mo_ta,trang_thai,loai_doi_tuong,tuoi_tu,tuoi_den,han_tra_loi,phien_ban,ngay_tao,hoan_thanh_luc,
      (select count(*) from public."GUI_KHAO_SAT" g where g.ma_khao_sat=selected.ma_khao_sat) as da_gui,
      (select count(*) from public."GUI_KHAO_SAT" g where g.ma_khao_sat=selected.ma_khao_sat and g.hoan_thanh_luc is not null) as da_tra_loi
      from selected order by ngay_tao desc,ma_khao_sat offset (p_page-1)*20 limit 20)
    select jsonb_build_object('data',coalesce((select jsonb_agg(to_jsonb(items)) from items),'[]'::jsonb),'total',(select count(*) from selected),'page',p_page,'page_size',20) into result;
    return result;
  end if;
  if not p_admin then raise exception 'Chỉ quản trị viên được xem báo cáo.' using errcode='42501'; end if;
  if p_kind='report' then
    with ages as (select public.crm_age_v1(ngay_sinh,today) as age from public."KHACH_HANG" where luu_tru_luc is null),
    groups as (select case when age is null then 'Chưa có thông tin' when age<18 then 'Dưới 18' when age<=24 then '18–24' when age<=34 then '25–34' when age<=44 then '35–44' else '45 trở lên' end as label,
      case when age is null then 6 when age<18 then 1 when age<=24 then 2 when age<=34 then 3 when age<=44 then 4 else 5 end as position from ages),
    grouped as (select label,position,count(*) as count from groups group by label,position),
    ratings as (select points as stars,(select count(*) from public."DANH_GIA_SAN_PHAM" where trang_thai='HIEN_THI' and so_sao=points) as count from generate_series(1,5) points),
    interests as (select sv.ma_khao_sat,sv.tieu_de from public."KHAO_SAT" sv where sv.trang_thai<>'NHAP' and exists(select 1 from public."CAU_HOI_KHAO_SAT" q where q.ma_khao_sat=sv.ma_khao_sat and q.nhom_noi_dung='SO_THICH') order by sv.ngay_tao desc limit 20)
    select jsonb_build_object('as_of',today,'total_customers',(select count(*) from ages),'age_groups',coalesce((select jsonb_agg(to_jsonb(grouped)-'position' order by position) from grouped),'[]'::jsonb),
      'review_stars',(select jsonb_agg(to_jsonb(ratings) order by stars) from ratings),
      'review_status',(select jsonb_build_object('pending',count(*) filter(where trang_thai='CHO_DUYET'),'visible',count(*) filter(where trang_thai='HIEN_THI'),'hidden',count(*) filter(where trang_thai='AN')) from public."DANH_GIA_SAN_PHAM"),
      'interest_surveys',coalesce((select jsonb_agg(to_jsonb(interests)) from interests),'[]'::jsonb)) into result;
    return result;
  end if;
  select * into s from public."KHAO_SAT" where ma_khao_sat=p_id;
  if not found then raise exception 'Không tìm thấy khảo sát.' using errcode='P0002'; end if;
  if p_kind='preview' then
    with eligible as (select c.ma_kh,c.ten_kh,public.crm_age_v1(c.ngay_sinh,today) as tuoi
      from public."KHACH_HANG" c left join public."TAI_KHOAN" a on a.ma_kh=c.ma_kh
      where (s.trang_thai='NHAP' and c.luu_tru_luc is null and a.trang_thai=1 and a.ma_nhan_vien is null
        and (s.loai_doi_tuong='TAT_CA' or s.loai_doi_tuong='CHUA_NGAY_SINH' and c.ngay_sinh is null or s.loai_doi_tuong='DO_TUOI' and public.crm_age_v1(c.ngay_sinh,today) between s.tuoi_tu and s.tuoi_den))
        or (s.trang_thai<>'NHAP' and exists(select 1 from public."GUI_KHAO_SAT" g where g.ma_khao_sat=p_id and g.ma_kh=c.ma_kh))),
    items as (select * from eligible order by ma_kh offset (p_page-1)*20 limit 20)
    select jsonb_build_object('data',coalesce((select jsonb_agg(to_jsonb(items)) from items),'[]'::jsonb),'total',(select count(*) from eligible),'page',p_page,'page_size',20,'phien_ban',s.phien_ban,'is_snapshot',s.trang_thai<>'NHAP') into result;
    return result;
  end if;
  if p_kind='statistics' then
    select jsonb_build_object('survey',to_jsonb(s)-'hash_tao'-'phat_hanh_tu_phien_ban'-'dong_tu_phien_ban',
      'sent',(select count(*) from public."GUI_KHAO_SAT" where ma_khao_sat=p_id),
      'completed',(select count(*) from public."GUI_KHAO_SAT" where ma_khao_sat=p_id and hoan_thanh_luc is not null),
      'questions',coalesce((select jsonb_agg(to_jsonb(q)||jsonb_build_object(
        'answered',(select count(*) from public."TRA_LOI_KHAO_SAT" a where a.ma_cau_hoi=q.ma_cau_hoi),
        'average',(select round(avg(diem),2) from public."TRA_LOI_KHAO_SAT" a where a.ma_cau_hoi=q.ma_cau_hoi),
        'options',coalesce((select jsonb_agg(jsonb_build_object('ma_lua_chon',o.ma_lua_chon,'noi_dung',o.noi_dung,'count',(select count(*) from public."TRA_LOI_KHAO_SAT" a where a.ma_lua_chon=o.ma_lua_chon)) order by o.thu_tu) from public."LUA_CHON_KHAO_SAT" o where o.ma_cau_hoi=q.ma_cau_hoi),'[]'::jsonb),
        'scores',case when q.loai_cau_hoi='DIEM_1_5' then (select jsonb_agg(jsonb_build_object('score',points,'count',(select count(*) from public."TRA_LOI_KHAO_SAT" a where a.ma_cau_hoi=q.ma_cau_hoi and a.diem=points))) from generate_series(1,5) points) else '[]'::jsonb end,
        'texts',coalesce((select jsonb_agg(x.noi_dung) from (select a.noi_dung from public."TRA_LOI_KHAO_SAT" a join public."GUI_KHAO_SAT" g on g.ma_gui=a.ma_gui
          where a.ma_cau_hoi=q.ma_cau_hoi and a.noi_dung is not null order by g.hoan_thanh_luc desc offset (p_page-1)*20 limit 20) x),'[]'::jsonb),
        'text_total',(select count(*) from public."TRA_LOI_KHAO_SAT" a where a.ma_cau_hoi=q.ma_cau_hoi and a.noi_dung is not null)) order by q.thu_tu)
        from public."CAU_HOI_KHAO_SAT" q where q.ma_khao_sat=p_id),'[]'::jsonb),'text_page',p_page,'page_size',20) into result;
    return result;
  end if;
  raise exception 'Thao tác không hợp lệ.' using errcode='23514';
end; $f$;

create function public.crm_review_write_v1(p_actor text,p_product text,p_order text,p_stars int,p_text text,p_version uuid default null)
returns jsonb language plpgsql security invoker set search_path=pg_catalog as $f$
declare k text; r public."DANH_GIA_SAN_PHAM"%rowtype;
begin
  k:=public.crm_actor_v1(p_actor,false);
  if p_stars is null or p_stars not between 1 and 5 or coalesce(length(btrim(p_text)),0) not between 1 and 4000 then
    raise exception 'Nhận xét và điểm 1–5 sao không hợp lệ.' using errcode='23514'; end if;
  perform 1 from public."DON_HANG" where ma_donhang=p_order and ma_kh=k and trang_thai='HOAN_THANH' for share;
  if not found then raise exception 'Chỉ đánh giá sản phẩm trong đơn đã hoàn thành của bạn.' using errcode='42501'; end if;
  perform 1 from public."CT_DON_HANG" l join public."SAN_PHAM" p on p.sku=l.sku where l.ma_donhang=p_order and p.ma_sp=p_product;
  if not found then raise exception 'Sản phẩm không thuộc đơn hàng này.' using errcode='23514'; end if;
  select * into r from public."DANH_GIA_SAN_PHAM" where ma_kh=k and ma_donhang=p_order and ma_sp=p_product for update;
  if found then
    if r.so_sao=p_stars and r.noi_dung=btrim(p_text) then return to_jsonb(r); end if;
    if p_version is null or r.phien_ban<>p_version then raise exception 'Đánh giá đã thay đổi. Tải lại trước khi sửa.' using errcode='40001'; end if;
    update public."DANH_GIA_SAN_PHAM" set so_sao=p_stars,noi_dung=btrim(p_text),trang_thai='CHO_DUYET',
      nguoi_duyet=null,ngay_duyet=null,duyet_tu_phien_ban=null,phien_ban=gen_random_uuid(),cap_nhat_luc=statement_timestamp()
      where ma_danh_gia=r.ma_danh_gia returning * into r;
  else
    if p_version is not null then raise exception 'Đánh giá không còn tồn tại. Tải lại danh sách.' using errcode='40001'; end if;
    insert into public."DANH_GIA_SAN_PHAM"(ma_kh,ma_sp,ma_donhang,so_sao,noi_dung) values(k,p_product,p_order,p_stars,btrim(p_text))
      on conflict(ma_kh,ma_donhang,ma_sp) do nothing returning * into r;
    if not found then raise exception 'Đánh giá vừa được tạo. Tải lại trước khi sửa.' using errcode='40001'; end if;
  end if;
  return to_jsonb(r);
end; $f$;

create function public.crm_review_moderate_v1(p_actor text,p_id uuid,p_status text,p_version uuid)
returns jsonb language plpgsql security invoker set search_path=pg_catalog as $f$
declare r public."DANH_GIA_SAN_PHAM"%rowtype;
begin
  perform public.crm_actor_v1(p_actor,true);
  if p_status is null or p_status not in ('HIEN_THI','AN') or p_version is null then raise exception 'Trạng thái duyệt không hợp lệ.' using errcode='23514'; end if;
  select * into r from public."DANH_GIA_SAN_PHAM" where ma_danh_gia=p_id for update;
  if not found then raise exception 'Không tìm thấy đánh giá.' using errcode='P0002'; end if;
  if r.duyet_tu_phien_ban=p_version and r.trang_thai=p_status then return to_jsonb(r); end if;
  if r.phien_ban<>p_version then raise exception 'Khách đã sửa đánh giá hoặc người khác đã duyệt. Tải lại trước khi thao tác.' using errcode='40001'; end if;
  update public."DANH_GIA_SAN_PHAM" set trang_thai=p_status,nguoi_duyet=p_actor,ngay_duyet=statement_timestamp(),cap_nhat_luc=statement_timestamp(),phien_ban=gen_random_uuid(),duyet_tu_phien_ban=p_version
    where ma_danh_gia=p_id returning * into r;
  return to_jsonb(r);
end; $f$;

create function public.crm_review_read_v1(p_actor text,p_kind text,p_product text default null,p_status text default null,p_page int default 1)
returns jsonb language plpgsql security invoker set search_path=pg_catalog as $f$
declare k text; result jsonb;
begin
  if p_page not between 1 and 10000 then raise exception 'Trang không hợp lệ.' using errcode='23514'; end if;
  if p_kind='public' then
    perform 1 from public."SAN_PHAM" where ma_sp=p_product and trang_thai<>0;
    if not found then raise exception 'Không tìm thấy sản phẩm.' using errcode='P0002'; end if;
    with selected as (select r.so_sao,r.noi_dung,r.ngay_tao,c.ten_kh as author from public."DANH_GIA_SAN_PHAM" r join public."KHACH_HANG" c on c.ma_kh=r.ma_kh
      where r.ma_sp=p_product and r.trang_thai='HIEN_THI' order by r.ngay_tao desc,r.ma_danh_gia offset (p_page-1)*20 limit 20)
    select jsonb_build_object('data',coalesce((select jsonb_agg(to_jsonb(selected)) from selected),'[]'::jsonb),
      'total',(select count(*) from public."DANH_GIA_SAN_PHAM" where ma_sp=p_product and trang_thai='HIEN_THI'),
      'average',(select round(avg(so_sao),2) from public."DANH_GIA_SAN_PHAM" where ma_sp=p_product and trang_thai='HIEN_THI'),
      'stars',(select jsonb_agg(jsonb_build_object('stars',points,'count',(select count(*) from public."DANH_GIA_SAN_PHAM" where ma_sp=p_product and trang_thai='HIEN_THI' and so_sao=points))) from generate_series(1,5) points),
      'page',p_page,'page_size',20) into result;
    return result;
  elsif p_kind='eligible' then
    k:=public.crm_actor_v1(p_actor,false);
    with selected as (select distinct d.ma_donhang,d.thoi_gian_dat,p.ma_sp,p.ten_sp,p.sku,r.ma_danh_gia,r.so_sao,r.noi_dung,r.trang_thai,r.phien_ban
      from public."DON_HANG" d join public."CT_DON_HANG" l on l.ma_donhang=d.ma_donhang join public."SAN_PHAM" p on p.sku=l.sku
      left join public."DANH_GIA_SAN_PHAM" r on r.ma_kh=k and r.ma_donhang=d.ma_donhang and r.ma_sp=p.ma_sp
      where d.ma_kh=k and d.trang_thai='HOAN_THANH'),
    items as (select * from selected order by thoi_gian_dat desc,ma_donhang,ma_sp offset (p_page-1)*20 limit 20)
    select jsonb_build_object('data',coalesce((select jsonb_agg(to_jsonb(items)) from items),'[]'::jsonb),'total',(select count(*) from selected),'page',p_page,'page_size',20) into result;
    return result;
  elsif p_kind='admin' then
    perform public.crm_actor_v1(p_actor,true);
    if p_status is not null and p_status not in ('CHO_DUYET','HIEN_THI','AN') then raise exception 'Bộ lọc trạng thái không hợp lệ.' using errcode='23514'; end if;
    with selected as (select r.*,c.ten_kh,p.ten_sp from public."DANH_GIA_SAN_PHAM" r join public."KHACH_HANG" c on c.ma_kh=r.ma_kh join public."SAN_PHAM" p on p.ma_sp=r.ma_sp
      where (p_status is null or r.trang_thai=p_status) and (p_product is null or r.ma_sp=p_product)),
    items as (select * from selected order by ngay_tao desc,ma_danh_gia offset (p_page-1)*20 limit 20)
    select jsonb_build_object('data',coalesce((select jsonb_agg(to_jsonb(items)) from items),'[]'::jsonb),'total',(select count(*) from selected),'page',p_page,'page_size',20) into result;
    return result;
  end if;
  raise exception 'Thao tác không hợp lệ.' using errcode='23514';
end; $f$;

-- Keep all entry points backend-only; SECURITY INVOKER never bypasses RLS itself.
do $functions$
declare fn regprocedure;
begin
  for fn in select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname in ('crm_actor_v1','crm_age_v1','crm_survey_detail_v1','crm_survey_write_v1','crm_survey_read_v1','crm_survey_submit_v1','crm_review_write_v1','crm_review_moderate_v1','crm_review_read_v1') loop
    execute format('revoke all on function %s from public, anon, authenticated',fn);
    execute format('grant execute on function %s to service_role',fn);
  end loop;
end; $functions$;
notify pgrst,'reload schema';
commit;
