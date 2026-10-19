-- Renewal of expired supplier certificates by e-mail.
--
-- quality_supplier_certificate_requests   one request per certificate: who it goes to,
--                                         who approved it, the link (only the SHA-256 of
--                                         the random single-use token is stored, valid
--                                         14 days), what the supplier submitted and the
--                                         review. On acceptance the certificate row takes
--                                         the new values and the request keeps the previous
--                                         ones (previous_values).
--
-- Flow: proposed (by a Quality reader) → approved & sent (Hospital Admin / Quality
-- Manager / manage_quality, or the Platform Owner) → submitted (the supplier, from the
-- public page, through the edge function supplier-certificate-submit) → accepted /
-- rejected (Quality). Nothing is e-mailed without that approval.
-- Reading: Quality (quality_read_orgs) and the Platform Owner. No direct writes: every
-- change goes through the functions below (the edge function uses the service role).
-- No SELECT/EXECUTE/RETURNING ... INTO (the Supabase SQL editor rewrites those).

create table if not exists public.quality_supplier_certificate_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  supplier_id uuid not null,
  certification_id uuid not null references public.quality_supplier_certifications(id) on delete cascade,
  recipient_email text not null check (recipient_email ~ '^[^\s@]+@[^\s@]+\.[^\s@]+$'),
  status text not null default 'proposed' check (status in ('proposed', 'approved', 'sent', 'submitted', 'accepted', 'rejected', 'cancelled')),
  certificate_snapshot jsonb not null default '{}'::jsonb,
  requested_by uuid references auth.users(id) on delete set null,
  requested_at timestamptz not null default now(),
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  token_hash text unique,
  token_expires_at timestamptz,
  sent_at timestamptz,
  send_count integer not null default 0,
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
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (supplier_id, organization_id) references public.quality_suppliers(id, organization_id) on delete cascade
);
create index if not exists quality_supplier_certificate_requests_org_idx on public.quality_supplier_certificate_requests (organization_id, status);
create index if not exists quality_supplier_certificate_requests_supplier_idx on public.quality_supplier_certificate_requests (supplier_id, organization_id);
create index if not exists quality_supplier_certificate_requests_certification_idx on public.quality_supplier_certificate_requests (certification_id);
create index if not exists quality_supplier_certificate_requests_attachment_idx on public.quality_supplier_certificate_requests (attachment_id);
-- One open request per certificate.
create unique index if not exists quality_supplier_certificate_requests_open_idx on public.quality_supplier_certificate_requests (certification_id)
  where status in ('proposed', 'approved', 'sent', 'submitted');
comment on table public.quality_supplier_certificate_requests is 'E-mailed requests to a supplier to upload the renewal of an expired certificate; the review replaces the certificate.';

alter table public.quality_supplier_certificate_requests enable row level security;
drop policy if exists quality_supplier_certificate_requests_read on public.quality_supplier_certificate_requests;
create policy quality_supplier_certificate_requests_read on public.quality_supplier_certificate_requests
  for select to authenticated using (
    (select public.current_user_is_platform_owner())
    or organization_id = any ((select private.current_user_quality_read_orgs())::uuid[]));
revoke all on public.quality_supplier_certificate_requests from anon;
revoke insert, update, delete on public.quality_supplier_certificate_requests from authenticated;
grant select on public.quality_supplier_certificate_requests to authenticated;

