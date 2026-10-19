-- Supplier certificate renewal, second version: one request (and one e-mail) per
-- supplier, with one item per certificate.
--
-- quality_supplier_certificate_requests        the header: one supplier, one address, one
--                                              link (only the SHA-256 of the random token is
--                                              stored, valid 14 days), its sending history
--                                              (send, resend = new link, reminder = same link
--                                              and 14 more days).
-- quality_supplier_certificate_request_items   one row per certificate to replace: what the
--                                              supplier submitted for it and its review.
--
-- Flow: proposed (by any Quality reader) → sent (only the Platform Owner or a member with
-- the add-on supplier_renewal_sender, which only the Platform Owner grants) → the supplier
-- submits the items one by one from the same link, until it expires or none is left →
-- each item is accepted / rejected by Quality (manage_quality) → the request closes when
-- no item is pending or submitted.
-- Reading: Quality (quality_read_orgs) and the Platform Owner. No direct writes.
-- No SELECT/EXECUTE/RETURNING ... INTO (the Supabase SQL editor rewrites those).

create table if not exists public.quality_supplier_certificate_request_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  request_id uuid not null references public.quality_supplier_certificate_requests(id) on delete cascade,
  supplier_id uuid not null,
  certification_id uuid not null references public.quality_supplier_certifications(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'submitted', 'accepted', 'rejected', 'cancelled')),
  certificate_snapshot jsonb not null default '{}'::jsonb,
  submitted_at timestamptz,
  certificate_type text,
  certificate_number text,
  issuer text,
  issued_on date,
  expires_on date,
  note text,
  attachment_id uuid references public.attachments(id) on delete set null,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  review_comment text,
  previous_values jsonb,
  history jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (supplier_id, organization_id) references public.quality_suppliers(id, organization_id) on delete cascade
);
create index if not exists quality_supplier_certificate_request_items_request_idx on public.quality_supplier_certificate_request_items (request_id, status);
create index if not exists quality_supplier_certificate_request_items_org_idx on public.quality_supplier_certificate_request_items (organization_id, status);
create index if not exists quality_supplier_certificate_request_items_supplier_idx on public.quality_supplier_certificate_request_items (supplier_id, organization_id);
create index if not exists quality_supplier_certificate_request_items_certification_idx on public.quality_supplier_certificate_request_items (certification_id);
create index if not exists quality_supplier_certificate_request_items_attachment_idx on public.quality_supplier_certificate_request_items (attachment_id);
-- One item in progress per certificate.
create unique index if not exists quality_supplier_certificate_request_items_open_idx on public.quality_supplier_certificate_request_items (certification_id)
  where status in ('pending', 'submitted');
comment on table public.quality_supplier_certificate_request_items is 'The certificates of a supplier renewal request: what the supplier submitted for each and its review.';

alter table public.quality_supplier_certificate_request_items enable row level security;
drop policy if exists quality_supplier_certificate_request_items_read on public.quality_supplier_certificate_request_items;
create policy quality_supplier_certificate_request_items_read on public.quality_supplier_certificate_request_items
  for select to authenticated using (
    (select public.current_user_is_platform_owner())
    or organization_id = any ((select private.current_user_quality_read_orgs())::uuid[]));
revoke all on public.quality_supplier_certificate_request_items from anon;
revoke insert, update, delete on public.quality_supplier_certificate_request_items from authenticated;
grant select on public.quality_supplier_certificate_request_items to authenticated;

-- The header keeps its sending history.
alter table public.quality_supplier_certificate_requests add column if not exists first_sent_at timestamptz;
alter table public.quality_supplier_certificate_requests add column if not exists reminder_count integer not null default 0;
alter table public.quality_supplier_certificate_requests add column if not exists last_reminder_at timestamptz;
alter table public.quality_supplier_certificate_requests add column if not exists send_history jsonb not null default '[]'::jsonb;

-- Existing one-certificate requests become a header with one item (none on the hosted
-- project when this was written; kept for any other database).
insert into public.quality_supplier_certificate_request_items(organization_id, request_id, supplier_id, certification_id, status, certificate_snapshot, submitted_at,
  certificate_type, certificate_number, issuer, issued_on, expires_on, note, attachment_id, reviewed_by, reviewed_at, review_comment, previous_values, created_at, updated_at)
