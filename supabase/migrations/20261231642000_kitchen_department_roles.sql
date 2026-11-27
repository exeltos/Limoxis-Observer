-- Κουζίνα (ιδιοκτήτης 27/11/2026, «ναι σε όλα»): το προσωπικό του τμήματος της κουζίνας παίρνει αυτόματα τα δικαιώματα της
-- Κουζίνας, χωρίς να τα προσθέτει κανείς έναν έναν.
-- 1. departments.is_kitchen: το τμήμα είναι κουζίνα (στις Λίστες › Τμήματα, τύπος «Κουζίνα (HACCP)»). Νέα στήλη, ώστε να
--    μην αλλάξει ο έλεγχος του department_type (κλινική σημασία: ΜΕΘ/ΜΕΝΝ/ΠΜΕΘ). ΙΑΣΩ: «Κεντρική Κουζίνα».
-- 2. Προϊστάμενος Τμήματος με εύρος σε τμήμα κουζίνας: «Διαχείριση κουζίνας» (λίστα προϊόντων, όρια, HACCP, επαλήθευση).
--    Χρήστης Τμήματος με εύρος σε τμήμα κουζίνας: «Καταχωρίσεις κουζίνας» (παραλαβές, ημέρες παραγωγής). Και οι δύο βλέπουν.
-- 3. Ο κανόνας ζει στη βάση: private.current_user_kitchen_orgs (όλες οι πολιτικές των πινάκων kitchen_*) και
--    private.kitchen_signoff_guard (επαλήθευση / επαναφορά). Η ενότητα κλειδωμένη (module gate) κόβει όπως πριν.

alter table public.departments add column if not exists is_kitchen boolean not null default false;
comment on column public.departments.is_kitchen is 'Τμήμα κουζίνας: ο Προϊστάμενος Τμήματος παίρνει «Διαχείριση κουζίνας» και ο Χρήστης Τμήματος «Καταχωρίσεις κουζίνας».';

-- Η αλλαγή καταγράφεται στο ιστορικό (audit_management_change) στον Ιδιοκτήτη πλατφόρμας, όπως στα 20261231221600/222100.
select set_config('request.jwt.claims', '{"sub":"84066ee0-57b7-4cae-9186-09e491d3ea6d","role":"authenticated"}', true);
update public.departments set is_kitchen = true
 where organization_id = '7972f286-e8b8-4bbf-aa97-cf9a3d1375bd' and name = 'Κεντρική Κουζίνα' and not is_kitchen;
select set_config('request.jwt.claims', '', true);

-- Οργανισμοί όπου ο χρήστης έχει το επίπεδο p_level στην κουζίνα: από τον ρόλο / τα δικαιώματά του, ή από το εύρος του σε
-- τμήμα κουζίνας (department_manager: όλα· department_user: προβολή και καταχώριση).
create or replace function private.current_user_kitchen_orgs(p_level text)
 returns uuid[]
 language sql
 stable security definer
 set search_path to ''
as $function$
  select coalesce(array_agg(distinct om.organization_id), '{}') from public.organization_members om
  where om.user_id = auth.uid() and om.status = 'active'
    and (public.current_user_has_capability(om.organization_id, 'manage_kitchen')
      or (p_level in ('view','record') and public.current_user_has_capability(om.organization_id, 'record_kitchen'))
      or (p_level = 'view' and public.current_user_has_capability(om.organization_id, 'view_kitchen'))
      or (not private.password_change_pending()
          and (om.role = 'department_manager' or (om.role = 'department_user' and p_level in ('view','record')))
          and exists (select 1 from public.organization_member_scopes s
                        join public.departments d on d.id = s.department_id
                       where s.membership_id = om.id and d.organization_id = om.organization_id and d.is_kitchen and d.is_active)));
$function$;

-- Επαλήθευση / επαναφορά ημέρας: όποιος έχει «Διαχείριση» στην κουζίνα, και ο Προϊστάμενος του τμήματος της κουζίνας.
do $do$
declare
  v_def text;
  v_old text := $o$not public.current_user_has_capability(p_org, 'manage_kitchen')$o$;
  v_new text := $n$not (p_org = any (private.current_user_kitchen_orgs('manage')))$n$;
begin
  select pg_get_functiondef('private.kitchen_signoff_guard(uuid,timestamp with time zone,timestamp with time zone,boolean,text)'::regprocedure) into v_def;
  if position(v_old in v_def) = 0 then
    if position(v_new in v_def) > 0 then return; end if;
    raise exception 'kitchen_signoff_guard: the expected text was not found';
  end if;
  execute replace(v_def, v_old, v_new);
end
$do$;
