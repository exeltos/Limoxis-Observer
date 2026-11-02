select set_config('request.jwt.claims', '{"sub":"84066ee0-57b7-4cae-9186-09e491d3ea6d","role":"authenticated"}', true);
-- ΙΑΣΩ: η έναρξη των ερωτηματολογίων των τμημάτων είναι η πρώτη απάντηση (εισαγωγή από το FileMaker), όχι η ημερομηνία εισαγωγής.
update quality_surveys s set opens_on = (select min(r.submitted_at)::date from quality_survey_responses r where r.survey_id = s.id)
where s.organization_id = '7972f286-e8b8-4bbf-aa97-cf9a3d1375bd' and s.code in ('SRV-2026-01','SRV-2026-02')
  and exists (select 1 from quality_survey_responses r where r.survey_id = s.id);
