-- «Σε απομόνωση τώρα» στην αρχική του Χρήστη Τμήματος και του Link Nurse (ιδιοκτήτης, 20/11/2026): πόσοι ασθενείς
-- των τμημάτων του χρήστη είναι σε απομόνωση τώρα. Μόνο ο αριθμός, ποτέ ποιοι.
--
-- Ο Χρήστης Τμήματος δεν διαβάζει τον πίνακα isolation_episodes (RLS: μόνο Προϊστάμενος, Link Nurse και ομάδα
-- λοιμώξεων), γι' αυτό η μέτρηση γίνεται σε SECURITY DEFINER συνάρτηση του σχήματος private (δεν εκτίθεται στο API)
-- και επιστρέφει μόνο ακέραιο. Το API καλεί το public.department_isolation_count, SECURITY INVOKER, που απλώς την
-- καλεί: έτσι δεν χρειάζεται αφαίρεση δικαιωμάτων και ο ανώνυμος παίρνει PERMISSION_DENIED.
--
-- Πρόσβαση: μόνο ρόλοι τμήματος (Προϊστάμενος, Χρήστης Τμήματος, Link Nurse) του οργανισμού. Μετρά μόνο τα
-- τμήματα του εύρους τους (organization_member_scopes των ενεργών μελών τμήματος του οργανισμού) και μόνο
-- ενεργά επεισόδια απομόνωσης του ίδιου οργανισμού. Χωρίς τμήμα: 0. Κλειδωμένη Επιτήρηση: null.
create or replace function private.department_isolation_count(p_organization_id uuid)
returns integer
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
  v_departments uuid[];
begin
  if auth.uid() is null then
    raise exception 'PERMISSION_DENIED' using errcode = '42501';
  end if;
  if p_organization_id is null then
    raise exception 'ORGANIZATION_REQUIRED' using errcode = '22023';
  end if;
  if private.password_change_pending() then
    raise exception 'PERMISSION_DENIED' using errcode = '42501';
  end if;
  if not public.current_user_has_org_role(p_organization_id,
       array['department_manager', 'department_user', 'link_nurse']::public.app_role[]) then
    raise exception 'PERMISSION_DENIED' using errcode = '42501';
  end if;
  if 'surveillance' = any (coalesce(private.org_disabled_modules(p_organization_id), '{}'::text[])) then
    return null;
  end if;

  select coalesce(array_agg(distinct oms.department_id), '{}'::uuid[]) into v_departments
    from public.organization_members om
    join public.organization_member_scopes oms on oms.membership_id = om.id
   where om.user_id = auth.uid()
     and om.organization_id = p_organization_id
     and om.status = 'active'
     and om.role in ('department_manager', 'department_user', 'link_nurse')
     and oms.department_id is not null;
  if cardinality(v_departments) = 0 then
    return 0;
  end if;

  -- Ασθενείς, όχι επεισόδια: ένας ασθενής με δύο ενεργές απομονώσεις μετρά μία φορά.
  return (select count(distinct x.patient_id)::integer
            from public.isolation_episodes x
           where x.organization_id = p_organization_id
             and x.status = 'active'
             and x.department_id = any (v_departments));
end
$function$;

create or replace function public.department_isolation_count(p_organization_id uuid)
returns integer
language sql
stable
security invoker
set search_path to ''
as $function$
  select private.department_isolation_count(p_organization_id)
$function$;

grant execute on function public.department_isolation_count(uuid) to authenticated;