-- Whether the caller manages Quality in the organization (Platform Owner included).
create or replace function private.quality_supplier_certificate_can_manage(p_organization_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $function$
  select public.current_user_is_platform_owner() or p_organization_id = any (private.current_user_quality_manage_orgs());
$function$;
revoke all on function private.quality_supplier_certificate_can_manage(uuid) from public, anon;
grant execute on function private.quality_supplier_certificate_can_manage(uuid) to authenticated;

-- A fresh link for one request (only its hash is stored) and the outbox row.
create or replace function private.quality_supplier_certificate_issue_link(p_id uuid)
returns void language plpgsql security definer set search_path = ''
as $function$
declare
  v_row public.quality_supplier_certificate_requests;
  v_token text := 'SCR-' || replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
  v_supplier public.quality_suppliers;
  v_cert public.quality_supplier_certifications;
  v_org_name text;
  v_payload jsonb;
  v_subject text;
  v_outbox uuid;
begin
  v_row := (select r from public.quality_supplier_certificate_requests r where r.id = p_id);
  if v_row.id is null or v_row.status not in ('proposed', 'approved', 'sent') then
    raise exception 'SUPPLIER_CERTIFICATE_REQUEST_NOT_OPEN';
  end if;
  if not private.quality_supplier_certificate_can_manage(v_row.organization_id) then
    raise exception 'PERMISSION_DENIED';
  end if;
  v_supplier := (select s from public.quality_suppliers s where s.id = v_row.supplier_id);
  v_cert := (select c from public.quality_supplier_certifications c where c.id = v_row.certification_id);
  v_org_name := (select o.name from public.organizations o where o.id = v_row.organization_id);

  update public.quality_supplier_certificate_requests r
     set status = 'sent', token_hash = encode(sha256(convert_to(v_token, 'UTF8')), 'hex'), token_expires_at = now() + interval '14 days',
         sent_at = now(), send_count = r.send_count + 1, updated_at = now()
   where r.id = p_id;

  v_subject := 'Ανανέωση πιστοποιητικού: ' || coalesce(v_cert.certificate_type, '') || ' · ' || coalesce(v_org_name, '');
  v_payload := jsonb_build_object('path', '/supplier-certificate/' || v_token, 'organizationName', coalesce(v_org_name, ''),
    'supplierName', coalesce(v_supplier.name, ''), 'certificateType', coalesce(v_cert.certificate_type, ''), 'certificateTitle', coalesce(v_cert.title, ''),
    'certificateNumber', coalesce(v_cert.certificate_number, ''), 'certificateExpiresOn', v_cert.expires_on,
    'expiresAt', now() + interval '14 days', 'language', 'el');
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
revoke all on function private.quality_supplier_certificate_issue_link(uuid) from public, anon, authenticated;

-- Creates the requests. p_items: [{certification_id, recipient_email}]. With p_send
-- (Quality managers only) each request is approved and e-mailed at once; without it
-- the request is only proposed (any Quality reader) and waits for that approval.
-- A certificate that already has an open request, or no valid e-mail, is skipped.
create or replace function public.quality_supplier_certificate_requests_create(p_organization_id uuid, p_items jsonb, p_send boolean default true)
returns jsonb language plpgsql security definer set search_path = ''
as $function$
declare
  v_items jsonb := case when jsonb_typeof(p_items) = 'array' then p_items else '[]'::jsonb end;
  v_item jsonb;
  v_cert public.quality_supplier_certifications;
  v_email text;
  v_id uuid;
  v_created integer := 0;
  v_skipped jsonb := '[]'::jsonb;
begin
  if p_organization_id is null then
    raise exception 'PERMISSION_DENIED';
  end if;
  if coalesce(p_send, true) then
    if not private.quality_supplier_certificate_can_manage(p_organization_id) then
      raise exception 'PERMISSION_DENIED';
    end if;
  elsif not (public.current_user_is_platform_owner() or p_organization_id = any (private.current_user_quality_read_orgs())) then
    raise exception 'PERMISSION_DENIED';
  end if;
  if jsonb_array_length(v_items) = 0 or jsonb_array_length(v_items) > 200 then
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
    if exists (select 1 from public.quality_supplier_certificate_requests r
               where r.certification_id = v_cert.id and r.status in ('proposed', 'approved', 'sent', 'submitted')) then
      v_skipped := v_skipped || jsonb_build_object('certification_id', v_cert.id, 'reason', 'open');
      continue;
    end if;
    v_id := gen_random_uuid();
    insert into public.quality_supplier_certificate_requests(id, organization_id, supplier_id, certification_id, recipient_email, status, certificate_snapshot,
      requested_by, approved_by, approved_at)
    values (v_id, p_organization_id, v_cert.supplier_id, v_cert.id, v_email, case when coalesce(p_send, true) then 'approved' else 'proposed' end,
      jsonb_build_object('certificate_type', v_cert.certificate_type, 'title', v_cert.title, 'document_kind', v_cert.document_kind,
        'certificate_number', v_cert.certificate_number, 'issuer', v_cert.issuer, 'expires_on', v_cert.expires_on, 'attachment_id', v_cert.attachment_id),
      auth.uid(), case when coalesce(p_send, true) then auth.uid() end, case when coalesce(p_send, true) then now() end);
    if coalesce(p_send, true) then
      perform private.quality_supplier_certificate_issue_link(v_id);
    end if;
    v_created := v_created + 1;
  end loop;
  return jsonb_build_object('created', v_created, 'sent', case when coalesce(p_send, true) then v_created else 0 end, 'skipped', v_skipped);
end;
$function$;
revoke all on function public.quality_supplier_certificate_requests_create(uuid, jsonb, boolean) from public, anon;
grant execute on function public.quality_supplier_certificate_requests_create(uuid, jsonb, boolean) to authenticated;

-- Quality's actions on one request (managers only):
--   approve   a proposed request: approved and e-mailed;
--   resend    a sent one: a new link (the previous one stops working);
--   cancel    a proposed, sent or submitted one: the link stops working;
--   accept    a submitted one: the certificate takes the submitted values and file,
--             the request keeps the previous ones;
--   reject    a submitted one, with a comment; with p_resend a new request (and link)
--             goes to the same address.
create or replace function public.quality_supplier_certificate_request_action(p_id uuid, p_action text, p_comment text default null, p_resend boolean default false)
returns jsonb language plpgsql security definer set search_path = ''
as $function$
declare
  v_row public.quality_supplier_certificate_requests;
  v_cert public.quality_supplier_certifications;
  v_comment text := nullif(btrim(coalesce(p_comment, '')), '');
  v_new uuid;
begin
  v_row := (select r from public.quality_supplier_certificate_requests r where r.id = p_id for update);
  if v_row.id is null then
    raise exception 'SUPPLIER_CERTIFICATE_REQUEST_NOT_FOUND';
  end if;
  if not private.quality_supplier_certificate_can_manage(v_row.organization_id) then
    raise exception 'PERMISSION_DENIED';
  end if;

  if p_action = 'approve' then
    if v_row.status <> 'proposed' then raise exception 'SUPPLIER_CERTIFICATE_REQUEST_NOT_OPEN'; end if;
    update public.quality_supplier_certificate_requests r set status = 'approved', approved_by = auth.uid(), approved_at = now(), updated_at = now() where r.id = p_id;
    perform private.quality_supplier_certificate_issue_link(p_id);
  elsif p_action = 'resend' then
    if v_row.status <> 'sent' then raise exception 'SUPPLIER_CERTIFICATE_REQUEST_NOT_OPEN'; end if;
    perform private.quality_supplier_certificate_issue_link(p_id);
  elsif p_action = 'cancel' then
    if v_row.status not in ('proposed', 'approved', 'sent', 'submitted') then raise exception 'SUPPLIER_CERTIFICATE_REQUEST_NOT_OPEN'; end if;
    update public.quality_supplier_certificate_requests r
       set status = 'cancelled', token_hash = null, reviewed_by = auth.uid(), reviewed_at = now(), review_comment = coalesce(v_comment, r.review_comment), updated_at = now()
     where r.id = p_id;
    update public.notification_outbox o set status = 'cancelled', last_error = null, updated_at = now()
     where o.notification_type = 'supplier_certificate_renewal' and o.entity_type = 'quality_supplier_certificate_request' and o.entity_id = p_id and o.status in ('pending', 'failed');
  elsif p_action = 'accept' then
    if v_row.status <> 'submitted' then raise exception 'SUPPLIER_CERTIFICATE_REQUEST_NOT_SUBMITTED'; end if;
    v_cert := (select c from public.quality_supplier_certifications c where c.id = v_row.certification_id and c.organization_id = v_row.organization_id for update);
    if v_cert.id is null then raise exception 'SUPPLIER_CERTIFICATE_NOT_FOUND'; end if;
    update public.quality_supplier_certifications c
       set certificate_type = coalesce(nullif(btrim(coalesce(v_row.certificate_type, '')), ''), c.certificate_type),
           certificate_number = coalesce(nullif(btrim(coalesce(v_row.certificate_number, '')), ''), c.certificate_number),
           issuer = coalesce(nullif(btrim(coalesce(v_row.issuer, '')), ''), c.issuer),
           expires_on = v_row.expires_on,
           attachment_id = coalesce(v_row.attachment_id, c.attachment_id),
           updated_by = auth.uid(), updated_at = now()
     where c.id = v_cert.id;
    update public.quality_supplier_certificate_requests r
       set status = 'accepted', token_hash = null, reviewed_by = auth.uid(), reviewed_at = now(), review_comment = v_comment,
           previous_values = jsonb_build_object('certificate_type', v_cert.certificate_type, 'title', v_cert.title, 'document_kind', v_cert.document_kind,
             'certificate_number', v_cert.certificate_number, 'issuer', v_cert.issuer, 'expires_on', v_cert.expires_on, 'attachment_id', v_cert.attachment_id),
           updated_at = now()
     where r.id = p_id;
  elsif p_action = 'reject' then
    if v_row.status <> 'submitted' then raise exception 'SUPPLIER_CERTIFICATE_REQUEST_NOT_SUBMITTED'; end if;
    if v_comment is null then raise exception 'SUPPLIER_CERTIFICATE_REJECTION_COMMENT_REQUIRED'; end if;
    update public.quality_supplier_certificate_requests r
       set status = 'rejected', token_hash = null, reviewed_by = auth.uid(), reviewed_at = now(), review_comment = v_comment, updated_at = now()
     where r.id = p_id;
    if coalesce(p_resend, false) then
      v_new := gen_random_uuid();
      insert into public.quality_supplier_certificate_requests(id, organization_id, supplier_id, certification_id, recipient_email, status, certificate_snapshot,
        requested_by, approved_by, approved_at, review_comment)
      values (v_new, v_row.organization_id, v_row.supplier_id, v_row.certification_id, v_row.recipient_email, 'approved', v_row.certificate_snapshot,
        auth.uid(), auth.uid(), now(), v_comment);
      perform private.quality_supplier_certificate_issue_link(v_new);
    end if;
  else
    raise exception 'SUPPLIER_CERTIFICATE_REQUEST_ACTION_INVALID';
  end if;
  return jsonb_build_object('ok', true, 'action', p_action, 'newRequestId', v_new);
end;
$function$;
revoke all on function public.quality_supplier_certificate_request_action(uuid, text, text, boolean) from public, anon;
grant execute on function public.quality_supplier_certificate_request_action(uuid, text, text, boolean) to authenticated;

-- Public page (no account): what the e-mailed link shows. A rejected submission with a
-- new link shows the comment on the new one.
create or replace function public.quality_supplier_certificate_access(p_token text)
returns jsonb language plpgsql stable security definer set search_path = ''
as $function$
declare
  v_row public.quality_supplier_certificate_requests;
  v_cert public.quality_supplier_certifications;
begin
  if nullif(btrim(coalesce(p_token, '')), '') is null then
    raise exception 'SUPPLIER_CERTIFICATE_ACCESS_NOT_AVAILABLE';
  end if;
  v_row := (select r from public.quality_supplier_certificate_requests r where r.token_hash = encode(sha256(convert_to(btrim(p_token), 'UTF8')), 'hex'));
  if v_row.id is null then
    raise exception 'SUPPLIER_CERTIFICATE_ACCESS_NOT_AVAILABLE';
  end if;
  v_cert := (select c from public.quality_supplier_certifications c where c.id = v_row.certification_id);
  return jsonb_build_object(
    'status', case when v_row.status = 'sent' and v_row.token_expires_at < now() then 'expired' else v_row.status end,
    'organizationName', (select o.name from public.organizations o where o.id = v_row.organization_id),
    'supplierName', (select s.name from public.quality_suppliers s where s.id = v_row.supplier_id),
    'certificate', jsonb_build_object(
      'type', coalesce(v_row.certificate_snapshot->>'certificate_type', v_cert.certificate_type),
      'title', coalesce(v_row.certificate_snapshot->>'title', v_cert.title),
      'number', coalesce(v_row.certificate_snapshot->>'certificate_number', v_cert.certificate_number),
      'issuer', coalesce(v_row.certificate_snapshot->>'issuer', v_cert.issuer),
      'expiresOn', coalesce(v_row.certificate_snapshot->>'expires_on', v_cert.expires_on::text)),
    'expiresAt', v_row.token_expires_at, 'submittedAt', v_row.submitted_at,
    'reviewComment', case when v_row.status in ('sent', 'rejected') then v_row.review_comment end);
end;
$function$;
revoke all on function public.quality_supplier_certificate_access(text) from public;
grant execute on function public.quality_supplier_certificate_access(text) to anon, authenticated;
