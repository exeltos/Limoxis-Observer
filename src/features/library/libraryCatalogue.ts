// The platform's content of «Βιβλιοθήκη» (Library), as production has it. The same rows are
// seeded in supabase/migrations/20261203200100_library_seed.sql and corrected or added by
// 20261231618000_library_cleanup.sql, 20261231620000_library_new_content.sql and
// 20261231621000_library_title_el.sql (the Platform Owner keeps them from then on, in
// «Διαχείριση βιβλιοθήκης»); the preview and the Demo read them from here.
// tests/library.test.ts keeps the two in step.
//
// Only real organisations and real, well-known publications: no invented
// documents. Entries the platform suggests but the Platform Owner has not yet
// confirmed carry `proposed` («Προτεινόμενο»).

// Link groups, in the order the «Σύνδεσμοι» tab shows them.
export const LINK_GROUPS = Object.freeze([
  { value: 'greek', el: 'Ελληνικοί φορείς', en: 'Greek bodies' },
  { value: 'international', el: 'Διεθνείς οργανισμοί', en: 'International organisations' },
  { value: 'nursing', el: 'Νοσηλευτικοί σύλλογοι & εκπαίδευση', en: 'Nursing associations & education' },
  { value: 'archive', el: 'Αρχείο', en: 'Archive' },
  { value: 'hospital', el: 'Του νοσοκομείου', en: "Hospital's own" },
])

// Topics (tags). A hospital may add its own words too; these have a label in both languages.
export const LIBRARY_TOPICS = Object.freeze([
  { value: 'surveillance', el: 'Επιτήρηση', en: 'Surveillance' },
  { value: 'guidelines', el: 'Οδηγίες', en: 'Guidelines' },
  { value: 'ipc', el: 'Πρόληψη λοιμώξεων', en: 'IPC' },
  { value: 'amr', el: 'AMR', en: 'AMR' },
  { value: 'pps', el: 'PPS', en: 'PPS' },
  { value: 'hand_hygiene', el: 'Υγιεινή χεριών', en: 'Hand hygiene' },
  { value: 'isolation', el: 'Απομόνωση', en: 'Isolation' },
  { value: 'catheters', el: 'Καθετήρες', en: 'Catheters' },
  { value: 'surgery', el: 'Χειρουργείο', en: 'Surgery' },
  { value: 'sterilization', el: 'Αποστείρωση', en: 'Sterilization' },
  { value: 'environment', el: 'Περιβάλλον', en: 'Environment' },
  { value: 'mdro', el: 'Πολυανθεκτικά', en: 'MDRO' },
  { value: 'sepsis', el: 'Σήψη', en: 'Sepsis' },
  { value: 'stewardship', el: 'Stewardship', en: 'Stewardship' },
  { value: 'treatment', el: 'Θεραπεία', en: 'Treatment' },
  { value: 'laboratory', el: 'Εργαστήριο', en: 'Laboratory' },
  { value: 'definitions', el: 'Ορισμοί', en: 'Definitions' },
  { value: 'medicines', el: 'Φάρμακα', en: 'Medicines' },
  { value: 'recalls', el: 'Ανακλήσεις', en: 'Recalls' },
  { value: 'hiv', el: 'HIV', en: 'HIV' },
  { value: 'education', el: 'Εκπαίδευση', en: 'Education' },
  { value: 'nursing', el: 'Νοσηλευτική', en: 'Nursing' },
  { value: 'journal', el: 'Περιοδικό', en: 'Journal' },
  { value: 'icu', el: 'ΜΕΘ', en: 'ICU' },
  { value: 'internal', el: 'Εσωτερικό', en: 'Internal' },
])

// [abbreviation, name, url, group, description EL, description EN, tags, extra]
type LinkRow = [string, string, string, string, string, string, string[], { proposed?: boolean, noteEl?: string, noteEn?: string, status?: string }?]
const LINK_ROWS: LinkRow[] = [
  ['ΕΟΔΥ', 'Εθνικός Οργανισμός Δημόσιας Υγείας', 'https://eody.gov.gr', 'greek', 'Επιδημιολογική επιτήρηση, οδηγίες για νοσοκομειακές λοιμώξεις και αντιμικροβιακή αντοχή, δήλωση νοσημάτων.', 'Epidemiological surveillance, guidance on healthcare-associated infections and antimicrobial resistance, disease notification.', ['surveillance', 'guidelines']],
  ['ΕΕΕΛ', 'Ελληνική Εταιρεία Ελέγχου Λοιμώξεων', 'https://www.eeel.gr', 'greek', 'Κατευθυντήριες οδηγίες, συνέδρια και εκπαίδευση για τον έλεγχο λοιμώξεων στα νοσοκομεία.', 'Guidelines, congresses and education on infection control in hospitals.', ['guidelines', 'education']],
  ['ΕΕΛ', 'Ελληνική Εταιρεία Λοιμώξεων', 'https://www.loimoxeis.gr', 'greek', 'Επιστημονική εταιρεία για τις λοιμώξεις: εκδηλώσεις, ενημέρωση και επιστημονικό έργο.', 'Scientific society for infectious diseases: events, news and scientific work.', ['treatment', 'education']],
  ['AIDS', 'Ελληνική Εταιρεία Μελέτης και Αντιμετώπισης του AIDS', 'https://www.aidshellas.gr', 'greek', 'Επιστημονική εταιρεία για τον HIV: ενημέρωση, θεραπευτικές οδηγίες και εκδηλώσεις.', 'Scientific society for HIV: news, treatment guidance and events.', ['hiv', 'guidelines'], { status: 'archived' }],
  ['ΕΟΦ', 'Εθνικός Οργανισμός Φαρμάκων', 'https://www.eof.gr', 'greek', 'Ανακλήσεις, ασφάλεια και ελλείψεις φαρμάκων, ανακοινώσεις για αντισηπτικά και βιοκτόνα.', 'Medicine recalls, safety and shortages; notices on antiseptics and biocides.', ['medicines', 'recalls'], { proposed: true }],
  ['WHO', 'World Health Organization', 'https://www.who.int', 'international', 'Παγκόσμιες οδηγίες IPC, υγιεινή χεριών, AMR, ειδήσεις και Disease Outbreak News.', 'Global IPC guidance, hand hygiene, AMR, news and Disease Outbreak News.', ['ipc', 'amr']],
  ['CDC', 'Centers for Disease Control and Prevention', 'https://www.cdc.gov', 'international', 'Οδηγίες HICPAC για απομόνωση, καθετήρες, απολύμανση· MMWR και Emerging Infectious Diseases.', 'HICPAC guidelines on isolation, catheters, disinfection; MMWR and Emerging Infectious Diseases.', ['ipc', 'guidelines']],
  ['ECDC', 'European Centre for Disease Prevention and Control', 'https://www.ecdc.europa.eu', 'international', 'Ευρωπαϊκή επιτήρηση HAI και αντοχής, πρωτόκολλο PPS, εβδομαδιαίες εκθέσεις απειλών.', 'European HAI and resistance surveillance, the PPS protocol, weekly threat reports.', ['surveillance', 'pps', 'amr'], { proposed: true }],
  ['APIC', 'Association for Professionals in Infection Control and Epidemiology', 'https://apic.org', 'international', 'Επαγγελματική ένωση ελέγχου λοιμώξεων: εργαλεία, implementation guides, εκπαίδευση.', 'Professional association for infection prevention: tools, implementation guides, education.', ['education', 'ipc']],
  ['HIS', 'Healthcare Infection Society', 'https://www.his.org.uk', 'international', 'Βρετανική επιστημονική εταιρεία (πρώην Hospital Infection Society)· Journal of Hospital Infection.', 'UK scientific society (formerly the Hospital Infection Society); Journal of Hospital Infection.', ['guidelines', 'journal']],
  ['AORN', 'Association of periOperative Registered Nurses', 'https://www.aorn.org', 'international', 'Περιεγχειρητική νοσηλευτική: πρότυπα για αποστείρωση, άσηπτη τεχνική, χειρουργείο.', 'Perioperative nursing: standards for sterilization, aseptic technique, the operating room.', ['surgery', 'sterilization']],
  ['CHICA', 'Canadian Association for Infection Prevention and Control (IPAC Canada)', 'https://ipac-canada.org', 'international', 'Καναδική ένωση IPAC (σήμερα IPAC Canada): θέσεις, εργαλεία, εκπαίδευση.', 'Canadian IPAC association (now IPAC Canada): position statements, tools, education.', ['ipc']],
  ['NHSN', 'CDC NHSN · ορισμοί επιτήρησης', 'https://www.cdc.gov/nhsn', 'international', 'Ορισμοί CLABSI, CAUTI, VAE, SSI και πρωτόκολλα επιτήρησης, ενημέρωση κάθε Ιανουάριο.', 'CLABSI, CAUTI, VAE and SSI definitions and surveillance protocols, updated every January.', ['definitions', 'surveillance'], { proposed: true }],
  ['IDSA', 'Infectious Diseases Society of America', 'https://www.idsociety.org', 'international', 'Κατευθυντήριες οδηγίες θεραπείας λοιμώξεων και καθοδήγηση για ανθεκτικά Gram-αρνητικά.', 'Treatment guidelines for infections and guidance on resistant Gram-negative infections.', ['treatment'], { proposed: true }],
  ['EUC', 'EUCAST · κλινικά όρια ευαισθησίας', 'https://www.eucast.org', 'international', 'Πίνακες breakpoints, εκδίδονται κάθε Ιανουάριο· βάση για τα αντιβιογράμματα του εργαστηρίου.', 'Breakpoint tables, issued every January; the basis of the laboratory\'s susceptibility reports.', ['laboratory'], { proposed: true }],
  ['SSC', 'Surviving Sepsis Campaign', 'https://www.sccm.org/survivingsepsiscampaign', 'international', 'Διεθνείς οδηγίες για σήψη και σηπτική καταπληξία (2021) και τα bundles της πρώτης ώρας.', 'International guidelines for sepsis and septic shock (2021) and the hour-1 bundles.', ['sepsis'], { proposed: true }],
  ['AWaRe', 'WHO AWaRe Antibiotic Book', 'https://www.who.int/publications/i/item/9789240062382', 'international', 'Εμπειρική αγωγή για συχνές λοιμώξεις με την κατάταξη Access / Watch / Reserve.', 'Empirical treatment of common infections with the Access / Watch / Reserve classification.', ['stewardship'], { proposed: true }],
  ['ΕΝΕ', 'Ένωση Νοσηλευτών Ελλάδος', 'https://www.enne.gr', 'nursing', 'Θεσμικός φορέας των νοσηλευτών: μητρώο, ανακοινώσεις, επιστημονικές εκδηλώσεις.', 'The statutory body of Greek nurses: register, announcements, scientific events.', ['nursing']],
  ['ΕΣΝΕ', 'Εθνικός Σύνδεσμος Νοσηλευτών Ελλάδος', 'https://www.esne.gr', 'nursing', 'Μέλος του ICN· συνέδρια, τομείς νοσηλευτικής, επιμόρφωση.', 'Member of the ICN; congresses, nursing sections, continuing education.', ['nursing']],
  ['ICN', 'International Council of Nurses', 'https://www.icn.ch', 'nursing', 'Διεθνές Συμβούλιο Νοσηλευτών: θέσεις πολιτικής, κώδικας δεοντολογίας.', 'International Council of Nurses: policy positions, code of ethics.', ['nursing']],
  ['ANA', 'American Nurses Association', 'https://www.nursingworld.org', 'nursing', 'Πρότυπα πρακτικής και επαγγελματική ανάπτυξη νοσηλευτών (ΗΠΑ).', 'Standards of practice and professional development for nurses (USA).', ['nursing']],
  ['CNA', 'Canadian Nurses Association', 'https://www.cna-aiic.ca/en', 'nursing', 'Καναδική νοσηλευτική ένωση: πρακτική, πολιτική, πιστοποιήσεις.', 'Canadian nursing association: practice, policy, certification.', ['nursing']],
  ['RCN', 'Royal College of Nursing', 'https://www.rcn.org.uk', 'nursing', 'Οδηγοί πρακτικής, μεταξύ άλλων για τον έλεγχο λοιμώξεων και την υγιεινή χεριών.', 'Practice guides, among them on infection prevention and hand hygiene.', ['nursing', 'hand_hygiene']],
  ['NS', 'Nursing Standard', 'https://journals.rcni.com/nursing-standard', 'nursing', 'Επιστημονικό περιοδικό νοσηλευτικής (RCNi)· μέρος του περιεχομένου με συνδρομή.', 'Nursing journal (RCNi); part of the content needs a subscription.', ['journal', 'nursing']],
  ['ICNA', 'Infection Control Nurses Association', 'http://www.icna.co.uk', 'archive', 'Ιστορική ένωση νοσηλευτών ελέγχου λοιμώξεων του Ηνωμένου Βασιλείου.', 'Historic UK association of infection control nurses.', ['nursing'], { noteEl: 'Συγχωνεύθηκε το 2007 στην Infection Prevention Society (ips.uk.net)· η διεύθυνση μπορεί να μην απαντά.', noteEn: 'Merged in 2007 into the Infection Prevention Society (ips.uk.net); the address may not answer.', status: 'archived' }],
  ['SARS', 'SARSwatch', 'http://www.sarswatch.ca', 'archive', 'Καναδική πύλη ενημέρωσης από την εποχή του SARS (2003).', 'Canadian information portal from the SARS era (2003).', ['surveillance'], { noteEl: 'Πηγή της εποχής του SARS, πιθανότατα ανενεργή· κρατιέται για αναφορά.', noteEn: 'A SARS-era source, most likely inactive; kept for reference.', status: 'archived' }],
  ['NMAP', 'NMAP · πύλη νοσηλευτικής', 'http://www.nmap.ac.uk', 'archive', 'Ακαδημαϊκή πύλη πηγών για νοσηλευτική και επαγγέλματα υγείας.', 'Academic gateway to nursing and allied health resources.', ['education'], { noteEl: 'Η πύλη (Intute) έκλεισε περίπου το 2011· κρατιέται για αναφορά.', noteEn: 'The gateway (Intute) closed around 2011; kept for reference.', status: 'archived' }],
  ['RCNA', 'Royal College of Nursing, Australia', 'http://www.rcna.org.au', 'archive', 'Αυστραλιανό κολλέγιο νοσηλευτικής.', 'Australian college of nursing.', ['nursing'], { noteEl: 'Συγχωνεύθηκε το 2012 στο Australian College of Nursing (acn.edu.au).', noteEn: 'Merged in 2012 into the Australian College of Nursing (acn.edu.au).', status: 'archived' }],
]

