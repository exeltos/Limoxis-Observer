-- Διευθυντής Διεύθυνσης: βοηθοί ανάγνωσης (12/11/2026).
--
-- private.employee_professional_category(ειδικότητα, κατηγορία προσωπικού)
--     Η επαγγελματική κατηγορία ενός εργαζομένου (nursing, medical, paramedical, administrative, technical, support)
--     από το ελεύθερο κείμενο της ειδικότητας (π.χ. «190 ΝΟΣΗΛΕΥΤΗΣ/ΤΡΙΑ 2ΕΤΟΥΣ», «ΙΑΤΡΟΣ ΑΝΕΙΔΙΚΕΥΤΟΣ») και το
--     staff_category (employee | physician | external). Άγνωστη ειδικότητα → null (δεν τη βλέπει καμία διεύθυνση).
-- private.current_user_division_departments(org) / private.current_user_division_categories(org)
--     Τα τμήματα και οι κατηγορίες των διευθύνσεων που διευθύνει ο χρήστης (μόνο με ρόλο division_director).
-- private.current_user_division_scope_keys() / private.current_user_division_category_keys()
--     Τα ίδια ως κλειδιά «org:τμήμα» και «org:τμήμα:κατηγορία» για όλα τα νοσοκομεία του χρήστη, για τις πολιτικές
--     ανάγνωσης: υπολογίζονται μία φορά ανά ερώτημα (select …), όχι ανά γραμμή.

create or replace function private.employee_professional_category(p_profession_name text, p_staff_category text)
returns text
language sql
immutable
set search_path to ''
as $function$
  with t as (
    select upper(translate(lower(coalesce(p_profession_name, '')), 'άέήίόύώϊϋΐΰ' || chr(769) || chr(776), 'αεηιουωιυιυ')) as v
  )
  select case
    when p_staff_category = 'physician' then 'medical'
    when t.v ~ '(ΝΟΣΗΛΕΥ|ΝΟΣΗΛΕΥΤ|ΜΑΙΑ|ΜΑΙΕΥΤ|ΒΟΗΘ.*ΝΟΣΗΛ|NURS|MIDWI)' then 'nursing'
    when t.v ~ '((^|[^Α-ΩA-Z])ΙΑΤΡ(ΟΣ|ΟΙ|ΟΥ|ΩΝ|ΙΝΑ|ΕΣ)|ΟΔΟΝΤΙΑΤΡ|ΕΠΙΜΕΛΗΤ|ΕΙΔΙΚΕΥΟΜΕΝ|ΕΙΔΙΚΕΥΟΜΕΝΗ|PHYSICIAN|DOCTOR)' then 'medical'
    when t.v ~ '(ΤΕΧΝΟΛΟΓ|ΕΡΓΑΣΤΗΡ|ΦΥΣΙΚΟΘΕΡΑΠ|ΕΡΓΟΘΕΡΑΠ|ΛΟΓΟΘΕΡΑΠ|ΨΥΧΟΛΟΓ|ΚΟΙΝΩΝΙΚ|ΔΙΑΙΤΟΛΟΓ|ΔΙΑΤΡΟΦΟΛΟΓ|ΦΑΡΜΑΚ|ΧΗΜΙΚ|ΒΙΟΛΟΓ|ΑΚΤΙΝΟΛΟΓ|ΡΑΔΙΟΛΟΓ|ΕΠΙΣΚΕΠΤ|ΦΥΣΙΚΟΣ|ΟΠΤΙΚ|ΑΚΟΥΟΛΟΓ|THERAPIST|PHARMAC|TECHNOLOGIST)' then 'paramedical'
    when t.v ~ '(ΤΕΧΝΙΚ|ΗΛΕΚΤΡΟΛΟΓ|ΗΛΕΚΤΡΟΝΙΚ|ΜΗΧΑΝΙΚ|ΜΗΧΑΝΟΤΕΧΝ|ΜΗΧΑΝΟΔΗΓ|ΥΔΡΑΥΛΙΚ|ΨΥΚΤΙΚ|ΘΕΡΜΑΣΤ|ΣΥΝΤΗΡΗΤ|ΠΛΗΡΟΦΟΡΙΚ|ΤΕΧΝΙΤ|ΞΥΛΟΥΡΓ|ΕΛΑΙΟΧΡΩΜΑΤ|ΚΑΥΣΤΗΡ|ENGINEER|TECHNICIAN|MAINTENANCE)' then 'technical'
    when t.v ~ '(ΔΙΟΙΚΗΤ|ΔΙΟΙΚΗΣ|ΓΡΑΜΜΑΤ|ΛΟΓΙΣΤ|ΟΙΚΟΝΟΜ|ΥΠΑΛΛΗΛ|ΝΟΜΙΚ|ΔΙΚΗΓΟΡ|ΓΡΑΦΕΙ|ΑΡΧΕΙΟΘΕΤ|ΑΡΧΕΙΟΥ|ΤΗΛΕΦΩΝ|ΠΡΟΣΩΠΙΚΟΥ|ΔΙΑΧΕΙΡΙΣ|ΠΡΟΜΗΘ|ΜΙΣΘΟΔΟΣ|ΚΙΝΗΣΗΣ|ΓΡΑΦΕΑΣ|ADMIN|SECRETAR|CLERK|ACCOUNT)' then 'administrative'
    when t.v ~ '(ΒΟΗΘ|ΚΑΘΑΡΙ|ΤΡΑΥΜΑΤΙΟΦΟΡ|ΦΥΛΑΚ|ΦΥΛΑΞ|ΜΑΓΕΙΡ|ΤΡΑΠΕΖΟΚΟΜ|ΙΜΑΤΙΟΘΗΚ|ΙΜΑΤΙΣΜ|ΠΛΥΝΤ|ΑΠΟΘΗΚ|ΘΥΡΩΡ|ΚΛΗΤΗΡ|ΣΙΤΙΣ|ΕΣΤΙΑΣ|ΒΑΡΔΙΑΝ|ΥΠΟΣΤΗΡΙΚ|ΟΔΗΓ|ΤΑΧΥΜΕΤΑΦ|ΕΡΓΑΤ|ΚΗΠΟΥΡ|PORTER|CLEAN|SECURITY|DRIVER|COOK|KITCHEN|LAUNDRY)' then 'support'
    else null
  end
  from t;
