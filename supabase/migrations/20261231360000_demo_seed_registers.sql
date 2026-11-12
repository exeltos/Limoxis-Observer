-- Demo: Μητρώα τμημάτων με δείκτες, στόχους και περιστατικά.
--
-- Κάθε νέο ή επαναφερόμενο Demo νοσοκομείο παίρνει επτά μητρώα, φτιαγμένα από
-- τα ίδια πρότυπα με την εφαρμογή (registerTemplates.js → registerCloud.definitionRows,
-- εδώ ως jsonb) και με τον ίδιο πίνακα δεδομένων που φτιάχνει το
-- public.department_register_sync:
--   REG-001 Μητρώο ασθενών ΜΕΘ                (ΜΕΘ)   ~6 μήνες νοσηλειών
--   REG-002 Μητρώο νεογνών ΜΕΝΝ                (ΜΕΝΝ)  ~6 μήνες νεογνών
--   REG-003 Μητρώο νοσηλευομένων Παιδιατρικής  (ΠΑΙΔ)  ~6 μήνες νοσηλειών
--   REG-004 Πράξεις Ενδοσκοπικού (φύλλο)       (ΕΝΔ)   3 μηνιαία σύνολα και ημερήσια φύλλα
--   REG-005 Μητρώο λεχωίδων Μαιευτικής         (ΜΑΙ)   ~5 μήνες τοκετών
--   REG-006 Πράξεις Αίθουσας Τοκετών (φύλλο)   (ΑΤ)    οι τοκετοί του REG-005 ανά ημέρα / μήνα
--   REG-007 Δραστηριότητα ΤΕΠ ανά βάρδια (φύλλο) (ΤΕΠ) 3 μηνιαία σύνολα και ημερήσια φύλλα
-- Το Demo δεν έχει από το demo_seed_departments_patients Μαιευτική, Αίθουσα
-- Τοκετών, ΤΕΠ και Ενδοσκοπικό· προστίθενται εδώ όπως στο ΙΑΣΩ (χωριστά τμήματα),
-- χωρίς κλινοημέρες. Στόχοι: μόνο όσοι έχουν εγκριθεί για τα πραγματικά μητρώα
-- (ο στόχος καισαρικών του Μητρώου λεχωίδων είναι πρόταση και δεν μπαίνει).
-- Ονόματα και αριθμοί περιστατικών είναι επινοημένα· ημερομηνίες σχετικές με τη
-- σημερινή ημέρα σε ώρα Ευρώπης/Αθήνας.
--
-- Πίνακες δεδομένων: το demo_wipe_data σβήνει τις γραμμές του μητρώου (και, μέσω
-- on delete cascade, τις γραμμές των πινάκων του), αλλά ο ίδιος ο πίνακας
-- register_<πρότυπο>_<8> μένει. Για να μη μαζεύονται άδειοι πίνακες σε κάθε
-- επαναφορά, το Demo μητρώο παίρνει σταθερό όνομα πίνακα ανά νοσοκομείο και πρότυπο
-- (md5 του νοσοκομείου και του προτύπου), οπότε η επόμενη επαναφορά ξαναχρησιμοποιεί
-- τον ίδιο πίνακα: το sync ξαναδένει τον trigger στο νέο μητρώο και το
-- register_fast_policies τις πολιτικές ανάγνωσης.
--
-- Η επαναφορά τρέχει και από τον ίδιο τον αξιολογητή (demo_reset_my_organization),
-- με όποιον ρόλο έχει διαλέξει (π.χ. Σύνδεσμος νοσηλευτής). Γι' αυτό ο πίνακας
-- φτιάχνεται από το private.demo_register_sync, ίδιο με το
-- public.department_register_sync χωρίς τον έλεγχο «ποιος ορίζει μητρώα»
-- (το demo_seed_data έχει ήδη ελέγξει ότι πρόκειται για Demo).

-- Ψευδοτυχαίος αριθμός [0,1) σταθερός ανά περιστατικό και χαρακτηριστικό.
create or replace function private.demo_register_rand(p_i integer, p_salt integer)
returns double precision
language sql
immutable
set search_path = ''
as $function$
  select (('x' || substr(md5(p_i::text || ':' || p_salt::text), 1, 8))::bit(32)::bigint)::double precision / 4294967296.0;
$function$;
revoke all on function private.demo_register_rand(integer, integer) from public, anon, authenticated;