// Well-known guidelines whose title, organisation and year are certain. Each
// links to the publisher's own page; nothing is copied.
// [abbreviation, title, organisation, year, url, language, tags, extra]
type GuidelineRow = [string, string, string, number | null, string, string, string[], { titleEl?: string, descriptionEl?: string, descriptionEn?: string, summaryEl?: string, summaryEn?: string, limoxisEl?: string, limoxisEn?: string, sortOrder?: number }?]
const GUIDELINE_ROWS: GuidelineRow[] = [
  ['SSC', 'Surviving Sepsis Campaign: International Guidelines for Management of Sepsis and Septic Shock 2026', 'SCCM / ESICM', 2026, 'https://www.sccm.org/clinical-resources/guidelines/guidelines/surviving-sepsis-campaign-international-guidelines-for-management-of-sepsis-and-septic-shock-2026', 'en', ['sepsis', 'icu', 'stewardship'], {
    titleEl: 'Surviving Sepsis Campaign: Διεθνείς οδηγίες για την αντιμετώπιση της σήψης και της σηπτικής καταπληξίας 2026',
    descriptionEl: 'Διεθνείς οδηγίες SCCM και ESICM για τη σήψη και τη σηπτική καταπληξία σε ενήλικες, έκδοση 2026 με 129 δηλώσεις.',
    descriptionEn: 'SCCM and ESICM international guidelines for sepsis and septic shock in adults, 2026 edition with 129 statements.',
    summaryEl: 'Διαλογή ενηλίκων με NEWS/NEWS2, MEWS ή SIRS αντί για qSOFA μόνο του.\nΑντιμικροβιακά το συντομότερο, ιδανικά εντός 1 ώρας, σε πιθανή ή βέβαιη σήψη ή σηπτική καταπληξία.\nΤουλάχιστον 30 ml/kg ενδοφλέβια κρυσταλλοειδή τις πρώτες 3 ώρες σε υποάρδευση ή σηπτική καταπληξία.\nΈλεγχος εστίας ιδανικά εντός 6 ωρών από τη διάγνωση.\nΌχι εμπειρική αντιμυκητιασική αγωγή ως ρουτίνα· έμφαση στην ορθή χρήση αντιμικροβιακών.',
    summaryEn: 'Screen adults with NEWS/NEWS2, MEWS or SIRS rather than qSOFA alone.\nAntimicrobials as soon as possible, ideally within 1 hour, for probable or definite sepsis or septic shock.\nAt least 30 ml/kg IV crystalloid in the first 3 hours for hypoperfusion or septic shock.\nSource control ideally within 6 hours of diagnosis.\nNo routine empirical antifungal therapy; emphasis on antimicrobial stewardship.',
    limoxisEl: 'Σχετίζεται με τη Σήψη του επεισοδίου επιτήρησης (Hour-1 bundle).',
    limoxisEn: 'Relates to Sepsis in the surveillance episode (hour-1 bundle).',
  }],
  ['WHO', 'WHO Guidelines on Hand Hygiene in Health Care', 'WHO', 2009, 'https://www.who.int/publications/i/item/9789241597906', 'en', ['hand_hygiene'], {
    titleEl: 'Οδηγίες του ΠΟΥ για την υγιεινή των χεριών στους χώρους υγείας',
    descriptionEl: 'Οι οδηγίες του ΠΟΥ για την υγιεινή των χεριών στους χώρους υγείας, με τις 5 Στιγμές και την πολυπαραγοντική στρατηγική.',
    descriptionEn: 'WHO guidelines on hand hygiene in health care, with the 5 Moments and the multimodal improvement strategy.',
    summaryEl: 'Οι «5 Στιγμές»: πριν την επαφή με τον ασθενή, πριν από άσηπτη εργασία, μετά από κίνδυνο έκθεσης σε βιολογικά υγρά, μετά την επαφή με τον ασθενή, μετά την επαφή με το περιβάλλον του.\nΑλκοολούχο αντισηπτικό ως πρώτη επιλογή όταν τα χέρια δεν είναι εμφανώς λερωμένα.\nΠλύσιμο με νερό και σαπούνι όταν τα χέρια είναι εμφανώς λερωμένα ή υπάρχει υποψία έκθεσης σε σπορογόνα (π.χ. C. difficile).\nΤα γάντια δεν αντικαθιστούν την υγιεινή των χεριών.\nΠολυπαραγοντική στρατηγική: αλλαγή συστήματος, εκπαίδευση, παρακολούθηση με ανατροφοδότηση, υπενθυμίσεις, κουλτούρα ασφάλειας.',
    summaryEn: 'The 5 Moments: before touching a patient, before a clean/aseptic procedure, after body fluid exposure risk, after touching a patient, after touching patient surroundings.\nAlcohol-based handrub is preferred when hands are not visibly soiled.\nWash with soap and water when hands are visibly soiled or exposure to spore-formers (e.g. C. difficile) is suspected.\nGloves do not replace hand hygiene.\nMultimodal strategy: system change, training, monitoring with feedback, reminders, institutional safety climate.',
  }],
  ['WHO', 'Guidelines on core components of infection prevention and control programmes at the national and acute health care facility level', 'WHO', 2016, 'https://www.who.int/publications/i/item/9789241549929', 'en', ['ipc'], {
    titleEl: 'Οδηγίες για τα βασικά στοιχεία των προγραμμάτων πρόληψης και ελέγχου λοιμώξεων σε εθνικό επίπεδο και στα νοσοκομεία οξείας φροντίδας',
    descriptionEl: 'Οι πρώτες τεκμηριωμένες διεθνείς οδηγίες του ΠΟΥ για τα 8 βασικά στοιχεία ενός προγράμματος πρόληψης λοιμώξεων.',
    descriptionEn: 'WHO\'s first evidence-based international guidelines on the 8 core components of an IPC programme.',
    summaryEl: 'Οκτώ βασικά στοιχεία: πρόγραμμα IPC, οδηγίες, εκπαίδευση, επιτήρηση λοιμώξεων, πολυπαραγοντικές στρατηγικές, έλεγχος και ανατροφοδότηση, φόρτος εργασίας-στελέχωση-πληρότητα κλινών, υποδομές και εξοπλισμός.\n11 συστάσεις και 3 δηλώσεις καλής πρακτικής, για εθνικό επίπεδο και για νοσοκομεία.\nΣε κάθε νοσοκομείο, ενεργό πρόγραμμα IPC με ειδικά εκπαιδευμένη ομάδα και σαφείς στόχους.\nΤακτικός έλεγχος των πρακτικών με έγκαιρη ανατροφοδότηση στο προσωπικό και τη διοίκηση.\nΗ πληρότητα δεν πρέπει να ξεπερνά τον τυπικό αριθμό κλινών· επαρκής στελέχωση ανάλογα με τον φόρτο.',
    summaryEn: 'Eight core components: IPC programme, guidelines, education and training, HAI surveillance, multimodal strategies, monitoring/audit and feedback, workload-staffing-bed occupancy, built environment and equipment.\n11 recommendations and 3 good practice statements, at national and facility level.\nEvery acute facility should have an active IPC programme with a dedicated trained team and clear objectives.\nRegular audit of practices with timely feedback to staff and management.\nBed occupancy should not exceed standard capacity; staffing matched to workload.',
  }],
  ['WHO', 'Global guidelines for the prevention of surgical site infection', 'WHO', 2018, 'https://www.who.int/publications/i/item/9789241550475', 'en', ['surgery'], {
    titleEl: 'Παγκόσμιες οδηγίες για την πρόληψη της λοίμωξης του χειρουργικού πεδίου',
    descriptionEl: 'Οι παγκόσμιες οδηγίες του ΠΟΥ για την πρόληψη της λοίμωξης χειρουργικού πεδίου, 2η έκδοση: 29 συστάσεις σε 23 θέματα.',
    descriptionEn: 'WHO global guidelines for preventing surgical site infection, 2nd edition: 29 recommendations on 23 topics.',
    summaryEl: '29 συστάσεις για την προεγχειρητική, διεγχειρητική και μετεγχειρητική περίοδο, από 28 συστηματικές ανασκοπήσεις.\nΌχι αφαίρεση τριχών· αν χρειάζεται, μόνο με κουρευτική μηχανή, όχι ξυράφι.\nΑντιμικροβιακή προφύλαξη εντός 120 λεπτών πριν την τομή και όχι παράταση μετά το τέλος της επέμβασης.\nΑντισηψία δέρματος με αλκοολούχο διάλυμα χλωρεξιδίνης.\nΑποαποικισμός με μουπιροσίνη (± πλύση χλωρεξιδίνης) σε γνωστούς ρινικούς φορείς S. aureus σε καρδιοθωρακοχειρουργικές και ορθοπαιδικές επεμβάσεις.',
    summaryEn: '29 recommendations across the pre-, intra- and postoperative periods, based on 28 systematic reviews.\nDo not remove hair; if necessary, use clippers only, never razors.\nSurgical antibiotic prophylaxis within 120 minutes before incision, not prolonged after the operation.\nSkin preparation with alcohol-based chlorhexidine.\nMupirocin (± chlorhexidine body wash) decolonisation for known S. aureus nasal carriers in cardiothoracic and orthopaedic surgery.',
  }],
  ['WHO', 'Guidelines for the prevention and control of carbapenem-resistant Enterobacteriaceae, Acinetobacter baumannii and Pseudomonas aeruginosa in health care facilities', 'WHO', 2017, 'https://www.who.int/publications/i/item/9789241550178', 'en', ['mdro'], {
    titleEl: 'Οδηγίες για την πρόληψη και τον έλεγχο των ανθεκτικών στις καρβαπενέμες Enterobacteriaceae, Acinetobacter baumannii και Pseudomonas aeruginosa στους χώρους υγείας',
    descriptionEl: 'Οι πρώτες παγκόσμιες οδηγίες του ΠΟΥ για την πρόληψη και τον έλεγχο των CRE, CRAB και CRPsA στα νοσοκομεία.',
    descriptionEn: 'WHO\'s first global guidelines on preventing and controlling CRE, CRAB and CRPsA in health care facilities.',
    summaryEl: 'Οκτώ συστάσεις, με πρώτη την πολυπαραγοντική στρατηγική πρόληψης και ελέγχου.\nΕνεργό πρόγραμμα IPC και αυστηρή τήρηση της υγιεινής των χεριών.\nΕπιτήρηση λοιμώξεων και αποικισμού, με καλλιέργειες επιτήρησης για ασυμπτωματικούς φορείς.\nΠροφυλάξεις επαφής και απομόνωση σε μονόκλινο ή ομαδοποίηση φορέων.\nΤακτικός καθαρισμός του περιβάλλοντος του ασθενή και, κατά περίπτωση, καλλιέργειες περιβάλλοντος.',
    summaryEn: 'Eight recommendations, the first being a multimodal IPC strategy.\nAn active IPC programme and strict hand hygiene compliance.\nSurveillance of infection and colonisation, with surveillance cultures for asymptomatic carriage.\nContact precautions and isolation in single rooms or cohorting.\nRegular cleaning of the patient environment and, where indicated, environmental surveillance cultures.',
  }],
  ['WHO', 'The WHO AWaRe (Access, Watch, Reserve) antibiotic book', 'WHO', 2022, 'https://www.who.int/publications/i/item/9789240062382', 'en', ['stewardship'], {
    titleEl: 'Το βιβλίο αντιβιοτικών AWaRe (Access, Watch, Reserve) του ΠΟΥ',
    descriptionEl: 'Πρακτικός οδηγός του ΠΟΥ για την εμπειρική αντιβιοτική αγωγή πάνω από 30 συχνών λοιμώξεων με την κατάταξη AWaRe.',
    descriptionEn: 'WHO practical guide to empirical antibiotic treatment of over 30 common infections using the AWaRe classification.',
    summaryEl: 'Επιλογή αντιβιοτικού, δόση, οδός και διάρκεια για περισσότερες από 30 συχνές λοιμώξεις σε ενήλικες και παιδιά.\nΚατάταξη Access (πρώτη επιλογή), Watch (περιορισμένες ενδείξεις) και Reserve (έσχατη λύση).\nΡητή καθοδήγηση για τις περιπτώσεις όπου δεν χρειάζεται αντιβιοτικό.\nΕυθυγραμμίζεται με τους Πρότυπους Καταλόγους Βασικών Φαρμάκων του ΠΟΥ.\nΣυνοδεύεται από συνοπτικά infographics και δωρεάν εφαρμογή.',
    summaryEn: 'Antibiotic choice, dose, route and duration for more than 30 common infections in adults and children.\nAccess (first choice), Watch (limited indications) and Reserve (last resort) groups.\nExplicit guidance on when no antibiotic is needed.\nAligned with the WHO Model Lists of Essential Medicines.\nAccompanied by summary infographics and a free app.',
  }],
  ['CDC', 'Guideline for Isolation Precautions: Preventing Transmission of Infectious Agents in Healthcare Settings', 'CDC / HICPAC', 2007, 'https://www.cdc.gov/infection-control/hcp/isolation-precautions/index.html', 'en', ['isolation'], {
    titleEl: 'Οδηγίες CDC/HICPAC για τις προφυλάξεις απομόνωσης: πρόληψη της μετάδοσης λοιμογόνων παραγόντων στους χώρους υγείας',
    descriptionEl: 'Οι οδηγίες CDC/HICPAC για τις βασικές προφυλάξεις και τις προφυλάξεις ανάλογα με τον τρόπο μετάδοσης σε όλους τους χώρους υγείας.',
    descriptionEn: 'CDC/HICPAC guideline on Standard Precautions and transmission-based precautions across all healthcare settings.',
    summaryEl: 'Βασικές προφυλάξεις για όλους τους ασθενείς, μαζί με υγιεινή αναπνοής, ασφαλείς ενέσεις και μάσκα σε οσφυονωτιαία παρακέντηση.\nΤρεις κατηγορίες προφυλάξεων μετάδοσης: επαφής, σταγονιδίων, αερογενούς.\nΠαράρτημα Α: είδος και διάρκεια προφυλάξεων ανά μικροοργανισμό και κλινική εικόνα.\nΠροτεινόμενη σειρά εφαρμογής και αφαίρεσης του ατομικού εξοπλισμού προστασίας.\nΠροστατευτικό περιβάλλον για λήπτες αλλογενούς μεταμόσχευσης αιμοποιητικών κυττάρων.',
    summaryEn: 'Standard Precautions for all patients, including respiratory hygiene, safe injection practices and masks for lumbar puncture.\nThree transmission-based categories: Contact, Droplet, Airborne.\nAppendix A: type and duration of precautions by infectious agent and condition.\nRecommended sequence for donning and removing PPE.\nProtective Environment for allogeneic haematopoietic stem cell transplant recipients.',
  }],
  ['CDC', 'Guidelines for the Prevention of Intravascular Catheter-Related Infections', 'CDC / HICPAC', 2011, 'https://www.cdc.gov/infection-control/hcp/intravascular-catheter-related-infection/index.html', 'en', ['catheters'], {
    titleEl: 'Οδηγίες CDC/HICPAC για την πρόληψη λοιμώξεων από ενδαγγειακούς καθετήρες',
    descriptionEl: 'Οι οδηγίες CDC/HICPAC για την πρόληψη των λοιμώξεων από ενδαγγειακούς καθετήρες, με την ενημέρωση του 2017.',
    descriptionEn: 'CDC/HICPAC guideline for preventing intravascular catheter-related infections, with the 2017 update.',
    summaryEl: 'Εκπαίδευση και εκπαίδευση επανάληψης του προσωπικού που τοποθετεί και φροντίζει καθετήρες.\nΜέγιστα μέτρα άσηπτης τεχνικής κατά την τοποθέτηση κεντρικού φλεβικού καθετήρα.\nΑντισηψία δέρματος με χλωρεξιδίνη >0,5% σε αλκοόλη.\nΌχι προγραμματισμένη αλλαγή κεντρικών καθετήρων ως ρουτίνα· αφαίρεση όταν δεν χρειάζονται πλέον.\nΔέσμες μέτρων με καταγραφή της συμμόρφωσης ως δείκτη ποιότητας· επιθέματα με χλωρεξιδίνη σε μη σηραγγοποιημένους καθετήρες ενηλίκων (2017).',
    summaryEn: 'Education and training of staff who insert and maintain catheters.\nMaximal sterile barrier precautions during central venous catheter insertion.\nSkin antisepsis with >0.5% chlorhexidine in alcohol.\nNo routine scheduled replacement of central lines; remove when no longer needed.\nBundles with compliance tracked as a quality benchmark; chlorhexidine dressings for non-tunnelled CVCs in adults (2017).',
  }],
  ['CDC', 'Guideline for Prevention of Catheter-Associated Urinary Tract Infections', 'CDC / HICPAC', 2009, 'https://www.cdc.gov/infection-control/hcp/cauti/index.html', 'en', ['catheters'], {
    titleEl: 'Οδηγίες CDC/HICPAC για την πρόληψη ουρολοιμώξεων που σχετίζονται με ουροκαθετήρα',
    descriptionEl: 'Οι οδηγίες CDC/HICPAC για την πρόληψη των ουρολοιμώξεων που σχετίζονται με καθετήρα κύστεως.',
    descriptionEn: 'CDC/HICPAC guideline for preventing catheter-associated urinary tract infections.',
    summaryEl: 'Καθετήρας μόνο για κατάλληλες ενδείξεις και αφαίρεση το συντομότερο δυνατό.\nΕλαχιστοποίηση της χρήσης ιδίως σε γυναίκες, ηλικιωμένους και ανοσοκατεσταλμένους.\nΤοποθέτηση με άσηπτη τεχνική και αποστειρωμένο εξοπλισμό.\nΚλειστό σύστημα παροχέτευσης, ασκός κάτω από το επίπεδο της κύστης, ανεμπόδιστη ροή.\nΕξέταση εναλλακτικών λύσεων, όπως διαλείπων καθετηριασμός ή εξωτερικός καθετήρας.',
    summaryEn: 'Use catheters only for appropriate indications and remove as soon as possible.\nMinimise use especially in women, the elderly and immunocompromised patients.\nInsert with aseptic technique and sterile equipment.\nClosed drainage system, bag below bladder level, unobstructed flow.\nConsider alternatives such as intermittent or external catheterisation.',
  }],
  ['CDC', 'Guideline for Disinfection and Sterilization in Healthcare Facilities', 'CDC / HICPAC', 2008, 'https://www.cdc.gov/infection-control/hcp/disinfection-and-sterilization/index.html', 'en', ['sterilization'], {
    titleEl: 'Οδηγίες CDC/HICPAC για την απολύμανση και την αποστείρωση στους χώρους υγείας',
    descriptionEl: 'Οι οδηγίες CDC/HICPAC για τον καθαρισμό, την απολύμανση και την αποστείρωση ιατροτεχνολογικών προϊόντων και του περιβάλλοντος.',
    descriptionEn: 'CDC/HICPAC guideline on cleaning, disinfection and sterilization of patient-care devices and the environment.',
    summaryEl: 'Ταξινόμηση Spaulding: κρίσιμα, ημικρίσιμα και μη κρίσιμα αντικείμενα.\nΕπιμελής καθαρισμός πριν από κάθε απολύμανση ή αποστείρωση.\nΤα κρίσιμα αντικείμενα αποστειρώνονται· τα ημικρίσιμα χρειάζονται τουλάχιστον απολύμανση υψηλού επιπέδου.\nΠαρακολούθηση της αποστείρωσης με φυσικούς, χημικούς και βιολογικούς δείκτες.\nΌχι ψεκασμός απολυμαντικού (fogging) ως ρουτίνα στους χώρους ασθενών.',
    summaryEn: 'Spaulding classification: critical, semicritical and noncritical items.\nMeticulous cleaning before any disinfection or sterilization.\nCritical items are sterilized; semicritical items need at least high-level disinfection.\nMonitor sterilization with mechanical, chemical and biological indicators.\nNo routine disinfectant fogging in patient-care areas.',
  }],
  ['CDC', 'Guidelines for Environmental Infection Control in Health-Care Facilities', 'CDC / HICPAC', 2003, 'https://www.cdc.gov/infection-control/hcp/environmental-control/index.html', 'en', ['environment'], {
    titleEl: 'Οδηγίες CDC/HICPAC για τον έλεγχο λοιμώξεων από το περιβάλλον στους χώρους υγείας',
    descriptionEl: 'Οι οδηγίες CDC/HICPAC για τον έλεγχο λοιμώξεων από αέρα, νερό, επιφάνειες και κατασκευαστικές εργασίες στα νοσοκομεία.',
    descriptionEn: 'CDC/HICPAC guideline on infection control related to air, water, surfaces and construction in healthcare facilities.',
    summaryEl: 'Εκτίμηση κινδύνου λοιμώξεων πριν από κάθε κατασκευή ή ανακαίνιση που παράγει σκόνη ή αεροζόλ νερού.\nΑξιολόγηση των συστημάτων αερισμού και νερού για την επίπτωσή τους στις λοιμώξεις (π.χ. Legionella).\nΌχι προγραμματισμένες περιβαλλοντικές καλλιέργειες ως ρουτίνα, εκτός ειδικών περιπτώσεων (π.χ. επιδημιολογική διερεύνηση, νερό αιμοκάθαρσης).\nΣτρατηγικές καθαρισμού και απολύμανσης επιφανειών, και για πολυανθεκτικά μικρόβια.',
    summaryEn: 'Infection-control risk assessment before any construction or renovation generating dust or water aerosols.\nAssess ventilation and water systems for infection impact (e.g. Legionella).\nNo routine environmental sampling except where epidemiologically directed or for haemodialysis water quality.\nSurface cleaning and disinfection strategies, including for resistant organisms.',
  }],
  ['CDC', 'Guideline for the Prevention of Surgical Site Infection', 'CDC', 2017, 'https://www.cdc.gov/infection-control/hcp/surgical-site-infection/index.html', 'en', ['surgery'], {
    titleEl: 'Οδηγίες του CDC για την πρόληψη της λοίμωξης του χειρουργικού πεδίου',
    descriptionEl: 'Οι οδηγίες CDC/HICPAC 2017 για την πρόληψη της λοίμωξης χειρουργικού πεδίου, βασισμένες σε συστηματική ανασκόπηση.',
    descriptionEn: 'CDC/HICPAC 2017 guideline for preventing surgical site infection, based on a systematic review.',
    summaryEl: 'Όχι επιπλέον δόσεις προφύλαξης μετά τη σύγκλειση σε καθαρές και καθαρές-μολυσμένες επεμβάσεις, ακόμη και με παροχέτευση.\nΑντισηψία δέρματος με αλκοολούχο διάλυμα, εκτός αν αντενδείκνυται.\nΓλυκόζη αίματος κάτω από 200 mg/dL διεγχειρητικά, σε διαβητικούς και μη.\nΔιατήρηση νορμοθερμίας σε όλους τους ασθενείς.\nΌχι τοπικά αντιμικροβιακά στην τομή.',
    summaryEn: 'No additional prophylactic doses after closure in clean and clean-contaminated procedures, even with a drain.\nAlcohol-based skin preparation unless contraindicated.\nPerioperative blood glucose below 200 mg/dL in patients with and without diabetes.\nMaintain normothermia in all patients.\nNo topical antimicrobials on the incision.',
  }],
  ['IDSA', 'IDSA Guidance on the Treatment of Antimicrobial-Resistant Gram-Negative Infections', 'IDSA', 2026, 'https://www.idsociety.org/practice-guideline/amr-guidance/', 'en', ['treatment', 'mdro'], {
    titleEl: 'Καθοδήγηση της IDSA για τη θεραπεία λοιμώξεων από ανθεκτικά Gram-αρνητικά βακτήρια',
    descriptionEl: 'Η καθοδήγηση της IDSA για τη θεραπεία λοιμώξεων από ανθεκτικά Gram-αρνητικά, έκδοση 2026· επικαιροποιείται κάθε 1–2 χρόνια.',
    descriptionEn: 'IDSA guidance on treating antimicrobial-resistant Gram-negative infections, 2026 edition; updated every 1–2 years.',
    summaryEl: 'Καλύπτει ESBL και AmpC Enterobacterales, CRE, P. aeruginosa δύσκολα θεραπεύσιμη, CRAB και S. maltophilia.\nΌλα τα ερωτήματα της έκδοσης 2024 αναθεωρήθηκαν.\nΑζτρεονάμη-αβιμπακτάμη για CRE που παράγουν NDM.\nΣεφιδεροκόλη ως μονοθεραπεία προτιμώμενη επιλογή σε διηθητικές λοιμώξεις από S. maltophilia.\nΗ θεραπεία επιλέγεται με βάση τον μηχανισμό αντοχής· οι συστάσεις διατυπώνονται ως «προτείνεται».',
    summaryEn: 'Covers ESBL and AmpC Enterobacterales, CRE, difficult-to-treat P. aeruginosa, CRAB and S. maltophilia.\nEvery question from the 2024 edition was revised.\nAztreonam-avibactam for NDM-producing CRE.\nCefiderocol monotherapy as preferred option for invasive S. maltophilia infections.\nTreatment chosen by resistance mechanism; statements phrased as suggestions.',
  }],
  ['ΕΕΕΛ', 'Κατευθυντήριες οδηγίες ΕΕΕΛ (συλλογή)', 'ΕΕΕΛ', null, 'https://www.eeel.gr/1/katefthyntiries-odigies-c4.html', 'el', ['ipc', 'guidelines'], {
    titleEl: 'Κατευθυντήριες οδηγίες ΕΕΕΛ (συλλογή)',
    descriptionEl: 'Συλλογή κατευθυντήριων οδηγιών της Ελληνικής Εταιρείας Ελέγχου Λοιμώξεων για τον έλεγχο λοιμώξεων στα νοσοκομεία.',
    descriptionEn: 'Collection of guidelines from the Hellenic Society for Infection Control on infection control in hospitals.',
  }],
  ['', 'Οδηγίες για τη διάγνωση, την πρόληψη και τον έλεγχο της διασποράς στελεχών Candida auris στο νοσοκομειακό περιβάλλον', 'ΕΟΔΥ', 2023, 'https://eody.gov.gr/candida-auris-2023', 'el', ['mdro', 'ipc', 'laboratory'], {
    titleEl: 'Οδηγίες για τη διάγνωση, την πρόληψη και τον έλεγχο της διασποράς στελεχών Candida auris στο νοσοκομειακό περιβάλλον',
    descriptionEl: 'Οδηγίες του ΕΟΔΥ και του Εργαστηρίου Μικροβιολογίας της Ιατρικής ΕΚΠΑ για την ανίχνευση και τον έλεγχο της C. auris στα νοσοκομεία.',
    descriptionEn: 'NPHO (EODY) and NKUA Microbiology guidance on detecting and controlling Candida auris in hospitals.',
    summaryEl: 'Η C. auris προκαλεί σποραδικές λοιμώξεις, επιδημίες και αποικισμό, κυρίως σε ΜΕΘ.\nΣυχνά ανθεκτική στις αζόλες και ενίοτε σε εχινοκανδίνες και αμφοτερικίνη Β.\nΜεταδίδεται κυρίως με τα χέρια από αποικισμένο ασθενή ή από επιμολυσμένο άψυχο περιβάλλον.\nΠρώτο μέτρο ελέγχου κρούσματος ή συρροής: έγκαιρη ταυτοποίηση στο εργαστήριο.\nΟι λοιμώξεις από C. auris είναι υποχρεωτικά δηλούμενες (ΦΕΚ 1665/2022).',
    summaryEn: 'C. auris causes sporadic infections, outbreaks and colonisation, mainly in ICUs.\nOften resistant to azoles and sometimes to echinocandins and amphotericin B.\nSpread mainly via hands from colonised patients or the contaminated environment.\nFirst control step for a case or cluster: early laboratory identification.\nC. auris infections are notifiable in Greece (Government Gazette 1665/2022).',
    sortOrder: 200,
  }],
  ['', 'Κατευθυντήριες οδηγίες για τη σύνταξη Εσωτερικού Κανονισμού Πρόληψης και Ελέγχου Λοιμώξεων στους Χώρους Παροχής Υπηρεσιών Υγείας', 'ΕΟΔΥ (πρώην ΚΕΕΛΠΝΟ)', 2015, 'https://eody.gov.gr/wp-content/uploads/2019/07/ma-nosokomeia-odigies-1.pdf', 'el', ['ipc', 'guidelines', 'surveillance'], {
    titleEl: 'Κατευθυντήριες οδηγίες για τη σύνταξη Εσωτερικού Κανονισμού Πρόληψης και Ελέγχου Λοιμώξεων στους Χώρους Παροχής Υπηρεσιών Υγείας',
    descriptionEl: 'Οδηγίες για τον εσωτερικό κανονισμό πρόληψης λοιμώξεων που κάθε μονάδα υγείας υποχρεούται να συντάξει (ΥΑ Υ1.Γ.Π.114971/2014).',
    descriptionEn: 'Guidance for the internal infection prevention regulation every Greek healthcare unit must draft (Ministerial Decision Y1.G.P.114971/2014).',
    summaryEl: 'Εφαρμόζει την ΥΑ Υ1.Γ.Π.114971/2014, που υποχρεώνει κάθε μονάδα να έχει εσωτερικό κανονισμό πρόληψης λοιμώξεων.\nΕπιτήρηση λοιμώξεων στους χώρους παροχής υγείας.\nΕπιτήρηση νοσοκομειακών λοιμώξεων και κατανάλωσης αντιβιοτικών.\nΔείκτες ποιότητας οργάνωσης και υποδομών για την πρόληψη λοιμώξεων.\nΜέτρα πρόληψης και ελέγχου.',
    summaryEn: 'Implements Ministerial Decision Y1.G.P.114971/2014 requiring every unit to have an internal infection prevention regulation.\nSurveillance of infections in healthcare settings.\nSurveillance of healthcare-associated infections and antibiotic consumption.\nQuality indicators for organisation and infrastructure.\nPrevention and control measures.',
    sortOrder: 201,
  }],
  ['', 'Point prevalence survey of healthcare-associated infections and antimicrobial use in European acute care hospitals – protocol version 6.1', 'ECDC', 2022, 'https://www.ecdc.europa.eu/en/publications-data/point-prevalence-survey-healthcare-associated-infections-and-antimicrobial-use-vs-6-1', 'en', ['pps', 'surveillance', 'definitions'], {
    titleEl: 'Μελέτη επιπολασμού σημείου των λοιμώξεων που συνδέονται με τη φροντίδα υγείας και της χρήσης αντιμικροβιακών στα ευρωπαϊκά νοσοκομεία οξείας φροντίδας – πρωτόκολλο, έκδοση 6.1',
    descriptionEl: 'Το τελικό πρωτόκολλο του ECDC για την 3η ευρωπαϊκή μελέτη επιπολασμού λοιμώξεων και χρήσης αντιμικροβιακών (2022–2023).',
    descriptionEn: 'ECDC final protocol for the third EU-wide point prevalence survey of HAIs and antimicrobial use (2022–2023).',
    summaryEl: 'Πρωτόκολλο της 3ης πανευρωπαϊκής μελέτης επιπολασμού σε νοσοκομεία οξέων (2022–2023).\nΟρισμοί δεδομένων χρήσης αντιμικροβιακών και ορισμοί κρουσμάτων νοσοκομειακών λοιμώξεων.\nΠροτεινόμενος αλγόριθμος εντοπισμού κρουσμάτων και κωδικοί ενδείξεων και λοιμώξεων.\nΑλλαγές σε σχέση με την έκδοση 5.3 (2016–2017), μεταξύ άλλων για τη νοσοκομειακή COVID-19.\nΗ Ελλάδα (ΕΟΔΥ, 2022) εφάρμοσε την έκδοση 6.0 σε 50 νοσοκομεία.',
    summaryEn: 'Protocol of the third EU-wide PPS in acute care hospitals (2022–2023).\nAntimicrobial use data definitions and HAI case definitions.\nRecommended case-finding algorithm and code lists for indications and infections.\nChanges from version 5.3 (2016–2017), including healthcare-associated COVID-19.\nGreece (EODY, 2022) applied version 6.0 in 50 hospitals.',
    sortOrder: 202,
  }],
  ['', 'Infection prevention and control measures and tools for the prevention of entry of carbapenem-resistant Enterobacteriaceae into healthcare settings: guidance from the European Centre for Disease Prevention and Control', 'ECDC', 2017, 'https://doi.org/10.1186/s13756-017-0259-z', 'en', ['mdro', 'ipc', 'isolation'], {
    titleEl: 'Μέτρα και εργαλεία πρόληψης και ελέγχου λοιμώξεων για να μην εισέλθουν ανθεκτικά στις καρβαπενέμες Enterobacteriaceae (CRE) στους χώρους υγείας: καθοδήγηση του ECDC',
    descriptionEl: 'Οδηγίες ECDC για την αναγνώριση ασθενών «σε κίνδυνο» για φορεία CRE κατά την εισαγωγή και τα άμεσα μέτρα πρόληψης.',
    descriptionEn: 'ECDC guidance for identifying patients at risk of CRE carriage on admission and applying prompt IPC measures.',
    summaryEl: 'Σε κίνδυνο: διανυκτέρευση σε χώρο υγείας ή αιμοκάθαρση/χημειοθεραπεία τους τελευταίους 12 μήνες, προηγούμενη φορεία, επιδημιολογική σύνδεση με φορέα.\nΒασικά μέτρα για όλους τους ασθενείς και συμπληρωματικά για τους ασθενείς σε κίνδυνο.\nΚατά την εισαγωγή: προληπτική απομόνωση, ενεργός έλεγχος για CRE και προφυλάξεις επαφής.\nΕπιβεβαιωμένοι φορείς: πρόσθετα μέτρα και ενημέρωση της μονάδας υποδοχής σε κάθε μεταφορά.\nΠεριλαμβάνει 6 πίνακες και διάγραμμα ροής· τα μέτρα μπορούν να εφαρμοστούν και σε άλλα πολυανθεκτικά Enterobacterales.',
    summaryEn: 'At risk: overnight stay in a healthcare setting, or dialysis/chemotherapy, in the last 12 months; previous carriage; link to a known carrier.\nCore measures for all patients, supplemental measures for at-risk patients.\nOn admission: pre-emptive isolation, active CRE screening and contact precautions.\nConfirmed carriers: additional measures and notification of the receiving facility on transfer.\nSix tables and a flowchart; measures may also apply to other MDR Enterobacterales.',
    sortOrder: 203,
  }],
  ['', 'Rapid risk assessment: Carbapenem-resistant Enterobacterales – fourth update', 'ECDC', 2026, 'https://www.ecdc.europa.eu/en/node/42242', 'en', ['mdro', 'amr', 'surveillance'], {
    titleEl: 'Ταχεία εκτίμηση κινδύνου του ECDC: ανθεκτικά στις καρβαπενέμες Enterobacterales (CRE) – τέταρτη επικαιροποίηση',
    descriptionEl: 'Εκτίμηση κινδύνου ECDC (18/11/2026): η διασπορά των CRE στην ΕΕ επιδεινώνεται, με αύξηση των καρβαπενεμασών NDM.',
    descriptionEn: 'ECDC risk assessment (18 Nov 2026): CRE spread in the EU/EEA is worsening, driven by rising NDM carbapenemases.',
    summaryEl: 'Η εκτιμώμενη επίπτωση βακτηριαιμιών από K. pneumoniae ανθεκτική στις καρβαπενέμες συνεχίζει να αυξάνεται στην ΕΕ/ΕΟΧ.\nΗ μελέτη CRE25 έδειξε μείωση των KPC και αύξηση των NDM σε σχέση με το 2019.\nΗ αύξηση των NDM μειώνει γρήγορα τις αποτελεσματικές νέες θεραπευτικές επιλογές.\nΗ πιθανότητα περαιτέρω διασποράς σε νοσοκομεία και κοινότητα εκτιμάται υψηλή.',
    summaryEn: 'Estimated incidence of carbapenem-resistant K. pneumoniae bloodstream infections keeps rising in the EU/EEA.\nThe CRE25 survey showed fewer KPC and more NDM genes than in 2019.\nRising NDM is rapidly reducing effective new treatment options.\nProbability of further spread in healthcare and community is assessed as high.',
    sortOrder: 204,
  }],
  ['', 'Minimum requirements for infection prevention and control programmes', 'WHO', 2019, 'https://www.who.int/publications/i/item/9789241516945', 'en', ['ipc', 'guidelines'], {
    titleEl: 'Ελάχιστες απαιτήσεις για τα προγράμματα πρόληψης και ελέγχου λοιμώξεων',
    descriptionEl: 'Οι ελάχιστες απαιτήσεις του ΠΟΥ για προγράμματα πρόληψης λοιμώξεων σε εθνικό επίπεδο και σε μονάδες υγείας, ανά βασικό στοιχείο.',
    descriptionEn: 'WHO minimum requirements for IPC programmes at national and facility level, organised by core component.',
    summaryEl: 'Ορίζει το ελάχιστο επίπεδο IPC για την προστασία ασθενών, προσωπικού και επισκεπτών.\nΟργανώνεται ανά βασικό στοιχείο των οδηγιών του 2016 (πρόγραμμα, οδηγίες, εκπαίδευση κ.λπ.).\nΑπευθύνεται σε εθνικό επίπεδο και σε μονάδες υγείας, ως πρώτο βήμα προς την πλήρη εφαρμογή.\nΣυνοδεύεται από εργαλείο αξιολόγησης σε εθνικό επίπεδο (2021).',
    summaryEn: 'Sets the minimum IPC level needed to protect patients, health workers and visitors.\nOrganised by the core components of the 2016 guidelines (programme, guidelines, training, etc.).\nFor national and facility levels, as a first step towards full implementation.\nAccompanied by a national-level assessment tool (2021).',
    sortOrder: 205,
  }],
  ['', 'Decontamination and reprocessing of medical devices for health-care facilities', 'WHO / PAHO', 2016, 'https://www.who.int/publications/i/item/9789241549851', 'en', ['sterilization', 'ipc'], {
    titleEl: 'Απολύμανση και επανεπεξεργασία ιατροτεχνολογικών προϊόντων στους χώρους υγείας',
    descriptionEl: 'Εγχειρίδιο ΠΟΥ/PAHO για τις υποδομές και τις τυπικές διαδικασίες καθαρισμού, απολύμανσης και αποστείρωσης ιατροτεχνολογικών προϊόντων.',
    descriptionEn: 'WHO/PAHO manual on infrastructure and standard procedures for cleaning, disinfection and sterilization of medical devices.',
    summaryEl: 'Υποδομές και τυπικές διαδικασίες για αποτελεσματική απολύμανση και αποστείρωση.\nΚεφάλαια για καθαρισμό, χημικά απολυμαντικά, ενδοσκόπια, αποστείρωση και μεταφορά στη μονάδα επανεπεξεργασίας.\nΠλήρης αναθεώρηση του εγχειριδίου αποστείρωσης της PAHO του 2009.\nΑπευθύνεται σε διοικήσεις και προσωπικό μονάδων υγείας.',
    summaryEn: 'Infrastructure and standard procedures for effective decontamination and sterilization.\nChapters on cleaning, chemical disinfectants, endoscopes, sterilization and transport to the reprocessing unit.\nA full revision of PAHO\'s 2009 sterilization manual.\nAimed at health facility managers and staff.',
    sortOrder: 206,
  }],
  ['', 'ESCMID guidelines for the management of the infection control measures to reduce transmission of multidrug-resistant Gram-negative bacteria in hospitalized patients', 'ESCMID', 2014, 'https://doi.org/10.1111/1469-0691.12427', 'en', ['mdro', 'ipc', 'isolation'], {
    titleEl: 'Οδηγίες της ESCMID για τα μέτρα ελέγχου λοιμώξεων που περιορίζουν τη μετάδοση πολυανθεκτικών Gram-αρνητικών βακτηρίων σε νοσηλευόμενους ασθενείς',
    descriptionEl: 'Οδηγίες ESCMID για τα μέτρα ελέγχου της μετάδοσης πολυανθεκτικών Gram-αρνητικών βακτηρίων σε νοσηλευόμενους ασθενείς.',
    descriptionEn: 'ESCMID guidelines on infection control measures to reduce transmission of MDR Gram-negative bacteria in hospitalised patients.',
    summaryEl: 'Συστάσεις ανά είδος μέτρου και ανά μικροοργανισμό (ESBL-Enterobacterales, K. pneumoniae, A. baumannii, P. aeruginosa).\n«Βασικά» μέτρα για όλα τα νοσοκομεία οξέων και «πρόσθετα» όταν η μετάδοση συνεχίζεται.\nΒασισμένες σε συστηματική ανασκόπηση, με αξιολόγηση τεκμηρίωσης GRADE.\nΔημοσίευση: Clin Microbiol Infect 2014;20 Suppl 1.',
    summaryEn: 'Recommendations by intervention type and organism (ESBL-Enterobacterales, K. pneumoniae, A. baumannii, P. aeruginosa).\nBasic practices for all acute care hospitals and additional measures when transmission persists.\nBased on a systematic review with GRADE evidence rating.\nPublished in Clin Microbiol Infect 2014;20 Suppl 1.',
    sortOrder: 207,
  }],
  ['', 'ESCMID-EUCIC clinical guidelines on decolonization of multidrug-resistant Gram-negative bacteria carriers', 'ESCMID / EUCIC', 2019, 'https://doi.org/10.1016/j.cmi.2019.01.005', 'en', ['mdro', 'treatment'], {
    titleEl: 'Κλινικές οδηγίες ESCMID-EUCIC για τον αποαποικισμό φορέων πολυανθεκτικών Gram-αρνητικών βακτηρίων',
    descriptionEl: 'Οδηγίες ESCMID-EUCIC για τον αποαποικισμό φορέων πολυανθεκτικών Gram-αρνητικών βακτηρίων σε όλους τους χώρους.',
    descriptionEn: 'ESCMID-EUCIC guidelines on decolonisation regimens for carriers of MDR Gram-negative bacteria in all settings.',
    summaryEl: 'Δεν συνιστάται αποαποικισμός ρουτίνας σε φορείς Enterobacterales ανθεκτικών στις κεφαλοσπορίνες 3ης γενιάς ή στις καρβαπενέμες.\nΑνεπαρκή στοιχεία για σύσταση υπέρ ή κατά σε φορείς CRAB, S. maltophilia, XDR P. aeruginosa και άλλων.\nΓια ανοσοκατεσταλμένους φορείς CRE προτείνονται προοπτικές μελέτες.\nΣυστάσεις GRADE από πολυεπιστημονική ομάδα· η μεταμόσχευση κοπράνων εξετάστηκε χωριστά.',
    summaryEn: 'Routine decolonisation of 3rd-generation cephalosporin-resistant or carbapenem-resistant Enterobacterales carriers is not recommended.\nInsufficient evidence for or against interventions in carriers of CRAB, S. maltophilia, XDR P. aeruginosa and others.\nProspective studies suggested for immunocompromised CRE carriers.\nGRADE-based recommendations from a multidisciplinary panel; faecal microbiota transplantation assessed separately.',
    sortOrder: 208,
  }],
  ['', 'European Society of Clinical Microbiology and Infectious Diseases: 2021 update on the treatment guidance document for Clostridioides difficile infection in adults', 'ESCMID', 2021, 'https://doi.org/10.1016/j.cmi.2021.09.038', 'en', ['treatment', 'stewardship'], {
    titleEl: 'ESCMID: επικαιροποίηση 2021 της καθοδήγησης για τη θεραπεία της λοίμωξης από Clostridioides difficile σε ενήλικες',
    descriptionEl: 'Η επικαιροποίηση 2021 της ESCMID για τη θεραπεία της λοίμωξης από C. difficile σε ενήλικες.',
    descriptionEn: 'ESCMID 2021 update on the treatment of Clostridioides difficile infection in adults.',
    summaryEl: 'Η μετρονιδαζόλη δεν συνιστάται πλέον όταν υπάρχει φιδαξομικίνη ή βανκομυκίνη.\nΠροτιμάται η φιδαξομικίνη λόγω λιγότερων υποτροπών· η βανκομυκίνη είναι αποδεκτή εναλλακτική.\nΗ θεραπεία επιλέγεται κυρίως με βάση τον κίνδυνο υποτροπής και όχι τη βαρύτητα.\nΜπεζλοτοξουμάμπη ως συμπλήρωμα της βανκομυκίνης σε υψηλό κίνδυνο υποτροπής όταν δεν υπάρχει φιδαξομικίνη.',
    summaryEn: 'Metronidazole is no longer recommended when fidaxomicin or vancomycin is available.\nFidaxomicin preferred for fewer recurrences; vancomycin an acceptable alternative.\nTreatment strategy driven by recurrence risk rather than severity.\nBezlotoxumab as an adjunct to vancomycin at high recurrence risk when fidaxomicin is unavailable.',
    sortOrder: 209,
  }],
  ['', 'Guidance document for prevention of Clostridium difficile infection in acute healthcare settings', 'ESCMID', 2018, 'https://doi.org/10.1016/j.cmi.2018.02.020', 'en', ['ipc', 'isolation', 'environment'], {
    titleEl: 'Καθοδήγηση για την πρόληψη της λοίμωξης από Clostridium difficile στα νοσοκομεία οξείας φροντίδας',
    descriptionEl: 'Οδηγίες της ομάδας μελέτης ESCMID για την πρόληψη της λοίμωξης από C. difficile σε νοσοκομεία οξέων.',
    descriptionEn: 'ESCMID study group guidance on preventing C. difficile infection in acute care hospitals.',
    summaryEl: '36 δηλώσεις για την πρόληψη, από τις οποίες 18 ισχυρές συστάσεις.\nΧωριστές συστάσεις για επιδημική και για ενδημική κατάσταση.\nΒασισμένες σε συστηματική ανασκόπηση και αξιολόγηση GRADE.\nΣυνδυασμός στοχευμένων μέτρων ελέγχου λοιμώξεων και ορθής χρήσης αντιβιοτικών.',
    summaryEn: '36 statements, 18 of them strong recommendations.\nSeparate recommendations for outbreak and endemic settings.\nBased on a systematic review and GRADE.\nCombines targeted infection control measures with antimicrobial stewardship.',
    sortOrder: 210,
  }],
]

