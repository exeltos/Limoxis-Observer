-- Phase 4D: query-aware governed retrieval + organism-specific IPC starter pack.
create or replace function public.search_lira_knowledge_text(p_organization_id uuid,p_query text,p_limit integer default 12)
returns table(chunk_id uuid,source_id uuid,title text,authority text,source_version text,source_url text,heading text,content text,citation_label text,page_start integer,page_end integer,match_score bigint)
language sql stable security invoker set search_path=''
as $$
 with eligible as (
  select c.id,c.source_id,c.chunk_index,c.heading,c.content,c.citation_label,c.page_start,c.page_end,
         s.title,s.authority,s.source_version,s.source_url
  from public.lira_knowledge_chunks c join public.lira_knowledge_sources s on s.id=c.source_id
  where s.status='approved'
   and (s.effective_from is null or s.effective_from<=current_date)
   and (s.effective_to is null or s.effective_to>=current_date)
   and (s.organization_id is null or (s.organization_id=p_organization_id and public.is_org_member(s.organization_id)))
 ), terms as (
  select distinct lower(t) term from regexp_split_to_table(coalesce(p_query,''),E'[^[:alnum:]Α-Ωα-ωΆ-ώ]+') t where char_length(t)>2 limit 24
 ), scored as (
  select e.*,coalesce(sum(case when lower(coalesce(e.heading,'')||' '||e.content||' '||e.title||' '||e.authority) like '%'||terms.term||'%' then 1 else 0 end),0)::bigint score
  from eligible e left join terms on true group by e.id,e.source_id,e.chunk_index,e.heading,e.content,e.citation_label,e.page_start,e.page_end,e.title,e.authority,e.source_version,e.source_url
 )
 select id,source_id,title,authority,source_version,source_url,heading,content,citation_label,page_start,page_end,score
 from scored order by score desc,authority,source_id,chunk_index limit greatest(1,least(p_limit,40))
$$;
revoke all on function public.search_lira_knowledge_text(uuid,text,integer) from public,anon;
grant execute on function public.search_lira_knowledge_text(uuid,text,integer) to authenticated;

insert into public.lira_knowledge_sources(organization_id,source_type,title,authority,source_url,source_version,language,status,metadata,ingestion_status)
values
(null,'guideline','Infection Control Guidance: Candida auris','CDC','https://www.cdc.gov/candida-auris/hcp/infection-control/index.html','2024-04','en','review',jsonb_build_object('official',true,'topic','candida-auris','review_required',true),'pending'),
(null,'guideline','Screening Recommendations for Healthcare Facilities: Candida auris','CDC','https://www.cdc.gov/candida-auris/hcp/screening-hcp/index.html','2025-12','en','review',jsonb_build_object('official',true,'topic','candida-auris-screening','review_required',true),'pending'),
(null,'guideline','Clinical Guidance for C. diff Infection Prevention in Acute Care Facilities','CDC','https://www.cdc.gov/c-diff/hcp/clinical-guidance/index.html','2026-05','en','review',jsonb_build_object('official',true,'topic','c-difficile','review_required',true),'pending'),
(null,'guideline','Infection Control Guidance: Preventing MRSA in Healthcare Facilities','CDC','https://www.cdc.gov/mrsa/hcp/infection-control/index.html','2025-06','en','review',jsonb_build_object('official',true,'topic','mrsa','review_required',true),'pending'),
(null,'risk-assessment','Carbapenem-resistant Enterobacterales – third update','ECDC','https://www.ecdc.europa.eu/en/publications-data/carbapenem-resistant-enterobacterales-third-update','2025-02','en','review',jsonb_build_object('official',true,'topic','cre-cpe','review_required',true),'pending')
on conflict do nothing;