select r.organization_id, r.id, r.supplier_id, r.certification_id,
  case when r.status in ('proposed', 'approved', 'sent') then 'pending' else r.status end,
  r.certificate_snapshot, r.submitted_at, r.certificate_type, r.certificate_number, r.issuer, r.issued_on, r.expires_on, r.note, r.attachment_id,
  r.reviewed_by, r.reviewed_at, r.review_comment, r.previous_values, r.created_at, r.updated_at
from public.quality_supplier_certificate_requests r
where r.certification_id is not null
  and not exists (select 1 from public.quality_supplier_certificate_request_items i where i.request_id = r.id);
alter table public.quality_supplier_certificate_requests drop constraint if exists quality_supplier_certificate_requests_status_check;
update public.quality_supplier_certificate_requests r
   set status = case when r.status = 'approved' then 'proposed' when r.status = 'submitted' then 'sent' when r.status in ('accepted', 'rejected') then 'closed' else r.status end,
       first_sent_at = coalesce(r.first_sent_at, r.sent_at)
 where r.status in ('approved', 'submitted', 'accepted', 'rejected') or (r.first_sent_at is null and r.sent_at is not null);
alter table public.quality_supplier_certificate_requests add constraint quality_supplier_certificate_requests_status_check
  check (status in ('proposed', 'sent', 'closed', 'cancelled'));

-- The per-certificate columns of the header now live on the items: they stay (empty,
-- nullable) because the hosted project applies no column drop without a separate
-- confirmation; nothing reads or writes them any more. The old «one open request per
-- certificate» index only sees those empty columns (NULL never conflicts).
alter table public.quality_supplier_certificate_requests alter column certification_id drop not null;
alter table public.quality_supplier_certificate_requests alter column certificate_snapshot drop not null;
alter index if exists public.quality_supplier_certificate_requests_open_idx rename to quality_supplier_certificate_requests_open_legacy_idx;
comment on column public.quality_supplier_certificate_requests.certification_id is 'Legacy (first version): the certificate is on quality_supplier_certificate_request_items.';
create index if not exists quality_supplier_certificate_requests_open_supplier_idx on public.quality_supplier_certificate_requests (supplier_id, recipient_email)
  where status in ('proposed', 'sent');
comment on table public.quality_supplier_certificate_requests is 'E-mailed requests to a supplier to upload the renewals of its expired certificates (one link, one item per certificate).';