// One-page clinical guides of the platform (20261231620000_library_new_content.sql): the «Τι κάνουμε»
// points in summary, the sources in note («Πηγές: …»), the link to the main source.
// [title, organisation, year, url, group, tags, extra]
type ClinicalRow = [string, string, number | null, string, string, string[], { descriptionEl?: string, descriptionEn?: string, summaryEl?: string, summaryEn?: string, noteEl?: string, noteEn?: string }?]
const CLINICAL_ROWS: ClinicalRow[] = [
  ['Υγιεινή χεριών – οι 5 στιγμές', 'ΕΟΔΥ · WHO', 2020, 'https://eody.gov.gr/wp-content/uploads/2020/03/plirofories_gia_epaggelmaties_ygeias_gia_tin_ygieini_ton_xerion.pdf', 'greek', ['hand_hygiene', 'ipc', 'nursing'], {
    descriptionEl: 'Πότε και πώς καθαρίζουμε τα χέρια στη φροντίδα του ασθενούς: οι 5 στιγμές του WHO, αντισηπτικό ή σαπούνι, γάντια.',
    descriptionEn: 'When and how to clean hands during patient care: the WHO 5 moments, handrub or soap and water, gloves.',
    summaryEl: '1. Πριν από την επαφή με τον ασθενή.\n2. Πριν από άσηπτο ή καθαρό χειρισμό (π.χ. καθετήρες, τραύματα, προετοιμασία φαρμάκων).\n3. Μετά από κίνδυνο έκθεσης σε βιολογικά υγρά (και μετά την αφαίρεση των γαντιών).\n4. Μετά από την επαφή με τον ασθενή.\n5. Μετά από την επαφή με το άμεσο περιβάλλον του ασθενούς, ακόμη κι αν δεν αγγίξατε τον ίδιο.\nΠροτιμήστε αλκοολούχο αντισηπτικό (20–30 δευτ.)· σαπούνι και νερό (40–60 δευτ.) όταν τα χέρια είναι εμφανώς λερωμένα ή επί υποψίας ή επιβεβαίωσης C. difficile ή νοροϊού.\nΤα γάντια δεν αντικαθιστούν την υγιεινή των χεριών: εφαρμόστε την πριν φορέσετε και αμέσως μετά την αφαίρεσή τους.\nΝύχια κοντά και φυσικά· όχι τεχνητά νύχια σε άμεση επαφή με ασθενείς.',
    summaryEn: '1. Before touching a patient.\n2. Before a clean or aseptic procedure (e.g. catheters, wounds, medication preparation).\n3. After body fluid exposure risk (and after removing gloves).\n4. After touching a patient.\n5. After touching the patient\'s immediate surroundings, even if the patient was not touched.\nPrefer alcohol-based handrub (20–30 s); use soap and water (40–60 s) when hands are visibly soiled or C. difficile or norovirus is suspected or confirmed.\nGloves do not replace hand hygiene: clean hands before putting them on and immediately after removing them.\nKeep nails short and natural; no artificial nails in direct patient contact.',
    noteEl: 'Πηγές: ΕΟΔΥ – Πληροφορίες για επαγγελματίες υγείας για την υγιεινή των χεριών (2020)· WHO Guidelines on Hand Hygiene in Health Care (2009)· WHO – Five moments for hand hygiene (2021)',
    noteEn: 'Sources: ΕΟΔΥ – Πληροφορίες για επαγγελματίες υγείας για την υγιεινή των χεριών (2020); WHO Guidelines on Hand Hygiene in Health Care (2009); WHO – Five moments for hand hygiene (2021)',
  }],
  ['Προφυλάξεις επαφής', 'CDC/HICPAC', 2007, 'https://www.cdc.gov/infection-control/hcp/isolation-precautions/index.html', 'international', ['isolation', 'ipc', 'mdro', 'nursing'], {
    descriptionEl: 'Μέτρα για ασθενή με λοίμωξη ή αποικισμό που μεταδίδεται με επαφή (π.χ. πολυανθεκτικά, C. difficile), επιπλέον των βασικών προφυλάξεων.',
    descriptionEn: 'Measures for a patient infected or colonised with an organism spread by contact (e.g. MDROs, C. difficile), on top of standard precautions.',
    summaryEl: 'Μονόκλινος θάλαμος όταν υπάρχει· αλλιώς κοινή νοσηλεία με ασθενείς με το ίδιο μικρόβιο, σε συνεννόηση με την Ομάδα Ελέγχου Λοιμώξεων.\nΓάντια και ποδιά κατά την είσοδο στον θάλαμο, για κάθε επαφή με τον ασθενή ή το περιβάλλον του.\nΑφαίρεση γαντιών και ποδιάς και υγιεινή χεριών πριν βγείτε από τον θάλαμο.\nΑποκλειστικός ή μίας χρήσης εξοπλισμός (στηθοσκόπιο, περιχειρίδα, θερμόμετρο)· αν μοιράζεται, καθαρισμός και απολύμανση πριν τον επόμενο ασθενή.\nΜετακινήσεις εκτός θαλάμου μόνο όταν χρειάζονται· οι αποικισμένες ή μολυσμένες περιοχές καλύπτονται και το τμήμα υποδοχής ενημερώνεται.\nΣυχνός καθαρισμός και απολύμανση του θαλάμου, τουλάχιστον καθημερινά, με έμφαση στις επιφάνειες που αγγίζονται συχνά.',
    summaryEn: 'Single room when available; otherwise cohort with patients carrying the same organism, in agreement with the Infection Prevention team.\nGloves and gown on entering the room, for any contact with the patient or their surroundings.\nRemove gloves and gown and clean hands before leaving the room.\nDedicated or single-use equipment (stethoscope, BP cuff, thermometer); if shared, clean and disinfect before the next patient.\nTransport outside the room only when necessary; cover colonised or infected areas and inform the receiving unit.\nClean and disinfect the room frequently, at least daily, focusing on frequently touched surfaces.',
    noteEl: 'Πηγές: CDC/HICPAC – 2007 Guideline for Isolation Precautions (Siegel et al.) (2007)· CDC – Transmission-Based Precautions (2024)',
    noteEn: 'Sources: CDC/HICPAC – 2007 Guideline for Isolation Precautions (Siegel et al.) (2007); CDC – Transmission-Based Precautions (2024)',
  }],
  ['Προφυλάξεις σταγονιδίων', 'CDC/HICPAC', 2007, 'https://www.cdc.gov/infection-control/hcp/isolation-precautions/index.html', 'international', ['isolation', 'ipc', 'nursing'], {
    descriptionEl: 'Μέτρα για λοιμώξεις που μεταδίδονται με μεγάλα σταγονίδια σε κοντινή απόσταση (π.χ. γρίπη, κοκκύτης, μηνιγγιτιδόκοκκος).',
    descriptionEn: 'Measures for infections spread by large respiratory droplets at close range (e.g. influenza, pertussis, meningococcus).',
    summaryEl: 'Μονόκλινος θάλαμος όταν υπάρχει· αλλιώς απόσταση τουλάχιστον 1 μέτρου (3 πόδια) ανάμεσα στις κλίνες και κουρτίνα.\nΧειρουργική μάσκα κατά την είσοδο στον θάλαμο.\nΠροστασία ματιών και ποδιά όταν αναμένεται εκτίναξη, όπως σε όλες τις βασικές προφυλάξεις.\nΟ ασθενής φορά χειρουργική μάσκα όταν βγαίνει από τον θάλαμο και τηρεί την υγιεινή του βήχα.\nΜετακινήσεις εκτός θαλάμου μόνο όταν χρειάζονται.\nΥγιεινή χεριών μετά την αφαίρεση της μάσκας και κάθε επαφή με αναπνευστικές εκκρίσεις.\nΔιάρκεια ανά νόσημα: π.χ. μηνιγγιτιδόκοκκος έως 24 ώρες αποτελεσματικής αγωγής, κοκκύτης έως 5 ημέρες αποτελεσματικής αγωγής.',
    summaryEn: 'Single room when available; otherwise keep at least 1 metre (3 feet) between beds and draw the curtain.\nSurgical mask on entering the room.\nEye protection and gown when splashes are expected, as in all standard precautions.\nThe patient wears a surgical mask when outside the room and follows cough etiquette.\nTransport outside the room only when necessary.\nClean hands after removing the mask and after any contact with respiratory secretions.\nDuration depends on the disease: e.g. meningococcus until 24 hours of effective therapy, pertussis until 5 days of effective therapy.',
    noteEl: 'Πηγές: CDC/HICPAC – 2007 Guideline for Isolation Precautions (Siegel et al.) (2007)· CDC – Transmission-Based Precautions (2024)· CDC – Appendix A: Type and Duration of Precautions Recommended for Selected Infections and Conditions (2007)',
    noteEn: 'Sources: CDC/HICPAC – 2007 Guideline for Isolation Precautions (Siegel et al.) (2007); CDC – Transmission-Based Precautions (2024); CDC – Appendix A: Type and Duration of Precautions Recommended for Selected Infections and Conditions (2007)',
  }],
  ['Αερογενείς προφυλάξεις', 'CDC/HICPAC', 2007, 'https://www.cdc.gov/infection-control/hcp/isolation-precautions/index.html', 'international', ['isolation', 'ipc', 'nursing'], {
    descriptionEl: 'Μέτρα για νοσήματα που μεταδίδονται με τον αέρα σε απόσταση: φυματίωση, ιλαρά, ανεμευλογιά, διάσπαρτος έρπης ζωστήρας.',
    descriptionEn: 'Measures for diseases spread through the air over distance: tuberculosis, measles, chickenpox, disseminated zoster.',
    summaryEl: 'Θάλαμος αρνητικής πίεσης (αερογενούς απομόνωσης) με την πόρτα πάντα κλειστή.\nΑν δεν υπάρχει τέτοιος θάλαμος: μονόκλινος με κλειστή πόρτα, χειρουργική μάσκα στον ασθενή και μεταφορά όπου υπάρχει θάλαμος αρνητικής πίεσης.\nΜάσκα υψηλής αναπνευστικής προστασίας (N95/FFP2 ή ανώτερη) πριν την είσοδο, με έλεγχο εφαρμογής.\nΠροσωπικό χωρίς ανοσία δεν μπαίνει σε θάλαμο ασθενούς με ιλαρά ή ανεμευλογιά, όταν υπάρχει προσωπικό με ανοσία.\nΟ ασθενής φορά χειρουργική μάσκα εκτός θαλάμου· οι δερματικές βλάβες καλύπτονται.\nΑνεμευλογιά και διάσπαρτος ζωστήρας: αερογενείς και προφυλάξεις επαφής έως ότου όλες οι βλάβες γίνουν εφελκίδες.\nΜετακινήσεις εκτός θαλάμου μόνο όταν χρειάζονται.',
    summaryEn: 'Airborne infection isolation room (negative pressure) with the door kept closed.\nIf no such room is available: single room with the door closed, a surgical mask on the patient, and transfer to a facility with one.\nRespirator (N95/FFP2 or higher) before entering, with a seal check.\nStaff without immunity do not enter the room of a patient with measles or chickenpox when immune staff are available.\nThe patient wears a surgical mask outside the room; skin lesions are covered.\nChickenpox and disseminated zoster: airborne plus contact precautions until all lesions are crusted.\nTransport outside the room only when necessary.',
    noteEl: 'Πηγές: CDC/HICPAC – 2007 Guideline for Isolation Precautions (Siegel et al.) (2007)· CDC – Transmission-Based Precautions (2024)· CDC – Appendix A: Type and Duration of Precautions Recommended for Selected Infections and Conditions (2007)',
    noteEn: 'Sources: CDC/HICPAC – 2007 Guideline for Isolation Precautions (Siegel et al.) (2007); CDC – Transmission-Based Precautions (2024); CDC – Appendix A: Type and Duration of Precautions Recommended for Selected Infections and Conditions (2007)',
  }],
  ['Δέσμη μέτρων κεντρικού φλεβικού καθετήρα', 'SHEA/IDSA/APIC · CDC', 2022, 'https://doi.org/10.1017/ice.2022.87', 'international', ['catheters', 'icu', 'ipc', 'nursing'], {
    descriptionEl: 'Εισαγωγή και συντήρηση του κεντρικού φλεβικού καθετήρα για την πρόληψη της βακτηριαιμίας από καθετήρα (CLABSI).',
    descriptionEn: 'Insertion and maintenance of a central venous catheter to prevent central line-associated bloodstream infection (CLABSI).',
    summaryEl: 'Υγιεινή χεριών πριν την εισαγωγή και κάθε χειρισμό· λίστα ελέγχου (checklist) κατά την εισαγωγή.\nΠλήρη μέτρα άσηπτης τεχνικής: σκούφος, μάσκα, αποστειρωμένη μπλούζα, αποστειρωμένα γάντια, μεγάλο αποστειρωμένο πεδίο που καλύπτει όλο τον ασθενή.\nΑντισηψία δέρματος με αλκοολούχο διάλυμα χλωρεξιδίνης >0,5%· αφήστε το να στεγνώσει πριν την παρακέντηση.\nΣε ενήλικες αποφύγετε τη μηριαία φλέβα· καθοδήγηση με υπερήχους κατά την εισαγωγή.\nΑπολύμανση του σημείου σύνδεσης ή της βαλβίδας πριν από κάθε πρόσβαση στη γραμμή.\nΕπίδεσμος με χλωρεξιδίνη (ασθενείς >2 μηνών)· αλλαγή διαφανούς κάθε 7 ημέρες, γάζας κάθε 2, ή νωρίτερα αν λερωθεί, υγρανθεί ή ξεκολλήσει.\nΣτη ΜΕΘ, καθημερινό λουτρό με χλωρεξιδίνη (ασθενείς >2 μηνών).\nΚαθημερινή αξιολόγηση της ανάγκης· αφαίρεση μόλις ο καθετήρας δεν είναι απαραίτητος.',
    summaryEn: 'Hand hygiene before insertion and every manipulation; use an insertion checklist.\nMaximal sterile barriers: cap, mask, sterile gown, sterile gloves, large sterile drape covering the whole patient.\nSkin antisepsis with >0.5% chlorhexidine in alcohol; let it dry before puncture.\nIn adults avoid the femoral vein; use ultrasound guidance for insertion.\nDisinfect the hub or needleless connector before every access.\nChlorhexidine dressing (patients >2 months); change transparent dressings every 7 days, gauze every 2, or sooner if soiled, damp or loose.\nIn the ICU, daily chlorhexidine bathing (patients >2 months).\nReview the need daily; remove the catheter as soon as it is no longer essential.',
    noteEl: 'Πηγές: SHEA/IDSA/APIC – Strategies to prevent CLABSI in acute-care hospitals: 2022 Update (Buetti et al., ICHE 2022;43:553-569) (2022)· CDC/HICPAC – Guidelines for the Prevention of Intravascular Catheter-Related Infections (O\'Grady et al.) (2011)',
    noteEn: 'Sources: SHEA/IDSA/APIC – Strategies to prevent CLABSI in acute-care hospitals: 2022 Update (Buetti et al., ICHE 2022;43:553-569) (2022); CDC/HICPAC – Guidelines for the Prevention of Intravascular Catheter-Related Infections (O\'Grady et al.) (2011)',
  }],
  ['Δέσμη μέτρων ουροκαθετήρα', 'SHEA/IDSA/APIC · CDC', 2023, 'https://pmc.ncbi.nlm.nih.gov/articles/PMC11287483/', 'international', ['catheters', 'ipc', 'nursing'], {
    descriptionEl: 'Ένδειξη, άσηπτη τοποθέτηση, φροντίδα και έγκαιρη αφαίρεση του ουροκαθετήρα για την πρόληψη της ουρολοίμωξης (CAUTI).',
    descriptionEn: 'Indication, aseptic insertion, care and timely removal of the urinary catheter to prevent catheter-associated UTI (CAUTI).',
    summaryEl: 'Ουροκαθετήρας μόνο με ένδειξη (π.χ. οξεία επίσχεση, ακριβής διούρηση σε βαρέως πάσχοντα, επιλεγμένες επεμβάσεις)· όχι για τη διαχείριση της ακράτειας.\nΕξετάστε εναλλακτικές: διαλείπων καθετηριασμός, εξωτερικός καθετήρας, έλεγχος υπολειπόμενων ούρων με υπερηχογράφο κύστης.\nΆσηπτη τοποθέτηση από εκπαιδευμένο προσωπικό, με αποστειρωμένα γάντια, πεδίο και λιπαντικό μίας χρήσης· όσο το δυνατόν μικρότερη διάμετρος.\nΣτερέωση του καθετήρα και κλειστό σύστημα παροχέτευσης· αν ανοίξει ή διαρρεύσει, αλλάζουν καθετήρας και ουροσυλλέκτης με άσηπτη τεχνική.\nΟ ουροσυλλέκτης πάντα κάτω από το επίπεδο της κύστης, ποτέ στο πάτωμα· σωλήνες χωρίς αναδιπλώσεις.\nΆδειασμα τακτικά σε καθαρό δοχείο ανά ασθενή, χωρίς επαφή της βαλβίδας με το δοχείο.\nΚαθαριότητα του στομίου της ουρήθρας στο καθημερινό λουτρό· όχι αντισηπτικά, όχι αλλαγή καθετήρα σε σταθερά διαστήματα.\nΚαθημερινή αξιολόγηση της ανάγκης· αφαίρεση το συντομότερο (μετεγχειρητικά κατά προτίμηση εντός 24 ωρών), με νοσηλευτικό πρωτόκολλο αφαίρεσης.',
    summaryEn: 'Catheter only with an indication (e.g. acute retention, accurate output in the critically ill, selected surgery); not to manage incontinence.\nConsider alternatives: intermittent catheterisation, external catheter, bladder scanner for residual volume.\nAseptic insertion by trained staff, with sterile gloves, drape and single-use lubricant; the smallest suitable bore.\nSecure the catheter and keep the drainage system closed; if it is opened or leaks, replace catheter and bag aseptically.\nKeep the bag below bladder level at all times, never on the floor; no kinks in the tubing.\nEmpty regularly into a clean container per patient, without the spigot touching the container.\nClean the meatus during daily bathing; no antiseptics, no catheter changes at fixed intervals.\nReview the need daily; remove as soon as possible (post-op preferably within 24 hours), using a nurse-driven removal protocol.',
    noteEl: 'Πηγές: SHEA/IDSA/APIC – Strategies to prevent CAUTI in acute-care hospitals: 2022 Update (Patel et al., ICHE 2023;44:1209-1231) (2023)· CDC/HICPAC – Guideline for Prevention of Catheter-Associated Urinary Tract Infections (2009)',
    noteEn: 'Sources: SHEA/IDSA/APIC – Strategies to prevent CAUTI in acute-care hospitals: 2022 Update (Patel et al., ICHE 2023;44:1209-1231) (2023); CDC/HICPAC – Guideline for Prevention of Catheter-Associated Urinary Tract Infections (2009)',
  }],
  ['Πρόληψη πνευμονίας σχετιζόμενης με αναπνευστήρα', 'SHEA/IDSA/APIC', 2022, 'https://pmc.ncbi.nlm.nih.gov/articles/PMC10903147/', 'international', ['icu', 'ipc', 'nursing'], {
    descriptionEl: 'Βασικά μέτρα σε διασωληνωμένους ενήλικες για την πρόληψη της πνευμονίας από αναπνευστήρα (VAP) στη ΜΕΘ.',
    descriptionEn: 'Essential measures for intubated adults to prevent ventilator-associated pneumonia (VAP) in the ICU.',
    summaryEl: 'Αποφυγή διασωλήνωσης και επαναδιασωλήνωσης όπου είναι ασφαλές: οξυγόνο υψηλής ροής ή μη επεμβατικός αερισμός.\nΕλάχιστη δυνατή καταστολή με πρωτόκολλο· αποφυγή βενζοδιαζεπινών.\nΚαθημερινή διακοπή καταστολής μαζί με δοκιμή αυτόματης αναπνοής για έγκαιρη αποσωλήνωση.\nΑνύψωση της κεφαλής του κρεβατιού στις 30–45°.\nΣτοματική φροντίδα με βούρτσισμα δοντιών, χωρίς χλωρεξιδίνη.\nΠρώιμη κινητοποίηση και άσκηση.\nΑλλαγή κυκλώματος αναπνευστήρα μόνο αν είναι εμφανώς λερωμένο ή δυσλειτουργεί.\nΕπιπλέον μέτρο: τραχειοσωλήνας με αναρρόφηση υπογλωττιδικών εκκρίσεων όταν αναμένεται διασωλήνωση >48–72 ωρών.',
    summaryEn: 'Avoid intubation and reintubation where safe: high-flow nasal oxygen or non-invasive ventilation.\nMinimise sedation with a protocol; avoid benzodiazepines.\nDaily sedation interruption paired with a spontaneous breathing trial for timely extubation.\nElevate the head of the bed to 30–45°.\nOral care with toothbrushing, without chlorhexidine.\nEarly exercise and mobilisation.\nChange the ventilator circuit only if visibly soiled or malfunctioning.\nAdditional measure: endotracheal tube with subglottic secretion drainage when intubation >48–72 hours is expected.',
    noteEl: 'Πηγές: SHEA/IDSA/APIC – Strategies to prevent VAP, VAE and NV-HAP in acute-care hospitals: 2022 Update (Klompas et al., ICHE 2022;43:687-713) (2022)',
    noteEn: 'Sources: SHEA/IDSA/APIC – Strategies to prevent VAP, VAE and NV-HAP in acute-care hospitals: 2022 Update (Klompas et al., ICHE 2022;43:687-713) (2022)',
  }],
  ['Ασθενής με πολυανθεκτικό μικρόβιο', 'WHO · ECDC · CDC', 2017, 'https://www.who.int/publications/i/item/9789241550178', 'international', ['mdro', 'isolation', 'amr', 'ipc'], {
    descriptionEl: 'Άμεσες ενέργειες όταν απομονωθεί CRE/KPC, A. baumannii ή P. aeruginosa ανθεκτικά στις καρβαπενέμες ή C. auris: απομόνωση και ενημέρωση.',
    descriptionEn: 'Immediate steps when CRE/KPC, carbapenem-resistant A. baumannii or P. aeruginosa, or C. auris is isolated: isolation and notification.',
    summaryEl: 'Ενημερώστε αμέσως τον θεράποντα και την Ομάδα Ελέγχου Λοιμώξεων μόλις ειδοποιήσει το εργαστήριο.\nΠροφυλάξεις επαφής χωρίς καθυστέρηση: γάντια και ποδιά, αυστηρή υγιεινή χεριών, αποκλειστικός εξοπλισμός.\nΜονόκλινος θάλαμος ή κοινή νοσηλεία μόνο με ασθενείς με το ίδιο μικρόβιο· για C. auris και αποκλειστικό νοσηλευτικό προσωπικό όπου είναι εφικτό.\nΕντατικός καθημερινός και τελικός καθαρισμός του θαλάμου· για C. auris απολυμαντικό με αποδεδειγμένη δράση έναντι του μύκητα.\nΚαλλιέργειες επιτήρησης (π.χ. ορθικό επίχρισμα) στους ασθενείς υψηλού κινδύνου, σύμφωνα με το πρωτόκολλο του νοσοκομείου.\nΓια C. auris: έλεγχος φορείας των στενών επαφών και διερεύνηση του κρούσματος.\nΣε μεταφορά ή διακομιδή, ενημερώστε το τμήμα ή το νοσοκομείο υποδοχής για το μικρόβιο και τα μέτρα.',
    summaryEn: 'Inform the attending physician and the Infection Prevention team as soon as the laboratory reports the result.\nContact precautions without delay: gloves and gown, strict hand hygiene, dedicated equipment.\nSingle room, or cohort only with patients carrying the same organism; for C. auris also dedicated nursing staff where feasible.\nEnhanced daily and terminal cleaning of the room; for C. auris a disinfectant proven effective against it.\nSurveillance cultures (e.g. rectal swab) of high-risk patients, according to the hospital protocol.\nFor C. auris: screen close contacts for carriage and investigate the case.\nOn transfer, inform the receiving unit or hospital of the organism and the precautions.',
    noteEl: 'Πηγές: WHO – Guidelines for the prevention and control of carbapenem-resistant Enterobacteriaceae, Acinetobacter baumannii and Pseudomonas aeruginosa in health care facilities (2017)· ECDC – Rapid risk assessment: Candida auris in healthcare settings – Europe (first update) (2018)· CDC – Infection Control Guidance: Candida auris (2024)',
    noteEn: 'Sources: WHO – Guidelines for the prevention and control of carbapenem-resistant Enterobacteriaceae, Acinetobacter baumannii and Pseudomonas aeruginosa in health care facilities (2017); ECDC – Rapid risk assessment: Candida auris in healthcare settings – Europe (first update) (2018); CDC – Infection Control Guidance: Candida auris (2024)',
  }],
  ['Τραυματισμός από βελόνα ή έκθεση σε αίμα', 'ΕΟΔΥ · CDC', 2021, 'https://eody.gov.gr/hiv-aidskat-odigies-pep-20210510', 'greek', ['hiv', 'ipc', 'nursing'], {
    descriptionEl: 'Τι κάνει αμέσως ο επαγγελματίας υγείας μετά από τρύπημα, κόψιμο ή εκτίναξη αίματος σε βλεννογόνο ή μη ακέραιο δέρμα.',
    descriptionEn: 'What a healthcare worker does immediately after a needlestick, cut, or blood splash onto mucosa or non-intact skin.',
    summaryEl: 'Πλύνετε αμέσως το τραύμα με σαπούνι και νερό· μη χρησιμοποιείτε καυστικές ουσίες.\nΕκτίναξη σε μύτη, στόμα ή δέρμα: ξέπλυμα με άφθονο νερό· στα μάτια, καταιόνηση με καθαρό νερό ή φυσιολογικό ορό.\nΔηλώστε αμέσως το συμβάν στον προϊστάμενο και στον υπεύθυνο του νοσοκομείου για την επαγγελματική έκθεση.\nΆμεση εκτίμηση από γιατρό: είδος έκθεσης και έλεγχος του ασθενούς-πηγή για HBsAg, anti-HCV και HIV, με τη συγκατάθεσή του.\nΑν χρειάζεται προφύλαξη για HIV, ξεκινά όσο το δυνατόν νωρίτερα, ιδανικά μέσα σε λίγες ώρες και όχι μετά τις 72 ώρες.\nΈλεγχος του εμβολιασμού και των αντισωμάτων (anti-HBs) του εκτεθέντος για ηπατίτιδα B· εμβόλιο ή ανοσοσφαιρίνη ανάλογα με την κατάσταση.\nΑρχικός ορολογικός έλεγχος του εκτεθέντος και παρακολούθηση σύμφωνα με τις οδηγίες.\nΠρόληψη: μην ξανακαλύπτετε βελόνες· απόρριψη αμέσως σε δοχείο αιχμηρών.',
    summaryEn: 'Wash the wound with soap and water immediately; do not use caustic agents.\nSplash to nose, mouth or skin: flush with plenty of water; eyes: irrigate with clean water or saline.\nReport the incident immediately to your supervisor and to the hospital\'s occupational exposure lead.\nPrompt medical assessment: type of exposure, and testing of the source patient for HBsAg, anti-HCV and HIV, with consent.\nIf HIV prophylaxis is needed, start as soon as possible, ideally within hours and not after 72 hours.\nCheck the exposed worker\'s hepatitis B vaccination and anti-HBs; vaccine or immunoglobulin according to status.\nBaseline serology of the exposed worker and follow-up as per guidance.\nPrevention: never recap needles; discard immediately into a sharps container.',
    noteEl: 'Πηγές: ΕΟΔΥ – Οδηγίες για την προφύλαξη μετά από έκθεση στον HIV (PEP) (2021)· ΕΟΔΥ – Επαγγελματικός κίνδυνος για ηπατίτιδα B και C (2019)· 2025 US Public Health Service Guidelines for the Management of Occupational Exposures to HIV and Recommendations for PEP (ICHE 2025) (2025)· CDC MMWR RR-11 – Updated USPHS Guidelines for the Management of Occupational Exposures to HBV, HCV and HIV (2001)· CDC/NIOSH – Bloodborne Infectious Disease Risk Factors (2024)',
    noteEn: 'Sources: ΕΟΔΥ – Οδηγίες για την προφύλαξη μετά από έκθεση στον HIV (PEP) (2021); ΕΟΔΥ – Επαγγελματικός κίνδυνος για ηπατίτιδα B και C (2019); 2025 US Public Health Service Guidelines for the Management of Occupational Exposures to HIV and Recommendations for PEP (ICHE 2025) (2025); CDC MMWR RR-11 – Updated USPHS Guidelines for the Management of Occupational Exposures to HBV, HCV and HIV (2001); CDC/NIOSH – Bloodborne Infectious Disease Risk Factors (2024)',
  }],
]

