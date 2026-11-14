-- Στοιχεία επικοινωνίας της δημόσιας «Σελίδας παρουσίασης» (διαδρομή «/» πριν τη σύνδεση): εταιρεία, email,
-- τηλέφωνο και ιστοσελίδα. Τα αλλάζει ο Ιδιοκτήτης Πλατφόρμας από την κονσόλα (Ρυθμίσεις οργανισμών › Σελίδα
-- παρουσίασης). Ο επισκέπτης χωρίς σύνδεση διαβάζει ΜΟΝΟ αυτά τα 4 μέσω της public_contact()· ο υπόλοιπος
-- platform_settings μένει κλειστός σε αυτόν.

alter table public.platform_settings
  add column if not exists public_name text,
  add column if not exists public_email text,
  add column if not exists public_phone text,
  add column if not exists public_website text;

update public.platform_settings
   set public_name = coalesce(public_name, 'Exeltos'),
       public_email = coalesce(public_email, 'info@exeltos.com'),
       public_phone = coalesce(public_phone, '694 247 1022'),
       public_website = coalesce(public_website, 'https://exeltos.com/')
 where id = 'global';

create or replace function public.public_contact()
returns table (name text, email text, phone text, website text)
language sql
stable
security definer
set search_path = ''
as $$
  select s.public_name, s.public_email, s.public_phone, s.public_website
  from public.platform_settings s
  where s.id = 'global'
$$;

grant execute on function public.public_contact() to anon, authenticated;
