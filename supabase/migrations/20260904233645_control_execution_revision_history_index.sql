create index if not exists control_execution_revisions_execution_history_idx
on public.control_execution_revisions (execution_id, organization_id, changed_at desc);
