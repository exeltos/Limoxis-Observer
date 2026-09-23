-- Age-aware Glasgow forms. The standard form is used from completed age 6;
-- younger children use the paediatric response wording described by the University of Glasgow.
update public.clinical_scale_definitions
set min_age_years=6, settings=array['ward','icu','ed','pediatric_ward','pediatric_ed','picu']
where scale_key='gcs' and version='GCS-STRUCTURED';

insert into public.clinical_scale_definitions
(scale_key,version,name_el,name_en,category,population,min_age_years,max_age_years,settings,definition,source_authority,source_reference,status)
values
('pediatric-gcs','PGCS-ADELAIDE','Παιδιατρική Κλίμακα Γλασκώβης — Adelaide','Paediatric Glasgow Coma Scale — Adelaide','neurology',
 array['neonatal','pediatric'],0,5.999,array['nicu','neonatal','pediatric_ward','pediatric_ed','picu','ward','icu','ed'],
 jsonb_build_object('engine','deterministic','scoringStatus','ready','engineVersion','1.0','inputPolicy','explicit_values_only','scoreRange',jsonb_build_array(3,15),'recordComponents',true,'ageAdaptedResponses',true,'sourceChecked','2026-09-23'),
 'University of Glasgow / Glasgow Coma Scale',
 'Glasgow Structured Approach FAQ: paediatric modification for younger children and infants; record Eye, Verbal and Motor components as well as total.',
 'approved')
on conflict(scale_key,version) do update set population=excluded.population,min_age_years=excluded.min_age_years,max_age_years=excluded.max_age_years,settings=excluded.settings,definition=excluded.definition,source_authority=excluded.source_authority,source_reference=excluded.source_reference,status=excluded.status,updated_at=now();

insert into public.clinical_content_sources(source_key,name,authority,source_url,current_version)
values ('pediatric-gcs','Paediatric Glasgow Coma Scale','University of Glasgow','https://www.glasgowcomascale.org/faq/','Adelaide paediatric modification')
on conflict(source_key) do update set source_url=excluded.source_url,current_version=excluded.current_version,updated_at=now();