-- Τα πρότυπα της εφαρμογής (registerTemplates.js, registerTemplatesHospital.js) ως
-- γραμμές ορισμού, χωρίς τα ονόματα στηλών του FileMaker (aliases, match). Η
-- Αίθουσα Τοκετών έχει τις διορθώσεις δεικτών που ενέκρινε ο ιδιοκτήτης
-- (20261231221000)· η Μαιευτική επινοημένους θεράποντες ιατρούς.
create or replace function private.demo_register_template(p_key text)
returns jsonb
language sql
immutable
set search_path = ''
as $function$
  select case p_key
    when 'icu' then $tpl${"name_el":"Μητρώο ασθενών ΜΕΘ","name_en":"ICU patient register","description_el":"Μία καρτέλα ανά νοσηλεία, Γενική και Καρδιοχειρουργική ΜΕΘ. Δείκτες: θνησιμότητα, SMR έναντι APACHE II, ημέρες ΜΕΘ, κατακλίσεις, επανεισαγωγές 48ώρου.","description_en":"One card per stay, General and Cardiac surgery ICU. Indicators: mortality, observed vs APACHE II predicted, ICU days, pressure ulcers, 48-hour readmissions.","kind":"case","entry_date_field":"admission_date","identity_case_number":true,"identity_patient_name":true,"sections":[{"key":"admission","label_el":"Εισαγωγή","label_en":"Admission","position":0},{"key":"severity","label_el":"Βαρύτητα","label_en":"Severity","position":1},{"key":"stay","label_el":"Νοσηλεία","label_en":"Stay","position":2},{"key":"discharge","label_el":"Έξοδος από τη ΜΕΘ","label_en":"Leaving the ICU","position":3}],"fields":[{"key":"admission_date","section_key":"admission","position":0,"field_type":"date","label_el":"Ημερομηνία εισαγωγής","label_en":"Admission date","required":true,"in_list":false,"in_breakdown":false,"provisional":false,"aliases":[],"archived":false},{"key":"category","section_key":"admission","position":1,"field_type":"choice","label_el":"Κατηγορία ασθενούς","label_en":"Patient category","required":true,"in_list":true,"in_breakdown":true,"provisional":false,"aliases":[],"archived":false},{"key":"age","section_key":"admission","position":2,"field_type":"number","label_el":"Ηλικία","label_en":"Age","unit_el":"έτη","unit_en":"years","min_value":0,"max_value":120,"required":false,"in_list":true,"in_breakdown":false,"provisional":false,"aliases":[],"archived":false},{"key":"sex","section_key":"admission","position":3,"field_type":"choice","label_el":"Φύλο","label_en":"Sex","required":false,"in_list":false,"in_breakdown":false,"provisional":false,"aliases":[],"archived":false},{"key":"admission_reason","section_key":"admission","position":4,"field_type":"choice","label_el":"Αιτία εισαγωγής","label_en":"Reason for admission","required":false,"in_list":false,"in_breakdown":true,"provisional":true,"aliases":[],"archived":false},{"key":"requisition","section_key":"admission","position":5,"field_type":"yes_no","label_el":"Επίταξη","label_en":"Requisitioned bed","required":false,"in_list":false,"in_breakdown":false,"provisional":false,"aliases":[],"archived":false},{"key":"readmission_48h","section_key":"admission","position":6,"field_type":"yes_no","label_el":"Επανεισαγωγή εντός 48 ωρών","label_en":"Readmission within 48 h","required":false,"in_list":false,"in_breakdown":false,"provisional":false,"aliases":[],"archived":false},{"key":"apache_score","section_key":"severity","position":7,"field_type":"number","label_el":"APACHE II score","label_en":"APACHE II score","min_value":0,"max_value":71,"required":false,"in_list":false,"in_breakdown":false,"provisional":false,"aliases":[],"archived":false},{"key":"apache_postop","section_key":"severity","position":8,"field_type":"yes_no","label_el":"Μετεγχειρητικός ασθενής","label_en":"Post-operative admission","required":false,"in_list":false,"in_breakdown":false,"provisional":false,"help_el":"Για τον πίνακα θνητότητας APACHE II.","help_en":"Selects the APACHE II mortality table.","aliases":[],"archived":false},{"key":"apache_mortality","section_key":"severity","position":9,"field_type":"computed","label_el":"Προβλεπόμενη θνητότητα APACHE II","label_en":"APACHE II predicted mortality","unit_el":"%","unit_en":"%","required":false,"in_list":false,"in_breakdown":false,"provisional":false,"help_el":"Υπολογίζεται από το APACHE II score και το αν ο ασθενής είναι μετεγχειρητικός.","help_en":"Computed from the APACHE II score and whether the admission is post-operative.","computed_kind":"apache_ii","computed_from":"apache_score","computed_to":"apache_postop","aliases":[],"archived":false},{"key":"euroscore","section_key":"severity","position":10,"field_type":"number","label_el":"EuroSCORE II","label_en":"EuroSCORE II","unit_el":"%","unit_en":"%","min_value":0,"max_value":100,"required":false,"in_list":false,"in_breakdown":false,"provisional":false,"help_el":"Μόνο για την Καρδιοχειρουργική ΜΕΘ, ως %.","help_en":"Cardiac surgery ICU only, as %.","show_when_key":"category","show_when_value":"cardiac","aliases":[],"archived":false},{"key":"ventilator_hours","section_key":"stay","position":11,"field_type":"number","label_el":"Ώρες στον αναπνευστήρα","label_en":"Ventilator hours","unit_el":"ώρες","unit_en":"hours","min_value":0,"max_value":8760,"required":false,"in_list":false,"in_breakdown":false,"provisional":false,"aliases":[],"archived":false},{"key":"pressure_ulcer","section_key":"stay","position":12,"field_type":"yes_no","label_el":"Εμφάνιση κατάκλισης","label_en":"Pressure ulcer developed","required":false,"in_list":false,"in_breakdown":false,"provisional":false,"aliases":[],"archived":false},{"key":"vap","section_key":"stay","position":13,"field_type":"yes_no","label_el":"VAP","label_en":"VAP","required":false,"in_list":false,"in_breakdown":false,"provisional":false,"help_el":"Θα συνδεθεί με το επεισόδιο στην Επιτήρηση.","help_en":"To be linked with the Surveillance episode.","aliases":[],"archived":false},{"key":"air_mattress","section_key":"stay","position":14,"field_type":"yes_no","label_el":"Αερόστρωμα","label_en":"Air mattress","required":false,"in_list":false,"in_breakdown":false,"provisional":false,"aliases":[],"archived":false},{"key":"daily_cleaning","section_key":"stay","position":15,"field_type":"yes_no","label_el":"Καθημερινή καθαριότητα","label_en":"Daily cleaning","required":false,"in_list":false,"in_breakdown":false,"provisional":false,"aliases":[],"archived":false},{"key":"line_care","section_key":"stay","position":16,"field_type":"yes_no","label_el":"Καθημερινή περιποίηση γραμμών","label_en":"Daily line care","required":false,"in_list":false,"in_breakdown":false,"provisional":false,"aliases":[],"archived":false},{"key":"cultures","section_key":"stay","position":17,"field_type":"yes_no","label_el":"Λήψη καλλιεργειών","label_en":"Cultures taken","required":false,"in_list":false,"in_breakdown":false,"provisional":false,"aliases":[],"archived":false},{"key":"discharge_date","section_key":"discharge","position":18,"field_type":"date","label_el":"Ημερομηνία εξόδου","label_en":"Discharge date","required":false,"in_list":true,"in_breakdown":false,"provisional":false,"not_before_key":"admission_date","aliases":[],"archived":false},{"key":"length_of_stay","section_key":"discharge","position":19,"field_type":"computed","label_el":"Ημέρες ΜΕΘ","label_en":"ICU days","unit_el":"ημέρες","unit_en":"days","required":false,"in_list":false,"in_breakdown":false,"provisional":false,"computed_kind":"days","computed_from":"admission_date","computed_to":"discharge_date","aliases":[],"archived":false},{"key":"outcome","section_key":"discharge","position":20,"field_type":"choice","label_el":"Πού πήγε","label_en":"Where to","required":false,"in_list":true,"in_breakdown":true,"provisional":false,"show_when_key":"discharge_date","aliases":[],"archived":false},{"key":"transfer_department","section_key":"discharge","position":21,"field_type":"choice","label_el":"Τμήμα μεταφοράς","label_en":"Receiving ward","required":false,"in_list":false,"in_breakdown":false,"provisional":true,"help_el":"Το νοσηλευτικό τμήμα όπου πήγε ο ασθενής. Η λίστα συμπληρώνεται με τα τμήματα του νοσοκομείου.","help_en":"The ward the patient went to. The list is completed with the hospital’s wards.","show_when_key":"outcome","show_when_value":"transfer_ward","aliases":[],"archived":false}],"options":[{"fieldKey":"category","value":"general","label_el":"Γενική ΜΕΘ","label_en":"General ICU","position":0,"match":[],"archived":false},{"fieldKey":"category","value":"cardiac","label_el":"Καρδιοχειρουργική ΜΕΘ","label_en":"Cardiac surgery ICU","position":1,"match":[],"archived":false},{"fieldKey":"sex","value":"male","label_el":"Άνδρας","label_en":"Male","position":0,"match":[],"archived":false},{"fieldKey":"sex","value":"female","label_el":"Γυναίκα","label_en":"Female","position":1,"match":[],"archived":false},{"fieldKey":"admission_reason","value":"respiratory","label_el":"Αναπνευστική ανεπάρκεια","label_en":"Respiratory failure","position":0,"match":[],"archived":false},{"fieldKey":"admission_reason","value":"sepsis","label_el":"Σήψη / σηπτική καταπληξία","label_en":"Sepsis / septic shock","position":1,"match":[],"archived":false},{"fieldKey":"admission_reason","value":"cardiac_surgery","label_el":"Καρδιοχειρουργική επέμβαση","label_en":"Cardiac surgery","position":2,"match":[],"archived":false},{"fieldKey":"admission_reason","value":"postop","label_el":"Μετεγχειρητική παρακολούθηση","label_en":"Post-operative care","position":3,"match":[],"archived":false},{"fieldKey":"admission_reason","value":"cardiac","label_el":"Καρδιολογική","label_en":"Cardiac","position":4,"match":[],"archived":false},{"fieldKey":"admission_reason","value":"neuro","label_el":"Νευρολογική","label_en":"Neurological","position":5,"match":[],"archived":false},{"fieldKey":"admission_reason","value":"trauma","label_el":"Τραύμα","label_en":"Trauma","position":6,"match":[],"archived":false},{"fieldKey":"admission_reason","value":"other","label_el":"Άλλο","label_en":"Other","position":7,"match":[],"archived":false},{"fieldKey":"outcome","value":"transfer_ward","label_el":"Μεταφορά σε νοσηλευτικό τμήμα","label_en":"Transfer to a ward","position":0,"match":[],"archived":false},{"fieldKey":"outcome","value":"transfer_hospital","label_el":"Διακομιδή σε άλλο νοσοκομείο","label_en":"Transfer to another hospital","position":1,"match":[],"archived":false},{"fieldKey":"outcome","value":"death","label_el":"Θάνατος","label_en":"Death","position":2,"match":[],"archived":false},{"fieldKey":"transfer_department","value":"internal","label_el":"Παθολογική","label_en":"Internal Medicine","position":0,"match":[],"archived":false},{"fieldKey":"transfer_department","value":"surgical","label_el":"Χειρουργική","label_en":"Surgery","position":1,"match":[],"archived":false},{"fieldKey":"transfer_department","value":"cardiology","label_el":"Καρδιολογική","label_en":"Cardiology","position":2,"match":[],"archived":false},{"fieldKey":"transfer_department","value":"cardiac_surgery_ward","label_el":"Καρδιοχειρουργική κλινική","label_en":"Cardiac surgery ward","position":3,"match":[],"archived":false},{"fieldKey":"transfer_department","value":"neurology","label_el":"Νευρολογική","label_en":"Neurology","position":4,"match":[],"archived":false},{"fieldKey":"transfer_department","value":"orthopaedic","label_el":"Ορθοπαιδική","label_en":"Orthopaedics","position":5,"match":[],"archived":false},{"fieldKey":"transfer_department","value":"pulmonary","label_el":"Πνευμονολογική","label_en":"Pulmonology","position":6,"match":[],"archived":false},{"fieldKey":"transfer_department","value":"other_ward","label_el":"Άλλο τμήμα","label_en":"Other ward","position":7,"match":[],"archived":false}],"axes":[],"indicators":[{"key":"patients","position":0,"title_el":"Ασθενείς","title_en":"Patients","aggregation":"count","sheet_rows":[],"denominator_rows":[],"daily_only":false,"direction":"context","archived":false},{"key":"cardiac_share","position":1,"title_el":"% Καρδιοχειρουργικής ΜΕΘ","title_en":"% Cardiac surgery ICU","aggregation":"percent","sheet_rows":[],"denominator_rows":[],"daily_only":false,"unit_el":"%","direction":"context","archived":false},{"key":"mean_age","position":2,"title_el":"Μέση ηλικία","title_en":"Mean age","aggregation":"mean","field_key":"age","sheet_rows":[],"denominator_rows":[],"daily_only":false,"unit_el":"έτη","unit_en":"years","direction":"context","archived":false},{"key":"mean_icu_days","position":3,"title_el":"Μέσες ημέρες ΜΕΘ","title_en":"Mean ICU days","aggregation":"mean","field_key":"length_of_stay","date_field_key":"discharge_date","sheet_rows":[],"denominator_rows":[],"daily_only":false,"unit_el":"ημέρες","unit_en":"days","direction":"lower","archived":false},{"key":"mortality","position":4,"title_el":"Θνησιμότητα ΜΕΘ","title_en":"ICU mortality","aggregation":"percent","date_field_key":"discharge_date","sheet_rows":[],"denominator_rows":[],"daily_only":false,"unit_el":"%","direction":"lower","archived":false},{"key":"predicted_mortality","position":5,"title_el":"Μέση προβλεπόμενη θνητότητα (APACHE II)","title_en":"Mean predicted mortality (APACHE II)","aggregation":"mean","field_key":"apache_mortality","date_field_key":"discharge_date","sheet_rows":[],"denominator_rows":[],"daily_only":false,"unit_el":"%","direction":"context","archived":false},{"key":"mortality_scored","position":6,"title_el":"Θνησιμότητα ασθενών με APACHE II","title_en":"Mortality of APACHE II-scored patients","aggregation":"percent","date_field_key":"discharge_date","sheet_rows":[],"denominator_rows":[],"daily_only":false,"unit_el":"%","direction":"lower","note_el":"Συγκρίνεται με τη μέση προβλεπόμενη θνητότητα: ίδιοι ασθενείς.","note_en":"Compare with the mean predicted mortality: same patients.","archived":false},{"key":"smr","position":7,"title_el":"SMR (θνησιμότητα προς προβλεπόμενη)","title_en":"SMR (observed to predicted mortality)","aggregation":"smr","field_key":"apache_mortality","date_field_key":"discharge_date","sheet_rows":[],"denominator_rows":[],"daily_only":false,"direction":"lower","note_el":"Θάνατοι ÷ θάνατοι που προβλέπει το APACHE II. Κάτω από 1: λιγότεροι από τους αναμενόμενους. Χρειάζεται αρκετούς ασθενείς.","note_en":"Deaths ÷ deaths predicted by APACHE II. Below 1: fewer than expected. Needs enough patients.","archived":false},{"key":"mean_apache","position":8,"title_el":"Μέσο APACHE II","title_en":"Mean APACHE II","aggregation":"mean","field_key":"apache_score","sheet_rows":[],"denominator_rows":[],"daily_only":false,"direction":"context","archived":false},{"key":"mean_ventilator_hours","position":9,"title_el":"Μέσες ώρες αναπνευστήρα (διασωληνωμένοι)","title_en":"Mean ventilator hours (ventilated)","aggregation":"mean","field_key":"ventilator_hours","date_field_key":"discharge_date","sheet_rows":[],"denominator_rows":[],"daily_only":false,"unit_el":"ώρες","unit_en":"hours","direction":"lower","archived":false},{"key":"pressure_ulcers","position":10,"title_el":"% με κατάκλιση","title_en":"% pressure ulcers","aggregation":"percent","date_field_key":"discharge_date","sheet_rows":[],"denominator_rows":[],"daily_only":false,"unit_el":"%","direction":"lower","note_el":"Μόνο όσοι βγήκαν, στον μήνα εξόδου.","note_en":"Discharged patients only, in the month of discharge.","archived":false},{"key":"readmissions_48h","position":11,"title_el":"% επανεισαγωγών 48ώρου","title_en":"% readmissions within 48 h","aggregation":"percent","sheet_rows":[],"denominator_rows":[],"daily_only":false,"unit_el":"%","direction":"lower","archived":false},{"key":"requisitions","position":12,"title_el":"Επιτάξεις","title_en":"Requisitioned beds","aggregation":"count","sheet_rows":[],"denominator_rows":[],"daily_only":false,"direction":"context","archived":false}],"filters":[{"indicatorKey":"cardiac_share","part":"numerator","position":0,"field_key":"category","op":"eq","value":"cardiac"},{"indicatorKey":"mean_icu_days","part":"numerator","position":0,"field_key":"discharge_date","op":"filled"},{"indicatorKey":"mortality","part":"numerator","position":0,"field_key":"outcome","op":"eq","value":"death"},{"indicatorKey":"mortality","part":"denominator","position":0,"field_key":"outcome","op":"filled"},{"indicatorKey":"predicted_mortality","part":"numerator","position":0,"field_key":"outcome","op":"filled"},{"indicatorKey":"mortality_scored","part":"numerator","position":0,"field_key":"outcome","op":"eq","value":"death"},{"indicatorKey":"mortality_scored","part":"denominator","position":0,"field_key":"outcome","op":"filled"},{"indicatorKey":"mortality_scored","part":"denominator","position":1,"field_key":"apache_mortality","op":"filled"},{"indicatorKey":"smr","part":"numerator","position":0,"field_key":"outcome","op":"eq","value":"death"},{"indicatorKey":"smr","part":"denominator","position":0,"field_key":"outcome","op":"filled"},{"indicatorKey":"smr","part":"denominator","position":1,"field_key":"apache_mortality","op":"filled"},{"indicatorKey":"mean_ventilator_hours","part":"numerator","position":0,"field_key":"ventilator_hours","op":"gt","value":"0"},{"indicatorKey":"pressure_ulcers","part":"numerator","position":0,"field_key":"pressure_ulcer","op":"yes"},{"indicatorKey":"pressure_ulcers","part":"denominator","position":0,"field_key":"discharge_date","op":"filled"},{"indicatorKey":"readmissions_48h","part":"numerator","position":0,"field_key":"readmission_48h","op":"yes"},{"indicatorKey":"readmissions_48h","part":"denominator","position":0,"field_key":"readmission_48h","op":"filled"},{"indicatorKey":"requisitions","part":"numerator","position":0,"field_key":"requisition","op":"yes"}]}$tpl$::jsonb
    when 'nicu' then $tpl${"name_el":"Μητρώο νεογνών ΜΕΝΝ","name_en":"NICU neonatal register","description_el":"Μία καρτέλα ανά νεογνό: εισαγωγή, τοκετός, νοσηλεία, έξοδος. Δείκτες: καισαρικές, διάρκεια νοσηλείας, αναπνευστήρας, θνησιμότητα, λοιμώξεις.","description_en":"One card per neonate: admission, birth, stay, discharge. Indicators: caesareans, length of stay, ventilation, mortality, infections.","kind":"case","entry_date_field":"admission_date","identity_case_number":true,"identity_patient_name":true,"sections":[{"key":"admission","label_el":"Εισαγωγή","label_en":"Admission","position":0},{"key":"birth","label_el":"Κύηση και τοκετός","label_en":"Pregnancy and birth","position":1},{"key":"stay","label_el":"Νοσηλεία","label_en":"Stay","position":2},{"key":"discharge","label_el":"Έξοδος","label_en":"Discharge","position":3}],"fields":[{"key":"admission_date","section_key":"admission","position":0,"field_type":"date","label_el":"Ημερομηνία εισαγωγής","label_en":"Admission date","required":true,"in_list":false,"in_breakdown":false,"provisional":false,"aliases":[],"archived":false},{"key":"birth_date","section_key":"admission","position":1,"field_type":"date","label_el":"Ημερομηνία γέννησης","label_en":"Date of birth","required":true,"in_list":false,"in_breakdown":false,"provisional":false,"aliases":[],"archived":false},{"key":"age_on_admission","section_key":"admission","position":2,"field_type":"computed","label_el":"Ηλικία κατά την εισαγωγή","label_en":"Age on admission","unit_el":"ημέρες","unit_en":"days","required":false,"in_list":false,"in_breakdown":false,"provisional":false,"help_el":"Διακρίνει τα νεογνά του μαιευτηρίου από όσα έρχονται αργότερα.","help_en":"Separates neonates born here from later admissions.","computed_kind":"age_days","computed_from":"birth_date","computed_to":"admission_date","aliases":[],"archived":false},{"key":"readmission","section_key":"admission","position":3,"field_type":"yes_no","label_el":"Επανεισαγωγή","label_en":"Readmission","required":false,"in_list":false,"in_breakdown":false,"provisional":false,"aliases":[],"archived":false},{"key":"admission_reason","section_key":"admission","position":4,"field_type":"choice","label_el":"Αιτία εισαγωγής","label_en":"Reason for admission","required":false,"in_list":false,"in_breakdown":true,"provisional":true,"help_el":"Με πολλές αιτίες κρατιέται η πρώτη.","help_en":"With several reasons, the first one is kept.","aliases":[],"archived":false},{"key":"admission_origin","section_key":"admission","position":5,"field_type":"choice","label_el":"Προέλευση εισαγωγής","label_en":"Admitted from","required":false,"in_list":false,"in_breakdown":true,"provisional":true,"aliases":[],"archived":false},{"key":"gestation","section_key":"birth","position":6,"field_type":"gestation","label_el":"Διάρκεια κύησης","label_en":"Gestational age","min_value":154,"max_value":308,"required":false,"in_list":true,"in_breakdown":false,"provisional":false,"help_el":"Εβδομάδες + ημέρες, π.χ. 37+4.","help_en":"Weeks + days, e.g. 37+4.","aliases":[],"archived":false},{"key":"pregnancy_type","section_key":"birth","position":7,"field_type":"choice","label_el":"Τύπος κύησης","label_en":"Pregnancy","required":false,"in_list":false,"in_breakdown":false,"provisional":true,"aliases":[],"archived":false},{"key":"delivery","section_key":"birth","position":8,"field_type":"choice","label_el":"Είδος τοκετού","label_en":"Mode of delivery","required":true,"in_list":true,"in_breakdown":false,"provisional":false,"help_el":"Σικυουλκία, εμβρυουλκία και τοκετός εκτός νοσοκομείου μετρούν ως φυσιολογικός.","help_en":"Vacuum, forceps and births before arrival count as vaginal.","aliases":[],"archived":false},{"key":"ivf","section_key":"birth","position":9,"field_type":"yes_no","label_el":"Εξωσωματική (IVF)","label_en":"IVF","required":false,"in_list":false,"in_breakdown":false,"provisional":false,"aliases":[],"archived":false},{"key":"prom_24h","section_key":"birth","position":10,"field_type":"yes_no","label_el":"Ρήξη θυλακίου > 24 ώρες","label_en":"Rupture of membranes > 24 h","required":false,"in_list":false,"in_breakdown":false,"provisional":false,"aliases":[],"archived":false},{"key":"birth_weight","section_key":"birth","position":11,"field_type":"number","label_el":"Βάρος εισόδου","label_en":"Admission weight","unit_el":"g","unit_en":"g","min_value":300,"max_value":6000,"usual_min":500,"usual_max":5000,"required":true,"in_list":true,"in_breakdown":false,"provisional":false,"aliases":[],"archived":false},{"key":"apgar_1","section_key":"birth","position":12,"field_type":"number","label_el":"APGAR 1′","label_en":"APGAR 1 min","min_value":0,"max_value":10,"required":false,"in_list":false,"in_breakdown":false,"provisional":false,"aliases":[],"archived":false},{"key":"apgar_5","section_key":"birth","position":13,"field_type":"number","label_el":"APGAR 5′","label_en":"APGAR 5 min","min_value":0,"max_value":10,"required":false,"in_list":false,"in_breakdown":false,"provisional":false,"aliases":[],"archived":false},{"key":"resuscitation","section_key":"birth","position":14,"field_type":"choice","label_el":"Ανάνηψη","label_en":"Resuscitation","required":false,"in_list":false,"in_breakdown":false,"provisional":true,"aliases":[],"archived":false},{"key":"congenital_anomalies","section_key":"birth","position":15,"field_type":"yes_no","label_el":"Συγγενείς ανωμαλίες","label_en":"Congenital anomalies","required":false,"in_list":false,"in_breakdown":false,"provisional":false,"aliases":[],"archived":false},{"key":"ventilator_days","section_key":"stay","position":16,"field_type":"number","label_el":"Ημέρες στον αναπνευστήρα","label_en":"Ventilator days","unit_el":"ημέρες","unit_en":"days","min_value":0,"max_value":365,"required":false,"in_list":false,"in_breakdown":false,"provisional":false,"aliases":[],"archived":false},{"key":"hfov","section_key":"stay","position":17,"field_type":"yes_no","label_el":"HFOV","label_en":"HFOV","required":false,"in_list":false,"in_breakdown":false,"provisional":false,"show_when_key":"ventilator_days","aliases":[],"archived":false},{"key":"cpap_days","section_key":"stay","position":18,"field_type":"number","label_el":"Ημέρες σε CPAP","label_en":"CPAP days","unit_el":"ημέρες","unit_en":"days","min_value":0,"max_value":365,"required":false,"in_list":false,"in_breakdown":false,"provisional":false,"aliases":[],"archived":false},{"key":"oxygen_days","section_key":"stay","position":19,"field_type":"number","label_el":"Ημέρες χορήγησης οξυγόνου","label_en":"Oxygen days","unit_el":"ημέρες","unit_en":"days","min_value":0,"max_value":365,"required":false,"in_list":false,"in_breakdown":false,"provisional":false,"aliases":[],"archived":false},{"key":"oxygen_after_36w","section_key":"stay","position":20,"field_type":"yes_no","label_el":"Οξυγόνο μετά τις 36 εβδ.","label_en":"Oxygen after 36 weeks","required":false,"in_list":false,"in_breakdown":false,"provisional":false,"help_el":"Στην εισαγωγή: ημέρες πάνω από 0 σημαίνουν Ναι.","help_en":"On import: days above 0 mean Yes.","aliases":[],"archived":false},{"key":"umbilical_catheter","section_key":"stay","position":21,"field_type":"choice","label_el":"Ομφαλικός καθετήρας","label_en":"Umbilical catheter","required":false,"in_list":false,"in_breakdown":false,"provisional":true,"aliases":[],"archived":false},{"key":"central_line_days","section_key":"stay","position":22,"field_type":"number","label_el":"Ημέρες φλεβικού καθετήρα","label_en":"Central line days","unit_el":"ημέρες","unit_en":"days","min_value":0,"max_value":365,"required":false,"in_list":false,"in_breakdown":false,"provisional":false,"aliases":[],"archived":false},{"key":"arterial_line_days","section_key":"stay","position":23,"field_type":"number","label_el":"Ημέρες αρτηριακού καθετήρα","label_en":"Arterial line days","unit_el":"ημέρες","unit_en":"days","min_value":0,"max_value":365,"required":false,"in_list":false,"in_breakdown":false,"provisional":false,"aliases":[],"archived":false},{"key":"tpn_days","section_key":"stay","position":24,"field_type":"number","label_el":"Ημέρες TPN","label_en":"TPN days","unit_el":"ημέρες","unit_en":"days","min_value":0,"max_value":365,"required":false,"in_list":false,"in_breakdown":false,"provisional":false,"aliases":[],"archived":false},{"key":"picc_days","section_key":"stay","position":25,"field_type":"number","label_el":"Ημέρες PICC line","label_en":"PICC line days","unit_el":"ημέρες","unit_en":"days","min_value":0,"max_value":365,"required":false,"in_list":false,"in_breakdown":false,"provisional":false,"aliases":[],"archived":false},{"key":"nasogastric","section_key":"stay","position":26,"field_type":"yes_no","label_el":"Σίτιση με ρινογαστρικό","label_en":"Nasogastric feeding","required":false,"in_list":false,"in_breakdown":false,"provisional":false,"aliases":[],"archived":false},{"key":"bottle_feeding","section_key":"stay","position":27,"field_type":"yes_no","label_el":"Αποκλειστική σίτιση με μπιμπερό","label_en":"Exclusive bottle feeding","required":false,"in_list":false,"in_breakdown":false,"provisional":false,"help_el":"Στην εισαγωγή: μια ημερομηνία σημαίνει Ναι.","help_en":"On import: a date means Yes.","aliases":[],"archived":false},{"key":"breast_milk","section_key":"stay","position":28,"field_type":"choice","label_el":"Διατήρηση μητρικού γάλακτος","label_en":"Breast milk","required":false,"in_list":false,"in_breakdown":false,"provisional":true,"aliases":[],"archived":false},{"key":"early_infection","section_key":"stay","position":29,"field_type":"yes_no","label_el":"Επιβεβαιωμένη πρώιμη λοίμωξη","label_en":"Confirmed early-onset infection","required":false,"in_list":false,"in_breakdown":false,"provisional":false,"help_el":"Θα συνδεθεί με το επεισόδιο στην Επιτήρηση.","help_en":"To be linked with the Surveillance episode.","aliases":[],"archived":false},{"key":"late_infection","section_key":"stay","position":30,"field_type":"yes_no","label_el":"Επιβεβαιωμένη όψιμη λοίμωξη","label_en":"Confirmed late-onset infection","required":false,"in_list":false,"in_breakdown":false,"provisional":false,"help_el":"Θα συνδεθεί με το επεισόδιο στην Επιτήρηση.","help_en":"To be linked with the Surveillance episode.","aliases":[],"archived":false},{"key":"discharge_date","section_key":"discharge","position":31,"field_type":"date","label_el":"Ημερομηνία εξόδου","label_en":"Discharge date","required":false,"in_list":true,"in_breakdown":false,"provisional":false,"not_before_key":"admission_date","aliases":[],"archived":false},{"key":"length_of_stay","section_key":"discharge","position":32,"field_type":"computed","label_el":"Διάρκεια νοσηλείας","label_en":"Length of stay","unit_el":"ημέρες","unit_en":"days","required":false,"in_list":false,"in_breakdown":false,"provisional":false,"help_el":"Υπολογίζεται από την εισαγωγή και την έξοδο.","help_en":"From admission and discharge.","computed_kind":"days","computed_from":"admission_date","computed_to":"discharge_date","aliases":[],"archived":false},{"key":"discharge_weight","section_key":"discharge","position":33,"field_type":"number","label_el":"Βάρος εξόδου","label_en":"Discharge weight","unit_el":"g","unit_en":"g","min_value":300,"max_value":8000,"required":false,"in_list":false,"in_breakdown":false,"provisional":false,"show_when_key":"discharge_date","aliases":[],"archived":false},{"key":"outcome","section_key":"discharge","position":34,"field_type":"choice","label_el":"Έκβαση","label_en":"Outcome","required":false,"in_list":true,"in_breakdown":true,"provisional":false,"show_when_key":"discharge_date","aliases":[],"archived":false}],"options":[{"fieldKey":"admission_reason","value":"observation","label_el":"Παρακολούθηση - διερεύνηση","label_en":"Observation - investigation","position":0,"match":[],"archived":false},{"fieldKey":"admission_reason","value":"prematurity","label_el":"Προωρότητα","label_en":"Prematurity","position":1,"match":[],"archived":false},{"fieldKey":"admission_reason","value":"respiratory","label_el":"Αναπνευστική δυσχέρεια","label_en":"Respiratory distress","position":2,"match":[],"archived":false},{"fieldKey":"admission_reason","value":"jaundice","label_el":"Ίκτερος","label_en":"Jaundice","position":3,"match":[],"archived":false},{"fieldKey":"admission_reason","value":"infection","label_el":"Λοίμωξη / σήψη","label_en":"Infection / sepsis","position":4,"match":[],"archived":false},{"fieldKey":"admission_reason","value":"low_weight","label_el":"Χαμηλό βάρος γέννησης / IUGR","label_en":"Low birth weight / IUGR","position":5,"match":[],"archived":false},{"fieldKey":"admission_reason","value":"congenital","label_el":"Συγγενής ανωμαλία","label_en":"Congenital anomaly","position":6,"match":[],"archived":false},{"fieldKey":"admission_reason","value":"boarding","label_el":"Φιλοξενία","label_en":"Boarding","position":7,"match":[],"archived":false},{"fieldKey":"admission_reason","value":"other","label_el":"Άλλο","label_en":"Other","position":8,"match":[],"archived":false},{"fieldKey":"admission_origin","value":"delivery_room","label_el":"Αίθουσα Τοκετών","label_en":"Delivery room","position":0,"match":[],"archived":false},{"fieldKey":"admission_origin","value":"maternity","label_el":"Μαιευτική κλινική","label_en":"Maternity ward","position":1,"match":[],"archived":false},{"fieldKey":"admission_origin","value":"other_hospital","label_el":"Άλλο νοσοκομείο","label_en":"Other hospital","position":2,"match":[],"archived":false},{"fieldKey":"admission_origin","value":"home","label_el":"Από το σπίτι","label_en":"From home","position":3,"match":[],"archived":false},{"fieldKey":"pregnancy_type","value":"single","label_el":"Μονήρης","label_en":"Singleton","position":0,"match":[],"archived":false},{"fieldKey":"pregnancy_type","value":"twin","label_el":"Δίδυμη","label_en":"Twin","position":1,"match":[],"archived":false},{"fieldKey":"pregnancy_type","value":"multiple","label_el":"Πολύδυμη","label_en":"Higher order","position":2,"match":[],"archived":false},{"fieldKey":"delivery","value":"vaginal","label_el":"Φυσιολογικός τοκετός (Φ/Τ)","label_en":"Vaginal delivery","position":0,"match":[],"archived":false},{"fieldKey":"delivery","value":"cs","label_el":"Καισαρική τομή (Κ/Τ)","label_en":"Caesarean section","position":1,"match":[],"archived":false},{"fieldKey":"resuscitation","value":"none","label_el":"Καμία","label_en":"None","position":0,"match":[],"archived":false},{"fieldKey":"resuscitation","value":"oxygen","label_el":"Οξυγόνο","label_en":"Oxygen","position":1,"match":[],"archived":false},{"fieldKey":"resuscitation","value":"bag_mask","label_el":"Μάσκα - ασκός","label_en":"Bag and mask","position":2,"match":[],"archived":false},{"fieldKey":"resuscitation","value":"intubation","label_el":"Διασωλήνωση","label_en":"Intubation","position":3,"match":[],"archived":false},{"fieldKey":"resuscitation","value":"cpr","label_el":"ΚΑΡΠΑ","label_en":"CPR","position":4,"match":[],"archived":false},{"fieldKey":"resuscitation","value":"unspecified","label_el":"Ναι, χωρίς είδος","label_en":"Yes, type not recorded","position":5,"match":[],"archived":false},{"fieldKey":"umbilical_catheter","value":"none","label_el":"Όχι","label_en":"None","position":0,"match":[],"archived":false},{"fieldKey":"umbilical_catheter","value":"venous","label_el":"Φλεβικός","label_en":"Venous","position":1,"match":[],"archived":false},{"fieldKey":"umbilical_catheter","value":"arterial","label_el":"Αρτηριακός","label_en":"Arterial","position":2,"match":[],"archived":false},{"fieldKey":"umbilical_catheter","value":"both","label_el":"Φλεβικός και αρτηριακός","label_en":"Venous and arterial","position":3,"match":[],"archived":false},{"fieldKey":"umbilical_catheter","value":"unspecified","label_el":"Ναι, χωρίς είδος","label_en":"Yes, type not recorded","position":4,"match":[],"archived":false},{"fieldKey":"breast_milk","value":"exclusive","label_el":"Αποκλειστικά μητρικό","label_en":"Exclusive","position":0,"match":[],"archived":false},{"fieldKey":"breast_milk","value":"mixed","label_el":"Μικτή σίτιση","label_en":"Mixed","position":1,"match":[],"archived":false},{"fieldKey":"breast_milk","value":"none","label_el":"Όχι","label_en":"None","position":2,"match":[],"archived":false},{"fieldKey":"breast_milk","value":"unspecified","label_el":"Ναι, χωρίς είδος","label_en":"Yes, type not recorded","position":3,"match":[],"archived":false},{"fieldKey":"outcome","value":"home","label_el":"Εξιτήριο","label_en":"Discharged home","position":0,"match":[],"archived":false},{"fieldKey":"outcome","value":"transfer_hospital","label_el":"Διακομιδή σε άλλο νοσοκομείο","label_en":"Transfer to another hospital","position":1,"match":[],"archived":false},{"fieldKey":"outcome","value":"transfer_ward","label_el":"Μεταφορά σε άλλη κλινική","label_en":"Transfer to another ward","position":2,"match":[],"archived":false},{"fieldKey":"outcome","value":"death","label_el":"Θάνατος","label_en":"Death","position":3,"match":[],"archived":false}],"axes":[],"indicators":[{"key":"admissions","position":0,"title_el":"Εισαγωγές νεογνών","title_en":"Neonatal admissions","aggregation":"count","sheet_rows":[],"denominator_rows":[],"daily_only":false,"direction":"context","archived":false},{"key":"cs_rate","position":1,"title_el":"% με καισαρική τομή","title_en":"% caesarean section","aggregation":"percent","sheet_rows":[],"denominator_rows":[],"daily_only":false,"unit_el":"%","direction":"context","archived":false},{"key":"vaginal_rate","position":2,"title_el":"% με φυσιολογικό τοκετό","title_en":"% vaginal delivery","aggregation":"percent","sheet_rows":[],"denominator_rows":[],"daily_only":false,"unit_el":"%","direction":"context","archived":false},{"key":"mean_los","position":3,"title_el":"Μέση διάρκεια νοσηλείας","title_en":"Mean length of stay","aggregation":"mean","field_key":"length_of_stay","date_field_key":"discharge_date","sheet_rows":[],"denominator_rows":[],"daily_only":false,"unit_el":"ημέρες","unit_en":"days","direction":"lower","note_el":"Μόνο όσα νεογνά βγήκαν, στον μήνα εξόδου.","note_en":"Discharged neonates only, in the month of discharge.","archived":false},{"key":"median_los","position":4,"title_el":"Διάμεση διάρκεια νοσηλείας","title_en":"Median length of stay","aggregation":"median","field_key":"length_of_stay","date_field_key":"discharge_date","sheet_rows":[],"denominator_rows":[],"daily_only":false,"unit_el":"ημέρες","unit_en":"days","direction":"context","archived":false},{"key":"mean_ventilator","position":5,"title_el":"Μέσες ημέρες στον αναπνευστήρα","title_en":"Mean ventilator days","aggregation":"mean","field_key":"ventilator_days","date_field_key":"discharge_date","sheet_rows":[],"denominator_rows":[],"daily_only":false,"unit_el":"ημέρες","unit_en":"days","direction":"lower","note_el":"Μόνο όσα νεογνά χρειάστηκαν αναπνευστήρα.","note_en":"Neonates who were ventilated only.","archived":false},{"key":"mean_cpap","position":6,"title_el":"Μέσες ημέρες σε CPAP","title_en":"Mean CPAP days","aggregation":"mean","field_key":"cpap_days","date_field_key":"discharge_date","sheet_rows":[],"denominator_rows":[],"daily_only":false,"unit_el":"ημέρες","unit_en":"days","direction":"lower","archived":false},{"key":"mortality","position":7,"title_el":"Θνησιμότητα","title_en":"Mortality","aggregation":"percent","date_field_key":"discharge_date","sheet_rows":[],"denominator_rows":[],"daily_only":false,"unit_el":"%","direction":"lower","archived":false},{"key":"readmissions","position":8,"title_el":"% επανεισαγωγών","title_en":"% readmissions","aggregation":"percent","sheet_rows":[],"denominator_rows":[],"daily_only":false,"unit_el":"%","direction":"lower","archived":false},{"key":"apgar_1","position":9,"title_el":"Μέσο APGAR 1′","title_en":"Mean APGAR 1 min","aggregation":"mean","field_key":"apgar_1","sheet_rows":[],"denominator_rows":[],"daily_only":false,"direction":"context","archived":false},{"key":"apgar_5","position":10,"title_el":"Μέσο APGAR 5′","title_en":"Mean APGAR 5 min","aggregation":"mean","field_key":"apgar_5","sheet_rows":[],"denominator_rows":[],"daily_only":false,"direction":"context","archived":false},{"key":"late_infection_rate","position":11,"title_el":"Όψιμες λοιμώξεις ανά 1.000 ημέρες καθετήρα","title_en":"Late-onset infections per 1,000 line days","aggregation":"rate","date_field_key":"discharge_date","denominator_field_key":"central_line_days","multiplier":1000,"sheet_rows":[],"denominator_rows":[],"daily_only":false,"unit_el":"/1.000 ημέρες καθετήρα","unit_en":"/1,000 line days","direction":"lower","archived":false},{"key":"breast_milk","position":12,"title_el":"% με αποκλειστικά μητρικό γάλα","title_en":"% exclusive breast milk","aggregation":"percent","date_field_key":"discharge_date","sheet_rows":[],"denominator_rows":[],"daily_only":false,"unit_el":"%","direction":"higher","archived":false},{"key":"no_breast_milk","position":13,"title_el":"% χωρίς μητρικό γάλα","title_en":"% without breast milk","aggregation":"percent","date_field_key":"discharge_date","sheet_rows":[],"denominator_rows":[],"daily_only":false,"unit_el":"%","direction":"lower","archived":false}],"filters":[{"indicatorKey":"cs_rate","part":"numerator","position":0,"field_key":"delivery","op":"eq","value":"cs"},{"indicatorKey":"cs_rate","part":"denominator","position":0,"field_key":"delivery","op":"filled"},{"indicatorKey":"vaginal_rate","part":"numerator","position":0,"field_key":"delivery","op":"eq","value":"vaginal"},{"indicatorKey":"vaginal_rate","part":"denominator","position":0,"field_key":"delivery","op":"filled"},{"indicatorKey":"mean_los","part":"numerator","position":0,"field_key":"discharge_date","op":"filled"},{"indicatorKey":"median_los","part":"numerator","position":0,"field_key":"discharge_date","op":"filled"},{"indicatorKey":"mean_ventilator","part":"numerator","position":0,"field_key":"ventilator_days","op":"gt","value":"0"},{"indicatorKey":"mean_cpap","part":"numerator","position":0,"field_key":"cpap_days","op":"gt","value":"0"},{"indicatorKey":"mortality","part":"numerator","position":0,"field_key":"outcome","op":"eq","value":"death"},{"indicatorKey":"mortality","part":"denominator","position":0,"field_key":"outcome","op":"filled"},{"indicatorKey":"readmissions","part":"numerator","position":0,"field_key":"readmission","op":"yes"},{"indicatorKey":"late_infection_rate","part":"numerator","position":0,"field_key":"late_infection","op":"yes"},{"indicatorKey":"breast_milk","part":"numerator","position":0,"field_key":"breast_milk","op":"eq","value":"exclusive"},{"indicatorKey":"breast_milk","part":"denominator","position":0,"field_key":"breast_milk","op":"filled"},{"indicatorKey":"no_breast_milk","part":"numerator","position":0,"field_key":"breast_milk","op":"eq","value":"none"},{"indicatorKey":"no_breast_milk","part":"denominator","position":0,"field_key":"breast_milk","op":"filled"}]}$tpl$::jsonb
    when 'paediatrics' then $tpl${"name_el":"Μητρώο νοσηλευομένων Παιδιατρικής","name_en":"Paediatrics inpatient register","description_el":"Νέο μητρώο: μία καρτέλα ανά νοσηλεία παιδιού. Αιτία εισαγωγής ως λίστα, ηλικία από την ημερομηνία γέννησης, διάρκεια νοσηλείας υπολογιζόμενη, επανεισαγωγές 30 ημερών, μεταφορές σε ΜΕΘ Παίδων.","description_en":"New register: one card per child stay. Reason as a list, age from the date of birth, length of stay computed, 30-day readmissions, transfers to the paediatric ICU.","kind":"case","entry_date_field":"admission_date","identity_case_number":true,"identity_patient_name":true,"sections":[{"key":"admission","label_el":"Εισαγωγή","label_en":"Admission","position":0},{"key":"stay","label_el":"Νοσηλεία","label_en":"Stay","position":1},{"key":"discharge","label_el":"Έξοδος","label_en":"Discharge","position":2}],"fields":[{"key":"admission_date","section_key":"admission","position":0,"field_type":"date","label_el":"Ημερομηνία εισαγωγής","label_en":"Admission date","required":true,"in_list":false,"in_breakdown":false,"provisional":false,"aliases":[],"archived":false},{"key":"birth_date","section_key":"admission","position":1,"field_type":"date","label_el":"Ημερομηνία γέννησης","label_en":"Date of birth","required":true,"in_list":false,"in_breakdown":false,"provisional":false,"aliases":[],"archived":false},{"key":"age","section_key":"admission","position":2,"field_type":"computed","label_el":"Ηλικία","label_en":"Age","unit_el":"έτη","unit_en":"years","required":false,"in_list":true,"in_breakdown":false,"provisional":false,"computed_kind":"age_years","computed_from":"birth_date","computed_to":"admission_date","aliases":[],"archived":false},{"key":"age_group","section_key":"admission","position":3,"field_type":"choice","label_el":"Ηλικιακή ομάδα","label_en":"Age group","required":true,"in_list":false,"in_breakdown":true,"provisional":false,"aliases":[],"archived":false},{"key":"sex","section_key":"admission","position":4,"field_type":"choice","label_el":"Φύλο","label_en":"Sex","required":true,"in_list":false,"in_breakdown":false,"provisional":false,"aliases":[],"archived":false},{"key":"admission_reason","section_key":"admission","position":5,"field_type":"choice","label_el":"Αιτία εισαγωγής","label_en":"Reason for admission","required":true,"in_list":true,"in_breakdown":true,"provisional":false,"aliases":[],"archived":false},{"key":"admission_reason_text","section_key":"admission","position":6,"field_type":"text","label_el":"Αιτία εισαγωγής (λεπτομέρειες)","label_en":"Reason (details)","required":false,"in_list":false,"in_breakdown":false,"provisional":false,"aliases":[],"archived":false},{"key":"from_ed","section_key":"admission","position":7,"field_type":"yes_no","label_el":"Από τα ΤΕΠ","label_en":"Admitted through the ED","required":false,"in_list":false,"in_breakdown":false,"provisional":false,"aliases":[],"archived":false},{"key":"readmission_30d","section_key":"admission","position":8,"field_type":"yes_no","label_el":"Επανεισαγωγή εντός 30 ημερών","label_en":"Readmission within 30 days","required":false,"in_list":false,"in_breakdown":false,"provisional":false,"aliases":[],"archived":false},{"key":"physician","section_key":"admission","position":9,"field_type":"text","label_el":"Θεράπων ιατρός","label_en":"Attending physician","required":false,"in_list":false,"in_breakdown":false,"provisional":false,"aliases":[],"archived":false},{"key":"isolation","section_key":"stay","position":10,"field_type":"yes_no","label_el":"Απομόνωση","label_en":"Isolation","required":false,"in_list":false,"in_breakdown":false,"provisional":false,"aliases":[],"archived":false},{"key":"iv_antibiotics","section_key":"stay","position":11,"field_type":"yes_no","label_el":"Ενδοφλέβια αντιβίωση","label_en":"IV antibiotics","required":false,"in_list":false,"in_breakdown":false,"provisional":false,"aliases":[],"archived":false},{"key":"iv_antibiotic_days","section_key":"stay","position":12,"field_type":"number","label_el":"Ημέρες ενδοφλέβιας αντιβίωσης","label_en":"IV antibiotic days","unit_el":"ημέρες","unit_en":"days","min_value":0,"max_value":365,"required":false,"in_list":false,"in_breakdown":false,"provisional":false,"show_when_key":"iv_antibiotics","show_when_value":"true","aliases":[],"archived":false},{"key":"peripheral_line_days","section_key":"stay","position":13,"field_type":"number","label_el":"Ημέρες περιφερικού φλεβοκαθετήρα","label_en":"Peripheral line days","unit_el":"ημέρες","unit_en":"days","min_value":0,"max_value":365,"required":false,"in_list":false,"in_breakdown":false,"provisional":false,"aliases":[],"archived":false},{"key":"phlebitis","section_key":"stay","position":14,"field_type":"yes_no","label_el":"Φλεβίτιδα περιφερικού καθετήρα","label_en":"Peripheral line phlebitis","required":false,"in_list":false,"in_breakdown":false,"provisional":false,"help_el":"Για τον δείκτη φλεβίτιδας ανά 1.000 ημέρες καθετήρα.","help_en":"For the phlebitis rate per 1,000 line days.","show_when_key":"peripheral_line_days","aliases":[],"archived":false},{"key":"hai","section_key":"stay","position":15,"field_type":"yes_no","label_el":"Λοίμωξη σχετιζόμενη με τη νοσηλεία","label_en":"Healthcare-associated infection","required":false,"in_list":false,"in_breakdown":false,"provisional":false,"help_el":"Θα συνδεθεί με το επεισόδιο στην Επιτήρηση.","help_en":"To be linked with the Surveillance episode.","aliases":[],"archived":false},{"key":"fall","section_key":"stay","position":16,"field_type":"yes_no","label_el":"Πτώση","label_en":"Fall","required":false,"in_list":false,"in_breakdown":false,"provisional":false,"help_el":"Κάθε πτώση δηλώνεται και ως αναφορά συμβάντος.","help_en":"Every fall is also reported as an incident.","aliases":[],"archived":false},{"key":"discharge_date","section_key":"discharge","position":17,"field_type":"date","label_el":"Ημερομηνία εξόδου","label_en":"Discharge date","required":false,"in_list":true,"in_breakdown":false,"provisional":false,"not_before_key":"admission_date","aliases":[],"archived":false},{"key":"length_of_stay","section_key":"discharge","position":18,"field_type":"computed","label_el":"Διάρκεια νοσηλείας","label_en":"Length of stay","unit_el":"ημέρες","unit_en":"days","required":false,"in_list":false,"in_breakdown":false,"provisional":false,"computed_kind":"days","computed_from":"admission_date","computed_to":"discharge_date","aliases":[],"archived":false},{"key":"outcome","section_key":"discharge","position":19,"field_type":"choice","label_el":"Έκβαση","label_en":"Outcome","required":false,"in_list":true,"in_breakdown":true,"provisional":false,"show_when_key":"discharge_date","aliases":[],"archived":false},{"key":"notes","section_key":"discharge","position":20,"field_type":"text","label_el":"Παρατηρήσεις","label_en":"Notes","required":false,"in_list":false,"in_breakdown":false,"provisional":false,"aliases":[],"archived":false}],"options":[{"fieldKey":"age_group","value":"infant","label_el":"Βρέφος (< 1 έτους)","label_en":"Infant (< 1 year)","position":0,"match":[],"archived":false},{"fieldKey":"age_group","value":"toddler","label_el":"Νήπιο (1–4)","label_en":"Toddler (1–4)","position":1,"match":[],"archived":false},{"fieldKey":"age_group","value":"child","label_el":"Παιδί (5–11)","label_en":"Child (5–11)","position":2,"match":[],"archived":false},{"fieldKey":"age_group","value":"adolescent","label_el":"Έφηβος (12–16)","label_en":"Adolescent (12–16)","position":3,"match":[],"archived":false},{"fieldKey":"sex","value":"male","label_el":"Άρρεν","label_en":"Male","position":0,"match":[],"archived":false},{"fieldKey":"sex","value":"female","label_el":"Θήλυ","label_en":"Female","position":1,"match":[],"archived":false},{"fieldKey":"admission_reason","value":"respiratory","label_el":"Λοίμωξη αναπνευστικού","label_en":"Respiratory infection","position":0,"match":[],"archived":false},{"fieldKey":"admission_reason","value":"gastro","label_el":"Γαστρεντερίτιδα / αφυδάτωση","label_en":"Gastroenteritis / dehydration","position":1,"match":[],"archived":false},{"fieldKey":"admission_reason","value":"fever","label_el":"Πυρετός προς διερεύνηση","label_en":"Fever under investigation","position":2,"match":[],"archived":false},{"fieldKey":"admission_reason","value":"uti","label_el":"Ουρολοίμωξη","label_en":"Urinary tract infection","position":3,"match":[],"archived":false},{"fieldKey":"admission_reason","value":"seizure","label_el":"Σπασμοί","label_en":"Seizures","position":4,"match":[],"archived":false},{"fieldKey":"admission_reason","value":"injury","label_el":"Ατύχημα / τραυματισμός","label_en":"Injury","position":5,"match":[],"archived":false},{"fieldKey":"admission_reason","value":"surgical","label_el":"Χειρουργικό","label_en":"Surgical","position":6,"match":[],"archived":false},{"fieldKey":"admission_reason","value":"other","label_el":"Άλλο","label_en":"Other","position":7,"match":[],"archived":false},{"fieldKey":"outcome","value":"home","label_el":"Εξιτήριο","label_en":"Discharged home","position":0,"match":[],"archived":false},{"fieldKey":"outcome","value":"picu","label_el":"Μεταφορά σε ΜΕΘ Παίδων","label_en":"Transfer to paediatric ICU","position":1,"match":[],"archived":false},{"fieldKey":"outcome","value":"transfer_hospital","label_el":"Διακομιδή σε άλλο νοσοκομείο","label_en":"Transfer to another hospital","position":2,"match":[],"archived":false},{"fieldKey":"outcome","value":"against_advice","label_el":"Αποχώρηση με ευθύνη γονέων","label_en":"Left against medical advice","position":3,"match":[],"archived":false},{"fieldKey":"outcome","value":"death","label_el":"Θάνατος","label_en":"Death","position":4,"match":[],"archived":false}],"axes":[],"indicators":[{"key":"admissions","position":0,"title_el":"Εισαγωγές","title_en":"Admissions","aggregation":"count","sheet_rows":[],"denominator_rows":[],"daily_only":false,"direction":"context","archived":false},{"key":"mean_los","position":1,"title_el":"Μέση διάρκεια νοσηλείας","title_en":"Mean length of stay","aggregation":"mean","field_key":"length_of_stay","date_field_key":"discharge_date","sheet_rows":[],"denominator_rows":[],"daily_only":false,"unit_el":"ημέρες","unit_en":"days","direction":"lower","archived":false},{"key":"median_los","position":2,"title_el":"Διάμεση διάρκεια νοσηλείας","title_en":"Median length of stay","aggregation":"median","field_key":"length_of_stay","date_field_key":"discharge_date","sheet_rows":[],"denominator_rows":[],"daily_only":false,"unit_el":"ημέρες","unit_en":"days","direction":"context","archived":false},{"key":"readmissions","position":3,"title_el":"% επανεισαγωγών 30 ημερών","title_en":"% 30-day readmissions","aggregation":"percent","sheet_rows":[],"denominator_rows":[],"daily_only":false,"unit_el":"%","direction":"lower","archived":false},{"key":"picu","position":4,"title_el":"% μεταφορών σε ΜΕΘ Παίδων","title_en":"% transfers to paediatric ICU","aggregation":"percent","date_field_key":"discharge_date","sheet_rows":[],"denominator_rows":[],"daily_only":false,"unit_el":"%","direction":"lower","archived":false},{"key":"iv_antibiotics","position":5,"title_el":"% με ενδοφλέβια αντιβίωση","title_en":"% on IV antibiotics","aggregation":"percent","sheet_rows":[],"denominator_rows":[],"daily_only":false,"unit_el":"%","direction":"context","archived":false},{"key":"hai","position":6,"title_el":"% με λοίμωξη σχετιζόμενη με τη νοσηλεία","title_en":"% healthcare-associated infection","aggregation":"percent","sheet_rows":[],"denominator_rows":[],"daily_only":false,"unit_el":"%","direction":"lower","archived":false},{"key":"falls","position":7,"title_el":"Πτώσεις","title_en":"Falls","aggregation":"count","sheet_rows":[],"denominator_rows":[],"daily_only":false,"direction":"lower","archived":false},{"key":"hai_rate","position":8,"title_el":"Λοιμώξεις νοσηλείας ανά 1.000 ημέρες νοσηλείας","title_en":"Healthcare-associated infections per 1,000 patient-days","aggregation":"rate","date_field_key":"discharge_date","denominator_field_key":"length_of_stay","multiplier":1000,"sheet_rows":[],"denominator_rows":[],"daily_only":false,"unit_el":"/1.000 ημέρες νοσηλείας","unit_en":"/1,000 patient-days","direction":"lower","note_el":"Μόνο όσα παιδιά βγήκαν, στον μήνα εξόδου.","note_en":"Discharged children only, in the month of discharge.","archived":false},{"key":"falls_rate","position":9,"title_el":"Πτώσεις ανά 1.000 ημέρες νοσηλείας","title_en":"Falls per 1,000 patient-days","aggregation":"rate","date_field_key":"discharge_date","denominator_field_key":"length_of_stay","multiplier":1000,"sheet_rows":[],"denominator_rows":[],"daily_only":false,"unit_el":"/1.000 ημέρες νοσηλείας","unit_en":"/1,000 patient-days","direction":"lower","note_el":"Μόνο όσα παιδιά βγήκαν, στον μήνα εξόδου.","note_en":"Discharged children only, in the month of discharge.","archived":false},{"key":"phlebitis_rate","position":10,"title_el":"Φλεβίτιδα ανά 1.000 ημέρες περιφερικού καθετήρα","title_en":"Phlebitis per 1,000 peripheral line days","aggregation":"rate","date_field_key":"discharge_date","denominator_field_key":"peripheral_line_days","multiplier":1000,"sheet_rows":[],"denominator_rows":[],"daily_only":false,"unit_el":"/1.000 ημέρες καθετήρα","unit_en":"/1,000 line days","direction":"lower","archived":false},{"key":"isolation","position":11,"title_el":"% παιδιών σε απομόνωση","title_en":"% children in isolation","aggregation":"percent","sheet_rows":[],"denominator_rows":[],"daily_only":false,"unit_el":"%","direction":"context","archived":false},{"key":"from_ed","position":12,"title_el":"% εισαγωγών από τα ΤΕΠ","title_en":"% admitted through the ED","aggregation":"percent","sheet_rows":[],"denominator_rows":[],"daily_only":false,"unit_el":"%","direction":"context","archived":false}],"filters":[{"indicatorKey":"mean_los","part":"numerator","position":0,"field_key":"discharge_date","op":"filled"},{"indicatorKey":"median_los","part":"numerator","position":0,"field_key":"discharge_date","op":"filled"},{"indicatorKey":"readmissions","part":"numerator","position":0,"field_key":"readmission_30d","op":"yes"},{"indicatorKey":"picu","part":"numerator","position":0,"field_key":"outcome","op":"eq","value":"picu"},{"indicatorKey":"picu","part":"denominator","position":0,"field_key":"outcome","op":"filled"},{"indicatorKey":"iv_antibiotics","part":"numerator","position":0,"field_key":"iv_antibiotics","op":"yes"},{"indicatorKey":"hai","part":"numerator","position":0,"field_key":"hai","op":"yes"},{"indicatorKey":"falls","part":"numerator","position":0,"field_key":"fall","op":"yes"},{"indicatorKey":"hai_rate","part":"numerator","position":0,"field_key":"hai","op":"yes"},{"indicatorKey":"hai_rate","part":"denominator","position":0,"field_key":"discharge_date","op":"filled"},{"indicatorKey":"falls_rate","part":"numerator","position":0,"field_key":"fall","op":"yes"},{"indicatorKey":"falls_rate","part":"denominator","position":0,"field_key":"discharge_date","op":"filled"},{"indicatorKey":"phlebitis_rate","part":"numerator","position":0,"field_key":"phlebitis","op":"yes"},{"indicatorKey":"phlebitis_rate","part":"denominator","position":0,"field_key":"peripheral_line_days","op":"gt","value":"0"},{"indicatorKey":"isolation","part":"numerator","position":0,"field_key":"isolation","op":"yes"},{"indicatorKey":"from_ed","part":"numerator","position":0,"field_key":"from_ed","op":"yes"}]}$tpl$::jsonb
    when 'endoscopy' then $tpl${"name_el":"Πράξεις Ενδοσκοπικού","name_en":"Endoscopy procedures","description_el":"Ένα φύλλο ανά μήνα με το πλήθος κάθε πράξης. Δείκτες: σύνολο, μερίδιο γαστροσκοπήσεων και κολονοσκοπήσεων.","description_en":"One sheet per month with the number of each procedure. Indicators: total, share of gastroscopies and colonoscopies.","kind":"sheet","entry_date_field":null,"identity_case_number":false,"identity_patient_name":false,"sections":[],"fields":[],"options":[],"axes":[{"axis":"row","key":"gastroscopy","label_el":"Γαστροσκοπήσεις","label_en":"Gastroscopies","position":0,"aliases":[],"archived":false},{"axis":"row","key":"colonoscopy","label_el":"Κολονοσκοπήσεις","label_en":"Colonoscopies","position":1,"aliases":[],"archived":false},{"axis":"row","key":"gastrostomy","label_el":"Γαστροστομίες","label_en":"Gastrostomies","position":2,"aliases":[],"archived":false},{"axis":"row","key":"cystoscopy","label_el":"Κυστεοσκοπήσεις","label_en":"Cystoscopies","position":3,"aliases":[],"archived":false},{"axis":"row","key":"bronchoscopy","label_el":"Βρογχοσκοπήσεις","label_en":"Bronchoscopies","position":4,"aliases":[],"archived":false},{"axis":"row","key":"ercp","label_el":"ERCP","label_en":"ERCP","position":5,"aliases":[],"archived":false},{"axis":"row","key":"eus","label_el":"EUS","label_en":"EUS","position":6,"aliases":[],"archived":false},{"axis":"row","key":"ebus","label_el":"EBUS","label_en":"EBUS","position":7,"aliases":[],"archived":false},{"axis":"measure","key":"count","label_el":"Αριθμός","label_en":"Number","position":0,"aliases":[],"archived":false}],"indicators":[{"key":"total","position":0,"title_el":"Σύνολο πράξεων","title_en":"Total procedures","aggregation":"sum","sheet_rows":[],"denominator_rows":[],"daily_only":false,"direction":"context","archived":false},{"key":"gastroscopy_share","position":1,"title_el":"% γαστροσκοπήσεων","title_en":"% gastroscopies","aggregation":"percent","sheet_rows":["gastroscopy"],"denominator_rows":[],"daily_only":false,"unit_el":"%","direction":"context","archived":false},{"key":"colonoscopy_share","position":2,"title_el":"% κολονοσκοπήσεων","title_en":"% colonoscopies","aggregation":"percent","sheet_rows":["colonoscopy"],"denominator_rows":[],"daily_only":false,"unit_el":"%","direction":"context","archived":false},{"key":"advanced_share","position":3,"title_el":"% προηγμένων πράξεων (ERCP, EUS, EBUS)","title_en":"% advanced procedures (ERCP, EUS, EBUS)","aggregation":"percent","sheet_rows":["ercp","eus","ebus"],"denominator_rows":[],"daily_only":false,"unit_el":"%","direction":"context","archived":false},{"key":"daily_mean","position":4,"title_el":"Μέσος αριθμός πράξεων ανά ημέρα λειτουργίας","title_en":"Mean procedures per working day","aggregation":"mean","sheet_rows":[],"denominator_rows":[],"daily_only":true,"direction":"context","note_el":"Από τα ημερήσια φύλλα· οι μήνες που καταχωρίστηκαν με ένα σύνολο δεν μετράνε.","note_en":"From the daily sheets; months recorded as a single total are left out.","archived":false},{"key":"days_recorded","position":5,"title_el":"Ημέρες με καταχώριση","title_en":"Days recorded","aggregation":"count","sheet_rows":[],"denominator_rows":[],"daily_only":true,"direction":"context","archived":false}],"filters":[]}$tpl$::jsonb
    when 'obstetrics' then $tpl${"name_el":"Μητρώο λεχωίδων Μαιευτικής","name_en":"Obstetrics postpartum register","description_el":"Μία καρτέλα ανά λεχωίδα: τοκετός, θηλασμός κατά την έξοδο, προγεννητικά μαθήματα, θήλαστρο.","description_en":"One card per mother: delivery, breastfeeding at discharge, antenatal classes, breast pump.","kind":"case","entry_date_field":"date","identity_case_number":true,"identity_patient_name":true,"sections":[{"key":"main","label_el":"Λεχωίδα","label_en":"Mother","position":0}],"fields":[{"key":"date","section_key":"main","position":0,"field_type":"date","label_el":"Ημερομηνία τοκετού","label_en":"Delivery date","required":true,"in_list":false,"in_breakdown":false,"provisional":false,"aliases":[],"archived":false},{"key":"delivery","section_key":"main","position":1,"field_type":"choice","label_el":"Τοκετός","label_en":"Delivery","required":true,"in_list":true,"in_breakdown":true,"provisional":false,"aliases":[],"archived":false},{"key":"breastfeeding","section_key":"main","position":2,"field_type":"choice","label_el":"Μητρικός θηλασμός κατά την έξοδο","label_en":"Breastfeeding at discharge","required":false,"in_list":true,"in_breakdown":true,"provisional":false,"aliases":[],"archived":false},{"key":"antenatal","section_key":"main","position":3,"field_type":"choice","label_el":"Προγεννητικά μαθήματα","label_en":"Antenatal classes","required":false,"in_list":true,"in_breakdown":true,"provisional":false,"aliases":[],"archived":false},{"key":"breast_pump","section_key":"main","position":4,"field_type":"yes_no","label_el":"Θήλαστρο","label_en":"Breast pump","required":false,"in_list":false,"in_breakdown":false,"provisional":false,"aliases":[],"archived":false},{"key":"physician","section_key":"main","position":5,"field_type":"choice","label_el":"Θεράπων ιατρός","label_en":"Attending physician","required":false,"in_list":false,"in_breakdown":false,"provisional":true,"help_el":"Οι ιατροί προστίθενται κατά την εισαγωγή ή στον ορισμό του μητρώου.","help_en":"Physicians are added on import or in the register definition.","aliases":[],"archived":false},{"key":"notes","section_key":"main","position":6,"field_type":"text","label_el":"Παρατηρήσεις","label_en":"Notes","required":false,"in_list":false,"in_breakdown":false,"provisional":false,"aliases":[],"archived":false}],"options":[{"fieldKey":"delivery","value":"vaginal","label_el":"Φυσιολογικός (Φ/Τ)","label_en":"Vaginal","position":0,"match":[],"archived":false},{"fieldKey":"delivery","value":"cs","label_el":"Καισαρική τομή (Κ/Τ)","label_en":"Caesarean section","position":1,"match":[],"archived":false},{"fieldKey":"breastfeeding","value":"exclusive","label_el":"Αποκλειστικός μητρικός θηλασμός","label_en":"Exclusive breastfeeding","position":0,"match":[],"archived":false},{"fieldKey":"breastfeeding","value":"mixed","label_el":"Μεικτή διατροφή","label_en":"Mixed feeding","position":1,"match":[],"archived":false},{"fieldKey":"breastfeeding","value":"weaning","label_el":"Απογαλακτισμός","label_en":"Weaning","position":2,"match":[],"archived":false},{"fieldKey":"antenatal","value":"attended","label_el":"Παρακολούθησε","label_en":"Attended","position":0,"match":[],"archived":false},{"fieldKey":"antenatal","value":"aware_not_attended","label_el":"Το γνώριζε, δεν παρακολούθησε","label_en":"Aware, did not attend","position":1,"match":[],"archived":false},{"fieldKey":"antenatal","value":"not_aware","label_el":"Δεν το γνώριζε","label_en":"Not aware","position":2,"match":[],"archived":false},{"fieldKey":"antenatal","value":"no","label_el":"Όχι","label_en":"No","position":3,"match":[],"archived":false},{"fieldKey":"physician","value":"rallis_g","label_el":"Γ. Ράλλης","label_en":"G. Rallis","position":0,"match":[],"archived":false},{"fieldKey":"physician","value":"mavridou_e","label_el":"Ε. Μαυρίδου","label_en":"E. Mavridou","position":1,"match":[],"archived":false},{"fieldKey":"physician","value":"kostopoulos_d","label_el":"Δ. Κωστόπουλος","label_en":"D. Kostopoulos","position":2,"match":[],"archived":false},{"fieldKey":"physician","value":"petridou_s","label_el":"Σ. Πετρίδου","label_en":"S. Petridou","position":3,"match":[],"archived":false}],"axes":[],"indicators":[{"key":"mothers","position":0,"title_el":"Λεχωίδες","title_en":"Mothers","aggregation":"count","sheet_rows":[],"denominator_rows":[],"daily_only":false,"direction":"context","archived":false},{"key":"cs_rate","position":1,"title_el":"% καισαρικών τομών","title_en":"% caesarean sections","aggregation":"percent","sheet_rows":[],"denominator_rows":[],"daily_only":false,"unit_el":"%","direction":"context","note_el":"Ανά λεχωίδα του τμήματος. Η Αίθουσα Τοκετών μετράει όλους τους τοκετούς.","note_en":"Per mother on the ward. The delivery room counts every delivery.","archived":false},{"key":"exclusive_bf","position":2,"title_el":"% αποκλειστικού μητρικού θηλασμού","title_en":"% exclusive breastfeeding","aggregation":"percent","sheet_rows":[],"denominator_rows":[],"daily_only":false,"unit_el":"%","direction":"higher","archived":false},{"key":"weaning","position":3,"title_el":"% απογαλακτισμού","title_en":"% weaning","aggregation":"percent","sheet_rows":[],"denominator_rows":[],"daily_only":false,"unit_el":"%","direction":"lower","archived":false},{"key":"antenatal","position":4,"title_el":"% με προγεννητικά μαθήματα","title_en":"% attended antenatal classes","aggregation":"percent","sheet_rows":[],"denominator_rows":[],"daily_only":false,"unit_el":"%","direction":"higher","archived":false},{"key":"breast_pump","position":5,"title_el":"% με θήλαστρο","title_en":"% breast pump","aggregation":"percent","sheet_rows":[],"denominator_rows":[],"daily_only":false,"unit_el":"%","direction":"context","archived":false}],"filters":[{"indicatorKey":"cs_rate","part":"numerator","position":0,"field_key":"delivery","op":"eq","value":"cs"},{"indicatorKey":"cs_rate","part":"denominator","position":0,"field_key":"delivery","op":"filled"},{"indicatorKey":"exclusive_bf","part":"numerator","position":0,"field_key":"breastfeeding","op":"eq","value":"exclusive"},{"indicatorKey":"exclusive_bf","part":"denominator","position":0,"field_key":"breastfeeding","op":"filled"},{"indicatorKey":"weaning","part":"numerator","position":0,"field_key":"breastfeeding","op":"eq","value":"weaning"},{"indicatorKey":"weaning","part":"denominator","position":0,"field_key":"breastfeeding","op":"filled"},{"indicatorKey":"antenatal","part":"numerator","position":0,"field_key":"antenatal","op":"eq","value":"attended"},{"indicatorKey":"antenatal","part":"denominator","position":0,"field_key":"antenatal","op":"filled"},{"indicatorKey":"breast_pump","part":"numerator","position":0,"field_key":"breast_pump","op":"yes"}]}$tpl$::jsonb
    when 'deliveryRoom' then $tpl${"name_el":"Πράξεις Αίθουσας Τοκετών","name_en":"Delivery room activity","description_el":"Ένα φύλλο ανά ημέρα: τοκετοί και λοιπές πράξεις. Οι φυσιολογικοί μετά από καισαρική μετριούνται ως μέρος των φυσιολογικών τοκετών, όχι επιπλέον.","description_en":"One sheet per month: deliveries and other procedures. VBAC is counted within vaginal deliveries, not on top.","kind":"sheet","entry_date_field":null,"identity_case_number":false,"identity_patient_name":false,"sections":[],"fields":[],"options":[],"axes":[{"axis":"row","key":"vaginal","label_el":"Φυσιολογικοί τοκετοί","label_en":"Vaginal deliveries","group_key":"deliveries","position":0,"aliases":[],"archived":false},{"axis":"row","key":"cs","label_el":"Καισαρικές τομές","label_en":"Caesarean sections","group_key":"deliveries","position":1,"aliases":[],"archived":false},{"axis":"row","key":"vbac","label_el":"Φυσιολογικοί μετά από καισαρική (μέρος των φυσιολογικών)","label_en":"Vaginal after caesarean (within vaginal)","group_key":"deliveries","position":2,"aliases":[],"archived":false},{"axis":"row","key":"multiple_vaginal","label_el":"Πολύδυμες με φυσιολογικό τοκετό","label_en":"Multiple pregnancies, vaginal","group_key":"deliveries","position":3,"aliases":[],"archived":false},{"axis":"row","key":"multiple_cs","label_el":"Πολύδυμες με καισαρική τομή","label_en":"Multiple pregnancies, caesarean","group_key":"deliveries","position":4,"aliases":[],"archived":false},{"axis":"row","key":"born_before_arrival","label_el":"Τοκετοί πριν την άφιξη στο νοσοκομείο","label_en":"Born before arrival","group_key":"deliveries","position":5,"aliases":[],"archived":false},{"axis":"row","key":"hysteroscopy","label_el":"Υστεροσκοπήσεις","label_en":"Hysteroscopies","group_key":"other","position":6,"aliases":[],"archived":false},{"axis":"row","key":"septic","label_el":"Σηπτικά","label_en":"Septic procedures","group_key":"other","position":7,"aliases":[],"archived":false},{"axis":"row","key":"pregnancy_monitoring","label_el":"Παρακολούθηση κύησης","label_en":"Pregnancy monitoring","group_key":"other","position":8,"aliases":[],"archived":false},{"axis":"row","key":"cerclage","label_el":"Περίδεση τραχήλου","label_en":"Cervical cerclage","group_key":"other","position":9,"aliases":[],"archived":false},{"axis":"measure","key":"count","label_el":"Αριθμός","label_en":"Number","position":0,"aliases":[],"archived":false},{"axis":"group","key":"deliveries","label_el":"Τοκετοί","label_en":"Deliveries","position":0,"aliases":[],"archived":false},{"axis":"group","key":"other","label_el":"Λοιπές πράξεις","label_en":"Other procedures","position":1,"aliases":[],"archived":false}],"indicators":[{"key":"deliveries","position":0,"title_el":"Σύνολο τοκετών","title_en":"Total deliveries","aggregation":"sum","sheet_rows":["vaginal","cs"],"denominator_rows":[],"daily_only":false,"direction":"context","archived":false},{"key":"cs_rate","position":1,"title_el":"% καισαρικών τομών","title_en":"% caesarean sections","aggregation":"percent","sheet_rows":["cs"],"denominator_rows":["vaginal","cs"],"daily_only":false,"unit_el":"%","direction":"lower","archived":false},{"key":"vbac_rate","position":2,"title_el":"Φυσιολογικοί τοκετοί μετά από καισαρική","title_en":"Vaginal births after caesarean","aggregation":"sum","sheet_rows":["vbac"],"denominator_rows":[],"daily_only":false,"direction":"context","archived":false},{"key":"multiple_cs_rate","position":3,"title_el":"% πολύδυμων που γεννήθηκαν με καισαρική","title_en":"% multiple pregnancies born by caesarean","aggregation":"percent","sheet_rows":["multiple_cs"],"denominator_rows":["multiple_cs","multiple_vaginal"],"daily_only":false,"unit_el":"%","direction":"context","archived":false},{"key":"hysteroscopies","position":4,"title_el":"Υστεροσκοπήσεις","title_en":"Hysteroscopies","aggregation":"sum","sheet_rows":["hysteroscopy"],"denominator_rows":[],"daily_only":false,"direction":"context","archived":false},{"key":"septic","position":5,"title_el":"Σηπτικά","title_en":"Septic procedures","aggregation":"sum","sheet_rows":["septic"],"denominator_rows":[],"daily_only":false,"direction":"context","archived":false},{"key":"born_before_arrival","position":6,"title_el":"Τοκετοί πριν την άφιξη στο νοσοκομείο","title_en":"Births before arrival at the hospital","aggregation":"sum","sheet_rows":["born_before_arrival"],"denominator_rows":[],"daily_only":false,"direction":"context","note_el":"Δεν περιλαμβάνονται στο σύνολο των τοκετών.","note_en":"Not included in the total deliveries.","archived":false},{"key":"daily_deliveries","position":7,"title_el":"Μέσος αριθμός τοκετών ανά ημέρα","title_en":"Mean deliveries per day","aggregation":"mean","sheet_rows":["vaginal","cs"],"denominator_rows":[],"daily_only":true,"direction":"context","note_el":"Από τα ημερήσια φύλλα· οι μήνες που καταχωρίστηκαν με ένα σύνολο δεν μετράνε.","note_en":"From the daily sheets; months recorded as one total do not count.","archived":false},{"sheet_rows":["cerclage"],"denominator_rows":[],"daily_only":false,"direction":"context","archived":false,"aggregation":"sum","multiplier":1,"key":"cerclages","position":8,"title_el":"Περιδέσεις τραχήλου","title_en":"Cervical cerclages"},{"sheet_rows":["pregnancy_monitoring"],"denominator_rows":[],"daily_only":false,"direction":"context","archived":false,"aggregation":"sum","multiplier":1,"key":"pregnancy_monitoring","position":9,"title_el":"Παρακολουθήσεις κύησης","title_en":"Pregnancy monitoring"}],"filters":[]}$tpl$::jsonb
    when 'emergency' then $tpl${"name_el":"Δραστηριότητα ΤΕΠ ανά βάρδια","name_en":"Emergency department activity by shift","description_el":"Ένα φύλλο ανά μήνα: κάθε κατηγορία ανά βάρδια. Ο καταχωρητής καταγράφεται αυτόματα.","description_en":"One sheet per month: each category per shift. Who recorded it is kept automatically.","kind":"sheet","entry_date_field":null,"identity_case_number":false,"identity_patient_name":false,"sections":[],"fields":[],"options":[],"axes":[{"axis":"row","key":"surgical","label_el":"Χειρουργικά","label_en":"Surgical","position":0,"aliases":[],"archived":false},{"axis":"row","key":"urgent","label_el":"Έκτακτα","label_en":"Urgent","position":1,"aliases":[],"archived":false},{"axis":"row","key":"admissions","label_el":"Εισαγωγές","label_en":"Admissions","position":2,"aliases":[],"archived":false},{"axis":"row","key":"dressings","label_el":"Αλλαγές","label_en":"Dressings","position":3,"aliases":[],"archived":false},{"axis":"row","key":"septic","label_el":"Σηπτικά","label_en":"Septic","position":4,"aliases":[],"archived":false},{"axis":"row","key":"assessments","label_el":"Εκτιμήσεις","label_en":"Assessments","position":5,"aliases":[],"archived":false},{"axis":"row","key":"checkup","label_el":"ΗΚΓ - check up","label_en":"ECG - check-up","position":6,"aliases":[],"archived":false},{"axis":"row","key":"preop","label_el":"Προεγχειρητικός έλεγχος","label_en":"Pre-operative check","position":7,"aliases":[],"archived":false},{"axis":"row","key":"left_without_seen","label_el":"Αποχώρησαν χωρίς εξέταση","label_en":"Left without being seen","position":8,"aliases":[],"archived":false},{"axis":"row","key":"revisit_72h","label_el":"Επανεπισκέψεις εντός 72 ωρών","label_en":"Return visits within 72 hours","position":9,"aliases":[],"archived":false},{"axis":"row","key":"transfers","label_el":"Διακομιδές σε άλλο νοσοκομείο","label_en":"Transfers to another hospital","position":10,"aliases":[],"archived":false},{"axis":"measure","key":"morning","label_el":"07:00-15:00","label_en":"07:00-15:00","position":0,"aliases":[],"archived":false},{"axis":"measure","key":"afternoon","label_el":"15:00-23:00","label_en":"15:00-23:00","position":1,"aliases":[],"archived":false},{"axis":"measure","key":"night","label_el":"23:00-07:00","label_en":"23:00-07:00","position":2,"aliases":[],"archived":false}],"indicators":[{"key":"total","position":0,"title_el":"Σύνολο περιστατικών","title_en":"Total cases","aggregation":"sum","sheet_rows":["surgical","urgent","checkup","preop","assessments","septic"],"denominator_rows":[],"daily_only":false,"direction":"context","archived":false},{"key":"admissions","position":1,"title_el":"Εισαγωγές","title_en":"Admissions","aggregation":"sum","sheet_rows":["admissions"],"denominator_rows":[],"daily_only":false,"direction":"context","archived":false},{"key":"admission_rate","position":2,"title_el":"% εισαγωγών από τα ΤΕΠ","title_en":"% admitted from the emergency department","aggregation":"percent","sheet_rows":["admissions"],"denominator_rows":["surgical","urgent","checkup","preop","assessments","septic"],"daily_only":false,"unit_el":"%","direction":"context","note_el":"Εισαγωγές ÷ περιστατικά του ΤΕΠ.","note_en":"Admissions ÷ the department’s cases.","archived":false},{"key":"daily_cases","position":3,"title_el":"Μέσος αριθμός περιστατικών ανά ημέρα","title_en":"Mean cases per day","aggregation":"mean","sheet_rows":["surgical","urgent","checkup","preop","assessments","septic"],"denominator_rows":[],"daily_only":true,"direction":"context","note_el":"Από τα ημερήσια φύλλα· οι μήνες που καταχωρίστηκαν με ένα σύνολο δεν μετράνε.","note_en":"From the daily sheets; months recorded as one total do not count.","archived":false},{"key":"night_share","position":4,"title_el":"% περιστατικών στη νυχτερινή βάρδια","title_en":"% of cases on the night shift","aggregation":"percent","sheet_rows":["surgical","urgent","checkup","preop","assessments","septic"],"sheet_measure":"night","denominator_rows":["surgical","urgent","checkup","preop","assessments","septic"],"daily_only":false,"unit_el":"%","direction":"context","archived":false},{"key":"septic","position":5,"title_el":"Σηπτικά","title_en":"Septic","aggregation":"sum","sheet_rows":["septic"],"denominator_rows":[],"daily_only":false,"direction":"context","archived":false},{"key":"dressings","position":6,"title_el":"Αλλαγές τραυμάτων","title_en":"Wound dressings","aggregation":"sum","sheet_rows":["dressings"],"denominator_rows":[],"daily_only":false,"direction":"context","note_el":"Δεν περιλαμβάνονται στο σύνολο περιστατικών.","note_en":"Not part of the total cases.","archived":false},{"key":"left_without_seen_rate","position":7,"title_el":"% αποχωρήσεων χωρίς εξέταση","title_en":"% left without being seen","aggregation":"percent","sheet_rows":["left_without_seen"],"denominator_rows":["surgical","urgent","checkup","preop","assessments","septic"],"daily_only":false,"unit_el":"%","target":2,"direction":"lower","note_el":"Οι ασθενείς που έφυγαν πριν εξεταστούν, ως ποσοστό των περιστατικών του ΤΕΠ.","note_en":"Patients who left before being seen, as a share of the emergency department's cases.","archived":false},{"key":"revisit_72h_rate","position":8,"title_el":"% επανεπισκέψεων εντός 72 ωρών","title_en":"% return visits within 72 hours","aggregation":"percent","sheet_rows":["revisit_72h"],"denominator_rows":["surgical","urgent","checkup","preop","assessments","septic"],"daily_only":false,"unit_el":"%","target":5,"direction":"lower","note_el":"Ασθενείς που ξαναήρθαν στο ΤΕΠ εντός 72 ωρών από προηγούμενη επίσκεψη.","note_en":"Patients who came back to the emergency department within 72 hours of a previous visit.","archived":false},{"key":"transfer_rate","position":9,"title_el":"% διακομιδών σε άλλο νοσοκομείο","title_en":"% transfers to another hospital","aggregation":"percent","sheet_rows":["transfers"],"denominator_rows":["surgical","urgent","checkup","preop","assessments","septic"],"daily_only":false,"unit_el":"%","direction":"context","note_el":"Πληροφοριακός δείκτης: δεν κρίνεται ως καλός ή κακός.","note_en":"Informative: it is not judged as good or bad.","archived":false}],"filters":[]}$tpl$::jsonb
  end;