-- Who may e-mail suppliers: the Platform Owner, or an active member of the organization
-- with the add-on supplier_renewal_sender (organization_member_capabilities).
create or replace function private.quality_supplier_renewal_can_send(p_organization_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $function$
  select public.current_user_is_platform_owner() or exists (
    select 1 from public.organization_members m
    join public.organization_member_capabilities c on c.membership_id = m.id
    where m.user_id = auth.uid() and m.organization_id = p_organization_id and m.status = 'active'
      and c.capability = 'supplier_renewal_sender' and c.effect = 'grant');
$function$;
revoke all on function private.quality_supplier_renewal_can_send(uuid) from public, anon;
grant execute on function private.quality_supplier_renewal_can_send(uuid) to authenticated;

-- The e-mail of a request (outbox row): the pending certificates and the link.
-- p_kind: send | reminder.
create or replace function private.quality_supplier_certificate_queue_email(p_id uuid, p_path text, p_kind text)
returns void language plpgsql security definer set search_path = ''
as $function$
declare
  v_row public.quality_supplier_certificate_requests;
  v_org_name text;
  v_supplier_name text;
  v_certificates jsonb;
  v_count integer;
  v_payload jsonb;
  v_subject text;
  v_outbox uuid;
begin
  v_row := (select r from public.quality_supplier_certificate_requests r where r.id = p_id);
  v_org_name := (select o.name from public.organizations o where o.id = v_row.organization_id);
  v_supplier_name := (select s.name from public.quality_suppliers s where s.id = v_row.supplier_id);
  v_certificates := coalesce((select jsonb_agg(jsonb_build_object(
      'type', coalesce(i.certificate_snapshot->>'certificate_type', ''), 'title', coalesce(i.certificate_snapshot->>'title', ''),
      'number', coalesce(i.certificate_snapshot->>'certificate_number', ''), 'expiresOn', i.certificate_snapshot->>'expires_on',
      'reviewComment', case when i.history <> '[]'::jsonb then i.review_comment end) order by i.certificate_snapshot->>'expires_on', i.created_at)
    from public.quality_supplier_certificate_request_items i where i.request_id = p_id and i.status = 'pending'), '[]'::jsonb);
  v_count := jsonb_array_length(v_certificates);
  v_subject := case when p_kind = 'reminder' then 'Υπενθύμιση: ' else '' end || 'Ανανέωση πιστοποιητικών (' || v_count || ') · ' || coalesce(v_org_name, '');
  v_payload := jsonb_build_object('path', p_path, 'organizationName', coalesce(v_org_name, ''), 'supplierName', coalesce(v_supplier_name, ''),
    'certificates', v_certificates, 'kind', p_kind, 'expiresAt', v_row.token_expires_at, 'language', 'el');
  v_outbox := (select o.id from public.notification_outbox o
               where o.notification_type = 'supplier_certificate_renewal' and o.entity_type = 'quality_supplier_certificate_request' and o.entity_id = p_id
               order by o.created_at desc limit 1);
  if v_outbox is null then
    insert into public.notification_outbox(organization_id, recipient_user_id, recipient_email, notification_type, entity_type, entity_id, subject, payload, status, attempts, available_at)
    values (v_row.organization_id, null, v_row.recipient_email, 'supplier_certificate_renewal', 'quality_supplier_certificate_request', p_id, v_subject, v_payload, 'pending', 0, now());
  else
    update public.notification_outbox o
       set recipient_email = v_row.recipient_email, subject = v_subject, payload = v_payload,
           status = 'pending', attempts = 0, available_at = now(), sent_at = null, last_error = null, updated_at = now()
     where o.id = v_outbox;
  end if;
end;
$function$;
revoke all on function private.quality_supplier_certificate_queue_email(uuid, text, text) from public, anon, authenticated;

-- A fresh link for a request (the previous one stops working) and its e-mail.
create or replace function private.quality_supplier_certificate_issue_link(p_id uuid)
returns void language plpgsql security definer set search_path = ''
as $function$
declare
  v_row public.quality_supplier_certificate_requests;
  v_token text := 'SCR-' || replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
  v_kind text;
begin
  v_row := (select r from public.quality_supplier_certificate_requests r where r.id = p_id);
  if v_row.id is null or v_row.status not in ('proposed', 'sent') then
    raise exception 'SUPPLIER_CERTIFICATE_REQUEST_NOT_OPEN';
  end if;
  if not private.quality_supplier_renewal_can_send(v_row.organization_id) then
    raise exception 'PERMISSION_DENIED';
  end if;
  if not exists (select 1 from public.quality_supplier_certificate_request_items i where i.request_id = p_id and i.status = 'pending') then
    raise exception 'SUPPLIER_CERTIFICATE_REQUEST_NOTHING_PENDING';
  end if;
  v_kind := case when v_row.status = 'sent' then 'resend' else 'send' end;
  update public.quality_supplier_certificate_requests r
     set status = 'sent', token_hash = encode(sha256(convert_to(v_token, 'UTF8')), 'hex'), token_expires_at = now() + interval '14 days',
         sent_at = now(), first_sent_at = coalesce(r.first_sent_at, now()), send_count = r.send_count + 1,
         send_history = r.send_history || jsonb_build_object('kind', v_kind, 'at', now(), 'by', auth.uid(), 'expiresAt', now() + interval '14 days'),
         updated_at = now()
   where r.id = p_id;
  perform private.quality_supplier_certificate_queue_email(p_id, '/supplier-certificate/' || v_token, 'send');
end;
$function$;
revoke all on function private.quality_supplier_certificate_issue_link(uuid) from public, anon, authenticated;

-- A reminder: the same link again (from its last e-mail), valid 14 more days. Without
-- that e-mail (or when its link is no longer the current one) a fresh link is issued.
create or replace function private.quality_supplier_certificate_remind(p_id uuid)
returns void language plpgsql security definer set search_path = ''
as $function$
declare
  v_row public.quality_supplier_certificate_requests;
  v_path text;
  v_until timestamptz;
begin
  v_row := (select r from public.quality_supplier_certificate_requests r where r.id = p_id);
  if v_row.id is null or v_row.status <> 'sent' then
    raise exception 'SUPPLIER_CERTIFICATE_REQUEST_NOT_OPEN';
  end if;
  if not private.quality_supplier_renewal_can_send(v_row.organization_id) then
    raise exception 'PERMISSION_DENIED';
  end if;
  if not exists (select 1 from public.quality_supplier_certificate_request_items i where i.request_id = p_id and i.status = 'pending') then
    raise exception 'SUPPLIER_CERTIFICATE_REQUEST_NOTHING_PENDING';
  end if;
  v_path := (select o.payload->>'path' from public.notification_outbox o
             where o.notification_type = 'supplier_certificate_renewal' and o.entity_type = 'quality_supplier_certificate_request' and o.entity_id = p_id
             order by o.created_at desc limit 1);
  if v_path is null or v_row.token_hash is null
     or encode(sha256(convert_to(substring(v_path from '^/supplier-certificate/(SCR-[0-9a-f]+)$'), 'UTF8')), 'hex') is distinct from v_row.token_hash then
    perform private.quality_supplier_certificate_issue_link(p_id);
    return;
  end if;
  v_until := greatest(coalesce(v_row.token_expires_at, now()), now()) + interval '14 days';
  update public.quality_supplier_certificate_requests r
     set token_expires_at = v_until, sent_at = now(), send_count = r.send_count + 1, reminder_count = r.reminder_count + 1, last_reminder_at = now(),
         send_history = r.send_history || jsonb_build_object('kind', 'reminder', 'at', now(), 'by', auth.uid(), 'expiresAt', v_until),
         updated_at = now()
   where r.id = p_id;
  perform private.quality_supplier_certificate_queue_email(p_id, v_path, 'reminder');
end;
$function$;
revoke all on function private.quality_supplier_certificate_remind(uuid) from public, anon, authenticated;

-- A request with nothing pending or submitted is closed (its link then only says so).
create or replace function private.quality_supplier_certificate_close_if_done(p_id uuid)
returns void language plpgsql security definer set search_path = ''
as $function$
begin
  if not exists (select 1 from public.quality_supplier_certificate_request_items i where i.request_id = p_id and i.status in ('pending', 'submitted')) then
    update public.quality_supplier_certificate_requests r set status = 'closed', updated_at = now() where r.id = p_id and r.status in ('proposed', 'sent');
    update public.notification_outbox o set status = 'cancelled', last_error = null, updated_at = now()
     where o.notification_type = 'supplier_certificate_renewal' and o.entity_type = 'quality_supplier_certificate_request' and o.entity_id = p_id and o.status in ('pending', 'failed');
  end if;
end;
$function$;
revoke all on function private.quality_supplier_certificate_close_if_done(uuid) from public, anon, authenticated;

-- Creates the requests. p_items: [{certification_id, recipient_email}]; the certificates
-- of one supplier and address go into one request. With p_send (Platform Owner or
-- supplier_renewal_sender only) the requests are e-mailed at once (a request already
-- sent to that address gets the new certificates and a reminder of the same link);
-- without it they are only proposed (any Quality reader), in a request not yet sent.
-- A certificate with an item in progress, or without a valid e-mail, is skipped.
create or replace function public.quality_supplier_certificate_requests_create(p_organization_id uuid, p_items jsonb, p_send boolean default true)
returns jsonb language plpgsql security definer set search_path = ''
as $function$
declare
  v_items jsonb := case when jsonb_typeof(p_items) = 'array' then p_items else '[]'::jsonb end;
  v_send boolean := coalesce(p_send, true);
  v_item jsonb;
  v_cert public.quality_supplier_certifications;
  v_email text;
  v_request uuid;
  v_status text;
  v_touched uuid[] := '{}';
  v_created integer := 0;
  v_requests integer := 0;
  v_sent integer := 0;
  v_skipped jsonb := '[]'::jsonb;
begin
  if p_organization_id is null then
    raise exception 'PERMISSION_DENIED';
  end if;
  if v_send then
    if not private.quality_supplier_renewal_can_send(p_organization_id) then
      raise exception 'PERMISSION_DENIED';
    end if;
  elsif not (public.current_user_is_platform_owner() or p_organization_id = any (private.current_user_quality_read_orgs())) then
    raise exception 'PERMISSION_DENIED';
  end if;
  if jsonb_array_length(v_items) = 0 or jsonb_array_length(v_items) > 500 then
    raise exception 'SUPPLIER_CERTIFICATE_REQUEST_ITEMS_INVALID';
  end if;

  for v_item in select e from jsonb_array_elements(v_items) e loop
    v_cert := (select c from public.quality_supplier_certifications c
               where c.id::text = v_item->>'certification_id' and c.organization_id = p_organization_id);
    v_email := lower(btrim(coalesce(v_item->>'recipient_email', '')));
    if v_cert.id is null then
      v_skipped := v_skipped || jsonb_build_object('certification_id', v_item->>'certification_id', 'reason', 'not_found');
      continue;
    end if;
    if v_email !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' then
      v_skipped := v_skipped || jsonb_build_object('certification_id', v_cert.id, 'reason', 'email');
      continue;
    end if;
    if exists (select 1 from public.quality_supplier_certificate_request_items i
               where i.certification_id = v_cert.id and i.status in ('pending', 'submitted')) then
      v_skipped := v_skipped || jsonb_build_object('certification_id', v_cert.id, 'reason', 'open');
      continue;
    end if;
    -- The open request of this supplier and address (a sent one only when sending now).
    v_request := (select r.id from public.quality_supplier_certificate_requests r
                  where r.organization_id = p_organization_id and r.supplier_id = v_cert.supplier_id and r.recipient_email = v_email
                    and (r.status = 'proposed' or (v_send and r.status = 'sent' and r.token_expires_at > now()))
                  order by (r.status = 'sent') desc, r.requested_at desc limit 1);
    if v_request is null then
      v_request := gen_random_uuid();
      insert into public.quality_supplier_certificate_requests(id, organization_id, supplier_id, recipient_email, status, requested_by)
      values (v_request, p_organization_id, v_cert.supplier_id, v_email, 'proposed', auth.uid());
      v_requests := v_requests + 1;
    end if;
    insert into public.quality_supplier_certificate_request_items(organization_id, request_id, supplier_id, certification_id, status, certificate_snapshot)
    values (p_organization_id, v_request, v_cert.supplier_id, v_cert.id, 'pending',
      jsonb_build_object('certificate_type', v_cert.certificate_type, 'title', v_cert.title, 'document_kind', v_cert.document_kind,
        'certificate_number', v_cert.certificate_number, 'issuer', v_cert.issuer, 'expires_on', v_cert.expires_on, 'attachment_id', v_cert.attachment_id));
    if not (v_request = any (v_touched)) then
      v_touched := v_touched || v_request;
    end if;
    v_created := v_created + 1;
  end loop;

  if v_send then
    foreach v_request in array v_touched loop
      v_status := (select r.status from public.quality_supplier_certificate_requests r where r.id = v_request);
      if v_status = 'proposed' then
        update public.quality_supplier_certificate_requests r set approved_by = auth.uid(), approved_at = now(), updated_at = now() where r.id = v_request;
        perform private.quality_supplier_certificate_issue_link(v_request);
      else
        perform private.quality_supplier_certificate_remind(v_request);
      end if;
      v_sent := v_sent + 1;
    end loop;
  end if;
  return jsonb_build_object('created', v_created, 'requests', v_requests, 'sent', v_sent, 'skipped', v_skipped);
end;
$function$;
revoke all on function public.quality_supplier_certificate_requests_create(uuid, jsonb, boolean) from public, anon;
grant execute on function public.quality_supplier_certificate_requests_create(uuid, jsonb, boolean) to authenticated;

-- The actions on a request (the supplier's e-mail):
--   approve   a proposed one: e-mailed with a new link        } Platform Owner or
--   resend    a sent one: a new link (the previous one stops)  } supplier_renewal_sender
--   remind    a sent one: the same link, valid 14 more days    }
--   cancel    a proposed or sent one: the link stops working, the pending certificates
--             are cancelled (submitted ones stay to review); also Quality managers.
create or replace function public.quality_supplier_certificate_request_action(p_id uuid, p_action text, p_comment text default null, p_resend boolean default false)
returns jsonb language plpgsql security definer set search_path = ''
as $function$
declare
  v_row public.quality_supplier_certificate_requests;
  v_comment text := nullif(btrim(coalesce(p_comment, '')), '');
