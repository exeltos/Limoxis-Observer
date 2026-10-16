import { demoOffsetDays, shiftDemoMonth } from '../../core/data/demoClock'
import { DEMO_WARDS, demoMonthlyPatientDays, lastDayOfMonth, pad2 } from '../../core/data/demoSeed'
const SYS=(source,version='current')=>({system:true,locked:true,source,version})
const LOCAL=()=>({system:false,locked:false,source:'Hospital',version:'local'})

export const demoUsers = [
  { id: 'u1', name: 'Demo Administrator', email: 'admin@demo.hospital', role: 'hospital_admin', status: 'active' },
  { id: 'u2', name: 'Ελένη Παπαδοπούλου', email: 'infection@demo.hospital', role: 'infection_control_lead', status: 'active' },
  { id: 'u3', name: 'Νίκος Δημητρίου', email: 'laboratory@demo.hospital', role: 'laboratory', status: 'active' },
]

export const demoOrganizations = [
  { id: 'demo-hospital', name: 'Demo Hospital', code: 'DEMO', type: 'hospital', status: 'active', members: 3 },
]

export const demoLibrarySeed = {
  departments:[
    ['ΜΕΘ','ICU',SYS('Limoxis core hospital structure')],
    ['Χειρουργική','Surgery',SYS('Limoxis core hospital structure')],
    ['Παθολογική','Internal Medicine',SYS('Limoxis core hospital structure')],
    ['ΤΕΠ','Emergency Department',SYS('Limoxis core hospital structure')],
    ['Μαιευτική','Obstetrics',SYS('Limoxis core hospital structure')],
    ['Γυναικολογική','Gynecology',SYS('Limoxis core hospital structure')],
    ['Παιδιατρική','Pediatrics',SYS('Limoxis core hospital structure')],
    ['Νεογνολογική / ΜΕΝΝ','Neonatal / NICU',SYS('Limoxis core hospital structure')],
    ['Καρδιολογική','Cardiology',SYS('Limoxis core hospital structure')],
    ['Ορθοπαιδική','Orthopedics',SYS('Limoxis core hospital structure')],
    ['Αιμοκάθαρση','Hemodialysis',SYS('Limoxis core hospital structure')],
    ['Εργαστήριο','Laboratory',SYS('Limoxis core hospital structure')],
    ['Ακτινοδιαγνωστικό','Radiology',SYS('Limoxis core hospital structure')],
    ['Κεντρική Αποστείρωση','Central Sterile Services',SYS('Limoxis core hospital structure')],
  ],
  // Same six categories as the system_master_library_baseline_seed_v2
  // migration seeds for every real organization, so demo mode's Employee
  // create/edit "Professional category" select is never left empty.
  // Job positions are the hospital's own list (Management > Libraries).
  positions:[
    ['Προϊστάμενος/η Τμήματος','Head of Department (Nursing)',{system:false,locked:false,source:'Hospital',version:'local'}],
    ['Νοσηλευτής/τρια ΜΕΘ','ICU Nurse',{system:false,locked:false,source:'Hospital',version:'local',jobDescription:{purpose:'Παροχή εξειδικευμένης νοσηλευτικής φροντίδας σε βαρέως πάσχοντες ασθενείς της ΜΕΘ με ασφάλεια και τήρηση των πρωτοκόλλων πρόληψης λοιμώξεων.',reportsTo:'Προϊστάμενος/η ΜΕΘ',duties:'Παρακολούθηση ζωτικών σημείων και κλινικής κατάστασης\nΦροντίδα κεντρικών φλεβικών καθετήρων κατά το bundle CLABSI\nΤήρηση υγιεινής χεριών (WHO 5 Moments) και μέτρων απομόνωσης\nΚαταγραφή ελέγχων τμήματος (ψυγείο φαρμάκων, απολύμανση)',responsibilities:'Άμεση αναφορά συμβάντων και αποκλίσεων\nΣυμμετοχή σε audits πρόληψης λοιμώξεων',qualifications:'Πτυχίο Νοσηλευτικής και άδεια άσκησης επαγγέλματος\nΕμπειρία σε μονάδα εντατικής θεραπείας (επιθυμητή)',competencies:'BLS/ALS\nΕτήσια εκπαίδευση υγιεινής χεριών και CLABSI',version:1,updatedAt:'2026-09-01T09:00:00Z',updatedBy:'Demo Hospital Admin'}}],
    ['Νοσηλευτής/τρια Θαλάμου','Ward Nurse',{system:false,locked:false,source:'Hospital',version:'local'}],
    ['Νοσηλευτής/τρια Επιτήρησης Λοιμώξεων (ΝΕΛ)','Infection Control Nurse',{system:false,locked:false,source:'Hospital',version:'local'}],
    ['Επιμελητής Ιατρός','Consultant Physician',{system:false,locked:false,source:'Hospital',version:'local'}],
    ['Ειδικευόμενος Ιατρός','Resident Physician',{system:false,locked:false,source:'Hospital',version:'local'}],
    ['Τεχνολόγος Εργαστηρίου','Laboratory Technologist',{system:false,locked:false,source:'Hospital',version:'local'}],
    ['Βοηθός Θαλάμου','Ward Assistant',{system:false,locked:false,source:'Hospital',version:'local'}],
  ],
  professionalCategories:[
    ['Ιατρός','Physician',SYS('Limoxis workforce core')],
    ['Νοσηλευτής/τρια','Nurse',SYS('Limoxis workforce core')],
    ['Μαία/Μαιευτής','Midwife',SYS('Limoxis workforce core')],
    ['Βοηθός Νοσηλευτή','Nursing Assistant',SYS('Limoxis workforce core')],
    ['Επαγγελματίας Εργαστηρίου','Laboratory Professional',SYS('Limoxis workforce core')],
    ['Λοιπό προσωπικό','Other Staff',SYS('Limoxis workforce core')],
  ],
  microorganisms:[
    ['Acinetobacter baumannii','Acinetobacter baumannii',SYS('WHO BPPL 2024','2024')],
    ['Escherichia coli','Escherichia coli',SYS('WHO BPPL 2024','2024')],
    ['Klebsiella pneumoniae','Klebsiella pneumoniae',SYS('WHO BPPL 2024','2024')],
    ['Proteus mirabilis','Proteus mirabilis',SYS('ΥΑ Υ1.Γ.Π.114971/ΦΕΚ Β 388/2014','2014')],
    ['Enterobacter cloacae complex','Enterobacter cloacae complex',SYS('WHO BPPL 2024','2024')],
    ['Pseudomonas aeruginosa','Pseudomonas aeruginosa',SYS('WHO BPPL 2024','2024')],
    ['Staphylococcus aureus','Staphylococcus aureus',SYS('WHO BPPL 2024','2024')],
    ['Enterococcus faecium','Enterococcus faecium',SYS('WHO BPPL 2024','2024')],
    ['Enterococcus faecalis','Enterococcus faecalis',SYS('Clinical microbiology core')],
    ['Streptococcus pneumoniae','Streptococcus pneumoniae',SYS('WHO BPPL 2024','2024')],
    ['Streptococcus pyogenes','Streptococcus pyogenes',SYS('WHO BPPL 2024','2024')],
    ['Streptococcus agalactiae','Streptococcus agalactiae',SYS('WHO BPPL 2024','2024')],
    ['Haemophilus influenzae','Haemophilus influenzae',SYS('WHO BPPL 2024','2024')],
    ['Neisseria gonorrhoeae','Neisseria gonorrhoeae',SYS('WHO BPPL 2024','2024')],
    ['Salmonella spp.','Salmonella spp.',SYS('WHO BPPL 2024','2024')],
    ['Shigella spp.','Shigella spp.',SYS('WHO BPPL 2024','2024')],
    ['Clostridioides difficile','Clostridioides difficile',SYS('IPC clinical core')],
    ['Mycobacterium tuberculosis','Mycobacterium tuberculosis',SYS('WHO BPPL 2024','2024')],
    ['Candida auris','Candida auris',SYS('IPC emerging pathogen core')],
  ],
  antibiotics:[
    ['Αμοξικιλλίνη','Amoxicillin',SYS('WHO AWaRe','2022')],
    ['Αμοξικιλλίνη/Κλαβουλανικό','Amoxicillin/clavulanic acid',SYS('WHO AWaRe','2022')],
    ['Αμπικιλλίνη','Ampicillin',SYS('WHO AWaRe','2022')],
    ['Κεφαζολίνη','Cefazolin',SYS('WHO AWaRe','2022')],
    ['Κεφουροξίμη','Cefuroxime',SYS('WHO AWaRe','2022')],
    ['Κεφτριαξόνη','Ceftriaxone',SYS('WHO AWaRe','2022')],
    ['Κεφοταξίμη','Cefotaxime',SYS('WHO AWaRe','2022')],
    ['Κεφταζιδίμη','Ceftazidime',SYS('WHO AWaRe','2022')],
    ['Κεφεπίμη','Cefepime',SYS('WHO AWaRe','2022')],
    ['Οξακιλλίνη','Oxacillin',SYS('ΥΑ Υ1.Γ.Π.114971/ΦΕΚ Β 388/2014','2014')],
    ['Πιπερακιλλίνη/Ταζομπακτάμη','Piperacillin/Tazobactam',SYS('WHO AWaRe','2022')],
    ['Ερταπενέμη','Ertapenem',SYS('WHO AWaRe','2022')],
    ['Ιμιπενέμη','Imipenem',SYS('WHO AWaRe','2022')],
    ['Μεροπενέμη','Meropenem',SYS('WHO AWaRe','2022')],
    ['Αζτρεονάμη','Aztreonam',SYS('Clinical antimicrobial core')],
    ['Γενταμικίνη','Gentamicin',SYS('WHO AWaRe','2022')],
    ['Αμικασίνη','Amikacin',SYS('WHO AWaRe','2022')],
    ['Σιπροφλοξασίνη','Ciprofloxacin',SYS('WHO AWaRe','2022')],
    ['Λεβοφλοξασίνη','Levofloxacin',SYS('WHO AWaRe','2022')],
    ['Βανκομυκίνη','Vancomycin',SYS('WHO AWaRe','2022')],
    ['Τεϊκοπλανίνη','Teicoplanin',SYS('Clinical antimicrobial core')],
    ['Λινεζολίδη','Linezolid',SYS('WHO AWaRe','2022')],
    ['Δαπτομυκίνη','Daptomycin',SYS('Clinical antimicrobial core')],
    ['Κολιστίνη','Colistin',SYS('WHO AWaRe','2022')],
    ['Τιγεκυκλίνη','Tigecycline',SYS('WHO AWaRe','2022')],
    ['Κεφταζιδίμη/Αβιμπακτάμη','Ceftazidime/avibactam',SYS('WHO AWaRe / Reserve','2022')],
    ['Κεφτολοζάνη/Ταζομπακτάμη','Ceftolozane/tazobactam',SYS('WHO AWaRe / Reserve','2022')],
  ],
  deviceTypes:[
    ['Κεντρικός φλεβικός καθετήρας (CVC)','Central venous catheter (CVC)',SYS('Limoxis IPC device core')],
    ['Ουροκαθετήρας','Urinary catheter',SYS('Limoxis IPC device core')],
    ['Μηχανικός αερισμός','Mechanical ventilation',SYS('Limoxis IPC device core')],
    ['Περιφερικός φλεβικός καθετήρας','Peripheral venous catheter',SYS('Limoxis IPC device core')],
  ],
  surveillanceDefinitions:[
    ['CLABSI – Λοίμωξη αιματικής ροής σχετιζόμενη με κεντρικό φλεβικό καθετήρα','CLABSI – Central line-associated bloodstream infection',SYS('ECDC surveillance definitions')],
    ['CAUTI – Ουρολοίμωξη σχετιζόμενη με ουροκαθετήρα','CAUTI – Catheter-associated urinary tract infection',SYS('ECDC surveillance definitions')],
    ['VAP – Πνευμονία σχετιζόμενη με μηχανικό αερισμό','VAP – Ventilator-associated pneumonia',SYS('ECDC surveillance definitions')],
    ['SSI – Λοίμωξη χειρουργικού πεδίου','SSI – Surgical site infection',SYS('ECDC surveillance definitions')],
  ],
  advancedAntibiotics:[
    ['Μεροπενέμη','Meropenem',SYS('Hospital stewardship core')],
    ['Ιμιπενέμη','Imipenem',SYS('Hospital stewardship core')],
    ['Κολιστίνη','Colistin',SYS('WHO AWaRe / Reserve','2022')],
    ['Λινεζολίδη','Linezolid',SYS('WHO AWaRe','2022')],
    ['Δαπτομυκίνη','Daptomycin',SYS('Hospital stewardship core')],
    ['Τιγεκυκλίνη','Tigecycline',SYS('Hospital stewardship core')],
    ['Κεφταζιδίμη/Αβιμπακτάμη','Ceftazidime/avibactam',SYS('WHO AWaRe / Reserve','2022')],
    ['Κεφτολοζάνη/Ταζομπακτάμη','Ceftolozane/tazobactam',SYS('WHO AWaRe / Reserve','2022')],
  ],
  notifiableDiseases:[
    ['Ιλαρά','Measles',SYS('ΕΟΔΥ · υποχρεωτική δήλωση')],
    ['Ερυθρά','Rubella',SYS('ΕΟΔΥ · υποχρεωτική δήλωση')],
    ['Παρωτίτιδα','Mumps',SYS('ΕΟΔΥ · υποχρεωτική δήλωση')],
    ['Μηνιγγιτιδοκοκκική νόσος','Meningococcal disease',SYS('ΕΟΔΥ · υποχρεωτική δήλωση')],
    ['Διφθερίτιδα','Diphtheria',SYS('ΕΟΔΥ · υποχρεωτική δήλωση')],
    ['Κοκκύτης','Pertussis',SYS('ΕΟΔΥ · υποχρεωτική δήλωση')],
    ['Φυματίωση','Tuberculosis',SYS('ΕΟΔΥ · υποχρεωτική δήλωση')],
    ['Λεγιονέλλωση','Legionellosis',SYS('ΕΟΔΥ · υποχρεωτική δήλωση')],
    ['Ιογενής ηπατίτιδα Α','Viral hepatitis A',SYS('ΕΟΔΥ · υποχρεωτική δήλωση')],
    ['Ιογενής ηπατίτιδα Β','Viral hepatitis B',SYS('ΕΟΔΥ · επιτήρηση')],
    ['Ιογενής ηπατίτιδα C','Viral hepatitis C',SYS('ΕΟΔΥ · επιτήρηση')],
    ['Σαλμονέλλωση','Salmonellosis',SYS('ΕΟΔΥ · επιτήρηση')],
    ['Σιγκέλλωση','Shigellosis',SYS('ΕΟΔΥ · επιτήρηση')],
    ['Λοίμωξη από ιό Δυτικού Νείλου','West Nile virus infection',SYS('ΕΟΔΥ · υποχρεωτική δήλωση')],
  ],
  sampleTypes:[
    ['Αίμα','Blood',SYS('Clinical microbiology core')],
    ['Ούρα','Urine',SYS('Clinical microbiology core')],
    ['ΕΝΥ','CSF',SYS('Clinical microbiology core')],
    ['Πτύελα','Sputum',SYS('Clinical microbiology core')],
    ['Τραχειακό αναρρόφημα','Tracheal aspirate',SYS('Clinical microbiology core')],
    ['BAL','BAL',SYS('Clinical microbiology core')],
    ['Τραύμα / επίχρισμα','Wound / swab',SYS('Clinical microbiology core')],
    ['Βαθύς ιστός','Deep tissue',SYS('Clinical microbiology core')],
    ['Κόπρανα','Stool',SYS('Clinical microbiology core')],
    ['Επιφάνεια','Surface',SYS('Environmental surveillance core')],
    ['Αέρας','Air',SYS('Environmental surveillance core')],
    ['Νερό','Water',SYS('Environmental surveillance core')],
    ['Περιβάλλον χώρου','Room environment',SYS('Environmental surveillance core')],
  ],
  controlTypes:[
    ['Έλεγχος θερμοκρασίας','Temperature check',{...SYS('Limoxis controls core'),code:'CTRL-TEMP'}],
    ['Έλεγχος ημερομηνιών λήξης','Expiry-date check',{...SYS('Limoxis controls core'),code:'CTRL-EXPIRY'}],
    ['Περιβαλλοντικός μικροβιολογικός έλεγχος','Environmental microbiological check',{...SYS('Limoxis controls core'),code:'CTRL-ENV'}],
    ['Έλεγχος υγιεινής / καθαριότητας','Hygiene / cleanliness check',{...SYS('Limoxis controls core'),code:'CTRL-HYGIENE'}],
    ['Έλεγχος εξοπλισμού','Equipment check',{...SYS('Limoxis controls core'),code:'CTRL-EQUIP'}],
    ['Έλεγχος απολύμανσης / αποστείρωσης','Disinfection / sterilisation check',{...SYS('Limoxis controls core'),code:'CTRL-DISINF'}],
    ['Επιθεώρηση με λίστα ελέγχου','Checklist audit',{...SYS('Limoxis controls core'),code:'CTRL-AUDIT'}],
  ],
  measurementUnits:[
    ['°C','°C',{...SYS('Limoxis measurement units core'),code:'UNIT-CELSIUS'}],
    ['%','%',{...SYS('Limoxis measurement units core'),code:'UNIT-PERCENT'}],
    ['ppm','ppm',{...SYS('Limoxis measurement units core'),code:'UNIT-PPM'}],
    ['mg/L','mg/L',{...SYS('Limoxis measurement units core'),code:'UNIT-MGL'}],
    ['pH','pH',{...SYS('Limoxis measurement units core'),code:'UNIT-PH'}],
    ['kPa','kPa',{...SYS('Limoxis measurement units core'),code:'UNIT-KPA'}],
    ['bar','bar',{...SYS('Limoxis measurement units core'),code:'UNIT-BAR'}],
    ['CFU','CFU',{...SYS('Limoxis measurement units core'),code:'UNIT-CFU'}],
    ['CFU/m³','CFU/m³',{...SYS('Limoxis measurement units core'),code:'UNIT-CFU-M3'}],
    ['CFU/100mL','CFU/100mL',{...SYS('Limoxis measurement units core'),code:'UNIT-CFU-100ML'}],
    ['λεπτά','minutes',{...SYS('Limoxis measurement units core'),code:'UNIT-MIN'}],
    ['ώρες','hours',{...SYS('Limoxis measurement units core'),code:'UNIT-HOUR'}],
    ['τεμάχια','pieces',{...SYS('Limoxis measurement units core'),code:'UNIT-PIECE'}],
  ],
  controlAnswers:[
    ['Συμμορφώνεται','Compliant',{...SYS('Limoxis controls core'),code:'ANS-COMPLIANT'}],
    ['Μη συμμόρφωση','Non-compliant',{...SYS('Limoxis controls core'),code:'ANS-NONCOMPLIANT'}],
    ['Μερική συμμόρφωση','Partially compliant',{...SYS('Limoxis controls core'),code:'ANS-PARTIAL'}],
    ['Καθαρό','Clean',{...SYS('Limoxis controls core'),code:'ANS-CLEAN'}],
    ['Μη καθαρό','Not clean',{...SYS('Limoxis controls core'),code:'ANS-NOTCLEAN'}],
    ['Λειτουργικό','Working',{...SYS('Limoxis controls core'),code:'ANS-WORKING'}],
    ['Εκτός λειτουργίας','Out of order',{...SYS('Limoxis controls core'),code:'ANS-OUTOFORDER'}],
    ['Δεν εφαρμόζεται','Not applicable',{...SYS('Limoxis controls core'),code:'ANS-NA'}],
  ],
  itemForms:[
    ['Ταμπλέτα','Tablet',{...SYS('Limoxis medicines & supplies core'),code:'FORM-TABLET'}],
    ['Καψάκιο','Capsule',{...SYS('Limoxis medicines & supplies core'),code:'FORM-CAPSULE'}],
    ['Φύσιγγα','Ampoule',{...SYS('Limoxis medicines & supplies core'),code:'FORM-AMPOULE'}],
    ['Φιαλίδιο','Vial',{...SYS('Limoxis medicines & supplies core'),code:'FORM-VIAL'}],
    ['Φλακόν','Flacon',{...SYS('Limoxis medicines & supplies core'),code:'FORM-FLACON'}],
    ['Φιάλη','Bottle',{...SYS('Limoxis medicines & supplies core'),code:'FORM-BOTTLE'}],
    ['Ασκός','Bag',{...SYS('Limoxis medicines & supplies core'),code:'FORM-BAG'}],
    ['Σωληνάριο','Tube',{...SYS('Limoxis medicines & supplies core'),code:'FORM-TUBE'}],
    ['Τεμάχιο','Piece',{...SYS('Limoxis medicines & supplies core'),code:'FORM-PIECE'}],
    ['Συσκευασία','Pack',{...SYS('Limoxis medicines & supplies core'),code:'FORM-PACK'}],
    ['Άλλο','Other',{...SYS('Limoxis medicines & supplies core'),code:'FORM-OTHER'}],
  ],
  medicinesSupplies:[
    ['Adrenaline 1mg/ml','Adrenaline 1mg/ml',{...SYS('Limoxis medicines & supplies core'),code:'MED-ADRENALINE-1MG'}],
    ['Atropine 0.5mg/ml','Atropine 0.5mg/ml',{...SYS('Limoxis medicines & supplies core'),code:'MED-ATROPINE-05MG'}],
    ['Amiodarone 150mg/3ml','Amiodarone 150mg/3ml',{...SYS('Limoxis medicines & supplies core'),code:'MED-AMIODARONE-150MG'}],
    ['Naloxone 0.4mg/ml','Naloxone 0.4mg/ml',{...SYS('Limoxis medicines & supplies core'),code:'MED-NALOXONE-04MG'}],
    ['Midazolam 5mg/ml','Midazolam 5mg/ml',{...SYS('Limoxis medicines & supplies core'),code:'MED-MIDAZOLAM-5MG'}],
    ['Flumazenil 0.1mg/ml','Flumazenil 0.1mg/ml',{...SYS('Limoxis medicines & supplies core'),code:'MED-FLUMAZENIL-01MG'}],
    ['Γλυκόζη 35%','Glucose 35%',{...SYS('Limoxis medicines & supplies core'),code:'MED-GLUCOSE-35'}],
    ['Ηπαρίνη 5.000 IU/ml','Heparin 5,000 IU/ml',{...SYS('Limoxis medicines & supplies core'),code:'MED-HEPARIN-5000IU'}],
    ['Ενοξαπαρίνη','Enoxaparin',{...SYS('Limoxis medicines & supplies core'),code:'MED-ENOXAPARIN'}],
    ['Φυσιολογικός ορός 0,9% 500ml','Normal saline 0.9% 500ml',{...SYS('Limoxis medicines & supplies core'),code:'MED-NS-09-500'}],
    ['Ringer\'s Lactate 500ml','Ringer\'s Lactate 500ml',{...SYS('Limoxis medicines & supplies core'),code:'MED-RL-500'}],
    ['Δεξτρόζη 5% 500ml','Dextrose 5% 500ml',{...SYS('Limoxis medicines & supplies core'),code:'MED-D5W-500'}],
    ['Παρακεταμόλη 500mg','Paracetamol 500mg',{...SYS('Limoxis medicines & supplies core'),code:'MED-PARACETAMOL-500MG'}],
    ['Παρακεταμόλη IV 1g','Paracetamol IV 1g',{...SYS('Limoxis medicines & supplies core'),code:'MED-PARACETAMOL-IV-1G'}],
    ['Μεθυλπρεδνιζολόνη','Methylprednisolone',{...SYS('Limoxis medicines & supplies core'),code:'MED-METHYLPREDNISOLONE'}],
    ['Υδροκορτιζόνη','Hydrocortisone',{...SYS('Limoxis medicines & supplies core'),code:'MED-HYDROCORTISONE'}],
    ['Σαλβουταμόλη εισπνεόμενη','Salbutamol inhaler',{...SYS('Limoxis medicines & supplies core'),code:'MED-SALBUTAMOL-INH'}],
    ['Φουροσεμίδη','Furosemide',{...SYS('Limoxis medicines & supplies core'),code:'MED-FUROSEMIDE'}],
    ['Ινσουλίνη ταχείας δράσης','Rapid-acting insulin',{...SYS('Limoxis medicines & supplies core'),code:'MED-INSULIN-RAPID'}],
    ['Σύριγγες 10ml','Syringes 10ml',{...SYS('Limoxis medicines & supplies core'),code:'SUP-SYRINGE-10ML'}],
    ['Σύριγγες 5ml','Syringes 5ml',{...SYS('Limoxis medicines & supplies core'),code:'SUP-SYRINGE-5ML'}],
    ['Βελόνες 21G','Needles 21G',{...SYS('Limoxis medicines & supplies core'),code:'SUP-NEEDLE-21G'}],
    ['Περιφερικοί φλεβοκαθετήρες 20G','Peripheral IV cannulas 20G',{...SYS('Limoxis medicines & supplies core'),code:'SUP-IV-CANNULA-20G'}],
    ['Συσκευές ορού','IV giving sets',{...SYS('Limoxis medicines & supplies core'),code:'SUP-IV-GIVING-SET'}],
    ['Αποστειρωμένα γάντια','Sterile gloves',{...SYS('Limoxis medicines & supplies core'),code:'SUP-GLOVES-STERILE'}],
    ['Γάζες αποστειρωμένες','Sterile gauze',{...SYS('Limoxis medicines & supplies core'),code:'SUP-GAUZE-STERILE'}],
    ['Χλωρεξιδίνη 2% διάλυμα','Chlorhexidine 2% solution',{...SYS('Limoxis medicines & supplies core'),code:'SUP-CHG-2'}],
    ['Αλκοολούχο αντισηπτικό χεριών','Alcohol-based hand rub',{...SYS('Limoxis medicines & supplies core'),code:'SUP-ABHR'}],
    ['Ενδοτραχειακοί σωλήνες','Endotracheal tubes',{...SYS('Limoxis medicines & supplies core'),code:'SUP-ETT'}],
    ['Μάσκες οξυγόνου','Oxygen masks',{...SYS('Limoxis medicines & supplies core'),code:'SUP-O2-MASK'}],
  ],
  equipment:[
    ['Ψυγείο φαρμάκων','Medication refrigerator',{...SYS('Limoxis equipment core'),code:'EQ-FRIDGE-MED'}],
    ['Ψυγείο εμβολίων','Vaccine refrigerator',{...SYS('Limoxis equipment core'),code:'EQ-FRIDGE-VACCINE'}],
    ['Καταψύκτης','Freezer',{...SYS('Limoxis equipment core'),code:'EQ-FREEZER'}],
    ['Τροχήλατο ανάνηψης','Crash cart',{...SYS('Limoxis equipment core'),code:'EQ-CRASH-CART'}],
    ['Απινιδωτής','Defibrillator',{...SYS('Limoxis equipment core'),code:'EQ-DEFIBRILLATOR'}],
    ['Κλίβανος αποστείρωσης','Steriliser (autoclave)',{...SYS('Limoxis equipment core'),code:'EQ-AUTOCLAVE'}],
    ['Πλυντήριο-απολυμαντής ενδοσκοπίων','Endoscope washer-disinfector',{...SYS('Limoxis equipment core'),code:'EQ-ENDOSCOPE-WD'}],
    ['Πλυντήριο-απολυμαντής σκωραμίδων','Bedpan washer-disinfector',{...SYS('Limoxis equipment core'),code:'EQ-BEDPAN-WD'}],
    ['Παρασκευαστής πάγου','Ice machine',{...SYS('Limoxis equipment core'),code:'EQ-ICE-MACHINE'}],
    ['Ψύκτης νερού','Water dispenser',{...SYS('Limoxis equipment core'),code:'EQ-WATER-DISPENSER'}],
    ['Θερμοκοιτίδα','Incubator',{...SYS('Limoxis equipment core'),code:'EQ-INCUBATOR'}],
    ['Αναρροφητήρας','Suction unit',{...SYS('Limoxis equipment core'),code:'EQ-SUCTION'}],
    ['Φιάλη οξυγόνου','Oxygen cylinder',{...SYS('Limoxis equipment core'),code:'EQ-O2-CYLINDER'}],
    ['Θάλαμος βιολογικής ασφάλειας','Biosafety cabinet',{...SYS('Limoxis equipment core'),code:'EQ-BSC'}],
  ],
  environmentalLocations:[
    ['Θάλαμος','Patient room',{...SYS('Environmental surveillance core'),code:'LOC-PATIENT-ROOM'}],
    ['Σταθμός νοσηλευτών','Nurses station',{...SYS('Environmental surveillance core'),code:'LOC-NURSES-STATION'}],
    ['Χειρουργική αίθουσα','Operating room',{...SYS('Environmental surveillance core'),code:'LOC-OPERATING-ROOM'}],
    ['ΜΕΘ','ICU',{...SYS('Environmental surveillance core'),code:'LOC-ICU'}],
    ['Αποδυτήρια','Changing room',{...SYS('Environmental surveillance core'),code:'LOC-CHANGING-ROOM'}],
  ],
  surfacePoints:[
    ['Κομοδίνο','Bedside table',{...SYS('Environmental surveillance core'),code:'POINT-BEDSIDE-TABLE'}],
    ['Πόμολο πόρτας','Door handle',{...SYS('Environmental surveillance core'),code:'POINT-DOOR-HANDLE'}],
    ['Κλίνη','Bed rail',{...SYS('Environmental surveillance core'),code:'POINT-BED-RAIL'}],
    ['Πληκτρολόγιο','Keyboard',{...SYS('Environmental surveillance core'),code:'POINT-KEYBOARD'}],
    ['Ιατροτεχνολογικός εξοπλισμός','Medical equipment',{...SYS('Environmental surveillance core'),code:'POINT-MEDICAL-EQUIPMENT'}],
  ],
  environmentalStandards:[
    {id:'ENV-SURF-SWAB',subjectType:'surface',sourceCode:'surfaceSwab',protocolCode:'ENV-SURF-SWAB',unit:'CFU',limitCfu:null,active:true},
    {id:'ENV-SURF-PLATE',subjectType:'surface',sourceCode:'contactPlate',protocolCode:'ENV-SURF-PLATE',unit:'CFU',limitCfu:null,active:true},
    {id:'ENV-ROOM',subjectType:'room',sourceCode:'roomSampling',protocolCode:'ENV-ROOM',unit:'CFU/m³',limitCfu:null,active:true},
    {id:'ENV-WATER',subjectType:'water',sourceCode:'waterSampling',protocolCode:'ENV-WATER',unit:'CFU/100mL',limitCfu:null,active:true},
  ],
  documentTypes:[
    ['Πολιτική','Policy',SYS('QMS documented information core')],
    ['Διαδικασία','Procedure',SYS('QMS documented information core')],
    ['Οδηγία εργασίας','Work instruction',SYS('QMS documented information core')],
    ['Έντυπο','Form',SYS('QMS documented information core')],
    ['Check-list','Checklist',SYS('QMS documented information core')],
    ['Εκπαιδευτικό υλικό','Training material',SYS('QMS documented information core')],
    ['Εξωτερικό έγγραφο','External document',SYS('QMS documented information core')],
  ],
}

