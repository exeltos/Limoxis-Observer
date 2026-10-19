-- Έλεγχος επικαιρότητας πρωτοκόλλων.
-- Each protocol (controlled_documents, document_type = 'protocol') is read once
-- per version by the protocol-review Edge Function: the text of its PDF/Word
-- attachments, split into sections, and the guidelines and legislation it cites.
-- A nightly pass compares it with its review date, its age and the sources it
-- cites (clinical_content_sources, legislation library) and writes suggestions.
-- Nothing changes in the document by itself: a person accepts (a new revision
-- through the usual flow), rejects with a reason, or postpones a suggestion.
-- No e-mail, no notification_outbox; every write is in system_audit_log.

-- 1. The text of one document version.
create table if not exists public.protocol_text_versions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  document_id uuid not null references public.controlled_documents(id) on delete cascade,
  document_version text,
  attachment_ids uuid[] not null default '{}',
  content_hash text,
  status text not null default 'processing' check (status in ('processing','extracted','no_text','failed','unsupported')),
  page_count integer,
  char_count integer,
  body text,
  sections jsonb not null default '{}'::jsonb check (jsonb_typeof(sections) = 'object'),
  error text,
  extractor text,
  started_at timestamptz not null default now(),
  extracted_at timestamptz,
  constraint protocol_text_versions_document_unique unique (document_id)
);
comment on table public.protocol_text_versions is
  'Κείμενο πρωτοκόλλου ανά έκδοση εγγράφου (μία γραμμή ανά controlled_documents.id): ενότητες σκοπός, ορισμοί, οδηγίες, δοσολογίες, βιβλιογραφία. status no_text = σαρωμένο PDF χωρίς κείμενο (χωρίς OCR).';
create index if not exists protocol_text_versions_org_status_idx on public.protocol_text_versions (organization_id, status);

-- 2. What the text cites.
create table if not exists public.protocol_references (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  text_version_id uuid not null references public.protocol_text_versions(id) on delete cascade,
  document_id uuid not null references public.controlled_documents(id) on delete cascade,
  kind text not null check (kind in ('organisation','legislation')),
  ref_key text not null check (length(ref_key) between 3 and 120),
  label text not null check (length(label) between 1 and 200),
  organisation text,
  cited_year integer check (cited_year is null or cited_year between 1900 and 2200),
  section text check (section is null or section in ('purpose','definitions','instructions','dosages','references')),
  context text check (context is null or length(context) <= 200),
  created_at timestamptz not null default now(),
  constraint protocol_references_unique unique (text_version_id, ref_key)
);
create index if not exists protocol_references_org_key_idx on public.protocol_references (organization_id, ref_key);
create index if not exists protocol_references_document_idx on public.protocol_references (document_id);

-- 3. The suggestions.
create table if not exists public.protocol_update_suggestions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  document_id uuid not null references public.controlled_documents(id) on delete cascade,
  reason text not null check (reason in ('review_due','source_changed','stale')),
  source_kind text check (source_kind is null or source_kind in ('clinical_source','legislation')),
  source_ref text not null default '',
  source_label text,
  source_url text,
  trigger_key text not null check (length(trigger_key) between 3 and 200),
  what_changed text not null check (length(what_changed) between 1 and 4000),
  affected_sections text[] not null default '{}',
  details jsonb not null default '{}'::jsonb,
  source_excerpt text check (source_excerpt is null or length(source_excerpt) <= 4000),
  draft_text text check (draft_text is null or length(draft_text) <= 4000),
  draft_citation text check (draft_citation is null or length(draft_citation) <= 500),
  draft_generated_at timestamptz,
  draft_attempted_at timestamptz,
  status text not null default 'open' check (status in ('open','accepted','rejected','snoozed')),
  decided_by uuid references auth.users(id) on delete set null,
  decided_at timestamptz,
  rejection_reason text check (rejection_reason is null or length(btrim(rejection_reason)) between 1 and 1000),
  snoozed_until date,
  revision_document_id uuid references public.controlled_documents(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint protocol_update_suggestions_rejected_reason check (status <> 'rejected' or rejection_reason is not null),
  constraint protocol_update_suggestions_snoozed_date check (status <> 'snoozed' or snoozed_until is not null),
  constraint protocol_update_suggestions_trigger_unique unique (document_id, reason, source_ref, trigger_key)
);
comment on table public.protocol_update_suggestions is
  'Προτάσεις ανανέωσης πρωτοκόλλων από τον νυχτερινό έλεγχο επικαιρότητας. reason: review_due, source_changed, stale. Μία ανοιχτή πρόταση ανά πρωτόκολλο, λόγο και πηγή.';
