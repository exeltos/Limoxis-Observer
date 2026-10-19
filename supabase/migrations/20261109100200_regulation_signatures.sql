-- Regulations: an edition is approved only with the signatures of the hospital's
-- administrator and of the infection control lead, each given by that person
-- for the exact text of the draft.
--
-- regulation_drafts.revision     goes up whenever the draft's text changes, so a
--                                signature given for an earlier text no longer counts.
-- regulation_signatures          one signature: the role it is given as, the draft
--                                revision it is for, the signer's name, title and
--                                handwritten signature (PNG); the edition it went
--                                into once approved. Written only by regulation_sign.
-- regulations.signatures,
-- regulation_editions.signatures the signatures of the approved edition, kept with it.

alter table public.regulation_drafts add column if not exists revision integer not null default 1;
alter table public.regulations add column if not exists signatures jsonb not null default '[]'::jsonb;
alter table public.regulation_editions add column if not exists signatures jsonb not null default '[]'::jsonb;

create or replace function private.regulation_draft_revision()
returns trigger language plpgsql set search_path = ''
as $$
begin
  if new.content is distinct from old.content or (new.active and not old.active) then new.revision := old.revision + 1; end if;
  return new;
end;
$$;
create or replace trigger trg_regulation_drafts_revision before update on public.regulation_drafts
  for each row execute function private.regulation_draft_revision();

create table if not exists public.regulation_signatures (
  id uuid primary key default gen_random_uuid(),
  regulation_id uuid not null,
  organization_id uuid not null,
  role text not null check (role in ('administrator','infection_lead')),
  draft_revision integer not null,
  signer_name text not null check (length(btrim(signer_name)) > 1),
  signer_title text,
  image text check (image is null or (image like 'data:image/png;base64,%' and length(image) < 300000)),
  signed_by uuid default auth.uid(),
  signed_at timestamptz not null default now(),
  edition integer,
  foreign key (regulation_id, organization_id) references public.regulations(id, organization_id) on delete cascade
);
create index if not exists regulation_signatures_regulation_idx on public.regulation_signatures (regulation_id, edition, role, signed_at desc);
alter table public.regulation_signatures enable row level security;
create policy regulation_signatures_read on public.regulation_signatures for select to authenticated
  using (public.is_org_member(organization_id) or public.current_user_is_platform_owner());
revoke all on public.regulation_signatures from anon, authenticated;
grant select on public.regulation_signatures to authenticated;

-- Who signs as what: the hospital administrator, the infection control lead.
create or replace function private.can_sign_regulation(p_org uuid, p_role text)
returns boolean language sql stable security definer set search_path = ''
as $$
  select public.current_user_is_platform_owner()
    or (p_role = 'administrator' and public.current_user_has_org_role(p_org, array['hospital_admin'::public.app_role]))
    or (p_role = 'infection_lead' and public.current_user_has_org_role(p_org, array['infection_control_lead'::public.app_role]));
$$;
revoke all on function private.can_sign_regulation(uuid, text) from public, anon;
grant execute on function private.can_sign_regulation(uuid, text) to authenticated;

-- Signs the regulation's draft, as it stands now, in the given role.
create or replace function public.regulation_sign(p_regulation_id uuid, p_role text, p_name text, p_title text, p_image text)
returns jsonb language plpgsql volatile security definer set search_path = ''
as $function$
declare
  v_regulation public.regulations;
  v_draft public.regulation_drafts;
  v_id uuid;
begin
  if auth.uid() is null then raise exception 'REGULATION_NOT_ALLOWED'; end if;
  select * into v_regulation from public.regulations where id = p_regulation_id;
  if v_regulation.id is null or not private.can_sign_regulation(v_regulation.organization_id, p_role) then raise exception 'REGULATION_NOT_ALLOWED'; end if;
  select * into v_draft from public.regulation_drafts where regulation_id = p_regulation_id and active;
  if v_draft.regulation_id is null then raise exception 'REGULATION_NO_DRAFT'; end if;
  insert into public.regulation_signatures (regulation_id, organization_id, role, draft_revision, signer_name, signer_title, image)
    values (v_regulation.id, v_regulation.organization_id, p_role, v_draft.revision, btrim(p_name), nullif(btrim(coalesce(p_title, '')), ''), p_image)
    returning id into v_id;
  return jsonb_build_object('id', v_id, 'revision', v_draft.revision);
end;
$function$;
revoke all on function public.regulation_sign(uuid, text, text, text, text) from public, anon;
grant execute on function public.regulation_sign(uuid, text, text, text, text) to authenticated;

-- Approval now needs both signatures for the draft's current text; they are kept
-- with the edition.
create or replace function public.regulation_approve(p_regulation_id uuid, p_change_note text, p_issued_on date, p_approved_by_name text)
returns integer language plpgsql volatile security definer set search_path = ''
as $function$
declare
  v_regulation public.regulations;
  v_draft public.regulation_drafts;
  v_edition integer;
  v_signatures jsonb;
begin
  select * into v_regulation from public.regulations where id = p_regulation_id for update;
  if v_regulation.id is null or not private.can_manage_regulations(v_regulation.organization_id) then raise exception 'REGULATION_NOT_ALLOWED'; end if;
  select * into v_draft from public.regulation_drafts where regulation_id = p_regulation_id and active;
  if v_draft.regulation_id is null then raise exception 'REGULATION_NO_DRAFT'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('role', s.role, 'name', s.signer_name, 'title', s.signer_title, 'image', s.image, 'signedAt', s.signed_at, 'signedBy', s.signed_by) order by s.role), '[]'::jsonb)
    into v_signatures
    from (select distinct on (role) * from public.regulation_signatures
          where regulation_id = v_regulation.id and edition is null and draft_revision = v_draft.revision
          order by role, signed_at desc) s;
  if jsonb_array_length(v_signatures) < 2 then raise exception 'REGULATION_SIGNATURES_MISSING'; end if;
  v_edition := v_regulation.edition + 1;
  insert into public.regulation_editions (regulation_id, organization_id, edition, content, change_note, issued_on, template_version, approved_by, approved_by_name, signatures)
    values (v_regulation.id, v_regulation.organization_id, v_edition, v_draft.content, nullif(btrim(coalesce(p_change_note, '')), ''), coalesce(p_issued_on, current_date), v_regulation.template_version, auth.uid(), nullif(btrim(coalesce(p_approved_by_name, '')), ''), v_signatures);
  update public.regulations set content = v_draft.content, edition = v_edition, issued_on = coalesce(p_issued_on, current_date),
    approved_at = now(), approved_by = auth.uid(), approved_by_name = nullif(btrim(coalesce(p_approved_by_name, '')), ''), signatures = v_signatures
    where id = v_regulation.id;
  update public.regulation_signatures set edition = v_edition where regulation_id = v_regulation.id and edition is null and draft_revision = v_draft.revision;
  update public.regulation_drafts set active = false, change_note = null where regulation_id = v_regulation.id;
  return v_edition;
end;
$function$;
revoke all on function public.regulation_approve(uuid, text, date, text) from public, anon;
grant execute on function public.regulation_approve(uuid, text, date, text) to authenticated;
