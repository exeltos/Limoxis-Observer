-- Official ΕΟΔΥ catalogue of notifiable diseases (Υ.Α. Δ1α/Γ.Π.οικ. 16711/2022, ΦΕΚ 1665/Β/7-4-2022):
-- all 57 diseases as global system rows of the «notifiableDiseases» library. Additive only:
--   * a global row is inserted only when no global row of the library has the same Greek name
--     (Ιλαρά, Ερυθρά, Μηνιγγιτιδοκοκκική νόσος, Φυματίωση already exist and are kept as they are);
--   * the existing propagation trigger copies each new global row to every organisation
--     (on conflict (organization_id, library_key, name_el) do nothing), so hospital rows are untouched;
--   * nothing is updated, deactivated or deleted. The older rows whose names differ from the catalogue
--     (ND-HEPA, ND-LEGIONELLA, ND-WNV) stay; the app reads deadlines from the catalogue by name.
-- The deadline (Αμέσως / 24ωρο / Εβδομάδα) lives in the application's catalogue (eodyCatalogue.js).
alter table public.master_library_items disable trigger trg_audit_master_library_items;

insert into public.master_library_items (
  organization_id,library_key,code,name_el,name_en,metadata,source_authority,source_version,is_active
)
select null,'notifiableDiseases',v.code,v.name_el,v.name_en,
       jsonb_build_object('system',true,'locked',true,'baseline_code',v.code),
       'ΕΟΔΥ · Υ.Α. Δ1α/Γ.Π.οικ. 16711/2022 (ΦΕΚ 1665/Β/2022)','2022',true