begin
  v_row := (select r from public.quality_supplier_certificate_requests r where r.id = p_id for update);
  if v_row.id is null then
    raise exception 'SUPPLIER_CERTIFICATE_REQUEST_NOT_FOUND';
  end if;

  if p_action in ('approve', 'resend', 'remind') then
    if not private.quality_supplier_renewal_can_send(v_row.organization_id) then
      raise exception 'PERMISSION_DENIED';
    end if;
    if p_action = 'approve' then
      if v_row.status <> 'proposed' then raise exception 'SUPPLIER_CERTIFICATE_REQUEST_NOT_OPEN'; end if;
      update public.quality_supplier_certificate_requests r set approved_by = auth.uid(), approved_at = now(), updated_at = now() where r.id = p_id;
      perform private.quality_supplier_certificate_issue_link(p_id);
    elsif p_action = 'resend' then
      if v_row.status <> 'sent' then raise exception 'SUPPLIER_CERTIFICATE_REQUEST_NOT_OPEN'; end if;
      perform private.quality_supplier_certificate_issue_link(p_id);
    else
      perform private.quality_supplier_certificate_remind(p_id);
    end if;
  elsif p_action = 'cancel' then
    if not (private.quality_supplier_certificate_can_manage(v_row.organization_id) or private.quality_supplier_renewal_can_send(v_row.organization_id)) then
      raise exception 'PERMISSION_DENIED';
    end if;
    if v_row.status not in ('proposed', 'sent') then raise exception 'SUPPLIER_CERTIFICATE_REQUEST_NOT_OPEN'; end if;
    update public.quality_supplier_certificate_request_items i
       set status = 'cancelled', reviewed_by = auth.uid(), reviewed_at = now(), review_comment = coalesce(v_comment, i.review_comment), updated_at = now()
     where i.request_id = p_id and i.status = 'pending';
    update public.quality_supplier_certificate_requests r
       set status = 'cancelled', token_hash = null, reviewed_by = auth.uid(), reviewed_at = now(), review_comment = coalesce(v_comment, r.review_comment), updated_at = now()
     where r.id = p_id;
    update public.notification_outbox o set status = 'cancelled', last_error = null, updated_at = now()
     where o.notification_type = 'supplier_certificate_renewal' and o.entity_type = 'quality_supplier_certificate_request' and o.entity_id = p_id and o.status in ('pending', 'failed');
  else
    raise exception 'SUPPLIER_CERTIFICATE_REQUEST_ACTION_INVALID';
  end if;
  return jsonb_build_object('ok', true, 'action', p_action);
