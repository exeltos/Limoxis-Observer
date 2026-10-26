-- ΙΑΣΩ ΘΕΣΣΑΛΙΑΣ: τα ονόματα στις καταγραφές ελέγχων γράφονται όπως στη λίστα εργαζομένων (ΕΠΩΝΥΜΟ ΟΝΟΜΑ).
-- Τρέχει ΜΟΝΟ από τον ιδιοκτήτη στο SQL Editor (αλλάζει ιστορικές καταγραφές). Όλο το αρχείο είναι ένα μπλοκ:
-- αν κάτι δεν ταιριάζει, δεν αλλάζει τίποτα. Δεν δημιουργούνται αναθεωρήσεις καταγραφών. Δεν αλλάζει τίποτα άλλο εκτός από το όνομα (response_data.actorName).
--   1. Όνομα που βρίσκεται στη λίστα εργαζομένων (σε οποιαδήποτε σειρά, με τόνους/λατινικά/κομμένο) → όπως στη λίστα.
--   2. Ορθογραφικά λάθη που δεν βρίσκονται αυτόματα → διόρθωση με το χέρι (πίνακας «manual»).
--   3. Καταγραφή με όνομα τμήματος ή «FileMaker» → ο υπεύθυνος του τμήματος (απόφαση ιδιοκτήτη, 26/10/2026).
-- Ονόματα που δεν υπάρχουν στη λίστα (π.χ. εξωτερικό εργαστήριο) μένουν ως έχουν.

do $$
declare
  v_org constant uuid := '7972f286-e8b8-4bbf-aa97-cf9a3d1375bd';
  v_total bigint; v_after bigint; v_changed bigint; v_dep_left bigint;
