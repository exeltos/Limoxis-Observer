alter table public.departments disable trigger trg_audit_departments;

with org as (
  select id from public.organizations where code='DEMO-205918' limit 1
), seed(code,name) as (
  values
    ('ED','Τμήμα Επειγόντων Περιστατικών'),
    ('ICU','Μονάδα Εντατικής Θεραπείας'),
    ('PATH','Παθολογική Κλινική'),
    ('CARD','Καρδιολογική Κλινική'),
    ('SURG','Χειρουργική Κλινική'),
    ('ORTHO','Ορθοπαιδική Κλινική'),
    ('PED','Παιδιατρική Κλινική'),
    ('OBGYN','Μαιευτική / Γυναικολογική Κλινική'),
    ('NEURO','Νευρολογική Κλινική'),
    ('URO','Ουρολογική Κλινική'),
    ('PULM','Πνευμονολογική Κλινική'),
    ('NEPH','Νεφρολογική Κλινική'),
    ('DIALYSIS','Μονάδα Τεχνητού Νεφρού'),
    ('OR','Χειρουργεία'),
    ('OUTPATIENT','Εξωτερικά Ιατρεία'),
    ('LAB','Μικροβιολογικό Εργαστήριο'),
    ('RAD','Ακτινοδιαγνωστικό Τμήμα'),
    ('PHARM','Φαρμακείο'),
    ('CSSD','Κεντρική Αποστείρωση'),
    ('IPC','Τμήμα / Ομάδα Ελέγχου Λοιμώξεων')
)
insert into public.departments(organization_id,code,name,is_active)
select org.id,seed.code,seed.name,true
from org cross join seed
where not exists (
  select 1 from public.departments d
  where d.organization_id=org.id and coalesce(d.code,'')=seed.code
);

alter table public.departments enable trigger trg_audit_departments;
