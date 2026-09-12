# v0.47.2 — Test reset deletion

- Real Supabase deletion for surveillance episodes.
- Real Supabase deletion for patient test records, including linked surveillance/lab/clinical rows.
- Destructive actions remain permission-gated and require confirmation/reason.
- No new tables or RLS policies were added. Two CREATE OR REPLACE RPC functions were added for transactional test cleanup.
