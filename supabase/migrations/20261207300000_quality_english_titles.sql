-- Quality records: optional English counterparts of the user-entered texts.
-- The title (and the description) a hospital types stays as written; the
-- English screens show the English text when it exists and the written one
-- otherwise. Additive and nullable: no existing row, policy or grant changes
-- (the tables are read with select * and granted per table).
alter table public.quality_incidents add column if not exists title_en text;
alter table public.quality_incidents add column if not exists description_en text;
alter table public.quality_findings add column if not exists title_en text;
alter table public.quality_findings add column if not exists description_en text;
alter table public.quality_capa_actions add column if not exists title_en text;
alter table public.quality_capa_actions add column if not exists description_en text;
alter table public.quality_audits add column if not exists title_en text;
alter table public.quality_objectives add column if not exists title_en text;
