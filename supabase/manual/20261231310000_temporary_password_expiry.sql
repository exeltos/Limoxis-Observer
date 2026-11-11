-- Τρέξτε ΟΛΟ το αρχείο στο Supabase SQL Editor (project Limoxis-Observer), ΠΡΙΝ την ανάρτηση της συνάρτησης
-- platform-create-active-users. Μόνο προσθήκες· μπορεί να ξανατρέξει χωρίς πρόβλημα (το cron.schedule με το ίδιο όνομα το ενημερώνει).
-- Προσωρινός κωδικός: λήγει σε 7 ημέρες αν ο χρήστης δεν έχει συνδεθεί και αλλάξει κωδικό.
-- Ο λογαριασμός κλειδώνει (auth.users.banned_until) από εργασία που τρέχει κάθε ώρα· ο ιδιοκτήτης δίνει νέο
-- προσωρινό κωδικό και ο λογαριασμός ξανανοίγει. Μόνο προσθήκες: οι υπάρχοντες λογαριασμοί δεν έχουν λήξη.

alter table public.profiles
  add column if not exists temporary_password_expires_at timestamptz,
  add column if not exists temporary_password_locked_at timestamptz;

comment on column public.profiles.temporary_password_expires_at is 'When the temporary password stops working if the user has not changed it (null = no expiry).';
comment on column public.profiles.temporary_password_locked_at is 'When the account was locked because the temporary password expired (null = not locked).';

-- Κλειδώνει όσους δεν άλλαξαν τον προσωρινό κωδικό μέχρι τη λήξη. Επιστρέφει πόσους κλείδωσε.
create or replace function private.lock_expired_temporary_passwords()
returns integer
language plpgsql
security definer
set search_path to ''
as $fn$
declare
  v_count integer;
begin
  with expired as (
    select p.id
      from public.profiles p
     where p.must_change_password
       and p.temporary_password_expires_at is not null
       and p.temporary_password_expires_at < now()
       and p.temporary_password_locked_at is null
  ), locked as (
    update auth.users u
       set banned_until = 'infinity'
      from expired e
     where u.id = e.id
    returning u.id
  ), marked as (
    update public.profiles p
       set temporary_password_locked_at = now()
      from locked l
     where p.id = l.id
    returning p.id
  )
  select count(*) into v_count from marked;
  return coalesce(v_count, 0);
end
$fn$;

revoke all on function private.lock_expired_temporary_passwords() from public, anon, authenticated;

-- Κάθε ώρα (στο λεπτό 7).
select cron.schedule('lock-expired-temporary-passwords', '7 * * * *', $job$select private.lock_expired_temporary_passwords()$job$);

-- Έλεγχος (μόνο ανάγνωση): 2 στήλες, 1 εργασία cron.
select count(*) as στήλες from information_schema.columns where table_schema='public' and table_name='profiles' and column_name in ('temporary_password_expires_at','temporary_password_locked_at');
select jobname, schedule from cron.job where jobname='lock-expired-temporary-passwords';
