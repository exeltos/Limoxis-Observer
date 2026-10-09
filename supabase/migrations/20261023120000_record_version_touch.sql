-- Concurrency protection for record editing: every UPDATE moves updated_at to
-- the transaction time, so a save can require the version the editor loaded
-- (`.eq('updated_at', loaded)`) and detect that someone else saved in between.
-- Tables that already had a BEFORE UPDATE trigger keep it; this adds the touch
-- only where nothing set updated_at server-side.
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
declare t text;
begin
  foreach t in array array['patients','employees','quality_incidents','quality_findings','quality_capa_actions','quality_audits'] loop
    execute format('create or replace trigger trg_%1$s_touch_updated_at before update on public.%1$I for each row execute function public.touch_updated_at()', t);
  end loop;
end
$$;
