-- Κουζίνα (εύρημα Codex στο #707): η επαλήθευση / επαναφορά ημέρας ξαναδέχεται τον Ιδιοκτήτη Πλατφόρμας, που μπαίνει σε
-- νοσοκομείο χωρίς γραμμή στο organization_members (το current_user_has_capability τον δεχόταν ρητά).
do $do$
declare
  v_def text;
  v_old text := $o$not (p_org = any (private.current_user_kitchen_orgs('manage')))$o$;
  v_new text := $n$not (public.current_user_is_platform_owner() or p_org = any (private.current_user_kitchen_orgs('manage')))$n$;
begin
  select pg_get_functiondef('private.kitchen_signoff_guard(uuid,timestamp with time zone,timestamp with time zone,boolean,text)'::regprocedure) into v_def;
  if position(v_new in v_def) > 0 then return; end if;
  if position(v_old in v_def) = 0 then
    raise exception 'kitchen_signoff_guard: the expected text was not found';
  end if;
  execute replace(v_def, v_old, v_new);
end
$do$;
