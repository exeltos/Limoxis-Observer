-- Supplier certificate renewal: the hospital's identity in the e-mail and on the
-- public page. The subject leads with the hospital («[Νοσοκομείο] · Ανανέωση
-- πιστοποιητικών προμηθευτή (N)», a reminder «Υπενθύμιση · …»); the e-mail payload
-- carries the hospital's contact e-mail/phone (organizations.contact_*) and when the
-- first e-mail went out (the reminder says how many days ago); the public page also
-- gets the hospital's logo (organizations.branding.logo, a data URL, as in
-- hr_application_public). Only these expressions of the live functions change.
do $do$
declare
  d text := pg_get_functiondef('private.quality_supplier_certificate_queue_email(uuid,text,text)'::regprocedure);
  old_subject constant text := $$v_subject := case when p_kind = 'reminder' then 'Υπενθύμιση: ' else '' end || 'Ανανέωση πιστοποιητικών (' || v_count || ') · ' || coalesce(v_org_name, '');$$;
  old_payload constant text := $$'certificates', v_certificates, 'kind', p_kind, 'expiresAt', v_row.token_expires_at, 'language', 'el');$$;
begin
  if position(old_subject in d) = 0 or position(old_payload in d) = 0 then
    raise exception 'quality_supplier_certificate_queue_email: subject or payload expression not found';
  end if;
  d := replace(d, old_subject, $$v_subject := case when p_kind = 'reminder' then 'Υπενθύμιση · ' else '' end || coalesce(nullif(v_org_name, ''), 'Limoxis Observer') || ' · Ανανέωση πιστοποιητικών προμηθευτή (' || v_count || ')';$$);
  d := replace(d, old_payload, $$'certificates', v_certificates, 'kind', p_kind, 'expiresAt', v_row.token_expires_at, 'language', 'el',
    'organizationEmail', coalesce((select o.contact_email from public.organizations o where o.id = v_row.organization_id), ''),
    'organizationPhone', coalesce((select o.contact_phone from public.organizations o where o.id = v_row.organization_id), ''),
    'firstSentAt', v_row.first_sent_at);$$);
  execute d;

  d := pg_get_functiondef('public.quality_supplier_certificate_access(text)'::regprocedure);
  if position($$'organizationName', (select o.name from public.organizations o where o.id = v_row.organization_id),$$ in d) = 0 then
    raise exception 'quality_supplier_certificate_access: organizationName expression not found';
  end if;
  d := replace(d, $$'organizationName', (select o.name from public.organizations o where o.id = v_row.organization_id),$$,
    $$'organizationName', (select o.name from public.organizations o where o.id = v_row.organization_id),
    'organizationLogo', (select case when coalesce(o.branding ->> 'logo', '') like 'data:image/%' and length(o.branding ->> 'logo') <= 420000 then o.branding ->> 'logo' end from public.organizations o where o.id = v_row.organization_id),
    'organizationEmail', (select nullif(btrim(coalesce(o.contact_email, '')), '') from public.organizations o where o.id = v_row.organization_id),
    'organizationPhone', (select nullif(btrim(coalesce(o.contact_phone, '')), '') from public.organizations o where o.id = v_row.organization_id),$$);
  execute d;
end
$do$;
