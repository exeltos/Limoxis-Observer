-- New Demo wizard (design §5, §7): the limit on the users of a Demo. Every
-- Demo is filled with the full data pack; the Owner creates its Hospital
-- Admin, who adds the other users inside the Demo up to this limit.

alter table public.platform_settings add column if not exists max_demo_users integer not null default 5
  check (max_demo_users between 1 and 20);
