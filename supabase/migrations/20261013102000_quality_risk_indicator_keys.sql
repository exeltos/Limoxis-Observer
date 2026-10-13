-- The indicators that measure a risk: keys of indicator_definitions
-- (indicator_key), so the link survives a new version of the indicator.
alter table public.quality_risks add column if not exists indicator_keys text[] not null default '{}';
