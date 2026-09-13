-- Resolve the existing committee annual-plan indicator text against governed indicator definitions.
-- Organization-specific definitions win over system defaults. Free text remains supported.

create or replace function public.sync_committee_plan_indicator_reference()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
declare
 v_definition public.indicator_definitions%rowtype;
begin
 if new.indicator_definition_id is not null then
   select * into v_definition
   from public.indicator_definitions d
   where d.id=new.indicator_definition_id
     and (d.organization_id=new.organization_id or d.organization_id is null)
   limit 1;
   if found then
     new.indicator_key:=v_definition.indicator_key;
     if nullif(btrim(coalesce(new.indicator,'')),'') is null then
       new.indicator:=v_definition.title_el;
     end if;
     return new;
   end if;
   new.indicator_definition_id:=null;
   new.indicator_key:=null;
 end if;

 if nullif(btrim(coalesce(new.indicator,'')),'') is null then
   new.indicator_definition_id:=null;
   new.indicator_key:=null;
   return new;
 end if;

 select * into v_definition
 from public.indicator_definitions d
 where (d.organization_id=new.organization_id or d.organization_id is null)
   and d.status='active'
   and (
     lower(btrim(d.indicator_key))=lower(btrim(new.indicator))
     or lower(btrim(d.title_el))=lower(btrim(new.indicator))
     or lower(btrim(coalesce(d.title_en,'')))=lower(btrim(new.indicator))
   )
 order by (d.organization_id=new.organization_id) desc, d.effective_from desc nulls last
 limit 1;

 if found then
   new.indicator_definition_id:=v_definition.id;
   new.indicator_key:=v_definition.indicator_key;
 else
   new.indicator_definition_id:=null;
   new.indicator_key:=null;
 end if;
 return new;
end;
$$;

revoke all on function public.sync_committee_plan_indicator_reference() from public,anon,authenticated;

drop trigger if exists trg_committee_plan_indicator_reference on public.committee_plan_items;
create trigger trg_committee_plan_indicator_reference
before insert or update of indicator,indicator_definition_id
on public.committee_plan_items
for each row execute function public.sync_committee_plan_indicator_reference();

-- Resolve existing rows by key/title now that the trigger exists.
update public.committee_plan_items p
set indicator=p.indicator
where nullif(btrim(coalesce(p.indicator,'')),'') is not null;
