-- Πρόγραμμα καλλιεργειών (Επιτήρηση › Πρόγραμμα καλλιεργειών, απόφαση ιδιοκτήτη 2/11/2026): κάθε καλλιέργεια του προγράμματος
-- (έλεγχος κατηγορίας «Περιβαλλοντικός μικροβιολογικός έλεγχος», ανατεθειμένος στο Γραφείο Λοιμώξεων) λέει σε ποιο τμήμα γίνεται
-- η δειγματοληψία και τι είδος δείγματος παίρνεται. Με αυτά, «έγινε» διαβάζεται από τα περιβαλλοντικά δείγματα του εργαστηρίου
-- (τμήμα + είδος δείγματος), χωρίς καταχώριση δεύτερη φορά. Μόνο προσθήκη στηλών και συμπλήρωση για το ΙΑΣΩ.
alter table public.control_definitions add column if not exists culture_department_id uuid references public.departments(id) on delete set null;
alter table public.control_definitions add column if not exists culture_sample_types text[];

do $$
declare
  org uuid := '7972f286-e8b8-4bbf-aa97-cf9a3d1375bd';
begin
  if not exists (select 1 from public.organizations where id = org) then return; end if;
  -- The controls' audit trigger records the platform owner as the actor (as the earlier migrations).
  perform set_config('request.jwt.claims', '{"sub":"84066ee0-57b7-4cae-9186-09e491d3ea6d","role":"authenticated"}', true);
  update public.control_definitions c
     set culture_department_id = d.id, culture_sample_types = v.types
    from (values
      ('FM-CTRL-0183', 'Μαιευτική', array['surface']),
      ('FM-CTRL-0186', 'Χημειοθεραπεία', array['surface']),
      ('FM-CTRL-0195', 'Απεικονίσεις', array['surface']),
      ('FM-CTRL-0193', 'ΤΕΠ', array['surface']),
      ('FM-CTRL-0187', 'Κεντρικά Εργαστήρια', array['surface']),
      ('FM-CTRL-0182', 'IVF', array['surface','equipment']),
      ('FM-CTRL-1358', 'Οφθαλμολογικό Χειρουργείο', array['equipment']),
      ('FM-CTRL-0180', 'Καρδιοχειρουργική', array['surface']),
      ('FM-CTRL-1322', 'Οφθαλμολογικό Χειρουργείο', array['surface']),
      ('FM-CTRL-0190', 'Ιματιοθήκη - Επιμέλεια', array['surface']),
      ('FM-CTRL-0188', 'Χειρουργική', array['surface']),
      ('FM-CTRL-0189', 'Παθολογική', array['surface']),
      ('FM-CTRL-1359', 'Αποστείρωση', array['equipment']),
      ('FM-CTRL-0191', 'Μονάδα Τεχνητού Νεφρού', array['surface']),
      ('FM-CTRL-0185', 'Αιμοδυναμικό', array['surface']),
      ('FM-CTRL-0198', 'Κεντρική Κουζίνα', array['surface']),
      ('FM-CTRL-0192', 'Ακτινοθεραπεία', array['surface']),
      ('FM-CTRL-0177', 'ΜΕΝΝ', array['surface']),
      ('FM-CTRL-0181', 'ΜΕΘ', array['surface']),
      ('FM-CTRL-0179', 'Αποστείρωση', array['surface']),
      ('FM-CTRL-0184', 'Αίθουσα Τοκετών', array['surface']),
      ('FM-CTRL-0178', 'Χειρουργεία', array['surface','equipment']),
      ('FM-CTRL-0194', 'Ενδοσκοπικό', array['surface']),
      ('FM-CTRL-1373', 'Μονάδα Τεχνητού Νεφρού', array['water']),
      ('FM-CTRL-1375', 'Κεντρική Κουζίνα', array['food'])
    ) as v(code, dept, types)
    join public.departments d on d.organization_id = org and d.name = v.dept
   where c.organization_id = org and c.code = v.code and c.culture_department_id is null;
end
$$;
