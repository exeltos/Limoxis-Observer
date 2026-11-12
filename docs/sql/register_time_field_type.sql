-- Μητρώα: νέος τύπος πεδίου «Ώρα» (time), για την ώρα γέννησης και την ώρα
-- εισαγωγής των νεογνών στη ΜΕΝΝ. Ο έλεγχος των τύπων πεδίου ξαναγράφεται με
-- τον νέο τύπο· οι υπάρχοντες τύποι μένουν ίδιοι. Τρέχει μία φορά στο SQL Editor,
-- πριν από το migration 20261231490000_register_time_fields_nicu.sql.
alter table public.department_register_fields drop constraint department_register_fields_field_type_check;
alter table public.department_register_fields add constraint department_register_fields_field_type_check
  check (field_type in ('number','date','time','yes_no','choice','multi_choice','gestation','text','computed'));
