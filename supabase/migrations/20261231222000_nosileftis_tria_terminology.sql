-- Ο όρος «Νοσηλεύτρια» γίνεται «Νοσηλευτής/τρια» στους τίτλους, τα επαγγέλματα και τους υπεύθυνους (πεδία-ετικέτες).
-- Δεν αλλάζουν: ελεύθερο κείμενο (απαντήσεις ερωτηματολογίων, περιγραφές συμβάντων, πρακτικά) και ο παγωμένος πίνακας training_records.
select set_config('request.jwt.claims', '{"sub":"84066ee0-57b7-4cae-9186-09e491d3ea6d","role":"authenticated"}', true);
update patient_clinical_scale_assessments set assessor_job_title = replace(replace(assessor_job_title,'Νοσηλευτής / Νοσηλεύτρια','Νοσηλευτής/τρια'),'Νοσηλεύτρια','Νοσηλευτής/τρια') where assessor_job_title like '%Νοσηλεύτρια%';
update hand_hygiene_observations set professional_category = replace(replace(professional_category,'Νοσηλευτής / Νοσηλεύτρια','Νοσηλευτής/τρια'),'Νοσηλεύτρια','Νοσηλευτής/τρια') where professional_category like '%Νοσηλεύτρια%';
update hand_hygiene_sessions set professional_category = replace(replace(professional_category,'Νοσηλευτής / Νοσηλεύτρια','Νοσηλευτής/τρια'),'Νοσηλεύτρια','Νοσηλευτής/τρια') where professional_category like '%Νοσηλεύτρια%';
update employees set profession_name = replace(replace(profession_name,'Νοσηλευτής / Νοσηλεύτρια','Νοσηλευτής/τρια'),'Νοσηλεύτρια','Νοσηλευτής/τρια') where profession_name like '%Νοσηλεύτρια%';
update training_programs set trainer = replace(replace(trainer,'Νοσηλευτής / Νοσηλεύτρια','Νοσηλευτής/τρια'),'Νοσηλεύτρια','Νοσηλευτής/τρια') where trainer like '%Νοσηλεύτρια%';
update training_assignments set assessment_reviewed_by = replace(replace(assessment_reviewed_by,'Νοσηλευτής / Νοσηλεύτρια','Νοσηλευτής/τρια'),'Νοσηλεύτρια','Νοσηλευτής/τρια') where assessment_reviewed_by like '%Νοσηλεύτρια%';
update quality_capa_actions set owner_label = replace(replace(owner_label,'Νοσηλευτής / Νοσηλεύτρια','Νοσηλευτής/τρια'),'Νοσηλεύτρια','Νοσηλευτής/τρια') where owner_label like '%Νοσηλεύτρια%';
update kitchen_settings set haccp_team = replace(replace(haccp_team,'Νοσηλευτής / Νοσηλεύτρια','Νοσηλευτής/τρια'),'Νοσηλεύτρια','Νοσηλευτής/τρια') where haccp_team like '%Νοσηλεύτρια%';
update critical_result_communications set recipient_name = replace(replace(recipient_name,'Νοσηλευτής / Νοσηλεύτρια','Νοσηλευτής/τρια'),'Νοσηλεύτρια','Νοσηλευτής/τρια') where recipient_name like '%Νοσηλεύτρια%';
update training_history_events set actor = replace(replace(actor,'Νοσηλευτής / Νοσηλεύτρια','Νοσηλευτής/τρια'),'Νοσηλεύτρια','Νοσηλευτής/τρια') where actor like '%Νοσηλεύτρια%';
update training_requirement_targets set value = replace(replace(value,'Νοσηλευτής / Νοσηλεύτρια','Νοσηλευτής/τρια'),'Νοσηλεύτρια','Νοσηλευτής/τρια') where value like '%Νοσηλεύτρια%';
update prevention_bundle_assessments set criteria = replace(replace(criteria::text,'Νοσηλευτής / Νοσηλεύτρια','Νοσηλευτής/τρια'),'Νοσηλεύτρια','Νοσηλευτής/τρια')::jsonb where criteria::text like '%Νοσηλεύτρια%';
