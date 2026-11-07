-- Suppliers in the nightly sync with the earlier register (FileMaker): its suppliers (Contacts), their certificates
-- (Contacts Documents), contact persons (Contacts Contact) and evaluations (Supplier Evaluation). Only what is
-- missing is added; what the platform holds is never changed. A supplier's code is SUP-<FileMaker id − 22220000>.

-- The kind of a certificate from its title.
create or replace function private.fm_certificate_type(p_title text)
returns text language sql immutable set search_path to '' as $$
  select case
    when upper(coalesce(p_title, '')) ~ '13485' then 'ISO 13485'
    when upper(coalesce(p_title, '')) ~ '9001' then 'ISO 9001'
    when upper(coalesce(p_title, '')) ~ '14001' then 'ISO 14001'
    when upper(coalesce(p_title, '')) ~ '45001' then 'ISO 45001'
    when upper(coalesce(p_title, '')) ~ '22000|HACCP|FSSC' then 'ISO 22000 / HACCP'
    when upper(coalesce(p_title, '')) ~ '15189|17025|ΔΙΑΠΙΣΤ' then 'ISO 15189 / ISO 17025'
    when upper(coalesce(p_title, '')) ~ 'ΔΥ8' then 'Βεβαίωση ΔΥ8δ/1348/04'
    when upper(coalesce(p_title, '')) ~ '(^|[^A-Z])DOC([^A-Z]|$)|ΔΗΛΩΣΗ|DECLARATION' then 'Δήλωση συμμόρφωσης'
    when upper(coalesce(p_title, '')) ~ 'ΑΔΕΙΑ' then 'Άδεια λειτουργίας'
    when upper(coalesce(p_title, '')) ~ '(^|[^A-Z])(CE|EC|MDD|MDR)([^A-Z]|$)' then 'CE'
    else 'Πιστοποιητικό' end
$$;

