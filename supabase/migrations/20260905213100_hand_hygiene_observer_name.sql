alter table public.hand_hygiene_sessions
  add column if not exists observer_name text;
