-- Ενεργοί λογαριασμοί από τον Ιδιοκτήτη Πλατφόρμας (platform-create-active-users):
-- ο λογαριασμός δημιουργείται ενεργός με προσωρινό κωδικό που δίνεται στον χρήστη·
-- στην πρώτη σύνδεση η εφαρμογή ζητά υποχρεωτικά νέο κωδικό.
--   profiles.must_change_password   true μόνο για λογαριασμούς με προσωρινό κωδικό
--                                    (το θέτει μόνο το Edge Function με service role).
--   complete_password_change()       ο ίδιος ο χρήστης, αφού άλλαξε τον κωδικό του
--                                    (supabase.auth.updateUser), καθαρίζει τη σημαία
--                                    μόνο για τον εαυτό του (auth.uid()).

alter table public.profiles add column if not exists must_change_password boolean not null default false;

create or replace function public.complete_password_change()
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $function$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then
    raise exception 'AUTH_REQUIRED' using errcode = '42501';
  end if;
  update public.profiles set must_change_password = false where id = v_user and must_change_password;
  return true;
end;
$function$;

revoke all on function public.complete_password_change() from public, anon;
grant execute on function public.complete_password_change() to authenticated;