$function$;
revoke all on function private.demo_register_template(text) from public, anon, authenticated;

-- Ο πίνακας δεδομένων ενός Demo μητρώου: ίδιος με το public.department_register_sync
-- (20261105100000) χωρίς τον έλεγχο ρόλου του χρήστη, ώστε η επαναφορά να
-- δουλεύει με όποιον ρόλο έχει ο αξιολογητής. Μόνο για μητρώα Demo νοσοκομείων.
create or replace function private.demo_register_sync(p_register_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $function$
declare
  r public.department_registers;
  f public.department_register_fields;
  cell record;
  base text;
  ident text;
begin
  select * into r from public.department_registers where id = p_register_id for update;
  if not found then raise exception 'Unknown register'; end if;
  if not exists (select 1 from public.organizations o where o.id = r.organization_id and o.is_demo) then
    raise exception 'Only Demo organizations' using errcode = '42501';
  end if;
  base := r.table_name;
  if base is null then
    base := 'register_' || left(regexp_replace(lower(coalesce(r.template_key, 'custom')), '[^a-z0-9]+', '_', 'g'), 20) || '_' || left(replace(r.id::text, '-', ''), 8);
    update public.department_registers set table_name = base where id = r.id;
  end if;
  ident := base || '_identity';

  execute format($t$create table if not exists public.%I (
    id uuid primary key default gen_random_uuid(),
    organization_id uuid not null references public.organizations(id) on delete cascade,
    department_id uuid references public.departments(id) on delete set null,
    register_id uuid not null references public.department_registers(id) on delete cascade,
    entry_date date not null default current_date,
    period_start date unique,
    status text not null default 'complete' check (status in ('draft','complete')),
    locked boolean not null default false,
    definition_version integer not null default 1,
    created_by uuid default auth.uid(),
    created_at timestamptz not null default now(),
    updated_by uuid default auth.uid(),
    updated_at timestamptz not null default now())$t$, base);
  execute format('create index if not exists %I on public.%I (entry_date desc)', base || '_date_idx', base);
  execute format('comment on table public.%I is %L', base, 'Data of the register «' || r.name_el || '» (' || r.code || '): one column per field, no names.');
  execute format('create or replace trigger trg_register_row_scope before insert or update on public.%I for each row execute function private.register_row_scope(%L)', base, r.id);
  execute format('alter table public.%I enable row level security', base);
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = base and policyname = 'register_read') then
    execute format($p$create policy register_read on public.%I for select to authenticated using (
    public.current_user_is_platform_owner()
    or public.current_user_has_org_role(organization_id, array['hospital_admin'::public.app_role,'quality_manager'::public.app_role,'infection_control_lead'::public.app_role])
    or public.current_user_has_capability(organization_id, 'view_quality')
    or (department_id is not null and public.current_user_has_department_scope(organization_id, department_id)))$p$, base);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = base and policyname = 'register_insert') then
    execute format($p$create policy register_insert on public.%I for insert to authenticated with check (
    public.current_user_is_platform_owner()
    or public.current_user_has_org_role(organization_id, array['hospital_admin'::public.app_role])
    or exists (select 1 from public.department_registers d where d.id = register_id and d.status = 'active'
      and d.department_id is not null and public.current_user_has_department_scope(d.organization_id, d.department_id)))$p$, base);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = base and policyname = 'register_update') then
    execute format($p$create policy register_update on public.%I for update to authenticated using (
    public.current_user_is_platform_owner()
    or public.current_user_has_org_role(organization_id, array['hospital_admin'::public.app_role,'quality_manager'::public.app_role])
    or public.current_user_has_capability(organization_id, 'manage_quality')
    or (department_id is not null and public.current_user_has_department_scope(organization_id, department_id)
      and (not locked or public.current_user_has_org_role(organization_id, array['department_manager'::public.app_role]))))
    with check (
    public.current_user_is_platform_owner()
    or public.current_user_has_org_role(organization_id, array['hospital_admin'::public.app_role,'quality_manager'::public.app_role])
    or public.current_user_has_capability(organization_id, 'manage_quality')
    or (department_id is not null and public.current_user_has_department_scope(organization_id, department_id)))$p$, base);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = base and policyname = 'register_delete') then
    execute format($p$create policy register_delete on public.%I for delete to authenticated using (
    public.current_user_is_platform_owner()
    or public.current_user_has_org_role(organization_id, array['hospital_admin'::public.app_role])
    or (not locked and department_id is not null and public.current_user_has_department_scope(organization_id, department_id)))$p$, base);
  end if;
  execute format('revoke all on public.%I from anon', base);
  execute format('grant select, insert, update, delete on public.%I to authenticated', base);

  for f in select * from public.department_register_fields where register_id = r.id and not archived order by (field_type = 'computed'), position loop
    if not exists (select 1 from information_schema.columns c where c.table_schema = 'public' and c.table_name = base and c.column_name = f.key) then
      execute format('alter table public.%I add column %I %s', base, f.key, private.register_column_sql(f));
    end if;
    execute format('comment on column public.%I.%I is %L', base, f.key, f.label_el || coalesce(' (' || f.unit_el || ')', ''));
  end loop;

  for cell in
    select rw.key || '__' || m.key as column_name, rw.label_el || ' · ' || m.label_el as label
    from public.department_register_sheet_axes rw
    join public.department_register_sheet_axes m on m.register_id = rw.register_id and m.axis = 'measure' and not m.archived
    where rw.register_id = r.id and rw.axis = 'row' and not rw.archived
  loop
    if not exists (select 1 from information_schema.columns c where c.table_schema = 'public' and c.table_name = base and c.column_name = cell.column_name) then
      execute format('alter table public.%I add column %I integer check (%I >= 0)', base, cell.column_name, cell.column_name);
    end if;
    execute format('comment on column public.%I.%I is %L', base, cell.column_name, cell.label);
  end loop;

  if r.kind = 'case' then
    execute format($t$create table if not exists public.%I (
      entry_id uuid primary key references public.%I(id) on delete cascade,
      organization_id uuid not null references public.organizations(id) on delete cascade,
      department_id uuid references public.departments(id) on delete set null,
      case_number text,
      patient_name text,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now())$t$, ident, base);
    execute format('create index if not exists %I on public.%I (case_number)', ident || '_case_idx', ident);
    execute format('comment on table public.%I is %L', ident, 'Who each entry of «' || r.name_el || '» is about. Readable only inside the department.');
    execute format('create or replace trigger trg_register_identity_scope before insert or update on public.%I for each row execute function private.register_identity_scope(%L)', ident, base);
    execute format('alter table public.%I enable row level security', ident);
    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = ident and policyname = 'register_identity_department') then
      execute format($p$create policy register_identity_department on public.%I for all to authenticated using (
      public.current_user_is_platform_owner()
      or (department_id is not null and public.current_user_has_department_scope(organization_id, department_id)))
      with check (
      public.current_user_is_platform_owner()
      or exists (select 1 from public.%I e where e.id = entry_id
        and e.department_id is not null and public.current_user_has_department_scope(e.organization_id, e.department_id)))$p$, ident, base);
    end if;
    execute format('revoke all on public.%I from anon', ident);
    execute format('grant select, insert, update, delete on public.%I to authenticated', ident);
  end if;

  notify pgrst, 'reload schema';
  return base;