export function newLocalLibraryItem(el,en=el){return [el,en,LOCAL()]}

const WARD_EN={ΜΕΘ:'ICU',Παθολογική:'Internal Medicine',Χειρουργική:'Surgery',ΤΕΠ:'Emergency Department',Καρδιολογική:'Cardiology','Νεογνολογική / ΜΕΝΝ':'Neonatal / NICU',Ορθοπαιδική:'Orthopedics'}
// Monthly patient-days of every Demo ward for the last twelve months and the
// current month (to date), plus the hospital total, so per-1,000-patient-day
// rates exist for every month. Values come from the same table Prevention uses.
export const demoPatientDayPeriods = (() => {
  const shift = Math.round(demoOffsetDays() / 30.4375)
  const today = new Date(), rows = []
  for (let back = 12; back >= 0; back--) {
    const first = new Date(Date.UTC(today.getFullYear(), today.getMonth() - back, 1))
    const month = first.toISOString().slice(0, 7), authored = shiftDemoMonth(month, -shift)
    const last = lastDayOfMonth(month), current = back === 0
    const to = current ? `${month}-${pad2(Math.max(1, today.getDate() - 1))}` : `${month}-${pad2(last)}`
    const share = current ? Number(to.slice(8)) / last : 1
    let hospital = 0
    DEMO_WARDS.forEach((ward, index) => {
      const value = Math.round(demoMonthlyPatientDays(ward, authored) * share)
      hospital += value
      rows.push({ id: `pd-${month}-${index + 1}`, from: `${month}-01`, to, scope: 'department', departmentEl: ward, departmentEn: WARD_EN[ward], value, source: 'manual' })
    })
    // Wards without an IPC unit of their own (obstetrics, paediatrics, dialysis…) add to the total.
    rows.push({ id: `pd-${month}-H`, from: `${month}-01`, to, scope: 'hospital', departmentEl: '', departmentEn: '', value: Math.round(hospital * 1.38), source: 'manual' })
  }
  return rows
})()
export const externalSources=[
  {id:'eody',label:'ΕΟΔΥ — Επιτήρηση λοιμωδών νοσημάτων',authority:'ΕΟΔΥ',version:'Εθνική επιτήρηση και υποχρεωτική δήλωση',versionEn:'National surveillance and mandatory notification',status:'approved',scope:'Δηλούμενα νοσήματα, επιδημιολογική επιτήρηση και εθνικές οδηγίες',scopeEn:'Notifiable diseases, epidemiological surveillance and national guidance'},
  {id:'eucast',label:'EUCAST — Αντιμικροβιακή ευαισθησία',authority:'EUCAST',version:'Clinical breakpoints / τρέχουσα έκδοση',versionEn:'Clinical breakpoints / current version',status:'approved',scope:'Breakpoints, MIC και ερμηνεία αντιμικροβιακής ευαισθησίας',scopeEn:'Breakpoints, MIC and antimicrobial susceptibility interpretation'},
  {id:'who',label:'WHO — Infection Prevention & Control',authority:'WHO',version:'IPC Core Components / BPPL / AWaRe',versionEn:'IPC Core Components / BPPL / AWaRe',status:'approved',scope:'IPC, AMR, υγιεινή χεριών και antimicrobial stewardship',scopeEn:'IPC, AMR, hand hygiene and antimicrobial stewardship'},
  {id:'cdc',label:'CDC — Infection Control',authority:'CDC',version:'Infection Control / Isolation Precautions',versionEn:'Infection Control / Isolation Precautions',status:'approved',scope:'Προφυλάξεις μετάδοσης, απομόνωση, HAI και πρακτικές πρόληψης',scopeEn:'Transmission precautions, isolation, HAI and prevention practices'},
  {id:'ecdc',label:'ECDC — Healthcare-associated infections & AMR',authority:'ECDC',version:'HAI-Net / EARS-Net / surveillance guidance',versionEn:'HAI-Net / EARS-Net / surveillance guidance',status:'approved',scope:'Ευρωπαϊκή επιτήρηση HAI, AMR, PPS και επιδημιολογικοί ορισμοί',scopeEn:'European HAI and AMR surveillance, PPS and epidemiological definitions'},
  {id:'shea',label:'SHEA — Healthcare Epidemiology',authority:'SHEA',version:'Compendium / practice recommendations',versionEn:'Compendium / practice recommendations',status:'approved',scope:'Πρόληψη HAI, bundles και στρατηγικές εφαρμογής',scopeEn:'HAI prevention, bundles and implementation strategies'},
  {id:'idsa',label:'IDSA — Infectious Diseases',authority:'IDSA',version:'Clinical practice guidelines',versionEn:'Clinical practice guidelines',status:'approved',scope:'Λοιμώξεις, αντιμικροβιακή θεραπεία και antimicrobial stewardship',scopeEn:'Infectious diseases, antimicrobial treatment and antimicrobial stewardship'},
  {id:'apic',label:'APIC — Infection Prevention',authority:'APIC',version:'Practice resources / implementation guidance',versionEn:'Practice resources / implementation guidance',status:'approved',scope:'Πρακτικές infection prevention, εκπαίδευση και εφαρμογή προγραμμάτων IPC',scopeEn:'Infection prevention practice, education and IPC program implementation'},
  {id:'nice',label:'NICE — Infection prevention & antimicrobial guidance',authority:'NICE',version:'Clinical guidance / quality standards',versionEn:'Clinical guidance / quality standards',status:'approved',scope:'Πρόληψη λοιμώξεων, antimicrobial prescribing και quality standards',scopeEn:'Infection prevention, antimicrobial prescribing and quality standards'},
  {id:'jci',label:'JCI — Accreditation standards',authority:'JCI',version:'Hospital accreditation standards',versionEn:'Hospital accreditation standards',status:'approved',scope:'PCI, ποιότητα, ασφάλεια ασθενών και οργανωτική διακυβέρνηση',scopeEn:'PCI, quality, patient safety and organizational governance'},
  {id:'iso',label:'ISO — Healthcare quality & safety standards',authority:'ISO',version:'ISO 9001 / EN 15224 και συναφή πρότυπα',versionEn:'ISO 9001 / EN 15224 and related standards',status:'approved',scope:'Συστήματα ποιότητας, κλινικές διεργασίες, τεκμηρίωση και διακυβέρνηση',scopeEn:'Quality systems, clinical processes, documentation and governance'},
  {id:'european-commission',label:'Ευρωπαϊκή Επιτροπή — Δημόσια υγεία',authority:'European Commission',version:'EU public-health framework',versionEn:'EU public-health framework',status:'approved',scope:'Ευρωπαϊκή πολιτική δημόσιας υγείας, AMR και κανονιστικό πλαίσιο',scopeEn:'EU public-health policy, AMR and regulatory framework'},
]