end;
$function$;
revoke all on function public.quality_supplier_certificate_request_action(uuid, text, text, boolean) from public, anon;
grant execute on function public.quality_supplier_certificate_request_action(uuid, text, text, boolean) to authenticated;

-- The review of one certificate (Quality managers):
--   accept    a submitted one: the certificate takes the submitted values and file, the
--             item keeps the previous ones;
--   reject    a submitted one, with a comment; with p_resend (Platform Owner or
--             supplier_renewal_sender) the certificate is asked again on the same link,
--             with the comment, and the supplier gets a reminder;
--   cancel    a pending or submitted one.
create or replace function public.quality_supplier_certificate_request_item_action(p_id uuid, p_action text, p_comment text default null, p_resend boolean default false)
returns jsonb language plpgsql security definer set search_path = ''
as $function$
declare
  v_item public.quality_supplier_certificate_request_items;
  v_request public.quality_supplier_certificate_requests;
  v_cert public.quality_supplier_certifications;
  v_comment text := nullif(btrim(coalesce(p_comment, '')), '');
begin
  v_item := (select i from public.quality_supplier_certificate_request_items i where i.id = p_id for update);
  if v_item.id is null then
    raise exception 'SUPPLIER_CERTIFICATE_REQUEST_NOT_FOUND';
  end if;
  if not private.quality_supplier_certificate_can_manage(v_item.organization_id) then
    raise exception 'PERMISSION_DENIED';
  end if;
  v_request := (select r from public.quality_supplier_certificate_requests r where r.id = v_item.request_id for update);

  if p_action = 'accept' then
    if v_item.status <> 'submitted' then raise exception 'SUPPLIER_CERTIFICATE_REQUEST_NOT_SUBMITTED'; end if;
    v_cert := (select c from public.quality_supplier_certifications c where c.id = v_item.certification_id and c.organization_id = v_item.organization_id for update);
    if v_cert.id is null then raise exception 'SUPPLIER_CERTIFICATE_NOT_FOUND'; end if;
    update public.quality_supplier_certifications c
       set certificate_type = coalesce(nullif(btrim(coalesce(v_item.certificate_type, '')), ''), c.certificate_type),
           certificate_number = coalesce(nullif(btrim(coalesce(v_item.certificate_number, '')), ''), c.certificate_number),
           issuer = coalesce(nullif(btrim(coalesce(v_item.issuer, '')), ''), c.issuer),
           expires_on = v_item.expires_on,
           attachment_id = coalesce(v_item.attachment_id, c.attachment_id),
           updated_by = auth.uid(), updated_at = now()
     where c.id = v_cert.id;
    update public.quality_supplier_certificate_request_items i
       set status = 'accepted', reviewed_by = auth.uid(), reviewed_at = now(), review_comment = v_comment,
           previous_values = jsonb_build_object('certificate_type', v_cert.certificate_type, 'title', v_cert.title, 'document_kind', v_cert.document_kind,
             'certificate_number', v_cert.certificate_number, 'issuer', v_cert.issuer, 'expires_on', v_cert.expires_on, 'attachment_id', v_cert.attachment_id),
           updated_at = now()
     where i.id = p_id;
  elsif p_action = 'reject' then
    if v_item.status <> 'submitted' then raise exception 'SUPPLIER_CERTIFICATE_REQUEST_NOT_SUBMITTED'; end if;
    if v_comment is null then raise exception 'SUPPLIER_CERTIFICATE_REJECTION_COMMENT_REQUIRED'; end if;
    if coalesce(p_resend, false) then
      if not private.quality_supplier_renewal_can_send(v_item.organization_id) then
        raise exception 'PERMISSION_DENIED';
      end if;
      if v_request.status <> 'sent' then raise exception 'SUPPLIER_CERTIFICATE_REQUEST_NOT_OPEN'; end if;
      -- Asked again on the same link: the rejected submission goes to the history.
      update public.quality_supplier_certificate_request_items i
         set status = 'pending', reviewed_by = auth.uid(), reviewed_at = now(), review_comment = v_comment,
             history = i.history || jsonb_build_object('rejectedAt', now(), 'rejectedBy', auth.uid(), 'comment', v_comment, 'submittedAt', i.submitted_at,
               'certificate_type', i.certificate_type, 'certificate_number', i.certificate_number, 'issuer', i.issuer, 'issued_on', i.issued_on,
               'expires_on', i.expires_on, 'note', i.note, 'attachment_id', i.attachment_id),
             submitted_at = null, certificate_type = null, certificate_number = null, issuer = null, issued_on = null, expires_on = null, note = null,
             attachment_id = null, updated_at = now()
       where i.id = p_id;
      perform private.quality_supplier_certificate_remind(v_item.request_id);
    else
      update public.quality_supplier_certificate_request_items i
         set status = 'rejected', reviewed_by = auth.uid(), reviewed_at = now(), review_comment = v_comment, updated_at = now()
       where i.id = p_id;
    end if;
  elsif p_action = 'cancel' then
    if v_item.status not in ('pending', 'submitted') then raise exception 'SUPPLIER_CERTIFICATE_REQUEST_NOT_OPEN'; end if;
    update public.quality_supplier_certificate_request_items i
       set status = 'cancelled', reviewed_by = auth.uid(), reviewed_at = now(), review_comment = coalesce(v_comment, i.review_comment), updated_at = now()
     where i.id = p_id;
  else
    raise exception 'SUPPLIER_CERTIFICATE_REQUEST_ACTION_INVALID';
  end if;
  perform private.quality_supplier_certificate_close_if_done(v_item.request_id);
  return jsonb_build_object('ok', true, 'action', p_action);
