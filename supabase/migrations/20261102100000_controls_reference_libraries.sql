-- Central reference libraries read by the Controls module: the remaining
-- control types (equipment, disinfection/sterilisation, checklist audit),
-- measurement units, control answers, item forms, medicines & supplies,
-- equipment, and the environmental locations / surface points that until now
-- existed only in the Demo seed.
--
-- The baseline list moves into private.system_master_library_baseline() so the
-- per-organization seed and the global (organization_id is null) catalog of
-- 20260921120000 are filled from one source. Every earlier baseline row is
-- kept unchanged.
--
-- Backfill follows the global propagation mechanism: a global row is created
-- for each baseline (library_key, code) that has none yet (the fan-out trigger
-- copies it to every organization, linked through origin_item_id), every
-- organization is then re-seeded idempotently, and unlinked system copies are
-- linked to their global row. The seed now skips a code the organization
-- already holds, so a baseline row renamed centrally is not re-added under its
-- old name.

create or replace function private.system_master_library_baseline()
returns table(library_key text,code text,name_el text,name_en text,source_authority text,source_version text)
language sql
immutable
set search_path = ''
as $$
  select v.library_key,v.code,v.name_el,v.name_en,v.source_authority,v.source_version
  from (values
    ('microorganisms','MICRO-ABA','Acinetobacter baumannii','Acinetobacter baumannii','WHO BPPL 2024','2024'),
    ('microorganisms','MICRO-ECO','Escherichia coli','Escherichia coli','WHO BPPL 2024','2024'),
    ('microorganisms','MICRO-KPN','Klebsiella pneumoniae','Klebsiella pneumoniae','WHO BPPL 2024','2024'),
    ('microorganisms','MICRO-PAE','Pseudomonas aeruginosa','Pseudomonas aeruginosa','WHO BPPL 2024','2024'),
    ('microorganisms','MICRO-SAU','Staphylococcus aureus','Staphylococcus aureus','WHO BPPL 2024','2024'),
    ('microorganisms','MICRO-EFM','Enterococcus faecium','Enterococcus faecium','WHO BPPL 2024','2024'),
    ('microorganisms','MICRO-CDI','Clostridioides difficile','Clostridioides difficile','Limoxis IPC clinical core','current'),
    ('microorganisms','MICRO-CAU','Candida auris','Candida auris','Limoxis IPC emerging pathogen core','current'),
    ('microorganisms','MICRO-PMI','Proteus mirabilis','Proteus mirabilis','ΥΑ Υ1.Γ.Π.114971/ΦΕΚ Β 388/2014','2014'),
    ('microorganisms','MICRO-ECL','Enterobacter cloacae','Enterobacter cloacae','ΥΑ Υ1.Γ.Π.114971/ΦΕΚ Β 388/2014','2014'),
    ('antibiotics','ABX-AMX','Αμοξικιλλίνη','Amoxicillin','WHO AWaRe','2022'),
    ('antibiotics','ABX-AMC','Αμοξικιλλίνη/Κλαβουλανικό','Amoxicillin/clavulanic acid','WHO AWaRe','2022'),
    ('antibiotics','ABX-CRO','Κεφτριαξόνη','Ceftriaxone','WHO AWaRe','2022'),
    ('antibiotics','ABX-PTZ','Πιπερακιλλίνη/Ταζομπακτάμη','Piperacillin/Tazobactam','WHO AWaRe','2022'),
    ('antibiotics','ABX-MEM','Μεροπενέμη','Meropenem','WHO AWaRe','2022'),
    ('antibiotics','ABX-AMK','Αμικασίνη','Amikacin','WHO AWaRe','2022'),
    ('antibiotics','ABX-VAN','Βανκομυκίνη','Vancomycin','WHO AWaRe','2022'),
    ('antibiotics','ABX-LNZ','Λινεζολίδη','Linezolid','WHO AWaRe','2022'),
    ('antibiotics','ABX-COL','Κολιστίνη','Colistin','WHO AWaRe','2022'),
    ('antibiotics','ABX-CZA','Κεφταζιδίμη/Αβιμπακτάμη','Ceftazidime/avibactam','WHO AWaRe / Reserve','2022'),
    ('antibiotics','ABX-OXA','Οξακιλλίνη','Oxacillin','ΥΑ Υ1.Γ.Π.114971/ΦΕΚ Β 388/2014','2014'),
    ('notifiableDiseases','ND-MEASLES','Ιλαρά','Measles','ΕΟΔΥ · υποχρεωτική δήλωση','current'),
    ('notifiableDiseases','ND-RUBELLA','Ερυθρά','Rubella','ΕΟΔΥ · υποχρεωτική δήλωση','current'),
    ('notifiableDiseases','ND-MENINGO','Μηνιγγιτιδοκοκκική νόσος','Meningococcal disease','ΕΟΔΥ · υποχρεωτική δήλωση','current'),
    ('notifiableDiseases','ND-TB','Φυματίωση','Tuberculosis','ΕΟΔΥ · υποχρεωτική δήλωση','current'),
    ('notifiableDiseases','ND-LEGIONELLA','Λεγιονέλλωση','Legionellosis','ΕΟΔΥ · υποχρεωτική δήλωση','current'),
    ('notifiableDiseases','ND-HEPA','Ιογενής ηπατίτιδα Α','Viral hepatitis A','ΕΟΔΥ · υποχρεωτική δήλωση','current'),
    ('notifiableDiseases','ND-WNV','Λοίμωξη από ιό Δυτικού Νείλου','West Nile virus infection','ΕΟΔΥ · υποχρεωτική δήλωση','current'),
    ('sampleTypes','SAMPLE-BLOOD','Αίμα','Blood','Limoxis clinical microbiology core','current'),
    ('sampleTypes','SAMPLE-URINE','Ούρα','Urine','Limoxis clinical microbiology core','current'),
    ('sampleTypes','SAMPLE-CSF','ΕΝΥ','CSF','Limoxis clinical microbiology core','current'),
    ('sampleTypes','SAMPLE-SPUTUM','Πτύελα','Sputum','Limoxis clinical microbiology core','current'),
    ('sampleTypes','SAMPLE-BAL','BAL','BAL','Limoxis clinical microbiology core','current'),
    ('sampleTypes','SAMPLE-WOUND','Τραύμα / επίχρισμα','Wound / swab','Limoxis clinical microbiology core','current'),
    ('sampleTypes','SAMPLE-STOOL','Κόπρανα','Stool','Limoxis clinical microbiology core','current'),
    ('sampleTypes','SAMPLE-SURFACE','Επιφάνεια','Surface','Limoxis environmental surveillance core','current'),
    ('sampleTypes','SAMPLE-WATER','Νερό','Water','Limoxis environmental surveillance core','current'),
    ('professionalCategories','PROF-PHYSICIAN','Ιατρός','Physician','Limoxis workforce core','current'),
    ('professionalCategories','PROF-NURSE','Νοσηλευτής/τρια','Nurse','Limoxis workforce core','current'),
    ('professionalCategories','PROF-MIDWIFE','Μαία/Μαιευτής','Midwife','Limoxis workforce core','current'),
    ('professionalCategories','PROF-NA','Βοηθός Νοσηλευτή','Nursing Assistant','Limoxis workforce core','current'),
    ('professionalCategories','PROF-LAB','Επαγγελματίας Εργαστηρίου','Laboratory Professional','Limoxis workforce core','current'),
    ('professionalCategories','PROF-OTHER','Λοιπό προσωπικό','Other Staff','Limoxis workforce core','current'),
    ('vaccines','VAC-INFLUENZA','Γρίπη','Influenza','Limoxis occupational health core','current'),
    ('vaccines','VAC-HBV','Ηπατίτιδα Β','Hepatitis B','Limoxis occupational health core','current'),
    ('vaccines','VAC-MMR','MMR (Ιλαρά-Παρωτίτιδα-Ερυθρά)','MMR (Measles-Mumps-Rubella)','Limoxis occupational health core','current'),
    ('vaccines','VAC-VAR','Ανεμευλογιά','Varicella','Limoxis occupational health core','current'),
    ('vaccines','VAC-COVID19','COVID-19','COVID-19','Limoxis occupational health core','current'),
    ('wasteTypes','WASTE-INFECTIOUS','Επικίνδυνα απόβλητα μολυσματικού χαρακτήρα','Infectious hazardous healthcare waste','Limoxis healthcare waste core','current'),
    ('wasteTypes','WASTE-SHARP','Αιχμηρά αντικείμενα','Sharps','Limoxis healthcare waste core','current'),
    ('wasteTypes','WASTE-PHARM','Φαρμακευτικά απόβλητα','Pharmaceutical waste','Limoxis healthcare waste core','current'),
    ('wasteTypes','WASTE-CHEM','Χημικά απόβλητα','Chemical waste','Limoxis healthcare waste core','current'),
    ('wasteTypes','WASTE-MUNICIPAL','Αστικού τύπου απόβλητα','Municipal-type waste','Limoxis healthcare waste core','current'),
    ('antiseptics','ANT-ABHR','Αλκοολούχο αντισηπτικό χεριών','Alcohol-based hand rub','WHO hand hygiene core','current'),
    ('antiseptics','ANT-CHG','Χλωρεξιδίνη','Chlorhexidine','Limoxis antisepsis core','current'),
    ('antiseptics','ANT-PVP-I','Ποβιδόνη-ιώδιο','Povidone-iodine','Limoxis antisepsis core','current'),
    ('isolationTypes','ISO-CONTACT','Προφυλάξεις επαφής','Contact precautions','Limoxis IPC isolation core','current'),
    ('isolationTypes','ISO-DROPLET','Προφυλάξεις σταγονιδίων','Droplet precautions','Limoxis IPC isolation core','current'),
    ('isolationTypes','ISO-AIRBORNE','Αερογενείς προφυλάξεις','Airborne precautions','Limoxis IPC isolation core','current'),
    ('isolationTypes','ISO-PROTECTIVE','Προστατευτική απομόνωση','Protective isolation','Limoxis IPC isolation core','current'),
    ('controlTypes','CTRL-TEMP','Έλεγχος θερμοκρασίας','Temperature check','Limoxis controls core','current'),
    ('controlTypes','CTRL-EXPIRY','Έλεγχος ημερομηνιών λήξης','Expiry-date check','Limoxis controls core','current'),
    ('controlTypes','CTRL-ENV','Περιβαλλοντικός μικροβιολογικός έλεγχος','Environmental microbiological check','Limoxis controls core','current'),
    ('controlTypes','CTRL-HYGIENE','Έλεγχος υγιεινής / καθαριότητας','Hygiene / cleanliness check','Limoxis controls core','current'),
    ('controlTypes','CTRL-EQUIP','Έλεγχος εξοπλισμού','Equipment check','Limoxis controls core','current'),
    ('controlTypes','CTRL-DISINF','Έλεγχος απολύμανσης / αποστείρωσης','Disinfection / sterilisation check','Limoxis controls core','current'),
    ('controlTypes','CTRL-AUDIT','Επιθεώρηση με λίστα ελέγχου','Checklist audit','Limoxis controls core','current'),
    ('documentCategories','DOC-POLICY','Πολιτική','Policy','Limoxis document governance core','current'),
    ('documentCategories','DOC-PROCEDURE','Διαδικασία','Procedure','Limoxis document governance core','current'),
    ('documentCategories','DOC-PROTOCOL','Πρωτόκολλο','Protocol','Limoxis document governance core','current'),
    ('documentCategories','DOC-INSTRUCTION','Οδηγία εργασίας','Work instruction','Limoxis document governance core','current'),
    ('documentCategories','DOC-FORM','Έντυπο','Form','Limoxis document governance core','current'),
    ('measurementUnits','UNIT-CELSIUS','°C','°C','Limoxis measurement units core','current'),
    ('measurementUnits','UNIT-PERCENT','%','%','Limoxis measurement units core','current'),
    ('measurementUnits','UNIT-PPM','ppm','ppm','Limoxis measurement units core','current'),
    ('measurementUnits','UNIT-MGL','mg/L','mg/L','Limoxis measurement units core','current'),
    ('measurementUnits','UNIT-PH','pH','pH','Limoxis measurement units core','current'),
    ('measurementUnits','UNIT-KPA','kPa','kPa','Limoxis measurement units core','current'),
    ('measurementUnits','UNIT-BAR','bar','bar','Limoxis measurement units core','current'),
    ('measurementUnits','UNIT-CFU','CFU','CFU','Limoxis measurement units core','current'),
    ('measurementUnits','UNIT-CFU-M3','CFU/m³','CFU/m³','Limoxis measurement units core','current'),
    ('measurementUnits','UNIT-CFU-100ML','CFU/100mL','CFU/100mL','Limoxis measurement units core','current'),
    ('measurementUnits','UNIT-MIN','λεπτά','minutes','Limoxis measurement units core','current'),
    ('measurementUnits','UNIT-HOUR','ώρες','hours','Limoxis measurement units core','current'),
    ('measurementUnits','UNIT-PIECE','τεμάχια','pieces','Limoxis measurement units core','current'),
    ('controlAnswers','ANS-COMPLIANT','Συμμορφώνεται','Compliant','Limoxis controls core','current'),
    ('controlAnswers','ANS-NONCOMPLIANT','Μη συμμόρφωση','Non-compliant','Limoxis controls core','current'),
    ('controlAnswers','ANS-PARTIAL','Μερική συμμόρφωση','Partially compliant','Limoxis controls core','current'),
    ('controlAnswers','ANS-CLEAN','Καθαρό','Clean','Limoxis controls core','current'),
    ('controlAnswers','ANS-NOTCLEAN','Μη καθαρό','Not clean','Limoxis controls core','current'),
    ('controlAnswers','ANS-WORKING','Λειτουργικό','Working','Limoxis controls core','current'),
    ('controlAnswers','ANS-OUTOFORDER','Εκτός λειτουργίας','Out of order','Limoxis controls core','current'),
    ('controlAnswers','ANS-NA','Δεν εφαρμόζεται','Not applicable','Limoxis controls core','current'),
    ('itemForms','FORM-TABLET','Ταμπλέτα','Tablet','Limoxis medicines & supplies core','current'),
    ('itemForms','FORM-CAPSULE','Καψάκιο','Capsule','Limoxis medicines & supplies core','current'),
    ('itemForms','FORM-AMPOULE','Φύσιγγα','Ampoule','Limoxis medicines & supplies core','current'),
    ('itemForms','FORM-VIAL','Φιαλίδιο','Vial','Limoxis medicines & supplies core','current'),
    ('itemForms','FORM-FLACON','Φλακόν','Flacon','Limoxis medicines & supplies core','current'),
    ('itemForms','FORM-BOTTLE','Φιάλη','Bottle','Limoxis medicines & supplies core','current'),
    ('itemForms','FORM-BAG','Ασκός','Bag','Limoxis medicines & supplies core','current'),
    ('itemForms','FORM-TUBE','Σωληνάριο','Tube','Limoxis medicines & supplies core','current'),
    ('itemForms','FORM-PIECE','Τεμάχιο','Piece','Limoxis medicines & supplies core','current'),
    ('itemForms','FORM-PACK','Συσκευασία','Pack','Limoxis medicines & supplies core','current'),
    ('itemForms','FORM-OTHER','Άλλο','Other','Limoxis medicines & supplies core','current'),
    ('medicinesSupplies','MED-ADRENALINE-1MG','Adrenaline 1mg/ml','Adrenaline 1mg/ml','Limoxis medicines & supplies core','current'),
    ('medicinesSupplies','MED-ATROPINE-05MG','Atropine 0.5mg/ml','Atropine 0.5mg/ml','Limoxis medicines & supplies core','current'),
    ('medicinesSupplies','MED-AMIODARONE-150MG','Amiodarone 150mg/3ml','Amiodarone 150mg/3ml','Limoxis medicines & supplies core','current'),
    ('medicinesSupplies','MED-NALOXONE-04MG','Naloxone 0.4mg/ml','Naloxone 0.4mg/ml','Limoxis medicines & supplies core','current'),
    ('medicinesSupplies','MED-MIDAZOLAM-5MG','Midazolam 5mg/ml','Midazolam 5mg/ml','Limoxis medicines & supplies core','current'),
    ('medicinesSupplies','MED-FLUMAZENIL-01MG','Flumazenil 0.1mg/ml','Flumazenil 0.1mg/ml','Limoxis medicines & supplies core','current'),
    ('medicinesSupplies','MED-GLUCOSE-35','Γλυκόζη 35%','Glucose 35%','Limoxis medicines & supplies core','current'),
    ('medicinesSupplies','MED-HEPARIN-5000IU','Ηπαρίνη 5.000 IU/ml','Heparin 5,000 IU/ml','Limoxis medicines & supplies core','current'),
    ('medicinesSupplies','MED-ENOXAPARIN','Ενοξαπαρίνη','Enoxaparin','Limoxis medicines & supplies core','current'),
    ('medicinesSupplies','MED-NS-09-500','Φυσιολογικός ορός 0,9% 500ml','Normal saline 0.9% 500ml','Limoxis medicines & supplies core','current'),
    ('medicinesSupplies','MED-RL-500','Ringer''s Lactate 500ml','Ringer''s Lactate 500ml','Limoxis medicines & supplies core','current'),
    ('medicinesSupplies','MED-D5W-500','Δεξτρόζη 5% 500ml','Dextrose 5% 500ml','Limoxis medicines & supplies core','current'),
    ('medicinesSupplies','MED-PARACETAMOL-500MG','Παρακεταμόλη 500mg','Paracetamol 500mg','Limoxis medicines & supplies core','current'),
    ('medicinesSupplies','MED-PARACETAMOL-IV-1G','Παρακεταμόλη IV 1g','Paracetamol IV 1g','Limoxis medicines & supplies core','current'),
    ('medicinesSupplies','MED-METHYLPREDNISOLONE','Μεθυλπρεδνιζολόνη','Methylprednisolone','Limoxis medicines & supplies core','current'),
    ('medicinesSupplies','MED-HYDROCORTISONE','Υδροκορτιζόνη','Hydrocortisone','Limoxis medicines & supplies core','current'),
    ('medicinesSupplies','MED-SALBUTAMOL-INH','Σαλβουταμόλη εισπνεόμενη','Salbutamol inhaler','Limoxis medicines & supplies core','current'),
    ('medicinesSupplies','MED-FUROSEMIDE','Φουροσεμίδη','Furosemide','Limoxis medicines & supplies core','current'),
    ('medicinesSupplies','MED-INSULIN-RAPID','Ινσουλίνη ταχείας δράσης','Rapid-acting insulin','Limoxis medicines & supplies core','current'),
    ('medicinesSupplies','SUP-SYRINGE-10ML','Σύριγγες 10ml','Syringes 10ml','Limoxis medicines & supplies core','current'),
    ('medicinesSupplies','SUP-SYRINGE-5ML','Σύριγγες 5ml','Syringes 5ml','Limoxis medicines & supplies core','current'),
    ('medicinesSupplies','SUP-NEEDLE-21G','Βελόνες 21G','Needles 21G','Limoxis medicines & supplies core','current'),
    ('medicinesSupplies','SUP-IV-CANNULA-20G','Περιφερικοί φλεβοκαθετήρες 20G','Peripheral IV cannulas 20G','Limoxis medicines & supplies core','current'),
    ('medicinesSupplies','SUP-IV-GIVING-SET','Συσκευές ορού','IV giving sets','Limoxis medicines & supplies core','current'),
    ('medicinesSupplies','SUP-GLOVES-STERILE','Αποστειρωμένα γάντια','Sterile gloves','Limoxis medicines & supplies core','current'),
    ('medicinesSupplies','SUP-GAUZE-STERILE','Γάζες αποστειρωμένες','Sterile gauze','Limoxis medicines & supplies core','current'),
    ('medicinesSupplies','SUP-CHG-2','Χλωρεξιδίνη 2% διάλυμα','Chlorhexidine 2% solution','Limoxis medicines & supplies core','current'),
    ('medicinesSupplies','SUP-ABHR','Αλκοολούχο αντισηπτικό χεριών','Alcohol-based hand rub','Limoxis medicines & supplies core','current'),
    ('medicinesSupplies','SUP-ETT','Ενδοτραχειακοί σωλήνες','Endotracheal tubes','Limoxis medicines & supplies core','current'),
    ('medicinesSupplies','SUP-O2-MASK','Μάσκες οξυγόνου','Oxygen masks','Limoxis medicines & supplies core','current'),
    ('equipment','EQ-FRIDGE-MED','Ψυγείο φαρμάκων','Medication refrigerator','Limoxis equipment core','current'),
    ('equipment','EQ-FRIDGE-VACCINE','Ψυγείο εμβολίων','Vaccine refrigerator','Limoxis equipment core','current'),
    ('equipment','EQ-FREEZER','Καταψύκτης','Freezer','Limoxis equipment core','current'),
    ('equipment','EQ-CRASH-CART','Τροχήλατο ανάνηψης','Crash cart','Limoxis equipment core','current'),
    ('equipment','EQ-DEFIBRILLATOR','Απινιδωτής','Defibrillator','Limoxis equipment core','current'),
    ('equipment','EQ-AUTOCLAVE','Κλίβανος αποστείρωσης','Steriliser (autoclave)','Limoxis equipment core','current'),
    ('equipment','EQ-ENDOSCOPE-WD','Πλυντήριο-απολυμαντής ενδοσκοπίων','Endoscope washer-disinfector','Limoxis equipment core','current'),
    ('equipment','EQ-BEDPAN-WD','Πλυντήριο-απολυμαντής σκωραμίδων','Bedpan washer-disinfector','Limoxis equipment core','current'),
    ('equipment','EQ-ICE-MACHINE','Παρασκευαστής πάγου','Ice machine','Limoxis equipment core','current'),
    ('equipment','EQ-WATER-DISPENSER','Ψύκτης νερού','Water dispenser','Limoxis equipment core','current'),
    ('equipment','EQ-INCUBATOR','Θερμοκοιτίδα','Incubator','Limoxis equipment core','current'),
    ('equipment','EQ-SUCTION','Αναρροφητήρας','Suction unit','Limoxis equipment core','current'),
    ('equipment','EQ-O2-CYLINDER','Φιάλη οξυγόνου','Oxygen cylinder','Limoxis equipment core','current'),
    ('equipment','EQ-BSC','Θάλαμος βιολογικής ασφάλειας','Biosafety cabinet','Limoxis equipment core','current'),
    ('environmentalLocations','LOC-PATIENT-ROOM','Θάλαμος','Patient room','Limoxis environmental surveillance core','current'),
    ('environmentalLocations','LOC-NURSES-STATION','Σταθμός νοσηλευτών','Nurses station','Limoxis environmental surveillance core','current'),
    ('environmentalLocations','LOC-OPERATING-ROOM','Χειρουργική αίθουσα','Operating room','Limoxis environmental surveillance core','current'),
    ('environmentalLocations','LOC-ICU','ΜΕΘ','ICU','Limoxis environmental surveillance core','current'),
    ('environmentalLocations','LOC-CHANGING-ROOM','Αποδυτήρια','Changing room','Limoxis environmental surveillance core','current'),
    ('surfacePoints','POINT-BEDSIDE-TABLE','Κομοδίνο','Bedside table','Limoxis environmental surveillance core','current'),
    ('surfacePoints','POINT-DOOR-HANDLE','Πόμολο πόρτας','Door handle','Limoxis environmental surveillance core','current'),
    ('surfacePoints','POINT-BED-RAIL','Κλίνη','Bed rail','Limoxis environmental surveillance core','current'),
    ('surfacePoints','POINT-KEYBOARD','Πληκτρολόγιο','Keyboard','Limoxis environmental surveillance core','current'),
    ('surfacePoints','POINT-MEDICAL-EQUIPMENT','Ιατροτεχνολογικός εξοπλισμός','Medical equipment','Limoxis environmental surveillance core','current')
  ) as v(library_key,code,name_el,name_en,source_authority,source_version)
