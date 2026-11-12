-- Fix two CRM defects found by end-to-end tests against the deployed environment (2026-11-12).
--
-- 1) A closed support ticket (DA_DONG) could still be edited or reopened to MOI.
--    Commit f4804e9 added the guard inside 20261023_customer_support.sql, but that file uses
--    CREATE FUNCTION and cannot be re-run, so the running database never received it. Later
--    migrations patch admin_update_feedback_v1 in place, so the guard is injected the same way.
--
-- 2) CRM RPCs reported conflicts with SQLSTATE 40001 (serialization_failure). Through PostgREST
--    the response arrived after the backend's 4 s read timeout and surfaced as
--    "503 Không kết nối được Supabase" instead of 409 (e.g. a second survey submission).
--    The conflicts are now raised as 23505; EngagementService already maps 23505 to 409.
--
-- Idempotent: each patch is skipped when it is already present or the function is not installed.
begin;
set local lock_timeout='5s';
set local statement_timeout='60s';

create or replace function pg_temp.insert_once(signature text, marker text, anchor text, addition text)
returns void language plpgsql as $$
declare source text;
begin
 if to_regprocedure(signature) is null then raise notice 'Skip %: function not installed', signature; return; end if;
 source:=pg_get_functiondef(signature::regprocedure);
 if strpos(source,marker)>0 then return; end if;
 if strpos(source,anchor)=0 then raise exception 'Unexpected function definition: %',signature; end if;
 execute replace(source,anchor,anchor||addition);
end $$;

create or replace function pg_temp.replace_all(signature text, before_text text, after_text text)
returns void language plpgsql as $$
declare source text;
begin
 if to_regprocedure(signature) is null then raise notice 'Skip %: function not installed', signature; return; end if;
 source:=pg_get_functiondef(signature::regprocedure);
 if strpos(source,before_text)=0 then return; end if;
 execute replace(source,before_text,after_text);
end $$;

-- 1) Closed tickets are read-only; an in-progress or resolved ticket cannot be reset to MOI.
select pg_temp.insert_once('public.admin_update_feedback_v1(text,uuid,jsonb)',
 'v_row.trang_thai = ''DA_DONG''',
 'if not found then raise exception ''FEEDBACK_NOT_FOUND'' using errcode=''P0002''; end if;',
 E'\n  if v_row.trang_thai = ''DA_DONG'' then\n    raise exception ''STATE_CONFLICT'' using errcode=''23514'';\n  end if;'
 || E'\n  if p_changes ? ''trang_thai'' and p_changes->>''trang_thai'' = ''MOI'' and v_row.trang_thai in (''DANG_XU_LY'', ''DA_GIAI_QUYET'') then\n    raise exception ''STATE_CONFLICT'' using errcode=''23514'';\n  end if;');

-- 2) Conflict errors that PostgREST returns promptly.
select pg_temp.replace_all('public.crm_survey_submit_v1(text,uuid,uuid,jsonb)', 'errcode=''40001''', 'errcode=''23505''');
select pg_temp.replace_all('public.crm_survey_write_v1(text,uuid,text,jsonb,uuid)', 'errcode=''40001''', 'errcode=''23505''');
select pg_temp.replace_all('public.crm_review_write_v1(text,text,text,int,text,uuid)', 'errcode=''40001''', 'errcode=''23505''');
select pg_temp.replace_all('public.crm_review_moderate_v1(text,uuid,text,uuid)', 'errcode=''40001''', 'errcode=''23505''');

commit;
