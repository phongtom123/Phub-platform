-- Cover the composite recipient FK used for answer ownership and history reads.
begin;
set local lock_timeout='5s';
create index "TRA_LOI_KHAO_SAT_ma_gui_ma_khao_sat_idx"
  on public."TRA_LOI_KHAO_SAT"(ma_gui,ma_khao_sat);
commit;