end;
$function$;
revoke all on function private.demo_register_sync(uuid) from public, anon, authenticated;

-- Φτιάχνει ένα μητρώο από πρότυπο, όπως η οθόνη «Νέο μητρώο»: γραμμή μητρώου,
-- ενότητες, πεδία, επιλογές, άξονες φύλλου, δείκτες, φίλτρα, στόχοι· μετά ο
-- πίνακας και οι γρήγορες αναγνώσεις. Επιστρέφει το id.
create or replace function private.demo_register_create(p_organization_id uuid, p_department_id uuid, p_code text, p_key text, p_actor uuid, p_daily_from date default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_tpl jsonb := private.demo_register_template(p_key);
  v_id uuid;
  v_table text;
begin
  if v_tpl is null then raise exception 'Unknown register template %', p_key; end if;
  -- Σταθερό όνομα πίνακα ανά νοσοκομείο και πρότυπο (βλ. σημείωση στην κορυφή).
  v_table := 'register_' || left(regexp_replace(lower(p_key), '[^a-z0-9]+', '_', 'g'), 20) || '_' || left(md5(p_organization_id::text || ':' || p_key), 8);
  if exists (select 1 from public.department_registers r where r.table_name = v_table) then v_table := null; end if;

  insert into public.department_registers (organization_id, department_id, code, name_el, name_en, description_el, description_en, kind, status, version, template_key, entry_date_field, daily_from, identity_case_number, identity_patient_name, table_name, history, created_by)
  values (p_organization_id, p_department_id, p_code, v_tpl ->> 'name_el', v_tpl ->> 'name_en', v_tpl ->> 'description_el', v_tpl ->> 'description_en', v_tpl ->> 'kind', 'active', 1, p_key,
    v_tpl ->> 'entry_date_field', case when v_tpl ->> 'kind' = 'sheet' then p_daily_from end,
    coalesce((v_tpl ->> 'identity_case_number')::boolean, false), coalesce((v_tpl ->> 'identity_patient_name')::boolean, false), v_table,
    jsonb_build_array(jsonb_build_object('at', to_char(now() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'), 'action', 'created', 'actor', coalesce((select p.full_name from public.profiles p where p.id = p_actor), 'Demo'))),
    p_actor)
  returning id into v_id;

  insert into public.department_register_sections (organization_id, register_id, key, label_el, label_en, position)
  select p_organization_id, v_id, s.key, s.label_el, s.label_en, s.position
  from jsonb_populate_recordset(null::public.department_register_sections, v_tpl -> 'sections') s;

  insert into public.department_register_fields (organization_id, register_id, key, section_key, position, field_type, label_el, label_en, unit_el, unit_en, min_value, max_value, usual_min, usual_max, required, required_from, in_list, in_breakdown, provisional, help_el, help_en, not_before_key, show_when_key, show_when_value, computed_kind, computed_from, computed_to, aliases, archived)
  select p_organization_id, v_id, f.key, f.section_key, f.position, f.field_type, f.label_el, f.label_en, f.unit_el, f.unit_en, f.min_value, f.max_value, f.usual_min, f.usual_max, f.required, f.required_from, f.in_list, f.in_breakdown, f.provisional, f.help_el, f.help_en, f.not_before_key, f.show_when_key, f.show_when_value, f.computed_kind, f.computed_from, f.computed_to, '{}', false
  from jsonb_populate_recordset(null::public.department_register_fields, v_tpl -> 'fields') f;

  insert into public.department_register_options (organization_id, register_id, field_id, value, label_el, label_en, position, match, archived)
  select p_organization_id, v_id, f.id, o ->> 'value', o ->> 'label_el', o ->> 'label_en', (o ->> 'position')::integer, '{}', false
  from jsonb_array_elements(v_tpl -> 'options') o
  join public.department_register_fields f on f.register_id = v_id and f.key = o ->> 'fieldKey';

  insert into public.department_register_sheet_axes (organization_id, register_id, axis, key, label_el, label_en, help_el, help_en, group_key, position, aliases, archived)
  select p_organization_id, v_id, a.axis, a.key, a.label_el, a.label_en, a.help_el, a.help_en, a.group_key, a.position, '{}', false
  from jsonb_populate_recordset(null::public.department_register_sheet_axes, v_tpl -> 'axes') a;

  insert into public.department_register_indicators (organization_id, register_id, key, position, title_el, title_en, aggregation, field_key, date_field_key, denominator_field_key, multiplier, sheet_rows, sheet_measure, denominator_rows, denominator_measure, daily_only, unit_el, unit_en, target, threshold, direction, note_el, note_en, archived)
  select p_organization_id, v_id, i.key, i.position, i.title_el, i.title_en, i.aggregation, i.field_key, i.date_field_key, i.denominator_field_key, i.multiplier, coalesce(i.sheet_rows, '{}'), i.sheet_measure, coalesce(i.denominator_rows, '{}'), i.denominator_measure, coalesce(i.daily_only, false), i.unit_el, i.unit_en, i.target, i.threshold, i.direction, i.note_el, i.note_en, false
  from jsonb_populate_recordset(null::public.department_register_indicators, v_tpl -> 'indicators') i;

  insert into public.department_register_indicator_filters (organization_id, register_id, indicator_id, part, position, field_key, op, value)
  select p_organization_id, v_id, i.id, x ->> 'part', (x ->> 'position')::integer, x ->> 'field_key', x ->> 'op', x ->> 'value'
  from jsonb_array_elements(v_tpl -> 'filters') x
  join public.department_register_indicators i on i.register_id = v_id and i.key = x ->> 'indicatorKey';

  -- Στόχοι Demo: όσοι εγκρίθηκαν για τα πραγματικά μητρώα (20261230110300,
  -- 20261230111100, 20261231221000, 20261231222700). Οι στόχοι του ΤΕΠ έρχονται
  -- από το πρότυπο. Ο στόχος καισαρικών του Μητρώου λεχωίδων δεν μπαίνει (πρόταση).
  update public.department_register_indicators i
  set target = t.target, threshold = t.threshold, direction = t.direction
  from (values
    ('icu', 'mortality', 15::numeric, null::numeric, 'lower'), ('icu', 'mortality_scored', 15, null, 'lower'), ('icu', 'mean_icu_days', 5, null, 'lower'),
    ('icu', 'pressure_ulcers', 5, null, 'lower'), ('icu', 'readmissions_48h', 5, null, 'lower'), ('icu', 'mean_ventilator_hours', 96, null, 'lower'),
    ('nicu', 'mortality', 2, null, 'lower'), ('nicu', 'readmissions', 5, null, 'lower'), ('nicu', 'late_infection_rate', 5, null, 'lower'),
    ('nicu', 'breast_milk', 50, null, 'higher'), ('nicu', 'no_breast_milk', 15, null, 'lower'), ('nicu', 'mean_los', 14, null, 'lower'),
    ('nicu', 'mean_ventilator', 5, null, 'lower'), ('nicu', 'mean_cpap', 7, null, 'lower'),
    ('paediatrics', 'readmissions', 5, null, 'lower'), ('paediatrics', 'hai', 2, null, 'lower'), ('paediatrics', 'picu', 3, null, 'lower'),
    ('paediatrics', 'falls', 0, null, 'lower'), ('paediatrics', 'mean_los', 3, null, 'lower'),
    ('paediatrics', 'hai_rate', 0, null, 'lower'), ('paediatrics', 'falls_rate', 0, null, 'lower'), ('paediatrics', 'phlebitis_rate', 0, null, 'lower'),
    ('obstetrics', 'exclusive_bf', 60, null, 'higher'), ('obstetrics', 'antenatal', 50, null, 'higher'), ('obstetrics', 'weaning', 10, null, 'lower'),
    ('deliveryRoom', 'cs_rate', 55, 65, 'lower')
  ) as t(template_key, indicator_key, target, threshold, direction)
  where t.template_key = p_key and i.register_id = v_id and i.key = t.indicator_key;

  perform private.demo_register_sync(v_id);
  perform private.register_fast_policies(v_id);
  return v_id;
end;
$function$;
revoke all on function private.demo_register_create(uuid, uuid, text, text, uuid, date) from public, anon, authenticated;

-- Γράφει καταχωρίσεις στον πίνακα του μητρώου: κάθε στοιχείο του p_rows είναι ένα
-- αντικείμενο με κλειδιά τις στήλες (οι υπολογιζόμενες τις γεμίζει η βάση), συν
-- _case και _name για τον πίνακα ταυτότητας.
create or replace function private.demo_register_insert(p_register_id uuid, p_actor uuid, p_rows jsonb)
returns integer
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_table text;
  v_kind text;
  v_cols text;
  v_count integer;
begin
  select table_name, kind into v_table, v_kind from public.department_registers where id = p_register_id;
  if v_table is null then raise exception 'Register has no data table'; end if;
  select string_agg(quote_ident(c.column_name), ', ' order by c.ordinal_position) into v_cols
  from information_schema.columns c
  where c.table_schema = 'public' and c.table_name = v_table and c.is_generated = 'NEVER'
    and c.column_name in (select distinct k from jsonb_array_elements(p_rows) e, jsonb_object_keys(e) k);
  execute format('insert into public.%I (%s, created_by) select %s, $2 from jsonb_populate_recordset(null::public.%I, $1)', v_table, v_cols, v_cols, v_table)
    using p_rows, p_actor;
  get diagnostics v_count = row_count;
  if v_kind = 'case' then
    execute format('insert into public.%I (entry_id, case_number, patient_name) select (e ->> ''id'')::uuid, e ->> ''_case'', e ->> ''_name'' from jsonb_array_elements($1) e where e ? ''_case''', v_table || '_identity')
      using p_rows;
  end if;
  return v_count;
end;
$function$;
revoke all on function private.demo_register_insert(uuid, uuid, jsonb) from public, anon, authenticated;

-- Επινοημένο ονοματεπώνυμο (επώνυμο, όνομα) για το Demo.
create or replace function private.demo_register_name(p_i integer, p_salt integer, p_female boolean)
returns text
language sql
immutable
set search_path = ''
as $function$
  select case when p_female
    then (array['Παπαδοπούλου','Γεωργίου','Δημητρίου','Νικολάου','Κωνσταντίνου','Ιωάννου','Αθανασίου','Βασιλείου','Οικονόμου','Μακρή','Αντωνίου','Σταθοπούλου','Κυριακίδου','Λαμπροπούλου','Χριστοδούλου','Ζαχαρίου'])[1 + floor(private.demo_register_rand(p_i, p_salt) * 16)::integer]
      || ' ' || (array['Μαρία','Ελένη','Αικατερίνη','Βασιλική','Σοφία','Αγγελική','Δήμητρα','Ευαγγελία','Ιωάννα','Χριστίνα','Παναγιώτα','Αναστασία'])[1 + floor(private.demo_register_rand(p_i, p_salt + 1) * 12)::integer]
    else (array['Παπαδόπουλος','Γεωργίου','Δημητρίου','Νικολάου','Κωνσταντίνου','Ιωάννου','Αθανασίου','Βασιλείου','Οικονόμου','Μακρής','Αντωνίου','Σταθόπουλος','Κυριακίδης','Λαμπρόπουλος','Χριστοδούλου','Ζαχαρίου'])[1 + floor(private.demo_register_rand(p_i, p_salt) * 16)::integer]
      || ' ' || (array['Γεώργιος','Ιωάννης','Κωνσταντίνος','Δημήτριος','Νικόλαος','Παναγιώτης','Βασίλειος','Χρήστος','Αθανάσιος','Μιχαήλ','Ευάγγελος','Σπυρίδων'])[1 + floor(private.demo_register_rand(p_i, p_salt + 1) * 12)::integer]
  end;
$function$;
revoke all on function private.demo_register_name(integer, integer, boolean) from public, anon, authenticated;

-- ΜΕΘ: 84 νοσηλείες σε ~6 μήνες, Γενική και Καρδιοχειρουργική, μερικοί ακόμη μέσα.
create or replace function private.demo_seed_register_icu(p_register_id uuid, p_actor uuid, d0 date)
returns integer
language plpgsql
security definer
set search_path = ''
as $function$
declare
  n constant integer := 84;
  v_rows jsonb := '[]'::jsonb;
  i integer;
  v_adm date; v_dis date; v_cardiac boolean; v_reason text; v_postop boolean; v_age integer; v_apache integer; v_los integer;
  v_vent integer; v_outcome text; v_transfer text; v_female boolean;
  r double precision[];
begin
  for i in 1..n loop
    r := array(select private.demo_register_rand(i, 1000 + k) from generate_series(1, 24) k);
    v_adm := d0 - (floor((i - 1) * 182.0 / n) + floor(r[1] * 2))::integer;
    v_cardiac := r[2] < 0.25;
    v_reason := case when v_cardiac then case when r[3] < 0.85 then 'cardiac_surgery' else 'cardiac' end
      when r[3] < 0.26 then 'respiratory' when r[3] < 0.46 then 'sepsis' when r[3] < 0.72 then 'postop'
      when r[3] < 0.82 then 'cardiac' when r[3] < 0.92 then 'neuro' when r[3] < 0.97 then 'trauma' else 'other' end;
    v_postop := v_reason in ('postop', 'cardiac_surgery');
    v_age := case when v_cardiac then 52 + floor(r[4] * 33) else 28 + floor(r[4] * 62) end;
    v_apache := case when v_cardiac then 6 + floor(r[5] * 14) when v_postop then 8 + floor(r[5] * 16) else 12 + floor(r[5] * 22) end;
    v_los := case when v_cardiac then 1 + floor(r[6] * r[6] * 5) when v_reason = 'postop' then 1 + floor(r[6] * r[6] * 6) else 2 + floor(r[6] * r[6] * 18) end;
    v_dis := case when v_adm + v_los <= d0 then v_adm + v_los end;
    v_vent := case when v_cardiac then 4 + floor(r[7] * 20)
      when v_reason in ('respiratory', 'sepsis', 'neuro', 'trauma') and r[7] < 0.85 then greatest(12, floor(v_los * 24 * (0.4 + 0.5 * r[8])))
      when r[7] < 0.3 then 6 + floor(r[8] * 30) else 0 end;
    v_outcome := case when v_dis is null then null
      when (v_cardiac and r[9] < 0.025) or (not v_cardiac and r[9] < v_apache / 115.0) then 'death'
      when r[10] < 0.05 then 'transfer_hospital' else 'transfer_ward' end;
    v_transfer := case when v_outcome is distinct from 'transfer_ward' then null
      when v_cardiac then case when r[11] < 0.7 then 'cardiac_surgery_ward' else 'cardiology' end
      when v_reason = 'postop' then case when r[11] < 0.75 then 'surgical' else 'orthopaedic' end
      when v_reason = 'respiratory' then case when r[11] < 0.6 then 'pulmonary' else 'internal' end
      when v_reason = 'neuro' then 'neurology' when v_reason = 'cardiac' then 'cardiology'
      when v_reason = 'trauma' then 'orthopaedic' else 'internal' end;
    v_female := r[21] >= 0.62;
    v_rows := v_rows || jsonb_build_object(
      'id', gen_random_uuid(), 'status', 'complete',
      'admission_date', v_adm, 'category', case when v_cardiac then 'cardiac' else 'general' end,
      'age', v_age, 'sex', case when v_female then 'female' else 'male' end, 'admission_reason', v_reason,
      'requisition', r[18] < 0.07, 'readmission_48h', r[19] < 0.03,
      'apache_score', v_apache, 'apache_postop', v_postop,
      'euroscore', case when v_cardiac then round((0.8 + r[20] * r[20] * 11)::numeric, 2) end,
      'ventilator_hours', v_vent,
      'pressure_ulcer', (v_los >= 7 and r[12] < 0.15) or r[12] < 0.01,
      'vap', v_vent > 96 and r[13] < 0.12,
      'air_mattress', v_los >= 3 and r[14] < 0.8,
      'daily_cleaning', r[15] < 0.96, 'line_care', r[16] < 0.93,
      'cultures', (not v_cardiac and r[17] < 0.7) or r[17] < 0.2,
      'discharge_date', v_dis, 'outcome', v_outcome, 'transfer_department', v_transfer,
      '_case', 'ΜΕΘ-' || to_char(v_adm, 'YY') || '-' || lpad((n + 1 - i)::text, 4, '0'),
      '_name', private.demo_register_name(i, 1100, v_female));
  end loop;
  return private.demo_register_insert(p_register_id, p_actor, v_rows);
end;
$function$;
revoke all on function private.demo_seed_register_icu(uuid, uuid, date) from public, anon, authenticated;

-- ΜΕΝΝ: 66 νεογνά σε ~6 μήνες, πρόωρα με αναπνευστήρα, CPAP, καθετήρες και TPN.
create or replace function private.demo_seed_register_nicu(p_register_id uuid, p_actor uuid, d0 date)
returns integer
language plpgsql
security definer
set search_path = ''
as $function$
declare
  n constant integer := 66;
  v_rows jsonb := '[]'::jsonb;
  i integer;
  v_adm date; v_birth date; v_dis date; v_reason text; v_origin text; v_gest integer; v_weight integer; v_preterm boolean;
  v_apgar1 integer; v_vent integer; v_cpap integer; v_umb text; v_umb_days integer; v_picc integer; v_central integer;
  v_los integer; v_outcome text; v_ptype text; v_female boolean;
  r double precision[];
begin
  for i in 1..n loop
    r := array(select private.demo_register_rand(i, 2000 + k) from generate_series(1, 32) k);
    v_adm := d0 - (floor((i - 1) * 182.0 / n) + floor(r[1] * 3))::integer;
    v_reason := case when r[2] < 0.30 then 'prematurity' when r[2] < 0.55 then 'respiratory' when r[2] < 0.70 then 'jaundice'
      when r[2] < 0.80 then 'infection' when r[2] < 0.88 then 'low_weight' when r[2] < 0.95 then 'observation'
      when r[2] < 0.98 then 'congenital' else 'other' end;
    v_gest := case when v_reason = 'prematurity' then 196 + floor(r[3] * 60)
      when v_reason = 'low_weight' then 245 + floor(r[3] * 21)
      when v_reason = 'respiratory' and r[4] < 0.33 then 231 + floor(r[3] * 28)
      else 259 + floor(r[3] * 32) end;
    v_preterm := v_gest < 259;
    -- Γεννημένα εδώ (Αίθουσα Τοκετών / Μαιευτική) ή από το σπίτι και άλλο νοσοκομείο.
    if v_preterm or r[5] < 0.75 then
      v_origin := case when v_reason = 'jaundice' or r[6] >= 0.75 then 'maternity' else 'delivery_room' end;
      v_birth := case when v_origin = 'maternity' then v_adm - (1 + floor(r[7] * 3))::integer else v_adm end;
    else
      v_origin := case when r[6] < 0.6 then 'home' else 'other_hospital' end;
      v_birth := v_adm - (3 + floor(r[7] * 18))::integer;
    end if;
    v_weight := least(4800, greatest(600, (3400 - (280 - v_gest) * 27 + (r[8] - 0.5) * 500)::integer));
    if v_reason = 'low_weight' then v_weight := least(v_weight, 2300); end if;
    v_apgar1 := case when v_gest < 224 then 4 + floor(r[9] * 4) else 7 + floor(r[9] * 3) end;
    v_vent := case when v_gest < 224 and r[10] < 0.6 then 1 + floor(r[11] * 10)
      when v_reason = 'respiratory' and r[10] < 0.2 then 1 + floor(r[11] * 3) else 0 end;
    v_cpap := case when (v_gest < 245 or v_reason = 'respiratory') and r[12] < 0.8 then 1 + floor(r[13] * 8) else 0 end;
    v_umb := case when v_gest < 224 then case when r[14] < 0.5 then 'venous' else 'both' end
      when v_gest < 245 and r[14] < 0.3 then 'venous' else 'none' end;
    v_umb_days := case when v_umb = 'none' then 0 else 3 + floor(r[15] * 5) end;
    v_picc := case when v_gest < 210 then 8 + floor(r[16] * 14) else 0 end;
    v_central := v_umb_days + v_picc;
    v_los := case when v_preterm then 7 + floor((259 - v_gest) * 0.75 + r[17] * 6) else 2 + floor(r[17] * 6) end;
    v_dis := case when v_adm + v_los <= d0 then v_adm + v_los end;
    v_outcome := case when v_dis is null then null
      when v_gest < 210 and r[18] < 0.12 then 'death'
      when r[18] < 0.04 then 'transfer_hospital' when r[18] < 0.08 then 'transfer_ward' else 'home' end;
    v_ptype := case when r[19] < 0.84 then 'single' when r[19] < 0.98 then 'twin' else 'multiple' end;
    v_female := r[20] < 0.48;
    v_rows := v_rows || jsonb_build_object(
      'id', gen_random_uuid(), 'status', 'complete',
      'admission_date', v_adm, 'birth_date', v_birth,
      'readmission', v_origin = 'home' and r[21] < 0.35,
      'admission_reason', v_reason, 'admission_origin', v_origin,
      'gestation', v_gest, 'pregnancy_type', v_ptype,
      'delivery', case when r[22] < 0.55 or v_ptype <> 'single' then 'cs' else 'vaginal' end,
      'ivf', case when v_ptype <> 'single' then r[23] < 0.6 else r[23] < 0.12 end,
      'prom_24h', case when v_reason = 'infection' then r[24] < 0.4 else r[24] < 0.06 end,
      'birth_weight', v_weight, 'apgar_1', v_apgar1, 'apgar_5', least(10, v_apgar1 + 1 + floor(r[25] * 2)::integer),
      'resuscitation', case when v_gest < 224 then case when r[26] < 0.5 then 'bag_mask' else 'intubation' end
        when v_reason = 'respiratory' then case when r[26] < 0.6 then 'oxygen' else 'bag_mask' end
        when r[26] < 0.85 then 'none' else 'oxygen' end,
      'congenital_anomalies', v_reason = 'congenital' or r[27] < 0.02,
      'ventilator_days', v_vent, 'hfov', case when v_vent > 0 then v_vent >= 6 and r[28] < 0.35 end,
      'cpap_days', v_cpap,
      'oxygen_days', case when v_vent + v_cpap > 0 then v_vent + v_cpap + floor(r[29] * 5)::integer when r[29] < 0.1 then 1 else 0 end,
      'oxygen_after_36w', v_gest < 210 and v_vent >= 5,
      'umbilical_catheter', v_umb, 'central_line_days', v_central,
      'arterial_line_days', case when v_umb = 'both' then 2 + floor(r[30] * 5)::integer else 0 end,
      'tpn_days', case when v_gest < 238 then 4 + floor(r[30] * 12)::integer else 0 end,
      'picc_days', v_picc,
      'nasogastric', v_gest < 245 or r[31] < 0.1,
      'bottle_feeding', r[31] >= 0.75,
      'breast_milk', case when v_dis is null then null when r[32] < 0.45 then 'exclusive' when r[32] < 0.85 then 'mixed' else 'none' end,
      'early_infection', v_reason = 'infection' and r[24] < 0.35,
      'late_infection', v_central >= 10 and r[11] < 0.18,
      'discharge_date', v_dis,
      'discharge_weight', case when v_dis is not null and v_outcome <> 'death' then case when v_preterm then v_weight + v_los * 18 else v_weight - 80 + v_los * 10 end end,
      'outcome', v_outcome,
      '_case', 'ΜΕΝΝ-' || to_char(v_adm, 'YY') || '-' || lpad((n + 1 - i)::text, 4, '0'),
      '_name', 'Νεογνό ' || split_part(private.demo_register_name(i, 2100, true), ' ', 1));
  end loop;
  return private.demo_register_insert(p_register_id, p_actor, v_rows);
end;
$function$;
revoke all on function private.demo_seed_register_nicu(uuid, uuid, date) from public, anon, authenticated;

-- Παιδιατρική: 132 νοσηλείες σε ~6 μήνες.
create or replace function private.demo_seed_register_paediatrics(p_register_id uuid, p_actor uuid, d0 date)
returns integer
language plpgsql
security definer
set search_path = ''
as $function$
declare
  n constant integer := 132;
  v_rows jsonb := '[]'::jsonb;
  i integer;
  v_adm date; v_dis date; v_group text; v_age_days integer; v_reason text; v_los integer; v_iv boolean; v_line integer; v_outcome text; v_female boolean;
  r double precision[];
begin
  for i in 1..n loop
    r := array(select private.demo_register_rand(i, 3000 + k) from generate_series(1, 20) k);
    v_adm := d0 - (floor((i - 1) * 182.0 / n) + floor(r[1] * 2))::integer;
    v_group := case when r[2] < 0.2 then 'infant' when r[2] < 0.5 then 'toddler' when r[2] < 0.82 then 'child' else 'adolescent' end;
    v_age_days := case v_group when 'infant' then 30 + floor(r[3] * 330) when 'toddler' then 366 + floor(r[3] * 1450)
      when 'child' then 1830 + floor(r[3] * 2550) else 4390 + floor(r[3] * 1640) end;
    v_reason := case when r[4] < 0.30 then 'respiratory' when r[4] < 0.50 then 'gastro' when r[4] < 0.62 then 'fever'
      when r[4] < 0.70 then 'uti' when r[4] < 0.76 then 'seizure' when r[4] < 0.85 then 'injury' when r[4] < 0.94 then 'surgical' else 'other' end;
    v_los := case when v_reason = 'surgical' then 1 + floor(r[5] * 3) else 1 + floor(r[5] * r[5] * 6) end;
    v_dis := case when v_adm + v_los <= d0 then v_adm + v_los end;
    v_iv := case v_reason when 'uti' then r[6] < 0.8 when 'fever' then r[6] < 0.6 when 'surgical' then r[6] < 0.5 when 'respiratory' then r[6] < 0.35 else r[6] < 0.1 end;
    v_line := case when r[7] < 0.8 then greatest(1, v_los - floor(r[8] * 2)::integer) else 0 end;
    v_outcome := case when v_dis is null then null when r[9] < 0.025 then 'picu' when r[9] < 0.05 then 'transfer_hospital'
      when r[9] < 0.065 then 'against_advice' else 'home' end;
    v_female := r[10] < 0.47;
    v_rows := v_rows || jsonb_build_object(
      'id', gen_random_uuid(), 'status', 'complete',
      'admission_date', v_adm, 'birth_date', v_adm - v_age_days, 'age_group', v_group,
      'sex', case when v_female then 'female' else 'male' end,
      'admission_reason', v_reason,
      'admission_reason_text', case when v_reason = 'other' then (array['Αλλεργική αντίδραση','Κοιλιακό άλγος προς διερεύνηση','Δηλητηρίαση από φάρμακο','Υπογλυκαιμία'])[1 + floor(r[11] * 4)::integer] end,
      'from_ed', r[12] < 0.72, 'readmission_30d', r[13] < 0.04,
      'physician', (array['Α. Παπαδημητρίου','Ε. Σταυροπούλου','Κ. Μιχαηλίδης','Μ. Αλεξανδρή'])[1 + floor(r[14] * 4)::integer],
      'isolation', v_reason in ('respiratory', 'gastro') and r[15] < 0.45,
      'iv_antibiotics', v_iv, 'iv_antibiotic_days', case when v_iv then least(greatest(v_los, 1), 2 + floor(r[16] * 5)::integer) end,
      'peripheral_line_days', v_line, 'phlebitis', case when v_line > 0 then r[17] < 0.04 end,
      'hai', r[18] < 0.015, 'fall', r[19] < 0.012,
      'discharge_date', v_dis, 'outcome', v_outcome,
      '_case', 'ΠΑΙΔ-' || to_char(v_adm, 'YY') || '-' || lpad((n + 1 - i)::text, 4, '0'),
      '_name', private.demo_register_name(i, 3100, v_female));
  end loop;
  return private.demo_register_insert(p_register_id, p_actor, v_rows);
end;
$function$;
revoke all on function private.demo_seed_register_paediatrics(uuid, uuid, date) from public, anon, authenticated;

-- Ενδοσκοπικό (φύλλο): τρία μηνιαία σύνολα πριν το daily_from και ένα φύλλο ανά
-- εργάσιμη ημέρα από εκεί ως χθες.
create or replace function private.demo_seed_register_endoscopy(p_register_id uuid, p_actor uuid, d0 date, p_daily_from date)
returns integer
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_rows jsonb := '[]'::jsonb;
  v_day date;
  v_month date;
  i integer := 0;
  r double precision[];
begin
  for v_month in select generate_series(p_daily_from - interval '3 months', p_daily_from - interval '1 month', interval '1 month')::date loop
    i := i + 1;
    r := array(select private.demo_register_rand(i, 4000 + k) from generate_series(1, 8) k);
    v_rows := v_rows || jsonb_build_object('period_start', v_month, 'status', 'complete',
      'gastroscopy__count', 120 + floor(r[1] * 40)::integer, 'colonoscopy__count', 95 + floor(r[2] * 35)::integer,
      'gastrostomy__count', 2 + floor(r[3] * 4)::integer, 'cystoscopy__count', 18 + floor(r[4] * 14)::integer,
      'bronchoscopy__count', 10 + floor(r[5] * 10)::integer, 'ercp__count', 5 + floor(r[6] * 6)::integer,
      'eus__count', 3 + floor(r[7] * 5)::integer, 'ebus__count', 1 + floor(r[8] * 3)::integer);
  end loop;
  for v_day in select generate_series(p_daily_from, d0 - 1, interval '1 day')::date loop
    continue when extract(isodow from v_day) > 5;
    i := i + 1;
    r := array(select private.demo_register_rand(i, 4000 + k) from generate_series(1, 8) k);
    v_rows := v_rows || jsonb_build_object('period_start', v_day, 'status', 'complete',
      'gastroscopy__count', 4 + floor(r[1] * 6)::integer, 'colonoscopy__count', 3 + floor(r[2] * 5)::integer,
      'gastrostomy__count', case when r[3] < 0.12 then 1 else 0 end, 'cystoscopy__count', floor(r[4] * 3)::integer,
      'bronchoscopy__count', floor(r[5] * 2.2)::integer, 'ercp__count', case when r[6] < 0.3 then 1 else 0 end,
      'eus__count', case when r[7] < 0.2 then 1 else 0 end, 'ebus__count', case when r[8] < 0.08 then 1 else 0 end);
  end loop;
  return private.demo_register_insert(p_register_id, p_actor, v_rows);
end;
$function$;
revoke all on function private.demo_seed_register_endoscopy(uuid, uuid, date, date) from public, anon, authenticated;


-- Μαιευτική: κάθε ημέρα από 0 ως 2 τοκετοί (~1,3), από τρεις μήνες πριν το
-- daily_from ως χθες. Η Αίθουσα Τοκετών μετρά τους ίδιους τοκετούς.
create or replace function private.demo_seed_register_obstetrics(p_register_id uuid, p_actor uuid, d0 date, p_from date)
returns integer
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_rows jsonb := '[]'::jsonb;
  v_day date;
  v_births integer;
  v_cs boolean;
  i integer := 0;
  b integer;
  r double precision[];
begin
  for v_day in select generate_series(p_from, d0 - 1, interval '1 day')::date loop
    v_births := floor(private.demo_register_rand((v_day - p_from), 5000) * 2.6)::integer;
    for b in 1..v_births loop
      i := i + 1;
      r := array(select private.demo_register_rand(i, 5100 + k) from generate_series(1, 8) k);
      v_cs := r[1] < 0.52;
      v_rows := v_rows || jsonb_build_object(
        'id', gen_random_uuid(), 'status', 'complete', 'date', v_day,
        'delivery', case when v_cs then 'cs' else 'vaginal' end,
        'breastfeeding', case when r[2] < (case when v_cs then 0.52 else 0.64 end) then 'exclusive' when r[2] < 0.91 then 'mixed' else 'weaning' end,
        'antenatal', case when r[3] < 0.48 then 'attended' when r[3] < 0.68 then 'aware_not_attended' when r[3] < 0.85 then 'not_aware' else 'no' end,
        'breast_pump', r[4] < 0.35,
        'physician', (array['rallis_g', 'mavridou_e', 'kostopoulos_d', 'petridou_s'])[1 + floor(r[5] * 4)::integer],
        'notes', case when r[6] < 0.04 then 'Ζήτησε συμβουλευτική θηλασμού μετά την έξοδο.' end,
        '_case', 'ΜΑΙ-' || to_char(v_day, 'YY') || '-' || lpad(i::text, 4, '0'),
        '_name', private.demo_register_name(i, 5200, true));
    end loop;
  end loop;
  return private.demo_register_insert(p_register_id, p_actor, v_rows);
end;
$function$;
revoke all on function private.demo_seed_register_obstetrics(uuid, uuid, date, date) from public, anon, authenticated;

-- Αίθουσα Τοκετών (φύλλο): μηνιαία σύνολα πριν το daily_from, ένα φύλλο ανά
-- ημέρα από εκεί ως χθες. Φυσιολογικοί και καισαρικές είναι οι τοκετοί του
-- Μητρώου λεχωίδων (p_obstetrics_register) της ίδιας ημέρας ή του ίδιου μήνα.
create or replace function private.demo_seed_register_deliveryroom(p_register_id uuid, p_actor uuid, d0 date, p_from date, p_daily_from date, p_obstetrics_register uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_rows jsonb := '[]'::jsonb;
  v_table text;
  v_counts jsonb := '{}'::jsonb;
  v_day date;
  v_month date;
  v_vag integer;
  v_cs integer;
  v_scale integer;
  i integer := 0;
  r double precision[];
begin
  select table_name into v_table from public.department_registers where id = p_obstetrics_register;
  if v_table is not null then
    execute format('select coalesce(jsonb_object_agg(d::text, jsonb_build_object(''v'', v, ''c'', c)), ''{}'') from (select date as d, count(*) filter (where delivery = ''vaginal'') as v, count(*) filter (where delivery = ''cs'') as c from public.%I group by date) x', v_table)
      into v_counts;
  end if;
  -- Μηνιαία σύνολα: από τον πρώτο μήνα του Μητρώου λεχωίδων ως πριν το daily_from.
  for v_month in select generate_series(date_trunc('month', p_from)::date, p_daily_from - interval '1 month', interval '1 month')::date loop
    i := i + 1;
    r := array(select private.demo_register_rand(i, 6000 + k) from generate_series(1, 10) k);
    select coalesce(sum((e.value ->> 'v')::integer), 0), coalesce(sum((e.value ->> 'c')::integer), 0) into v_vag, v_cs
    from jsonb_each(v_counts) e where e.key::date >= v_month and e.key::date < (v_month + interval '1 month')::date;
    if v_vag + v_cs = 0 then v_vag := 16 + floor(r[9] * 8)::integer; v_cs := 20 + floor(r[10] * 8)::integer; end if;
    v_scale := 30;
    v_rows := v_rows || jsonb_build_object('period_start', v_month, 'status', 'complete',
      'vaginal__count', v_vag, 'cs__count', v_cs,
      'vbac__count', least(v_vag, floor(r[1] * 3)::integer), 'multiple_vaginal__count', floor(r[2] * 1.5)::integer,
      'multiple_cs__count', 1 + floor(r[3] * 2)::integer, 'born_before_arrival__count', floor(r[4] * 1.4)::integer,
      'hysteroscopy__count', 12 + floor(r[5] * 10)::integer, 'septic__count', 3 + floor(r[6] * 5)::integer,
      'pregnancy_monitoring__count', 45 + floor(r[7] * 30)::integer, 'cerclage__count', floor(r[8] * 2.5)::integer);
  end loop;
  for v_day in select generate_series(p_daily_from, d0 - 1, interval '1 day')::date loop
    i := i + 1;
    r := array(select private.demo_register_rand(i, 6000 + k) from generate_series(1, 10) k);
    v_vag := coalesce((v_counts -> v_day::text ->> 'v')::integer, case when v_table is null then floor(r[9] * 1.6)::integer else 0 end);
    v_cs := coalesce((v_counts -> v_day::text ->> 'c')::integer, case when v_table is null then floor(r[10] * 1.8)::integer else 0 end);
    v_rows := v_rows || jsonb_build_object('period_start', v_day, 'status', 'complete',
      'vaginal__count', v_vag, 'cs__count', v_cs,
      'vbac__count', case when v_vag > 0 and r[1] < 0.06 then 1 else 0 end,
      'multiple_vaginal__count', case when v_vag > 0 and r[2] < 0.02 then 1 else 0 end,
      'multiple_cs__count', case when v_cs > 0 and r[3] < 0.05 then 1 else 0 end,
      'born_before_arrival__count', case when r[4] < 0.02 then 1 else 0 end,
      'hysteroscopy__count', case when extract(isodow from v_day) <= 5 then floor(r[5] * 2.2)::integer else 0 end,
      'septic__count', case when r[6] < 0.15 then 1 else 0 end,
      'pregnancy_monitoring__count', 1 + floor(r[7] * 3)::integer,
      'cerclage__count', case when r[8] < 0.03 then 1 else 0 end);
  end loop;
  return private.demo_register_insert(p_register_id, p_actor, v_rows);
end;
$function$;
revoke all on function private.demo_seed_register_deliveryroom(uuid, uuid, date, date, date, uuid) from public, anon, authenticated;

-- ΤΕΠ (φύλλο ανά βάρδια): τρία μηνιαία σύνολα πριν το daily_from και ένα φύλλο
-- κάθε ημέρα (και Σαββατοκύριακα) από εκεί ως χθες, κάθε κατηγορία ανά βάρδια.
create or replace function private.demo_seed_register_emergency(p_register_id uuid, p_actor uuid, d0 date, p_daily_from date)
returns integer
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_rows jsonb := '[]'::jsonb;
  v_case_rows constant text[] := array['urgent', 'surgical', 'assessments', 'checkup', 'preop', 'septic'];
  v_base constant numeric[] := array[24, 9, 6, 7, 4, 2];
  v_shifts constant text[] := array['morning', 'afternoon', 'night'];
  v_share constant numeric[] := array[0.45, 0.35, 0.20];
  v_period date;
  v_monthly boolean;
  v_mult numeric;
  v_obj jsonb;
  v_val integer;
  v_shift_total integer;
  i integer := 0;
  s integer;
  j integer;
begin
  for v_period, v_monthly in
    select m::date, true from generate_series(p_daily_from - interval '3 months', p_daily_from - interval '1 month', interval '1 month') m
    union all
    select d::date, false from generate_series(p_daily_from, d0 - 1, interval '1 day') d
    order by 1
  loop
    i := i + 1;
    v_mult := case when v_monthly then extract(day from (v_period + interval '1 month' - interval '1 day'))::numeric * 0.95
      when extract(isodow from v_period) > 5 then 0.85 else 1 end;
    v_obj := jsonb_build_object('period_start', v_period, 'status', 'complete');
    for s in 1..3 loop
      v_shift_total := 0;
      for j in 1..6 loop
        -- Ο έλεγχος (check up) και ο προεγχειρητικός γίνονται σχεδόν μόνο τη μέρα.
        v_val := floor(v_base[j] * v_share[s] * v_mult * (case when j in (4, 5) and s = 3 then 0.1 else 1 end)
          * (0.7 + 0.6 * private.demo_register_rand(i, 7000 + s * 20 + j)))::integer;
        v_obj := v_obj || jsonb_build_object(v_case_rows[j] || '__' || v_shifts[s], v_val);
        v_shift_total := v_shift_total + v_val;
      end loop;
      v_obj := v_obj || jsonb_build_object(
        'admissions__' || v_shifts[s], round(v_shift_total * 0.12 * (0.6 + 0.8 * private.demo_register_rand(i, 7100 + s)))::integer,
        'dressings__' || v_shifts[s], floor(5 * v_share[s] * v_mult * (0.6 + 0.8 * private.demo_register_rand(i, 7110 + s)))::integer,
        'left_without_seen__' || v_shifts[s], floor(v_shift_total * 0.032 * private.demo_register_rand(i, 7120 + s))::integer,
        'revisit_72h__' || v_shifts[s], floor(v_shift_total * 0.085 * private.demo_register_rand(i, 7130 + s))::integer,
        'transfers__' || v_shifts[s], floor(v_shift_total * 0.025 * private.demo_register_rand(i, 7140 + s))::integer);
    end loop;
    v_rows := v_rows || v_obj;
  end loop;
  return private.demo_register_insert(p_register_id, p_actor, v_rows);
end;
$function$;
revoke all on function private.demo_seed_register_emergency(uuid, uuid, date, date) from public, anon, authenticated;

-- Τα επτά μητρώα του Demo και τα τμήματα που λείπουν (Μαιευτική, Αίθουσα
-- Τοκετών, ΤΕΠ, Ενδοσκοπικό, όπως στο demo_seed_departments_patients: κωδικός,
-- όνομα, τύπος, ενεργό· χωρίς κλινοημέρες). Παραλείπει ό,τι υπάρχει ήδη (ίδιο
-- πρότυπο ή κωδικό) ή όταν λείπει το τμήμα του.
create or replace function private.demo_seed_registers(p_organization_id uuid, p_actor uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_org uuid := p_organization_id;
  d0 date := (now() at time zone 'Europe/Athens')::date;
  v_daily_from date := (date_trunc('month', (now() at time zone 'Europe/Athens')::date) - interval '2 months')::date;
  v_from date;
  v_dept uuid;
  v_id uuid;
  v_spec record;
begin
  if not exists (select 1 from public.organizations o where o.id = v_org and o.is_demo) then
    raise exception 'Only Demo organizations can be filled with Demo data' using errcode = '42501';
  end if;
  v_from := (v_daily_from - interval '3 months')::date;

  insert into public.departments(organization_id, code, name, department_type, is_active)
  select v_org, d.code, d.name, d.kind, true
  from (values ('ΜΑΙ', 'Μαιευτική Κλινική', 'general'), ('ΑΤ', 'Αίθουσα Τοκετών', 'general'),
    ('ΤΕΠ', 'Τμήμα Επειγόντων Περιστατικών', 'general'), ('ΕΝΔ', 'Ενδοσκοπικό Τμήμα', 'general')) d(code, name, kind)
  where not exists (select 1 from public.departments x where x.organization_id = v_org and x.code = d.code)
  on conflict (organization_id, name) do nothing;

  for v_spec in select * from (values
    ('REG-001', 'icu', 'ΜΕΘ'), ('REG-002', 'nicu', 'ΜΕΝΝ'), ('REG-003', 'paediatrics', 'ΠΑΙΔ'), ('REG-004', 'endoscopy', 'ΕΝΔ'),
    ('REG-005', 'obstetrics', 'ΜΑΙ'), ('REG-006', 'deliveryRoom', 'ΑΤ'), ('REG-007', 'emergency', 'ΤΕΠ')
  ) s(code, template_key, department_code) loop
    continue when exists (select 1 from public.department_registers r where r.organization_id = v_org and (r.template_key = v_spec.template_key or r.code = v_spec.code));
    select d.id into v_dept from public.departments d where d.organization_id = v_org and d.code = v_spec.department_code limit 1;
    continue when v_dept is null;
    v_id := private.demo_register_create(v_org, v_dept, v_spec.code, v_spec.template_key, p_actor,
      case when v_spec.template_key in ('endoscopy', 'deliveryRoom', 'emergency') then v_daily_from end);
    case v_spec.template_key
      when 'icu' then perform private.demo_seed_register_icu(v_id, p_actor, d0);
      when 'nicu' then perform private.demo_seed_register_nicu(v_id, p_actor, d0);
      when 'paediatrics' then perform private.demo_seed_register_paediatrics(v_id, p_actor, d0);
      when 'endoscopy' then perform private.demo_seed_register_endoscopy(v_id, p_actor, d0, v_daily_from);
      when 'obstetrics' then perform private.demo_seed_register_obstetrics(v_id, p_actor, d0, v_from);
      when 'deliveryRoom' then perform private.demo_seed_register_deliveryroom(v_id, p_actor, d0, v_from, v_daily_from,
        (select r.id from public.department_registers r where r.organization_id = v_org and r.template_key = 'obstetrics' limit 1));
      when 'emergency' then perform private.demo_seed_register_emergency(v_id, p_actor, d0, v_daily_from);
    end case;
  end loop;
end;
$function$;
revoke all on function private.demo_seed_registers(uuid, uuid) from public, anon, authenticated;

-- Άδειοι πίνακες μητρώων που δεν ανήκουν πια σε μητρώο (π.χ. μητρώο Demo που
-- φτιάχτηκε από την οθόνη και σβήστηκε στην επαναφορά). Μόνο ανάγνωση· το
-- καθάρισμα (drop) το τρέχει ο ιδιοκτήτης στο SQL Editor.
create or replace function private.register_orphan_tables()
returns setof text
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_name text;
  v_rows boolean;
begin
  for v_name in
    select c.relname from pg_catalog.pg_class c
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    join pg_catalog.pg_attribute a on a.attrelid = c.oid and a.attname = 'register_id' and not a.attisdropped
    where n.nspname = 'public' and c.relkind = 'r' and c.relname like 'register\_%'
      and not exists (select 1 from public.department_registers r where r.table_name = c.relname)
    order by c.relname
  loop
    execute format('select exists (select 1 from public.%I)', v_name) into v_rows;
    if not v_rows then return next v_name; end if;
  end loop;
end;
$function$;
revoke all on function private.register_orphan_tables() from public, anon, authenticated;