$function$;
revoke all on function private.employee_professional_category(text, text) from public, anon;
grant execute on function private.employee_professional_category(text, text) to authenticated;

create or replace function private.current_user_division_departments(p_organization_id uuid)
returns uuid[]
language sql
stable
security definer
set search_path to ''
as $function$
  select coalesce(array_agg(distinct dd.department_id), '{}'::uuid[])
    from public.organization_members om
    join public.hr_division_members dm on dm.user_id = om.user_id and dm.organization_id = om.organization_id
    join public.hr_division_departments dd on dd.division_id = dm.division_id and dd.organization_id = dm.organization_id
   where om.user_id = auth.uid()
     and om.organization_id = p_organization_id
     and om.status = 'active'
     and om.role = 'division_director';
$function$;
revoke all on function private.current_user_division_departments(uuid) from public, anon;
grant execute on function private.current_user_division_departments(uuid) to authenticated;

create or replace function private.current_user_division_categories(p_organization_id uuid)
returns text[]
language sql
stable
security definer
set search_path to ''
as $function$
  select coalesce(array_agg(distinct dc.professional_category), '{}'::text[])
    from public.organization_members om
    join public.hr_division_members dm on dm.user_id = om.user_id and dm.organization_id = om.organization_id
    join public.hr_division_categories dc on dc.division_id = dm.division_id and dc.organization_id = dm.organization_id
   where om.user_id = auth.uid()
     and om.organization_id = p_organization_id
     and om.status = 'active'
     and om.role = 'division_director';
$function$;
revoke all on function private.current_user_division_categories(uuid) from public, anon;
grant execute on function private.current_user_division_categories(uuid) to authenticated;

-- «org:τμήμα» για κάθε τμήμα διεύθυνσης που διευθύνει ο χρήστης (σε όλα τα νοσοκομεία του).
create or replace function private.current_user_division_scope_keys()
returns text[]
language sql
stable
security definer
set search_path to ''
as $function$
  select coalesce(array_agg(distinct om.organization_id::text || ':' || dd.department_id::text), '{}'::text[])
    from public.organization_members om
    join public.hr_division_members dm on dm.user_id = om.user_id and dm.organization_id = om.organization_id
    join public.hr_division_departments dd on dd.division_id = dm.division_id and dd.organization_id = dm.organization_id
   where om.user_id = auth.uid()
     and om.status = 'active'
     and om.role = 'division_director'
     and not private.password_change_pending();
$function$;
revoke all on function private.current_user_division_scope_keys() from public, anon;
grant execute on function private.current_user_division_scope_keys() to authenticated;

-- «org:τμήμα:κατηγορία»: ανά διεύθυνση, τα τμήματά της × οι κατηγορίες προσωπικού της.
create or replace function private.current_user_division_category_keys()
returns text[]
language sql
stable
security definer
set search_path to ''
as $function$
  select coalesce(array_agg(distinct om.organization_id::text || ':' || dd.department_id::text || ':' || dc.professional_category), '{}'::text[])
    from public.organization_members om
    join public.hr_division_members dm on dm.user_id = om.user_id and dm.organization_id = om.organization_id
    join public.hr_division_departments dd on dd.division_id = dm.division_id and dd.organization_id = dm.organization_id
    join public.hr_division_categories dc on dc.division_id = dm.division_id and dc.organization_id = dm.organization_id
   where om.user_id = auth.uid()
     and om.status = 'active'
     and om.role = 'division_director'
     and not private.password_change_pending();
$function$;
revoke all on function private.current_user_division_category_keys() from public, anon;
grant execute on function private.current_user_division_category_keys() to authenticated;
