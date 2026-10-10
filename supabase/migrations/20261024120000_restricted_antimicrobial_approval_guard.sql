-- Stewardship approval for restricted antimicrobials, enforced by the database.
--
-- Until now the browser decided whether a therapy needs approval: it sent
-- approval_status 'pending' for an antibiotic on the restricted list, and the
-- database stored whatever it received. A user allowed to record therapies
-- could call the API directly and store a restricted antibiotic as
-- 'not_required' (or 'approved'), and then trg_enforce_therapy_approved_before_administration
-- let its administrations through.
--
-- Rule, for requests made by signed-in users (PostgREST role authenticated/anon):
--   - a new therapy with a restricted antimicrobial is always stored 'pending';
--   - changing a therapy's antimicrobial to a restricted one sets it back to 'pending';
--   - a restricted therapy can never be set to 'not_required' (it becomes 'pending').
-- Approving or rejecting a pending therapy is unchanged (antimicrobial_therapies_update).
--
-- The restricted list is the organization's active 'advancedAntibiotics'
-- library, matched on the Greek or English name; an organization without that
-- library uses the system default list, exactly as the application does
-- (managementData.js demoLibrarySeed.advancedAntibiotics).
--
-- The trigger function is SECURITY INVOKER on purpose: for a direct API request
-- current_user is the request role (authenticated), while trusted server code
-- (the Demo seed functions, owned by postgres, and service-role edge
-- functions) runs as another role and keeps the approval status it writes.
-- Every role allowed to insert or update therapies can read its
-- organization's library rows (master_library_items_read).

create or replace function public.enforce_restricted_antimicrobial_approval()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  medicine text := lower(btrim(coalesce(new.antimicrobial, '')));
  restricted boolean;
begin
  if current_user not in ('authenticated', 'anon') or medicine = '' then
    return new;
  end if;

  if exists (
    select 1 from public.master_library_items
    where organization_id = new.organization_id and library_key = 'advancedAntibiotics' and is_active
  ) then
    select exists (
      select 1 from public.master_library_items
      where organization_id = new.organization_id and library_key = 'advancedAntibiotics' and is_active
        and medicine in (lower(btrim(coalesce(name_el, ''))), lower(btrim(coalesce(name_en, ''))))
    ) into restricted;
  else
    restricted := medicine = any (array[
      'μεροπενέμη', 'meropenem',
      'ιμιπενέμη', 'imipenem',
      'κολιστίνη', 'colistin',
      'λινεζολίδη', 'linezolid',
      'δαπτομυκίνη', 'daptomycin',
      'τιγεκυκλίνη', 'tigecycline',
      'κεφταζιδίμη/αβιμπακτάμη', 'ceftazidime/avibactam',
      'κεφτολοζάνη/ταζομπακτάμη', 'ceftolozane/tazobactam'
    ]);
  end if;

  if not restricted then
    return new;
  end if;

  if tg_op = 'INSERT'
     or new.antimicrobial is distinct from old.antimicrobial
     or new.approval_status = 'not_required' then
    new.approval_status := 'pending';
  end if;

  return new;
end;
$$;

revoke execute on function public.enforce_restricted_antimicrobial_approval() from public, anon, authenticated;

drop trigger if exists trg_enforce_restricted_antimicrobial_approval on public.antimicrobial_therapies;
create trigger trg_enforce_restricted_antimicrobial_approval
before insert or update of antimicrobial, approval_status on public.antimicrobial_therapies
for each row execute function public.enforce_restricted_antimicrobial_approval();