with x(authority,title,chunk_index,heading,content,citation_label) as (values
('CDC','Infection Control Guidance: Candida auris',0,'C. auris IPC','Candida auris can spread readily in healthcare settings and can persist on patients and environmental surfaces. Colonization and infection require the same transmission-prevention attention. LIRA should flag transfer communication, hand hygiene, appropriate barrier precautions, environmental disinfection and reusable-equipment cleaning as core IPC actions.','CDC · C. auris infection control'),
('CDC','Infection Control Guidance: Candida auris',1,'C. auris environmental disinfection','Routine and terminal cleaning must use a hospital-grade disinfectant with demonstrated activity against C. auris; products based only on quaternary ammonium compounds are not considered effective. Shared and mobile equipment must be cleaned and disinfected after use. No-touch technologies supplement rather than replace standard cleaning and disinfection.','CDC · C. auris environmental disinfection'),
('CDC','Screening Recommendations for Healthcare Facilities: Candida auris',0,'C. auris colonization screening','C. auris colonization screening is used to identify asymptomatic carriers and inform IPC measures. Screening strategy should reflect local epidemiology, epidemiologic links, patient risk factors, facility characteristics and the purpose of screening. CDC recommends a composite swab of bilateral axilla and groin for colonization screening.','CDC 2025 · C. auris screening'),
('CDC','Screening Recommendations for Healthcare Facilities: Candida auris',1,'C. auris screening guardrails','A previously colonized patient can have intermittent negative screening results followed by a positive result; a negative result should not by itself trigger discontinuation of appropriate IPC precautions. Routine screening of healthcare workers is not recommended.','CDC 2025 · C. auris screening guardrails'),
('CDC','Clinical Guidance for C. diff Infection Prevention in Acute Care Facilities',0,'C. difficile isolation and testing','Patients with suspected or confirmed C. difficile infection should be placed on Contact Precautions while clinically evaluated. Testing should focus on appropriate symptomatic patients and unformed stool. A positive test should not be repeated as a test of cure because positivity may persist after clinical recovery.','CDC 2026 · C. difficile isolation and testing'),
('CDC','Clinical Guidance for C. diff Infection Prevention in Acute Care Facilities',1,'C. difficile environmental control','Daily and terminal environmental cleaning for C. difficile requires a sporicidal agent effective against C. difficile, with attention to high-touch surfaces, shared equipment and areas visited by the patient.','CDC 2026 · C. difficile environmental cleaning'),
('CDC','Clinical Guidance for C. diff Infection Prevention in Acute Care Facilities',2,'C. difficile precaution duration','For confirmed C. difficile infection, CDC guidance maintains Contact Precautions for at least 48 hours after diarrhea resolves and notes that facilities may extend them, including through hospitalization. LIRA must present this as source-specific guidance and preserve local policy where it is more stringent.','CDC 2026 · C. difficile precaution duration'),
('CDC','Infection Control Guidance: Preventing MRSA in Healthcare Facilities',0,'MRSA acute-care IPC','CDC recommends Contact Precautions in inpatient acute-care settings for patients colonized or infected with MRSA, alongside hand hygiene, environmental/equipment cleaning and relevant device- and procedure-associated infection prevention practices.','CDC 2025 · MRSA infection control'),
('CDC','Infection Control Guidance: Preventing MRSA in Healthcare Facilities',1,'MRSA colonization versus infection','MRSA colonization and MRSA infection are distinct clinical states, but both can be relevant to transmission prevention. LIRA must not infer active infection solely from a colonization result.','CDC 2025 · MRSA interpretation guardrail'),
('ECDC','Carbapenem-resistant Enterobacterales – third update',0,'CRE/CPE IPC measures','For patients carrying or infected with carbapenem-resistant Enterobacterales in acute-care hospitals, IPC measures include Standard Precautions plus transmission-based Contact Precautions, appropriate placement, gloves and gowns, limiting unnecessary movement, dedicated or disposable equipment where appropriate, and prioritised room cleaning and disinfection.','ECDC 2025 · CRE IPC'),
('ECDC','Carbapenem-resistant Enterobacterales – third update',1,'CRE screening and epidemiology','CRE prevention requires risk-based identification and epidemiological assessment in addition to laboratory resistance information. LIRA should distinguish carbapenem resistance from demonstrated carbapenemase production and should not infer a transmission chain from resistance phenotype alone.','ECDC 2025 · CRE/CPE interpretation')
)
insert into public.lira_knowledge_chunks(source_id,chunk_index,heading,content,citation_label,token_count,content_hash,metadata,embedding_status)
select s.id,x.chunk_index,x.heading,x.content,x.citation_label,ceil(length(x.content)/4.0)::integer,md5(x.content),jsonb_build_object('curation','official-source-summary','review_required',true,'phase','4D'),'not_required'
from x join public.lira_knowledge_sources s on s.authority=x.authority and s.title=x.title where s.status='review'
on conflict(source_id,chunk_index) do update set heading=excluded.heading,content=excluded.content,citation_label=excluded.citation_label,token_count=excluded.token_count,content_hash=excluded.content_hash,metadata=excluded.metadata,embedding_status=excluded.embedding_status;
update public.lira_knowledge_sources s set ingestion_status='ingested',updated_at=now() where s.status='review' and exists(select 1 from public.lira_knowledge_chunks c where c.source_id=s.id and c.metadata->>'phase'='4D');