create or replace function private.fm_sync_suppliers()
returns integer language plpgsql security definer set search_path to '' as $fn$
declare v_org uuid := private.fm_org(); v_by uuid := private.fm_importer(); v_count integer := 0; v_rows integer;
begin
  if v_org is null then return 0; end if;

  -- New suppliers with a name that the platform does not already hold (by code or by name).
  insert into public.quality_suppliers (organization_id, code, name, legal_name, category, criticality, status, approval_status,
    tax_id, phone, email, address, city, products, evaluation_months, created_by)
  select v_org, 'SUP-' || ((r.data->>'Contact ID')::bigint - 22220000), trim(r.data->>'Contact Company Name'),
         nullif(trim(r.data->>'Contact Company Title'), ''), k.category,
         case when k.category in ('consumables', 'laboratory', 'kitchen') then 'high' else 'medium' end,
         case when r.data->>'Contact Status' = 'Ανενεργή Επαφή' then 'inactive' else 'active' end,
         case r.data->>'Contact Approval Status' when 'Εγκεκριμένος' then 'approved' when 'Απορρίφθηκε' then 'rejected' else null end,
         nullif(trim(r.data->>'Contact VAT'), ''), nullif(trim(r.data->>'Contact Phone'), ''), nullif(trim(r.data->>'Contact email'), ''),
         nullif(trim(r.data->>'Contact Address'), ''), nullif(trim(r.data->>'Contact City'), ''), nullif(trim(r.data->>'Contact Activity'), ''),
         12, v_by
  from public.fm_stage_records r
  cross join lateral (select case
      when r.data->>'All contact' ~ 'Κουζίν' or nullif(r.data->>'contact kitchen', '') is not null then 'kitchen'
      when nullif(r.data->>'contact LAB', '') is not null then 'laboratory'
      when r.data->>'Contact Type' = 'Φορέας Πιστοποίησης' then 'certification_body'
      when r.data->>'Contact Type' = 'Υπεργολάβος' then 'services'
      else 'consumables' end as category) k
  where r.base_table = 'Contacts' and nullif(trim(r.data->>'Contact Company Name'), '') is not null
    and (r.data->>'Contact ID') ~ '^\d+$' and (r.data->>'Contact ID')::bigint > 22220000
    -- not already there: the same code, the same name, or one name the start of the other («Metrisis» /
    -- «METRISIS ΔΙΑΚΡΙΒΩΣΕΙΣ Ι.Κ.Ε.», «Del Monde» / «DEL»)
    and not exists (select 1 from public.quality_suppliers s
                    cross join lateral (select upper(regexp_replace(s.name, '[^[:alnum:]]', '', 'g')) as other,
                                               upper(regexp_replace(r.data->>'Contact Company Name', '[^[:alnum:]]', '', 'g')) as key) n
                    where s.organization_id = v_org
                      and (s.code = 'SUP-' || ((r.data->>'Contact ID')::bigint - 22220000)
                           or (length(n.key) >= 3 and length(n.other) >= 3 and (n.key like n.other || '%' or n.other like n.key || '%'))));
  get diagnostics v_rows = row_count; v_count := v_count + v_rows;

  -- Certificates with an expiry date (each title and date once), linked to the file copied from the register.
  insert into public.quality_supplier_certifications (organization_id, supplier_id, certificate_type, title, document_kind, expires_on, attachment_id, created_by)
  select distinct on (s.id, upper(trim(regexp_replace(d.data->>'Contact Doc Title', '\s+', ' ', 'g'))), (d.data->>'Contact Doc Expiration')::date)
         v_org, s.id, private.fm_certificate_type(d.data->>'Contact Doc Title'), trim(regexp_replace(d.data->>'Contact Doc Title', '\s+', ' ', 'g')),
         case private.fm_certificate_type(d.data->>'Contact Doc Title') when 'Δήλωση συμμόρφωσης' then 'declaration' when 'Άδεια λειτουργίας' then 'licence' else 'certificate' end,
         (d.data->>'Contact Doc Expiration')::date, f.attachment_id, v_by
  from public.fm_stage_records d
  join public.quality_suppliers s on s.organization_id = v_org and s.code = 'SUP-' || ((d.data->>'Contact ID')::bigint - 22220000)
  left join lateral (select f.attachment_id from public.fm_stage_files f where f.base_table = d.base_table and f.record_id = d.record_id and f.attachment_id is not null limit 1) f on true
  where d.base_table = 'Contacts Documents' and (d.data->>'Contact ID') ~ '^\d+$' and nullif(trim(d.data->>'Contact Doc Title'), '') is not null
    and nullif(d.data->>'Contact Doc Expiration', '') is not null
    and not exists (select 1 from public.quality_supplier_certifications c where c.supplier_id = s.id and c.expires_on = (d.data->>'Contact Doc Expiration')::date
                    and upper(trim(regexp_replace(c.title, '\s+', ' ', 'g'))) = upper(trim(regexp_replace(d.data->>'Contact Doc Title', '\s+', ' ', 'g'))))
  order by s.id, upper(trim(regexp_replace(d.data->>'Contact Doc Title', '\s+', ' ', 'g'))), (d.data->>'Contact Doc Expiration')::date, f.attachment_id nulls last;
  get diagnostics v_rows = row_count; v_count := v_count + v_rows;

  -- Contact persons with a name, once per supplier and name.
  insert into public.quality_supplier_contacts (organization_id, supplier_id, position, full_name, job_title, phone, email, notes, created_by)
  select v_org, s.id, coalesce((select max(c.position) + 1 from public.quality_supplier_contacts c where c.supplier_id = s.id), 0),
         n.full_name, nullif(trim(r.data->>'Contact Cont Position'), ''), nullif(trim(r.data->>'Contact Cont phone'), ''),
         nullif(trim(r.data->>'Contact Cont email'), ''), nullif(trim(r.data->>'Contact Cont notes'), ''), v_by
  from public.fm_stage_records r
  cross join lateral (select nullif(trim(regexp_replace(concat_ws(' ', r.data->>'Contact Cont Name', r.data->>'Contact Cont Surname'), '\s+', ' ', 'g')), '') as full_name) n
  join public.quality_suppliers s on s.organization_id = v_org and s.code = 'SUP-' || ((r.data->>'Contact ID')::bigint - 22220000)
  where r.base_table = 'Contacts Contact' and (r.data->>'Contact ID') ~ '^\d+$' and (r.data->>'Contact ID')::bigint > 22220000 and n.full_name is not null
    and not exists (select 1 from public.quality_supplier_contacts c where c.supplier_id = s.id
                    and upper(trim(regexp_replace(c.full_name, '\s+', ' ', 'g'))) = upper(n.full_name));
  get diagnostics v_rows = row_count; v_count := v_count + v_rows;

  -- Evaluations with a total: on the template of their form, the total as % of its scale (kitchen 1–5, the others
  -- 1–10; a kitchen total above 5 was entered on 10). The scores per criterion are not in the register's reading.
  insert into public.quality_supplier_evaluations (organization_id, supplier_id, evaluated_on, evaluator, notes, template_id, template_name, template_version,
    pass_threshold, conditional_threshold, score_scale, total_score, result, criteria_scores, period_year, source, created_by, updated_by)
  select v_org, s.id, e.day, nullif(trim(r.data->>'Creation Account Name'), ''),
         'Συνολική βαθμολογία ' || replace(e.total::text, '.', ',') || ' / ' || e.scale || ' (από το προηγούμενο μητρώο)· οι βαθμοί ανά κριτήριο δεν καταγράφηκαν.',
         t.id, t.name, t.version, t.pass_threshold, t.conditional_threshold, 5, round(e.total / e.scale * 100, 1),
         case when e.total / e.scale * 100 >= t.pass_threshold then 'approved' when e.total / e.scale * 100 >= t.conditional_threshold then 'conditional' else 'rejected' end,
         'not_recorded', extract(year from e.day)::int, 'filemaker', v_by, v_by
  from public.fm_stage_records r
  cross join lateral (select nullif(r.data->>'Evaluation Date', '')::date as day, nullif(r.data->>'Average Weight Score', '')::numeric as total,
      case when r.data->>'Evaluation Criteria LK' ~ '^Ποιότητα προσφερόμενων' and coalesce(nullif(r.data->>'Average Weight Score', '')::numeric, 0) <= 5 then 5 else 10 end as scale,
      case when r.data->>'Evaluation Criteria LK' ~ '^Ποιότητα προσφερόμενων' then 'Προμηθευτής Κουζίνας'
           when r.data->>'Evaluation Criteria LK' ~ 'Υπηρεσιών' then 'Προμηθευτής Υπηρεσιών/Υπεργολάβος' else 'Προμηθευτής Προϊόντων' end as template) e
  join public.quality_suppliers s on s.organization_id = v_org and s.code = 'SUP-' || ((r.data->>'Evaluation Contact ID')::bigint - 22220000)
  join public.quality_supplier_eval_templates t on t.organization_id = v_org and t.name = e.template
  where r.base_table = 'Supplier Evaluation' and (r.data->>'Evaluation Contact ID') ~ '^\d+$'
    and e.day > date '2020-01-01' and e.total > 0
    and not exists (select 1 from public.quality_supplier_evaluations x where x.supplier_id = s.id and x.evaluated_on = e.day);
  get diagnostics v_rows = row_count; v_count := v_count + v_rows;
  return v_count;
end;
$fn$;

-- The four supplier tables are fetched again every night, and the sync adds what is new.
create or replace function private.fm_sync_tables()
returns text[] language sql immutable set search_path to '' as $$
  select array['PerformedControls', 'People', 'Departments', 'Controls', 'Training', 'Training Participants', 'Meeting_REVIEWS', 'Μeeting_Decisions',
               'Commitees', 'Commitees_REVIEWS', 'Commitees_Decisions', 'IncidentManagement', 'Death', 'Deviations',
               'Indicators TEP', 'Indicators Α.Τ', 'Indicators Ενδοσκοπικό', 'Indicators eyelab', 'Indicator ΜΕΝΝ',
               'Contacts', 'Contacts Documents', 'Contacts Contact', 'Supplier Evaluation']
$$;

-- private.fm_sync_all() also returns 'suppliers': private.fm_sync_suppliers() (applied in place on the function).

-- Applied on 2026-11-06: 'suppliers', private.fm_sync_suppliers() added to private.fm_sync_all() after 'deviations';
-- run once, it added 54 certificates of ΙΑΣΩ with an expiry date that had come over only as files (two of them
-- duplicates, titles ending in a hidden space; removed by docs/sql/supplier_certificate_duplicates.sql).