$$;

revoke all on function private.system_master_library_baseline() from public,anon,authenticated;

create or replace function private.seed_system_master_libraries(target_org uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if target_org is null then return; end if;

  insert into public.master_library_items (
    organization_id,library_key,code,name_el,name_en,metadata,source_authority,source_version,is_active
  )
  select target_org,b.library_key,b.code,b.name_el,b.name_en,
         jsonb_build_object('system',true,'locked',true,'baseline_code',b.code),
         b.source_authority,b.source_version,true
  from private.system_master_library_baseline() b
  where not exists (
    select 1 from public.master_library_items m
    where m.organization_id = target_org and m.library_key = b.library_key and m.code = b.code
  )
  on conflict (organization_id,library_key,name_el) do nothing;
end;
$$;

revoke all on function private.seed_system_master_libraries(uuid) from public,anon,authenticated;

alter table public.master_library_items disable trigger trg_audit_master_library_items;

-- Global catalog: one row per baseline code that has none (active or not), so a
-- row the Platform Owner deactivated is not brought back. The propagation
-- trigger fans each new row out to every organization.
insert into public.master_library_items (
  organization_id,library_key,code,name_el,name_en,metadata,source_authority,source_version,is_active
)
select null,b.library_key,b.code,b.name_el,b.name_en,
       jsonb_build_object('system',true,'locked',true,'baseline_code',b.code),
       b.source_authority,b.source_version,true
from private.system_master_library_baseline() b
where not exists (
  select 1 from public.master_library_items g
  where g.organization_id is null and g.library_key = b.library_key and g.code = b.code
);

do $$
declare r record;
begin
  for r in select id from public.organizations loop
    perform private.seed_system_master_libraries(r.id);
  end loop;
end;
$$;

update public.master_library_items m
set origin_item_id = g.id
from public.master_library_items g
where g.organization_id is null
  and m.organization_id is not null
  and m.origin_item_id is null
  and m.library_key = g.library_key
  and m.code = g.code
  and coalesce(m.metadata->>'system','false') = 'true';

alter table public.master_library_items enable trigger trg_audit_master_library_items;
