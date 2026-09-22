-- LIRA Phase 2B: governed clinical curriculum registry.
-- Registers authoritative source metadata only. No copyrighted guideline body is copied here.
-- Sources begin in review state; approval requires explicit clinical governance review.

insert into public.lira_knowledge_sources
  (organization_id,source_type,title,authority,source_url,source_version,language,status,effective_from,metadata)
select null,v.source_type,v.title,v.authority,v.source_url,v.source_version,v.language,'review',v.effective_from,v.metadata::jsonb
from (values
 ('surveillance_protocol','2026 NHSN Patient Safety Component Manual','CDC/NHSN','https://www.cdc.gov/nhsn/','2026','en','2026-01-01','{"curriculum":["HAI","CLABSI","CAUTI","VAE","SSI","MDRO"],"jurisdiction":"US","priority":10}'),
 ('surveillance_protocol','HAI-Net ICU protocol','ECDC','https://www.ecdc.europa.eu/en/publications-data/protocol-surveillance-healthcare-associated-infections-and-prevention-indicators','2.3','en','2025-03-18','{"curriculum":["HAI","ICU","prevention_indicators"],"jurisdiction":"EU","priority":10}'),
 ('laboratory_standard','Clinical breakpoint tables','EUCAST','https://www.eucast.org/bacteria/clinical-breakpoints-and-interpretation/clinical-breakpoint-tables/','16.1','en','2026-06-24','{"curriculum":["AMR","AST","microbiology"],"valid_through":"2026-12-31","jurisdiction":"EU","priority":10}'),
 ('ipc_guideline','Minimum requirements for infection prevention and control programmes','WHO','https://www.who.int/publications/i/item/9789241516945','2019','en','2019-11-18','{"curriculum":["IPC","governance","prevention"],"jurisdiction":"global","priority":8}'),
 ('ipc_guideline','WHO hand hygiene in health care resources','WHO','https://www.who.int/teams/integrated-health-services/infection-prevention-control/hand-hygiene','living-resource','en',null,'{"curriculum":["hand_hygiene","IPC","prevention"],"jurisdiction":"global","priority":9}')
) as v(source_type,title,authority,source_url,source_version,language,effective_from,metadata)
where not exists (
 select 1 from public.lira_knowledge_sources s
 where s.organization_id is null and s.authority=v.authority and s.title=v.title and coalesce(s.source_version,'')=coalesce(v.source_version,'')
);

comment on table public.lira_knowledge_sources is
'Governed, versioned LIRA knowledge sources. Phase 2B authoritative catalog entries start in review and require explicit clinical governance approval before retrieval.';
