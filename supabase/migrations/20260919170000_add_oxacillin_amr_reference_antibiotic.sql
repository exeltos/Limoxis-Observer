-- The AMR-per-pathogen/antibiotic indicator (ΥΑ Υ1.Γ.Π.114971/ΦΕΚ Β 388/2014,
-- §2.3) uses oxacillin resistance as the reference marker for S. aureus
-- (MRSA), the universal EARS-Net-style convention. Oxacillin was missing
-- from the antibiotics baseline library entirely, so hospitals could not
-- record it through the standard antibiotic picker. Adds it to the
-- baseline seed function (future organizations) and backfills existing
-- organizations, identical in structure to the two prior baseline-library
-- migrations (20260902154615, 20260919140000).

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
  select target_org,v.library_key,v.code,v.name_el,v.name_en,
         jsonb_build_object('system',true,'locked',true,'baseline_code',v.code),
         v.source_authority,v.source_version,true
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
    ('documentCategories','DOC-POLICY','Πολιτική','Policy','Limoxis document governance core','current'),
    ('documentCategories','DOC-PROCEDURE','Διαδικασία','Procedure','Limoxis document governance core','current'),
    ('documentCategories','DOC-PROTOCOL','Πρωτόκολλο','Protocol','Limoxis document governance core','current'),
    ('documentCategories','DOC-INSTRUCTION','Οδηγία εργασίας','Work instruction','Limoxis document governance core','current'),
    ('documentCategories','DOC-FORM','Έντυπο','Form','Limoxis document governance core','current')
  ) as v(library_key,code,name_el,name_en,source_authority,source_version)
  on conflict (organization_id,library_key,name_el) do nothing;
end;
$$;

revoke all on function private.seed_system_master_libraries(uuid) from public,anon,authenticated;

alter table public.master_library_items disable trigger trg_audit_master_library_items;
do $$
declare r record;
begin
  for r in select id from public.organizations loop
    perform private.seed_system_master_libraries(r.id);
  end loop;
end;
$$;
alter table public.master_library_items enable trigger trg_audit_master_library_items;