from (values
    ('ND-EODY-01','Creutzfeldt-Jakob (Νόσος Creutzfeldt-Jakob - CJD)','Creutzfeldt-Jakob disease (CJD)'),
    ('ND-EODY-02','COVID-19 (Λοίμωξη από νέο κορωνοϊό SARS-CoV-2)','COVID-19 (infection with the novel coronavirus SARS-CoV-2)'),
    ('ND-EODY-03','HIV λοίμωξη','HIV infection'),
    ('ND-EODY-04','Αιμορραγικοί ιογενείς πυρετοί','Viral haemorrhagic fevers'),
    ('ND-EODY-05','Αλλαντίαση','Botulism'),
    ('ND-EODY-06','Ανεμοβλογιά με επιπλοκές','Varicella with complications'),
    ('ND-EODY-07','Άνθρακας','Anthrax'),
    ('ND-EODY-08','Ασυνήθιστο συμβάν (συρροής κρουσμάτων ή μεμονωμένου περιστατικού)','Unusual event (cluster of cases or a single case)'),
    ('ND-EODY-09','Βρουκέλλωση','Brucellosis'),
    ('ND-EODY-10','Γονόρροια','Gonorrhoea'),
    ('ND-EODY-11','Γρίπη (κρούσμα με εργαστηριακή επιβεβαίωση ή σύνδεση με κρούσμα που έχει επιβεβαιωθεί εργαστηριακά)','Influenza (laboratory-confirmed case, or a case linked to a laboratory-confirmed case)'),
    ('ND-EODY-12','Δάγκειος πυρετός','Dengue fever'),
    ('ND-EODY-13','Διφθερίτιδα','Diphtheria'),
    ('ND-EODY-14','Δυτικός Νείλος (Λοίμωξη από ιό του Δυτικού Νείλου)','West Nile virus infection'),
    ('ND-EODY-15','Εγκεφαλίτιδες από αρθρο-ιούς (συμπεριλαμβανομένης της κροτωνογενούς εγκεφαλίτιδας)','Arthropod-borne viral encephalitis (including tick-borne encephalitis)'),
    ('ND-EODY-16','Ελονοσία','Malaria'),
    ('ND-EODY-17','Ερυθρά','Rubella'),
    ('ND-EODY-18','Ερυθρά, συγγενής','Congenital rubella'),
    ('ND-EODY-19','Ευλογιά','Smallpox'),
    ('ND-EODY-20','Εχινοκοκκίαση','Echinococcosis'),
    ('ND-EODY-21','ΖΙΚΑ (Λοίμωξη από ιό) και συγγενής λοίμωξη από ιό ΖΙΚΑ','Zika virus infection and congenital Zika virus infection'),
    ('ND-EODY-22','Ηπατίτιδα Α, οξεία','Hepatitis A, acute'),
    ('ND-EODY-23','Ηπατίτιδα Β (οξεία, χρόνια)','Hepatitis B (acute, chronic)'),
    ('ND-EODY-24','Ηπατίτιδα C (οξεία, χρόνια)','Hepatitis C (acute, chronic)'),
    ('ND-EODY-25','Ιλαρά','Measles'),
    ('ND-EODY-26','Καμπυλοβακτηρίδιο (Λοίμωξη από)','Campylobacter infection'),
    ('ND-EODY-27','Κοκκύτης','Pertussis'),
    ('ND-EODY-28','Κολοβακτηρίδιο (Λοίμωξη από εντεροαιμορραγικό κολοβακτηρίδιο EHEC/VTEC/STEC)','Escherichia coli infection (enterohaemorrhagic E. coli EHEC/VTEC/STEC)'),
    ('ND-EODY-29','Λεγιονέλλωση/Πυρετός Pontiac','Legionnaires’ disease / Pontiac fever'),
    ('ND-EODY-30','Λεϊσμανίαση','Leishmaniasis'),
    ('ND-EODY-31','Λεπτοσπείρωση','Leptospirosis'),
    ('ND-EODY-32','Λιστερίωση','Listeriosis'),
    ('ND-EODY-33','Λοιμώξεις που Συνδέονται με Χώρους Υπηρεσιών Υγείας (ΛΣΧΠΥΥ)','Healthcare-associated infections (HAI)'),
    ('ND-EODY-34','Λύσσα','Rabies'),
    ('ND-EODY-35','Μελιοείδωση/Μάλη','Melioidosis / Glanders'),
    ('ND-EODY-36','Μηνιγγίτιδα (βακτηριακή, άσηπτη)','Meningitis (bacterial, aseptic)'),
    ('ND-EODY-37','Μηνιγγιτιδοκοκκική νόσος','Meningococcal disease'),
    ('ND-EODY-38','Νόσος Lyme/ Μπορρελίωση, Ρικετσιώσεις, Αναπλάσμωση, Ερλιχίωση','Lyme disease / Borreliosis, Rickettsioses, Anaplasmosis, Ehrlichiosis'),
    ('ND-EODY-39','Πανώλη','Plague'),
    ('ND-EODY-40','Παρωτίτιδα','Mumps'),
    ('ND-EODY-41','Πολυομυελίτιδα (και οξεία χαλαρή παράλυση)','Poliomyelitis (and acute flaccid paralysis)'),
    ('ND-EODY-42','Πυρετός Q','Q fever'),
    ('ND-EODY-43','Σαλμονέλλωση (μη τυφο-παρατυφική)','Salmonellosis (non-typhoidal, non-paratyphoidal)'),
    ('ND-EODY-44','ΣΟΑΣ- SARS (Σοβαρό Οξύ Αναπνευστικό Σύνδρομο)','SARS (Severe Acute Respiratory Syndrome)'),
    ('ND-EODY-45','Σιγκέλλωση','Shigellosis'),
    ('ND-EODY-46','Σύφιλη','Syphilis'),
    ('ND-EODY-47','Σύφιλη συγγενής','Congenital syphilis'),
    ('ND-EODY-48','Συρροή κρουσμάτων τροφιμογενούς-υδατογενούς νοσήματος','Cluster of cases of a food-borne or water-borne disease'),
    ('ND-EODY-49','Τέτανος/Τέτανος νεογνικός','Tetanus / Neonatal tetanus'),
    ('ND-EODY-50','Τοξοπλάσμωση, συγγενής','Toxoplasmosis, congenital'),
    ('ND-EODY-51','Τουλαραιμία','Tularaemia'),
    ('ND-EODY-52','Τριχίνωση','Trichinellosis'),
    ('ND-EODY-53','Τσικουνγκούνια - Chikungunya (Λοίμωξη από ιό Chikungunya)','Chikungunya virus infection'),
    ('ND-EODY-54','Τυφοειδής και παρατυφοειδής πυρετός','Typhoid and paratyphoid fever'),
    ('ND-EODY-55','Φυματίωση','Tuberculosis'),
    ('ND-EODY-56','Χλαμυδιακή λοίμωξη','Chlamydial infection'),
    ('ND-EODY-57','Χολέρα','Cholera')
) as v(code,name_el,name_en)
where not exists (
  select 1 from public.master_library_items g
  where g.organization_id is null and g.library_key = 'notifiableDiseases'
    and (g.name_el = v.name_el or g.code = v.code)
);

alter table public.master_library_items enable trigger trg_audit_master_library_items;

