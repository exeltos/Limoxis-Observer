revoke all on table public.patient_day_periods from anon;
grant select, insert, update, delete on table public.patient_day_periods to authenticated;

drop policy if exists patient_day_periods_manage on public.patient_day_periods;
drop policy if exists patient_day_periods_read on public.patient_day_periods;

create policy patient_day_periods_read
on public.patient_day_periods
for select
to authenticated
using (public.is_org_member(organization_id));

create policy patient_day_periods_manage
on public.patient_day_periods
for all
to authenticated
using (
  public.is_org_admin(organization_id)
  or public.current_user_has_org_role(organization_id, array['infection_control_lead'::public.app_role])
)
with check (
  public.is_org_admin(organization_id)
  or public.current_user_has_org_role(organization_id, array['infection_control_lead'::public.app_role])
);

drop trigger if exists trg_audit_patient_day_periods on public.patient_day_periods;
create trigger trg_audit_patient_day_periods
after insert or update or delete on public.patient_day_periods
for each row execute function private.audit_management_change();
