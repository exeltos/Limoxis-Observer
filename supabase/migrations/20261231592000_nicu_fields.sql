-- ΜΕΝΝ, τα πεδία (ιδιοκτήτης 17/11/2026), σε κάθε μητρώο ΜΕΝΝ (ΙΑΣΩ και demo):
-- 1. PICC = διαδερμικός καθετήρας: το FileMaker είχε «ΦΕΡΕΙ PICC LINE» έως το 2023 και «ΔΙΑΡΚΕΙΑ ΦΛΕΒΙΚΟΥ ΚΑΘΕΤΗΡΑ» από
--    το 2024 (ποτέ και τα δύο). Ένα πεδίο, «Ημέρες PICC (διαδερμικός καθετήρας)» (central_line_days): οι ημέρες PICC περνούν
--    εκεί όπου είναι κενό· το picc_days αρχειοθετείται (η στήλη και οι τιμές του μένουν), όπως και οι δύο δείκτες PICC.
-- 2. «Αποκλειστική σίτιση με μπιμπερό» → «Σίτιση με μπιμπερό»: στην εισαγωγή μια ημερομηνία έναρξης σήμαινε «ναι».
-- 3. Μητρικό γάλα και ομφαλικός: η γενική επιλογή «Ναι» μένει για τις παλιές καταγραφές, με οδηγία να επιλέγεται το είδος.
-- 4. Όψιμη λοίμωξη: προτείνεται από θετική αιμοκαλλιέργεια ≥ 72 ώρες μετά την εισαγωγή και επιβεβαιώνεται από τη ΜΕΝΝ.
-- Μόνο update· καμία τιμή δεν σβήνεται.
do $fields$
declare
  reg record;
begin
  for reg in select r.id, r.table_name from public.department_registers r where r.template_key = 'nicu' and r.table_name is not null loop
    if exists (select 1 from information_schema.columns c where c.table_schema = 'public' and c.table_name = reg.table_name and c.column_name = 'picc_days') then
      execute format('update public.%I set central_line_days = picc_days where central_line_days is null and picc_days > 0', reg.table_name);
    end if;
    update public.department_register_fields set label_el = 'Ημέρες PICC (διαδερμικός καθετήρας)', label_en = 'PICC (percutaneous central line) days',
      aliases = array['ΔΙΑΡΚΕΙΑ ΦΛΕΒΙΚΟΥ ΚΑΘΕΤΗΡΑ', 'ΦΕΡΕΙ PICC _ LINE', 'ΦΕΡΕΙ PICC LINE', 'PICC LINE', 'PICC']
      where register_id = reg.id and key = 'central_line_days';
    update public.department_register_fields set archived = true where register_id = reg.id and key = 'picc_days';
    update public.department_register_indicators set archived = true where register_id = reg.id and key in ('picc_rate', 'mean_picc');
    update public.department_register_indicators set title_el = '% με PICC (διαδερμικό καθετήρα)', title_en = '% with a PICC (percutaneous central line)'
      where register_id = reg.id and key = 'central_line_rate';
    update public.department_register_indicators set title_el = 'Μέσες ημέρες PICC (διαδερμικού καθετήρα)', title_en = 'Mean PICC (percutaneous central line) days'
      where register_id = reg.id and key = 'mean_central_line';
    update public.department_register_fields set label_el = 'Σίτιση με μπιμπερό', label_en = 'Bottle feeding'
      where register_id = reg.id and key = 'bottle_feeding';
    update public.department_register_fields set help_el = 'Επιλέξτε το είδος: αποκλειστικά μητρικό ή μικτή σίτιση. Το «Ναι, χωρίς είδος» είναι για τις παλιές καταγραφές.',
      help_en = 'Choose the kind: exclusive or mixed. «Yes, type not recorded» is for the old records.'
      where register_id = reg.id and key = 'breast_milk';
    update public.department_register_options o set label_el = 'Ναι, χωρίς είδος (παλιές καταγραφές)', label_en = 'Yes, type not recorded (old records)'
      from public.department_register_fields f where f.id = o.field_id and f.register_id = reg.id and f.key = 'breast_milk' and o.value in ('kept', 'unspecified');
    update public.department_register_fields set help_el = 'Επιλέξτε φλεβικός, αρτηριακός ή και τα δύο, και συμπληρώστε τις ημέρες. Το «Ναι, χωρίς είδος» είναι για τις παλιές καταγραφές.',
      help_en = 'Choose venous, arterial or both, and fill in the days. «Yes, type not recorded» is for the old records.'
      where register_id = reg.id and key = 'umbilical_catheter';
    update public.department_register_options o set label_el = 'Ναι, χωρίς είδος (παλιές καταγραφές)', label_en = 'Yes, type not recorded (old records)'
      from public.department_register_fields f where f.id = o.field_id and f.register_id = reg.id and f.key = 'umbilical_catheter' and o.value in ('yes', 'unspecified');
    update public.department_register_fields set help_el = 'Προτείνεται αυτόματα όταν υπάρχει θετική αιμοκαλλιέργεια 72 ώρες ή περισσότερο μετά την εισαγωγή· η ΜΕΝΝ την επιβεβαιώνει ή την απορρίπτει.',
      help_en = 'Suggested when a blood culture is positive 72 hours or more after admission; the NICU confirms or rejects it.'
      where register_id = reg.id and key = 'late_infection';
  end loop;
end
$fields$;
