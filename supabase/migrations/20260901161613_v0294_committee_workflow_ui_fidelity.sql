alter table public.committee_members add column if not exists client_key text;
alter table public.committee_meetings add column if not exists client_key text;
alter table public.committee_meetings add column if not exists meeting_type text not null default 'regular';
alter table public.committee_meetings add column if not exists location text;
alter table public.committee_meeting_attendance add column if not exists client_key text;
alter table public.committee_decisions add column if not exists client_key text;
alter table public.committee_decisions add column if not exists topic_key text;
alter table public.committee_decisions add column if not exists owner_label text;
alter table public.committee_plan_items add column if not exists client_key text;
alter table public.committee_plan_items add column if not exists owner_label text;

update public.committee_members set client_key=id::text where client_key is null;
update public.committee_meetings set client_key=id::text where client_key is null;
update public.committee_meeting_attendance set client_key=id::text where client_key is null;
update public.committee_decisions set client_key=id::text where client_key is null;
update public.committee_plan_items set client_key=id::text where client_key is null;

create unique index if not exists committee_members_committee_client_key_uq on public.committee_members(committee_id,client_key) where client_key is not null;
create unique index if not exists committee_meetings_committee_client_key_uq on public.committee_meetings(committee_id,client_key) where client_key is not null;
create unique index if not exists committee_attendance_meeting_client_key_uq on public.committee_meeting_attendance(meeting_id,client_key) where client_key is not null;
create unique index if not exists committee_decisions_committee_client_key_uq on public.committee_decisions(committee_id,client_key) where client_key is not null;
create unique index if not exists committee_plan_items_committee_client_key_uq on public.committee_plan_items(committee_id,client_key) where client_key is not null;

alter table public.committee_meetings drop constraint if exists committee_meetings_meeting_type_check;
alter table public.committee_meetings add constraint committee_meetings_meeting_type_check check (meeting_type in ('regular','extraordinary'));