end;
$function$;
revoke all on function public.quality_supplier_certificate_request_item_action(uuid, text, text, boolean) from public, anon;
grant execute on function public.quality_supplier_certificate_request_item_action(uuid, text, text, boolean) to authenticated;

-- Public page (no account): what the e-mailed link shows, every certificate of the
-- request with its state (a rejected one asked again shows the comment).
create or replace function public.quality_supplier_certificate_access(p_token text)
returns jsonb language plpgsql stable security definer set search_path = ''
as $function$
declare
  v_row public.quality_supplier_certificate_requests;
  v_items jsonb;
begin
  if nullif(btrim(coalesce(p_token, '')), '') is null then
    raise exception 'SUPPLIER_CERTIFICATE_ACCESS_NOT_AVAILABLE';
  end if;
  v_row := (select r from public.quality_supplier_certificate_requests r where r.token_hash = encode(sha256(convert_to(btrim(p_token), 'UTF8')), 'hex'));
  if v_row.id is null or v_row.status not in ('sent', 'closed') then
    raise exception 'SUPPLIER_CERTIFICATE_ACCESS_NOT_AVAILABLE';
  end if;
  v_items := coalesce((select jsonb_agg(jsonb_build_object(
      'id', i.id, 'status', i.status,
      'type', coalesce(i.certificate_snapshot->>'certificate_type', c.certificate_type),
      'title', coalesce(i.certificate_snapshot->>'title', c.title),
      'number', coalesce(i.certificate_snapshot->>'certificate_number', c.certificate_number),
      'issuer', coalesce(i.certificate_snapshot->>'issuer', c.issuer),
      'expiresOn', coalesce(i.certificate_snapshot->>'expires_on', c.expires_on::text),
      'submittedAt', i.submitted_at,
      'reviewComment', case when i.status = 'pending' and i.history <> '[]'::jsonb then i.review_comment end)
      order by i.certificate_snapshot->>'expires_on', i.created_at)
    from public.quality_supplier_certificate_request_items i
    left join public.quality_supplier_certifications c on c.id = i.certification_id
    where i.request_id = v_row.id and i.status <> 'cancelled'), '[]'::jsonb);
  return jsonb_build_object(
    'status', case when v_row.status = 'sent' and v_row.token_expires_at < now() then 'expired' else v_row.status end,
    'organizationName', (select o.name from public.organizations o where o.id = v_row.organization_id),
    'supplierName', (select s.name from public.quality_suppliers s where s.id = v_row.supplier_id),
    'items', v_items,
    'expiresAt', v_row.token_expires_at);
