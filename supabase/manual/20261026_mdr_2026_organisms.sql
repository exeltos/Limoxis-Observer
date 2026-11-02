-- MDR 2026: συμπλήρωση μικροβίου και σημείου λήψης στα 16 δείγματα με ένδειξη πολυανθεκτικού στελέχους (στοιχεία του Εργαστηρίου, αρχείο «MDR 2026»).
-- Τα επικυρωμένα αποτελέσματα είναι αμετάβλητα: η συμπλήρωση γίνεται ως ΔΙΟΡΘΩΣΗ (νέο αποτέλεσμα amended_from = το αρχικό),
-- όπως στην εφαρμογή (χωρίς προσωπικό υπογράφοντα, όπως και τα εισαχθέντα αποτελέσματα). Το σημείο λήψης γράφεται στο source_site του δείγματος και σημειώνεται η προέλευση στο clinical_context.
begin;
create temp table mdr_fix(sample_code text, organism text, site text) on commit drop;
insert into mdr_fix values
  ('4727','Klebsiella spp','Μηροβουβωνικό & Περιορθρικό'),
  ('6407','Klebsiella spp','Μηροβουβωνικό & Περιορθρικό'),
  ('9817','Klebsiella spp','Μηροβουβωνικό & Περιορθρικό'),
  ('24715','Proteus spp','Περιορθρικό'),
  ('24722','Proteus spp','Μηροβουβωνικό'),
  ('382981','Klebsiella spp','Μηροβουβωνικό & Περιορθρικό'),
  ('383990','E.coli','Μηροβουβωνικό & Περιορθρικό'),
  ('3825786','Klebsiella spp','Μηροβουβωνικό & Περιορθρικό'),
  ('3826512','Klebsiella spp','Μηροβουβωνικό'),
  ('3826514','Klebsiella spp','Περιορθρικό'),
  ('3829624','Klebsiella spp, Pseudomonas spp','Μηροβουβωνικό & Περιορθρικό & Πύο ούρα'),
  ('3839116','Klebsiella spp','Μηροβουβωνικό & Περιορθρικό'),
  ('3854128','Klebsiella spp','Μηροβουβωνικό & Περιορθρικό'),
  ('37861544','E.coli','Περιορθρικό'),
  ('37861921','E.coli','Περιορθρικό'),
  ('37866883','Klebsiella spp','Μηροβουβωνικό & Περιορθρικό');

create temp table mdr_target on commit drop as
select s.id as sample_id, f.sample_code, f.organism, f.site, r.id as result_id
from mdr_fix f
join public.laboratory_samples s on s.organization_id = '7972f286-e8b8-4bbf-aa97-cf9a3d1375bd' and s.sample_code = f.sample_code
join public.microbiology_results r on r.sample_id = s.id and r.validation_status = 'validated' and r.resistance_class = 'MDR' and coalesce(r.organism, '') = ''
where not exists (select 1 from public.microbiology_results x where x.amended_from = r.id);

do $$
declare v_n bigint;
begin
  select count(*) into v_n from mdr_target;
  if v_n <> 16 then raise exception 'Βρέθηκαν % δείγματα αντί για 16', v_n; end if;
end $$;

insert into public.microbiology_results(organization_id, sample_id, result_status, resistance_class, organism, susceptibility_summary, is_critical,
  resulted_at, method, preliminary, interpretation_standard, interpretation_version, cfu_count, cfu_limit, within_limit,
  validation_status, validated_at, validated_by, amended_from, created_by, updated_by)
select r.organization_id, r.sample_id, r.result_status, r.resistance_class, t.organism, r.susceptibility_summary, r.is_critical,
       r.resulted_at, r.method, r.preliminary, r.interpretation_standard, r.interpretation_version, r.cfu_count, r.cfu_limit, r.within_limit,
       'amended', now(), null, r.id, r.created_by, r.created_by
from mdr_target t
join public.microbiology_results r on r.id = t.result_id;

update public.laboratory_samples s
set source_site = t.site,
    clinical_context = coalesce(s.clinical_context, '{}'::jsonb) || jsonb_build_object('organism_completion', jsonb_build_object(
      'source', 'MDR 2026 (Εργαστήριο)', 'applied_at', now(), 'lab_verified', false)),
    updated_at = now()
from mdr_target t
where s.id = t.sample_id;

select count(*) as διορθωμενα_αποτελεσματα from public.microbiology_results where amended_from in (select result_id from mdr_target);
commit;