-- One open (or postponed) suggestion per protocol, reason and source.
create unique index if not exists protocol_update_suggestions_one_open
  on public.protocol_update_suggestions (document_id, reason, source_ref) where status in ('open','snoozed');
create index if not exists protocol_update_suggestions_org_status_idx on public.protocol_update_suggestions (organization_id, status);

-- 4. Read access is the access to the documents; writes go through the Edge
-- Function (service role) and the decision RPC below.
alter table public.protocol_text_versions enable row level security;
alter table public.protocol_references enable row level security;
alter table public.protocol_update_suggestions enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'protocol_text_versions' and policyname = 'protocol_text_versions_read') then
    create policy protocol_text_versions_read on public.protocol_text_versions for select to authenticated using (
      (select public.current_user_is_platform_owner())
      or coalesce(organization_id = any((select private.fast_orgs_governance('view_documents'))::uuid[]), false));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'protocol_references' and policyname = 'protocol_references_read') then
    create policy protocol_references_read on public.protocol_references for select to authenticated using (
      (select public.current_user_is_platform_owner())
      or coalesce(organization_id = any((select private.fast_orgs_governance('view_documents'))::uuid[]), false));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'protocol_update_suggestions' and policyname = 'protocol_update_suggestions_read') then
    create policy protocol_update_suggestions_read on public.protocol_update_suggestions for select to authenticated using (
      (select public.current_user_is_platform_owner())
      or coalesce(organization_id = any((select private.fast_orgs_governance('view_documents'))::uuid[]), false));
  end if;
end $$;

revoke all on public.protocol_text_versions, public.protocol_references, public.protocol_update_suggestions from anon;
revoke insert, update, delete, truncate on public.protocol_text_versions, public.protocol_references, public.protocol_update_suggestions from authenticated;
grant select on public.protocol_text_versions, public.protocol_references, public.protocol_update_suggestions to authenticated;
grant all on public.protocol_text_versions, public.protocol_references, public.protocol_update_suggestions to service_role;

-- 5. Audit: every new suggestion, every decision and every extraction result.
-- The nightly job writes as the service role (no signed-in user): actor null.
create or replace function private.audit_protocol_suggestion_change()
returns trigger language plpgsql security definer set search_path = ''
as $function$
declare
  v_actor uuid := (select auth.uid());
  v_role public.app_role;
begin
  if tg_op = 'UPDATE' and old.status is not distinct from new.status and old.snoozed_until is not distinct from new.snoozed_until
     and old.draft_text is not distinct from new.draft_text then
    return new;
  end if;
  if v_actor is not null then
    select om.role into v_role from public.organization_members om
    where om.organization_id = new.organization_id and om.user_id = v_actor and om.status = 'active'
    order by om.created_at desc limit 1;
  end if;
  insert into public.system_audit_log (organization_id, actor_user_id, actor_role, event_type, entity_type, entity_id, metadata)
  values (new.organization_id, v_actor, v_role, lower(tg_op), 'protocol_update_suggestions', new.id::text,
    jsonb_build_object('source', case when v_actor is null then 'protocol_review_job' else 'protocol_review' end,
      'operation', tg_op, 'document_id', new.document_id, 'reason', new.reason, 'source_ref', nullif(new.source_ref, ''),
      'old_status', case when tg_op = 'INSERT' then null else old.status end, 'new_status', new.status,
      'snoozed_until', new.snoozed_until, 'revision_document_id', new.revision_document_id,
      'drafted', tg_op = 'UPDATE' and old.draft_text is distinct from new.draft_text));
  return new;
end;
$function$;
revoke all on function private.audit_protocol_suggestion_change() from public, anon, authenticated;

create or replace function private.audit_protocol_text_change()
returns trigger language plpgsql security definer set search_path = ''
as $function$
begin
  if tg_op = 'UPDATE' and old.status is not distinct from new.status then
    return new;
  end if;
  insert into public.system_audit_log (organization_id, actor_user_id, actor_role, event_type, entity_type, entity_id, metadata)
  values (new.organization_id, (select auth.uid()), null, lower(tg_op), 'protocol_text_versions', new.id::text,
    jsonb_build_object('source', 'protocol_review_job', 'operation', tg_op, 'document_id', new.document_id,
      'document_version', new.document_version, 'old_status', case when tg_op = 'INSERT' then null else old.status end,
      'new_status', new.status, 'char_count', new.char_count));
  return new;
end;
$function$;
revoke all on function private.audit_protocol_text_change() from public, anon, authenticated;

