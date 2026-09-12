create table if not exists public.management_announcements (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  title text not null,
  message text not null,
  priority text not null default 'normal' check (priority in ('normal','high','critical')),
  audience_type text not null default 'all' check (audience_type in ('all','role','department','user')),
  audience_values jsonb not null default '[]'::jsonb,
  requires_ack boolean not null default false,
  starts_at timestamptz,
  ends_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint management_announcements_window check (ends_at is null or starts_at is null or ends_at > starts_at),
  constraint management_announcements_audience check ((audience_type='all' and jsonb_array_length(audience_values)=0) or (audience_type<>'all' and jsonb_array_length(audience_values)>0))
);
create table if not exists public.management_announcement_acknowledgements (
  id uuid primary key default gen_random_uuid(),
  announcement_id uuid not null references public.management_announcements(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  acknowledged_at timestamptz not null default now(),
  unique (announcement_id,user_id)
);
alter table public.management_announcements enable row level security;
alter table public.management_announcement_acknowledgements enable row level security;
revoke all on public.management_announcements from anon;
revoke all on public.management_announcement_acknowledgements from anon;
grant select,insert,update,delete on public.management_announcements to authenticated;
grant select,insert,delete on public.management_announcement_acknowledgements to authenticated;
create policy management_announcements_read_targeted on public.management_announcements for select to authenticated using (public.is_org_member(organization_id) and (audience_type='all' or (audience_type='user' and audience_values ? auth.uid()::text) or (audience_type='role' and exists (select 1 from public.organization_members om where om.organization_id=management_announcements.organization_id and om.user_id=auth.uid() and om.status='active' and audience_values ? om.role::text)) or (audience_type='department' and exists (select 1 from public.organization_members om join public.organization_member_scopes oms on oms.membership_id=om.id where om.organization_id=management_announcements.organization_id and om.user_id=auth.uid() and om.status='active' and audience_values ? oms.department_id::text))));
create policy management_announcements_manage on public.management_announcements for all to authenticated using (public.is_org_admin(organization_id) or public.current_user_has_org_role(organization_id,array['infection_control_lead'::public.app_role])) with check (public.is_org_admin(organization_id) or public.current_user_has_org_role(organization_id,array['infection_control_lead'::public.app_role]));
create policy management_announcement_ack_read on public.management_announcement_acknowledgements for select to authenticated using (user_id=auth.uid() and public.is_org_member(organization_id));
create policy management_announcement_ack_insert on public.management_announcement_acknowledgements for insert to authenticated with check (user_id=auth.uid() and public.is_org_member(organization_id) and exists (select 1 from public.management_announcements a where a.id=announcement_id and a.organization_id=management_announcement_acknowledgements.organization_id and a.requires_ack));
create policy management_announcement_ack_delete on public.management_announcement_acknowledgements for delete to authenticated using (user_id=auth.uid() and public.is_org_member(organization_id));
drop trigger if exists trg_audit_management_announcements on public.management_announcements;
create trigger trg_audit_management_announcements after insert or update or delete on public.management_announcements for each row execute function private.audit_management_change();
drop trigger if exists trg_audit_management_announcement_acknowledgements on public.management_announcement_acknowledgements;
create trigger trg_audit_management_announcement_acknowledgements after insert or delete on public.management_announcement_acknowledgements for each row execute function private.audit_management_change();