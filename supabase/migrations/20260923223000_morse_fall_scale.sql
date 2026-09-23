insert into public.clinical_scale_definitions
(scale_key,version,name_el,name_en,category,population,min_age_years,max_age_years,settings,definition,source_authority,source_reference,status)
values ('morse','MFS-1989','Morse Fall Scale — Κίνδυνος πτώσης ενηλίκων','Morse Fall Scale — Adult Fall Risk','fall_risk',array['adult'],18,null,array['ward','icu','ed','acute_care'],
jsonb_build_object('engine','deterministic','scoringStatus','ready','engineVersion','1.0','inputPolicy','explicit_values_only','scoreRange',jsonb_build_array(0,125),'institutionThresholdReview',true,'sourceChecked','2026-09-23'),
'AHRQ / Morse et al.','AHRQ Preventing Falls in Hospitals, Tool 3H. Suggested bands: <25 low, 25–45 moderate, >45 high; institutional cut-points should be reviewed locally.','approved')
on conflict(scale_key,version) do update set definition=excluded.definition,source_reference=excluded.source_reference,status=excluded.status,updated_at=now();