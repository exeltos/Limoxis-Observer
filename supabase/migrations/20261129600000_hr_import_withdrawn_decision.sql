-- FileMaker HR import: a candidate who refused gets the hospital's «hire» decision
-- only when FileMaker says the hospital had chosen them («ΕΠΙΤΥΧΗΣ ΑΛΛΑ ΑΡΝΗΘΗΚΕ»);
-- a bare refusal carries no decision. Only that expression of the live function changes.
do $do$
declare
  d text := pg_get_functiondef('private.hr_fm_import_candidates()'::regprocedure);
  old_expr constant text := $$case when v_status in ('offer','hired','withdrawn') then 'hire'$$;
begin
  if position(old_expr in d) = 0 then
    raise exception 'hr_fm_import_candidates: decision expression not found';
  end if;
  d := replace(d, old_expr, $$case when v_status in ('offer','hired') or (v_status = 'withdrawn' and private.hr_fm_norm(d ->> 'STATUS') ~ 'ΕΠΙΤΥΧ') then 'hire'$$);
  execute d;
end
$do$;