begin
  -- Μόνο διόρθωση ονόματος: η καταγραφή δεν σημειώνεται ως «επεξεργασμένη» και δεν γράφεται αναθεώρηση.
  -- Η παύση του trigger ισχύει μόνο μέσα σε αυτή τη συναλλαγή· ενεργοποιείται ξανά στο τέλος του μπλοκ.
  alter table public.control_executions disable trigger trg_control_execution_revision;
  select count(*) into v_total from public.control_executions where organization_id = v_org;

  create temp table actor_map on commit drop as
  with emp as (
    select trim(last_name) || ' ' || trim(first_name) as full_name, department_name as dep,
      array(select t from unnest(regexp_split_to_array(trim(regexp_replace(translate(upper(last_name || ' ' || first_name),
        'ΆΈΉΊΌΎΏΪΫABEHIKMNOPTXYZ', 'ΑΕΗΙΟΥΩΙΥΑΒΕΗΙΚΜΝΟΡΤΧΥΖ'), '[^Α-Ω]+', ' ', 'g')), ' ')) t where t <> '' order by t) as toks
    from public.employees where organization_id = v_org),
  act as (
    select distinct e.department_id, d.name as dep, e.response_data->>'actorName' as actor
    from public.control_executions e join public.departments d on d.id = e.department_id
    where e.organization_id = v_org and coalesce(e.response_data->>'actorName', '') <> ''),
  an as (
    select a.*, array(select t from unnest(regexp_split_to_array(trim(regexp_replace(translate(upper(a.actor),
        'ΆΈΉΊΌΎΏΪΫABEHIKMNOPTXYZ', 'ΑΕΗΙΟΥΩΙΥΑΒΕΗΙΚΜΝΟΡΤΧΥΖ'), '[^Α-Ω]+', ' ', 'g')), ' ')) t where t <> '' order by t) as toks
    from act a),
  exact as (
    select an.department_id, an.actor, min(emp.full_name) as name
    from an join emp on emp.toks = an.toks
    group by 1, 2 having count(distinct emp.full_name) = 1),
  pref as (
    select an.department_id, an.actor, min(emp.full_name) as name
    from an join emp on not exists (
      select 1 from unnest(an.toks) at
      where length(at) < 3 or not exists (select 1 from unnest(emp.toks) et where et like at || '%'))
    group by 1, 2 having count(distinct emp.full_name) = 1),
  manual(actor, name) as (values
    ('ΧΑΝΤΖΗ ΜΑΡΙΑ', 'ΧΑΤΖΗ ΜΑΡΙΑ'), ('ΧΑΤΖΗ', 'ΧΑΤΖΗ ΜΑΡΙΑ'),
    ('rentifhs', 'ΡΕΝΤΙΦΗΣ ΗΛΙΑΣ'), ('kanecoy', 'ΚΑΝΕΨΟΥ ΒΑΡΒΑΡΑ'),
    ('ΧΑΙΔΑ ΛΕΝΗ', 'ΧΑΙΔΑ ΕΛΕΝΗ'), ('ΠΟΥΠΑΛΟΥ ΚΑΑΛΙΟΠΗ', 'ΠΟΥΠΑΛΟΥ ΚΑΛΛΙΟΠΗ'),
    ('maliagka basilikh', 'ΜΑΛΙΑΓΚΑ ΒΑΣΙΛΙΚΗ'), ('ΜΑΛΙΑΓΚΑ ΒΙΚΗ', 'ΜΑΛΙΑΓΚΑ ΒΑΣΙΛΙΚΗ'), ('ΜΑΛΙΑΓΚΑ ΒΑΙΛΙΚΗ', 'ΜΑΛΙΑΓΚΑ ΒΑΣΙΛΙΚΗ'),
    ('ΑΘΑΝΑΣΙΑΔΟΥΝ ΔΕΣΠΟΙΝΑ', 'ΑΘΑΝΑΣΙΑΔΟΥ ΔΕΣΠΟΙΝΑ'), ('ΑΘΑΝΑΣΙΑΟΔΥ ΔΕΣΠΟΙΝΑ', 'ΑΘΑΝΑΣΙΑΔΟΥ ΔΕΣΠΟΙΝΑ'),
    ('ΑΘΑΝΑΣΑΙΔΟΥ ΔΕΣΠΟΙΝΑ', 'ΑΘΑΝΑΣΙΑΔΟΥ ΔΕΣΠΟΙΝΑ'),
    ('ΒΑΓΓΕΛΗΣ ΝΤΖΙΜΑΝΗΣ', 'ΝΤΖΙΜΑΝΗΣ ΕΥΑΓΓΕΛΟΣ'),
    ('MΠΑΤΣΙ', 'ΜΠΑΤΣΙ KΡΙΣΤΙΝΑ'),
    ('ΦΑΦΑΝΑΣ ΓΕΟΡΓΙΟΣ', 'ΦΑΦΑΝΑΣ ΓΕΩΡΓΙΟΣ'), ('ΦΑΦΑΝΑΣ ΓΕΩΡΓΕΙΟΣ', 'ΦΑΦΑΝΑΣ ΓΕΩΡΓΙΟΣ'), ('ΦΑΦΑΝΑΣ ΓΕΩΡΓΙΩΣ', 'ΦΑΦΑΝΑΣ ΓΕΩΡΓΙΟΣ'),
    ('ΚΡΥΒΟΣΙΔΗ ΕΛΕΝΗ', 'ΚΡΥΒΟΣΙΔΗ ΕΛΕΝΗ'), ('ΚΡΥΒΟΣΙΔΗ ΕΛΕΝΑ', 'ΚΡΥΒΟΣΙΔΗ ΕΛΕΝΗ'), ('κρυβοσιδη ελενη', 'ΚΡΥΒΟΣΙΔΗ ΕΛΕΝΗ'),
    ('XHIALLI ANASTASIA', 'ΤΖΙΑΛΛΙ ΑΝΑΣΤΑΣΙΑ'), ('XHIALLI', 'ΤΖΙΑΛΛΙ ΑΝΑΣΤΑΣΙΑ'), ('ΤΖΙΑΛΗ', 'ΤΖΙΑΛΛΙ ΑΝΑΣΤΑΣΙΑ'),
    ('ΤΖΙΑΛΛΙ ΑΝΑΣΤΑΣΙΑ', 'ΤΖΙΑΛΛΙ ΑΝΑΣΤΑΣΙΑ'),
    ('ΤΣΕΛΕΚΙΔΟΥ ΕΙΡΗΝΗ', 'ΤΣΕΛΕΚΙΔΟΥ ΕΙΡΗΝΗ'), ('ΕΙΡΗΝΗ ΤΣΕΛΕΚΙΔΟΥ', 'ΤΣΕΛΕΚΙΔΟΥ ΕΙΡΗΝΗ'),
    ('Β. Καργιώτης', 'ΚΑΡΓΙΩΤΗΣ ΒΑΣΙΛΕΙΟΣ')),
  heads(dep, name) as (values
    ('Χειρουργεία', 'ΠΑΓΑΝΑ ΕΛΕΝΗ'), ('Μαιευτική', 'ΡΑΓΙΑ ΑΘΑΝΑΣΙΑ'), ('Αίθουσα Τοκετών', 'ΜΠΑΓΙΩΤΗ ΕΥΑΓΓΕΛΙΑ'),
    ('ΜΕΘ', 'ΣΑΡΡΟΣ ΣΠΥΡΙΔΩΝ'), ('ΜΕΝΝ', 'ΧΑΚΚΑ ΑΝΔΡΟΜΑΧΗ'), ('Καρδιοχειρουργική', 'ΚΑΡΑΧΡΗΣΤΟΣ ΙΩΑΝΝΗΣ'),
    ('Παθολογική', 'ΓΚΑΡΕΛΗ ΕΥΤΑΞΙΑ'), ('Χειρουργική', 'ΚΥΡΓΙΑ ΓΕΩΡΓΙΑ'), ('ΤΕΠ', 'ΤΣΙΠΑ ΑΘΗΝΑ'),
    ('Αιμοδοσία', 'ΝΤΖΙΜΑΝΗΣ ΕΥΑΓΓΕΛΟΣ'), ('Αιμοδυναμικό', 'ΚΙΤΣΙΟΥ ΣΤΥΛΙΑΝΗ'), ('Αναισθησιολογικό', 'ΖΑΒΛΑΝΟΣ ΘΩΜΑΣ'),
    ('Απεικονίσεις', 'ΠΑΝΑΓΟΥ ΓΕΩΡΓΙΑ'), ('Ενδοσκοπικό', 'ΝΤΟΥΡΟΥ ΘΕΟΔΩΡΑ'), ('Κεντρικά Εργαστήρια', 'ΠΟΥΠΑΛΟΥ ΚΑΛΛΙΟΠΗ'),
    ('Κεντρική Κουζίνα', 'ΚΟΥΖΟΥΜΗ ΑΝΔΡΕΑΝΑ'), ('Μονάδα Τεχνητού Νεφρού', 'ΣΕΦΕΡΛΗ ΧΡΥΣΟΥΛΑ'),
    ('Οφθαλμολογικό Χειρουργείο', 'ΛΕΤΣΙΟΥ ΑΦΡΟΔΙΤΗ'), ('Παιδιατρική', 'ΠΑΠΑΙΩΑΝΝΟΥ ΕΥΑΓΓΕΛΙΑ'),
    ('Τεχνική Υπηρεσία', 'ΣΠΑΝΟΠΟΥΛΟΥ ΧΑΙΔΩ-ΜΑΡΙΑ'), ('Χημειοθεραπεία', 'ΜΠΕΦΑ ΘΕΟΔΩΡΑ'),
    ('Γραφείο Λοιμώξεων', 'ΣΑΡΡΟΣ ΣΠΥΡΙΔΩΝ'))
  select an.department_id, an.actor,
         coalesce(case when an.actor in (an.dep, 'FileMaker') then h.name end, m.name, x.name, p.name) as new_name
  from an
  left join heads h on h.dep = an.dep
  left join manual m on m.actor = an.actor
  left join exact x on x.department_id = an.department_id and x.actor = an.actor
  left join pref p on p.department_id = an.department_id and p.actor = an.actor;

  delete from actor_map where new_name is null or new_name = actor;

  -- Κάθε τμήμα που εμφανίζεται ως όνομα πρέπει να έχει υπεύθυνο
  select count(*) into v_dep_left
  from public.control_executions e join public.departments d on d.id = e.department_id
  where e.organization_id = v_org and e.response_data->>'actorName' = d.name
    and not exists (select 1 from actor_map m where m.department_id = e.department_id and m.actor = d.name);
  if v_dep_left <> 0 then raise exception '% καταγραφές με όνομα τμήματος χωρίς υπεύθυνο', v_dep_left; end if;

  update public.control_executions e
  set response_data = jsonb_set(e.response_data, '{actorName}', to_jsonb(m.new_name))
  from actor_map m
  where e.organization_id = v_org and e.department_id = m.department_id and e.response_data->>'actorName' = m.actor;
  get diagnostics v_changed = row_count;

  alter table public.control_executions enable trigger trg_control_execution_revision;

  select count(*) into v_after from public.control_executions where organization_id = v_org;
  if v_after <> v_total then raise exception 'Άλλαξε το πλήθος των καταγραφών'; end if;

  raise notice 'Έγινε: διορθώθηκε το όνομα σε % από % καταγραφές', v_changed, v_total;
end $$;
