-- Phase 7: governed clinical scale catalogue expansion.
-- Registry metadata only. Instruments requiring permission or a governed scoring definition
-- remain unavailable for scoring until that review is complete.
insert into public.clinical_scale_definitions
(scale_key,version,name_el,name_en,category,population,min_age_years,max_age_years,settings,definition,source_authority,source_reference,status)
values
('cam-icu','CAM-ICU-2023','CAM-ICU — Έλεγχος παραληρήματος ΜΕΘ','CAM-ICU — ICU Delirium Assessment','delirium',array['adult'],18,null,array['icu'],jsonb_build_object('engine','governed','scoringStatus','permission_review_required','licenseReviewRequired',true),'Vanderbilt CIBS Center / Ely et al.','CAM-ICU official resources; JAMA. 2001;286:2703–2710. PMID 11730446','draft'),
('pews','PEWS-GOVERNED','PEWS — Παιδιατρική έγκαιρη προειδοποίηση','PEWS — Pediatric Early Warning Score','deterioration',array['pediatric'],0,17.999,array['pediatric_ward','pediatric_ed'],jsonb_build_object('engine','governed','scoringStatus','local_definition_required','note','PEWS implementations vary; hospital must govern the selected validated definition before activation.'),'Hospital-governed / validated PEWS implementation','Pediatric early warning systems require a named validated implementation and local governance.','draft'),
('newtt2','NEWTT2','NEWTT2 — Έγκαιρη αναγνώριση επιδείνωσης νεογνού','NEWTT2 — Newborn Early Warning Track and Trigger','deterioration',array['neonatal'],0,0.083,array['maternity','postnatal','neonatal'],jsonb_build_object('engine','governed','scoringStatus','implementation_review_required','licenseReviewRequired',true),'British Association of Perinatal Medicine','NEWTT2 Framework for Practice — Deterioration of the Newborn','draft')
on conflict(scale_key,version) do nothing;
