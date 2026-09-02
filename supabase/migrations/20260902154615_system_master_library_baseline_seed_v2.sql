create or replace function private.audit_management_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org uuid;
  v_entity text;
  v_actor_role public.app_role;
begin
  if tg_table_name = 'master_library_items'
     and tg_op = 'INSERT'
     and coalesce(new.metadata->>'system','false') = 'true'
     and pg_trigger_depth() > 1 then
    return new;
  end if;

  if (select auth.uid()) is null then
    raise exception 'Authentication required';
  end if;

  if tg_table_name = 'custom_role_capabilities' then
    select r.organization_id into v_org
    from public.custom_roles r
    where r.id = coalesce(new.custom_role_id, old.custom_role_id);
  else
    v_org := coalesce(new.organization_id, old.organization_id);
  end if;

  if v_org is not null and not public.is_org_member(v_org) then
    raise exception 'Organization membership required';
  end if;

  select om.role into v_actor_role
  from public.organization_members om
  where om.organization_id = v_org
    and om.user_id = (select auth.uid())
    and om.status = 'active'
  order by om.created_at desc
  limit 1;

  v_entity := coalesce(new.id, old.id)::text;

  insert into public.system_audit_log(
    organization_id,actor_user_id,actor_role,event_type,entity_type,entity_id,metadata
  ) values (
    v_org,(select auth.uid()),v_actor_role,lower(tg_op),tg_table_name,v_entity,
    jsonb_build_object('source','management_center','operation',tg_op)
  );

  return coalesce(new, old);
end;
$$;

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

create or replace function private.seed_system_master_libraries_on_org_create()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.seed_system_master_libraries(new.id);
  return new;
end;
$$;

revoke all on function private.seed_system_master_libraries_on_org_create() from public,anon,authenticated;

drop trigger if exists trg_seed_system_master_libraries on public.organizations;
create trigger trg_seed_system_master_libraries
after insert on public.organizations
for each row execute function private.seed_system_master_libraries_on_org_create();

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