// The feeds and pages the «Νέα» tab is filled from. None was opened from the
// build environment, so all start unverified (N2-sources.md): the first
// successful check marks them as answering.
// [abbreviation of the link it belongs to, name, url, kind, every N hours, keywords]
export interface NewsSourceSeed { abbreviation: string, name: string, url: string, kind: string, intervalHours: number, keywords: string[] }
export const NEWS_SOURCES: readonly Readonly<NewsSourceSeed>[] = Object.freeze(([
  ['ECDC', 'ECDC · news', 'https://www.ecdc.europa.eu/en/taxonomy/term/1307/feed', 'rss', 2, []],
  ['ECDC', 'ECDC · Communicable disease threats report', 'https://www.ecdc.europa.eu/en/taxonomy/term/1505/feed', 'rss', 2, []],
  ['ECDC', 'ECDC · Public health guidance', 'https://www.ecdc.europa.eu/en/taxonomy/term/1301/feed', 'rss', 2, []],
  ['CDC', 'CDC · EID ahead of print', 'https://wwwnc.cdc.gov/eid/rss/ahead-of-print.xml', 'rss', 2, []],
  ['CDC', 'CDC · MMWR', 'https://www.cdc.gov/mmwr/index.html', 'page', 6, []],
  ['WHO', 'WHO · news', 'https://www.who.int/rss-feeds/news-english.xml', 'rss', 2, ['infection', 'antimicrobial', 'outbreak', 'hand hygiene', 'patient safety', 'vaccine']],
  ['ΕΟΔΥ', 'ΕΟΔΥ · ανακοινώσεις', 'https://eody.gov.gr/feed/', 'rss', 6, []],
  ['ΕΕΕΛ', 'ΕΕΕΛ · οδηγίες', 'https://www.eeel.gr/1/katefthyntiries-odigies-c4.html', 'page', 24, []],
  ['ΕΝΕ', 'ΕΝΕ · ανακοινώσεις', 'https://www.enne.gr', 'page', 24, []],
] as [string, string, string, string, number, string[]][]).map(([abbreviation, name, url, kind, intervalHours, keywords]) => Object.freeze({ abbreviation, name, url, kind, intervalHours, keywords })))

