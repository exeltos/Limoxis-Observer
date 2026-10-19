-- Controls: expiry checks read only the entries that carry an item list.
--
-- The programme and the bell read, for the expiry controls, the entries whose
-- response_data holds structuredData.rows. Under row level security a filter
-- on a jsonb path (not leakproof) is applied only after the policy, so neither
-- a plain nor a partial index on the jsonb path is used and the read walked
-- every entry of the organisation (~185k at ΙΑΣΩ, 0.6-3.5 s). A stored flag
-- is a plain boolean the planner may use under the policy, and the partial
-- index below holds just those entries.
--
-- control_executions_item_lists_idx (20261123100000) cannot be used for the
-- reason above; it is left in place here and is safe to drop.

set local lock_timeout = '15s';

alter table public.control_executions
  add column if not exists has_item_list boolean
  generated always as ((response_data -> 'structuredData' -> 'rows') is not null) stored;

create index if not exists control_executions_item_list_flag_idx
  on public.control_executions (organization_id, control_id, performed_at desc)
  where has_item_list;