create or replace trigger trg_audit_protocol_update_suggestions after insert or update on public.protocol_update_suggestions
  for each row execute function private.audit_protocol_suggestion_change();
create or replace trigger trg_audit_protocol_text_versions after insert or update on public.protocol_text_versions
  for each row execute function private.audit_protocol_text_change();

-- 6. A person decides: accept (with the new revision that was started for it),
-- reject (reason required) or postpone (a future date). Same capabilities as
-- the revision flow: manage_documents or supersede_document.
create or replace function public.protocol_suggestion_decide(
  p_suggestion_id uuid, p_decision text, p_reason text default null, p_snooze_until date default null, p_revision_document_id uuid default null)
returns jsonb language plpgsql volatile security definer set search_path = ''
as $function$
declare
  v_row public.protocol_update_suggestions;
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
begin
  if auth.uid() is null then raise exception 'PROTOCOL_SUGGESTION_AUTH_REQUIRED'; end if;
  select * into v_row from public.protocol_update_suggestions where id = p_suggestion_id for update;
  if v_row.id is null then raise exception 'PROTOCOL_SUGGESTION_UNKNOWN'; end if;
  if not (public.current_user_has_governance_capability(v_row.organization_id, 'manage_documents')
          or public.current_user_has_governance_capability(v_row.organization_id, 'supersede_document')) then
    raise exception 'PROTOCOL_SUGGESTION_NOT_ALLOWED';
  end if;
  if v_row.status not in ('open','snoozed') then raise exception 'PROTOCOL_SUGGESTION_ALREADY_DECIDED'; end if;
  if p_decision = 'accepted' then
    if p_revision_document_id is not null and not exists (
      select 1 from public.controlled_documents d
      where d.id = p_revision_document_id and d.organization_id = v_row.organization_id and d.revision_of_id = v_row.document_id) then
      raise exception 'PROTOCOL_SUGGESTION_REVISION_MISMATCH';
    end if;
    update public.protocol_update_suggestions set status = 'accepted', decided_by = auth.uid(), decided_at = now(),
      revision_document_id = p_revision_document_id, snoozed_until = null, updated_at = now() where id = v_row.id returning * into v_row;
  elsif p_decision = 'rejected' then
    if v_reason is null then raise exception 'PROTOCOL_SUGGESTION_REASON_REQUIRED'; end if;
    update public.protocol_update_suggestions set status = 'rejected', decided_by = auth.uid(), decided_at = now(),
      rejection_reason = left(v_reason, 1000), snoozed_until = null, updated_at = now() where id = v_row.id returning * into v_row;
  elsif p_decision = 'snoozed' then
    if p_snooze_until is null or p_snooze_until <= current_date then raise exception 'PROTOCOL_SUGGESTION_SNOOZE_DATE_REQUIRED'; end if;
    update public.protocol_update_suggestions set status = 'snoozed', decided_by = auth.uid(), decided_at = now(),
      snoozed_until = p_snooze_until, updated_at = now() where id = v_row.id returning * into v_row;
  else
    raise exception 'PROTOCOL_SUGGESTION_DECISION_UNKNOWN';
  end if;
  return to_jsonb(v_row);
end;
$function$;
revoke all on function public.protocol_suggestion_decide(uuid, text, text, date, uuid) from public, anon;
grant execute on function public.protocol_suggestion_decide(uuid, text, text, date, uuid) to authenticated;

-- 7. The nightly run: pg_cron asks the protocol-review Edge Function, with the
-- same Vault URL and scheduler secret as platform-scheduled-tasks.
create or replace function private.protocol_review_dispatch(p_body jsonb default '{"task":"nightly"}'::jsonb)
returns bigint language plpgsql security definer set search_path = ''
as $function$
declare
  v_url text := (select s.decrypted_secret from vault.decrypted_secrets s where s.name = 'limoxis_functions_url');
  v_secret text := (select s.decrypted_secret from vault.decrypted_secrets s where s.name = 'limoxis_scheduler_secret');
begin
  if v_url is null or v_secret is null then
    return null;
  end if;
  return net.http_post(
    url := rtrim(v_url, '/') || '/protocol-review',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-limoxis-scheduler', v_secret),
    body := coalesce(p_body, '{"task":"nightly"}'::jsonb),
    timeout_milliseconds := 300000);
end;
$function$;
revoke all on function private.protocol_review_dispatch(jsonb) from public, anon, authenticated;

-- Every night at 03:13 UTC (cron.schedule with a job name replaces an earlier one).
select cron.schedule('limoxis-protocol-review', '13 3 * * *', 'select private.protocol_review_dispatch(''{"task":"nightly"}''::jsonb);');
