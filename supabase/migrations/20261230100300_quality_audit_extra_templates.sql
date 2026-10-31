-- An audit can combine questionnaires: the ones picked by name next to its main one. The test audits
-- of the basic questionnaire do not list the standards any more (their answers name them, by clause).
alter table public.quality_audits add column if not exists extra_template_ids uuid[] not null default '{}';
comment on column public.quality_audits.extra_template_ids is 'Questionnaires combined with the audit''s main one (quality_audit_templates ids).';
update public.quality_audits set standards = '{}' where notes like 'ΔΟΚΙΜΑΣΤΙΚΗ ΚΑΤΑΧΩΡΗΣΗ%' and standards <> '{}';
