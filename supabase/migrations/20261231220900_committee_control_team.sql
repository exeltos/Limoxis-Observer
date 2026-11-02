-- Ομάδα ελέγχου μιας επιτροπής (π.χ. Ομάδα Ελέγχου Λοιμώξεων μέσα στην Επιτροπή Νοσοκομειακών Λοιμώξεων):
-- ποια μέλη ανήκουν σε αυτήν και αν μια συνεδρίαση ήταν της ολομέλειας ή μόνο της ομάδας.
-- Όταν συνεδριάζει η ομάδα, οι παρουσίες (και άρα η απαρτία) είναι μόνο των μελών της. Μόνο προσθήκη στηλών.
alter table public.committee_members add column if not exists in_control_team boolean not null default false;
alter table public.committee_meetings add column if not exists composition text not null default 'plenary';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'committee_meetings_composition_check') then
    alter table public.committee_meetings add constraint committee_meetings_composition_check check (composition in ('plenary', 'control_team'));
  end if;
end
$$;