const seedId = (prefix: string, index: number) => `${prefix}-${String(index + 1).padStart(2, '0')}`

export const PLATFORM_LINKS = Object.freeze(LINK_ROWS.map(([abbreviation, name, url, group, descriptionEl, descriptionEn, tags, extra = {}], index) => Object.freeze({
  id: seedId('lib-link', index), organizationId: null, kind: 'link', group, abbreviation, name, organisation: '', url,
  descriptionEl, descriptionEn, tags, year: null, language: /^[Ά-ώ]/u.test(name) ? 'el' : 'en', proposed: Boolean(extra.proposed),
  noteEl: extra.noteEl || '', noteEn: extra.noteEn || '', summaryEl: '', summaryEn: '', limoxisEl: '', limoxisEn: '', status: extra.status || 'published', sortOrder: (index + 1) * 10,
})))

export const PLATFORM_GUIDELINES = Object.freeze(GUIDELINE_ROWS.map(([abbreviation, name, organisation, year, url, language, tags, extra = {}], index) => Object.freeze({
  id: seedId('lib-guide', index), organizationId: null, kind: 'guideline', group: language === 'el' ? 'greek' : 'international', abbreviation, name, titleEl: extra.titleEl || '', organisation, url,
  descriptionEl: extra.descriptionEl || '', descriptionEn: extra.descriptionEn || '', tags, year, language, proposed: false, noteEl: '', noteEn: '',
  summaryEl: extra.summaryEl || '', summaryEn: extra.summaryEn || '', limoxisEl: extra.limoxisEl || '', limoxisEn: extra.limoxisEn || '', status: 'published', sortOrder: extra.sortOrder || (index + 1) * 10,
})))

export const PLATFORM_CLINICAL_GUIDES = Object.freeze(CLINICAL_ROWS.map(([name, organisation, year, url, group, tags, extra = {}], index) => Object.freeze({
  id: seedId('lib-clinical', index), organizationId: null, kind: 'clinical_guide', group, abbreviation: '', name, organisation, url,
  descriptionEl: extra.descriptionEl || '', descriptionEn: extra.descriptionEn || '', tags, year, language: 'el', proposed: false, noteEl: extra.noteEl || '', noteEn: extra.noteEn || '',
  summaryEl: extra.summaryEl || '', summaryEn: extra.summaryEn || '', limoxisEl: '', limoxisEn: '', status: 'published', sortOrder: 300 + index,
})))