end;
$function$;
revoke all on function public.quality_supplier_certificate_access(text) from public;
grant execute on function public.quality_supplier_certificate_access(text) to anon, authenticated;

-- The Platform Owner designates who may e-mail suppliers in an organization: the add-on
-- supplier_renewal_sender of that member (organization_member_capabilities).
create or replace function public.set_member_supplier_renewal_sender(p_organization_id uuid, p_user_id uuid, p_enabled boolean)
returns jsonb language plpgsql security definer set search_path = ''
as $function$
declare
  v_membership uuid;
begin
  if auth.uid() is null or not public.current_user_is_platform_owner() then
    raise exception 'PERMISSION_DENIED';
  end if;
  v_membership := (select m.id from public.organization_members m where m.organization_id = p_organization_id and m.user_id = p_user_id);
  if v_membership is null then
    raise exception 'MEMBER_NOT_FOUND';
  end if;
  if coalesce(p_enabled, false) then
    insert into public.organization_member_capabilities(membership_id, capability, granted_by, effect)
    values (v_membership, 'supplier_renewal_sender', auth.uid(), 'grant')
    on conflict (membership_id, capability) do update set effect = 'grant', granted_by = auth.uid();
  else
    delete from public.organization_member_capabilities c where c.membership_id = v_membership and c.capability = 'supplier_renewal_sender';
  end if;
  return jsonb_build_object('ok', true, 'enabled', coalesce(p_enabled, false));
end;
$function$;
revoke all on function public.set_member_supplier_renewal_sender(uuid, uuid, boolean) from public, anon;
grant execute on function public.set_member_supplier_renewal_sender(uuid, uuid, boolean) to authenticated;
