// The platform's starting content of «Βιβλιοθήκη» (Library). The same rows are
// seeded in supabase/migrations/20261203200100_library_seed.sql (the Platform
// Owner keeps them from then on, in «Διαχείριση βιβλιοθήκης»); the preview and
// the Demo read them from here. tests/library.test.js keeps the two in step.
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
const LINK_ROWS = [
  ['ΕΟΔΥ', 'Εθνικός Οργανισμός Δημόσιας Υγείας', 'https://eody.gov.gr', 'greek', 'Επιδημιολογική επιτήρηση, οδηγίες για νοσοκομειακές λοιμώξεις και αντιμικροβιακή αντοχή, δήλωση νοσημάτων.', 'Epidemiological surveillance, guidance on healthcare-associated infections and antimicrobial resistance, disease notification.', ['surveillance', 'guidelines']],
  ['ΕΕΕΛ', 'Ελληνική Εταιρεία Ελέγχου Λοιμώξεων', 'https://www.eeel.gr', 'greek', 'Κατευθυντήριες οδηγίες, συνέδρια και εκπαίδευση για τον έλεγχο λοιμώξεων στα νοσοκομεία.', 'Guidelines, congresses and education on infection control in hospitals.', ['guidelines', 'education']],
  ['ΕΕΛ', 'Ελληνική Εταιρεία Λοιμώξεων', 'https://www.loimoxeis.gr', 'greek', 'Επιστημονική εταιρεία για τις λοιμώξεις: εκδηλώσεις, ενημέρωση και επιστημονικό έργο.', 'Scientific society for infectious diseases: events, news and scientific work.', ['treatment', 'education']],
  ['AIDS', 'Ελληνική Εταιρεία Μελέτης και Αντιμετώπισης του AIDS', 'https://www.aidshellas.gr', 'greek', 'Επιστημονική εταιρεία για τον HIV: ενημέρωση, θεραπευτικές οδηγίες και εκδηλώσεις.', 'Scientific society for HIV: news, treatment guidance and events.', ['hiv', 'guidelines']],
  ['ΕΟΦ', 'Εθνικός Οργανισμός Φαρμάκων', 'https://www.eof.gr', 'greek', 'Ανακλήσεις, ασφάλεια και ελλείψεις φαρμάκων, ανακοινώσεις για αντισηπτικά και βιοκτόνα.', 'Medicine recalls, safety and shortages; notices on antiseptics and biocides.', ['medicines', 'recalls'], { proposed: true }],
  ['WHO', 'World Health Organization', 'https://www.who.int', 'international', 'Παγκόσμιες οδηγίες IPC, υγιεινή χεριών, AMR, ειδήσεις και Disease Outbreak News.', 'Global IPC guidance, hand hygiene, AMR, news and Disease Outbreak News.', ['ipc', 'amr']],
  ['CDC', 'Centers for Disease Control and Prevention', 'https://www.cdc.gov', 'international', 'Οδηγίες HICPAC για απομόνωση, καθετήρες, απολύμανση· MMWR και Emerging Infectious Diseases.', 'HICPAC guidelines on isolation, catheters, disinfection; MMWR and Emerging Infectious Diseases.', ['ipc', 'guidelines']],
  ['ECDC', 'European Centre for Disease Prevention and Control', 'https://www.ecdc.europa.eu', 'international', 'Ευρωπαϊκή επιτήρηση HAI και αντοχής, πρωτόκολλο PPS, εβδομαδιαίες εκθέσεις απειλών.', 'European HAI and resistance surveillance, the PPS protocol, weekly threat reports.', ['surveillance', 'pps', 'amr'], { proposed: true }],
  ['APIC', 'Association for Professionals in Infection Control and Epidemiology', 'https://apic.org', 'international', 'Επαγγελματική ένωση ελέγχου λοιμώξεων: εργαλεία, implementation guides, εκπαίδευση.', 'Professional association for infection prevention: tools, implementation guides, education.', ['education', 'ipc']],
  ['HIS', 'Healthcare Infection Society', 'https://www.his.org.uk', 'international', 'Βρετανική επιστημονική εταιρεία (πρώην Hospital Infection Society)· Journal of Hospital Infection.', 'UK scientific society (formerly the Hospital Infection Society); Journal of Hospital Infection.', ['guidelines', 'journal']],
  ['AORN', 'Association of periOperative Registered Nurses', 'https://www.aorn.org', 'international', 'Περιεγχειρητική νοσηλευτική: πρότυπα για αποστείρωση, άσηπτη τεχνική, χειρουργείο.', 'Perioperative nursing: standards for sterilization, aseptic technique, the operating room.', ['surgery', 'sterilization']],
  ['CHICA', 'Canadian Association for Infection Prevention and Control (IPAC Canada)', 'https://www.chica.org', 'international', 'Καναδική ένωση IPAC (σήμερα IPAC Canada): θέσεις, εργαλεία, εκπαίδευση.', 'Canadian IPAC association (now IPAC Canada): position statements, tools, education.', ['ipc']],
  ['NHSN', 'CDC NHSN · ορισμοί επιτήρησης', 'https://www.cdc.gov/nhsn', 'international', 'Ορισμοί CLABSI, CAUTI, VAE, SSI και πρωτόκολλα επιτήρησης, ενημέρωση κάθε Ιανουάριο.', 'CLABSI, CAUTI, VAE and SSI definitions and surveillance protocols, updated every January.', ['definitions', 'surveillance'], { proposed: true }],
  ['IDSA', 'Infectious Diseases Society of America', 'https://www.idsociety.org', 'international', 'Κατευθυντήριες οδηγίες θεραπείας λοιμώξεων και καθοδήγηση για ανθεκτικά Gram-αρνητικά.', 'Treatment guidelines for infections and guidance on resistant Gram-negative infections.', ['treatment'], { proposed: true }],
  ['EUC', 'EUCAST · κλινικά όρια ευαισθησίας', 'https://www.eucast.org', 'international', 'Πίνακες breakpoints, εκδίδονται κάθε Ιανουάριο· βάση για τα αντιβιογράμματα του εργαστηρίου.', 'Breakpoint tables, issued every January; the basis of the laboratory\'s susceptibility reports.', ['laboratory'], { proposed: true }],
  ['SSC', 'Surviving Sepsis Campaign', 'https://www.sccm.org/survivingsepsiscampaign', 'international', 'Διεθνείς οδηγίες για σήψη και σηπτική καταπληξία (2021) και τα bundles της πρώτης ώρας.', 'International guidelines for sepsis and septic shock (2021) and the hour-1 bundles.', ['sepsis'], { proposed: true }],
  ['AWaRe', 'WHO AWaRe Antibiotic Book', 'https://www.who.int/publications/i/item/9789240062382', 'international', 'Εμπειρική αγωγή για συχνές λοιμώξεις με την κατάταξη Access / Watch / Reserve.', 'Empirical treatment of common infections with the Access / Watch / Reserve classification.', ['stewardship'], { proposed: true }],
  ['ΕΝΕ', 'Ένωση Νοσηλευτών Ελλάδος', 'https://www.enne.gr', 'nursing', 'Θεσμικός φορέας των νοσηλευτών: μητρώο, ανακοινώσεις, επιστημονικές εκδηλώσεις.', 'The statutory body of Greek nurses: register, announcements, scientific events.', ['nursing']],
  ['ΕΣΔΝΕ', 'Εθνικός Σύνδεσμος Διπλωματούχων Νοσηλευτών Ελλάδος', 'https://www.esdne.gr', 'nursing', 'Μέλος του ICN· συνέδρια, τομείς νοσηλευτικής, επιμόρφωση.', 'Member of the ICN; congresses, nursing sections, continuing education.', ['nursing']],
  ['ICN', 'International Council of Nurses', 'https://www.icn.ch', 'nursing', 'Διεθνές Συμβούλιο Νοσηλευτών: θέσεις πολιτικής, κώδικας δεοντολογίας.', 'International Council of Nurses: policy positions, code of ethics.', ['nursing']],
  ['ANA', 'American Nurses Association', 'https://www.nursingworld.org', 'nursing', 'Πρότυπα πρακτικής και επαγγελματική ανάπτυξη νοσηλευτών (ΗΠΑ).', 'Standards of practice and professional development for nurses (USA).', ['nursing']],
  ['CNA', 'Canadian Nurses Association', 'https://www.cna-nurses.ca', 'nursing', 'Καναδική νοσηλευτική ένωση: πρακτική, πολιτική, πιστοποιήσεις.', 'Canadian nursing association: practice, policy, certification.', ['nursing']],
  ['RCN', 'Royal College of Nursing', 'https://www.rcn.org.uk', 'nursing', 'Οδηγοί πρακτικής, μεταξύ άλλων για τον έλεγχο λοιμώξεων και την υγιεινή χεριών.', 'Practice guides, among them on infection prevention and hand hygiene.', ['nursing', 'hand_hygiene']],
  ['NS', 'Nursing Standard', 'https://www.nursing-standard.co.uk', 'nursing', 'Επιστημονικό περιοδικό νοσηλευτικής (RCNi)· μέρος του περιεχομένου με συνδρομή.', 'Nursing journal (RCNi); part of the content needs a subscription.', ['journal', 'nursing']],
  ['ICNA', 'Infection Control Nurses Association', 'http://www.icna.co.uk', 'archive', 'Ιστορική ένωση νοσηλευτών ελέγχου λοιμώξεων του Ηνωμένου Βασιλείου.', 'Historic UK association of infection control nurses.', ['nursing'], { noteEl: 'Συγχωνεύθηκε το 2007 στην Infection Prevention Society (ips.uk.net)· η διεύθυνση μπορεί να μην απαντά.', noteEn: 'Merged in 2007 into the Infection Prevention Society (ips.uk.net); the address may not answer.' }],
  ['SARS', 'SARSwatch', 'http://www.sarswatch.ca', 'archive', 'Καναδική πύλη ενημέρωσης από την εποχή του SARS (2003).', 'Canadian information portal from the SARS era (2003).', ['surveillance'], { noteEl: 'Πηγή της εποχής του SARS, πιθανότατα ανενεργή· κρατιέται για αναφορά.', noteEn: 'A SARS-era source, most likely inactive; kept for reference.' }],
  ['NMAP', 'NMAP · πύλη νοσηλευτικής', 'http://www.nmap.ac.uk', 'archive', 'Ακαδημαϊκή πύλη πηγών για νοσηλευτική και επαγγέλματα υγείας.', 'Academic gateway to nursing and allied health resources.', ['education'], { noteEl: 'Η πύλη (Intute) έκλεισε περίπου το 2011· κρατιέται για αναφορά.', noteEn: 'The gateway (Intute) closed around 2011; kept for reference.' }],
  ['RCNA', 'Royal College of Nursing, Australia', 'http://www.rcna.org.au', 'archive', 'Αυστραλιανό κολλέγιο νοσηλευτικής.', 'Australian college of nursing.', ['nursing'], { noteEl: 'Συγχωνεύθηκε το 2012 στο Australian College of Nursing (acn.edu.au).', noteEn: 'Merged in 2012 into the Australian College of Nursing (acn.edu.au).' }],
]

// Well-known guidelines whose title, organisation and year are certain. Each
// links to the publisher's own page; nothing is copied.
// [abbreviation, title, organisation, year, url, language, tags, extra]
const GUIDELINE_ROWS = [
  ['SSC', 'Surviving Sepsis Campaign: International Guidelines for Management of Sepsis and Septic Shock 2021', 'SCCM / ESICM', 2021, 'https://www.sccm.org/survivingsepsiscampaign', 'en', ['sepsis', 'icu', 'stewardship'], {
    descriptionEl: 'Society of Critical Care Medicine και European Society of Intensive Care Medicine· Crit Care Med 49(11) και Intensive Care Med 47, Οκτ. 2021.',
    descriptionEn: 'Society of Critical Care Medicine and European Society of Intensive Care Medicine; Crit Care Med 49(11) and Intensive Care Med 47, Oct 2021.',
    summaryEl: 'Αντιβιοτικό το συντομότερο, ιδανικά εντός 1 ώρας όταν η σηπτική καταπληξία είναι πιθανή ή βέβαιη.\nΚαλλιέργειες αίματος πριν το αντιβιοτικό, χωρίς να καθυστερεί η χορήγηση.\nΚρυσταλλοειδή 30 ml/kg τις πρώτες 3 ώρες σε υπόταση ή γαλακτικό ≥4 mmol/L.\nΝοραδρεναλίνη πρώτης γραμμής, στόχος MAP ≥65 mmHg.\nΚαθημερινή επανεκτίμηση για αποκλιμάκωση· όχι qSOFA μόνο του ως εργαλείο διαλογής.',
    summaryEn: 'Antibiotics as soon as possible, ideally within 1 hour when septic shock is possible or definite.\nBlood cultures before the antibiotic, without delaying it.\nCrystalloid 30 ml/kg within the first 3 hours for hypotension or lactate ≥4 mmol/L.\nNorepinephrine first line, target MAP ≥65 mmHg.\nDaily reassessment for de-escalation; not qSOFA alone as a screening tool.',
    limoxisEl: 'Σχετίζεται με τη Σήψη του επεισοδίου επιτήρησης (Hour-1 bundle).',
    limoxisEn: 'Relates to Sepsis in the surveillance episode (hour-1 bundle).',
  }],
  ['WHO', 'WHO Guidelines on Hand Hygiene in Health Care', 'WHO', 2009, 'https://www.who.int/publications/i/item/9789241597906', 'en', ['hand_hygiene']],
  ['WHO', 'Guidelines on core components of infection prevention and control programmes at the national and acute health care facility level', 'WHO', 2016, 'https://www.who.int/publications/i/item/9789241549929', 'en', ['ipc']],
  ['WHO', 'Global guidelines for the prevention of surgical site infection', 'WHO', 2016, 'https://www.who.int', 'en', ['surgery']],
  ['WHO', 'Guidelines for the prevention and control of carbapenem-resistant Enterobacteriaceae, Acinetobacter baumannii and Pseudomonas aeruginosa in health care facilities', 'WHO', 2017, 'https://www.who.int', 'en', ['mdro']],
  ['WHO', 'The WHO AWaRe (Access, Watch, Reserve) antibiotic book', 'WHO', 2022, 'https://www.who.int/publications/i/item/9789240062382', 'en', ['stewardship']],
  ['CDC', 'Guideline for Isolation Precautions: Preventing Transmission of Infectious Agents in Healthcare Settings', 'CDC / HICPAC', 2007, 'https://www.cdc.gov/infection-control/', 'en', ['isolation']],
  ['CDC', 'Guidelines for the Prevention of Intravascular Catheter-Related Infections', 'CDC / HICPAC', 2011, 'https://www.cdc.gov/infection-control/', 'en', ['catheters']],
  ['CDC', 'Guideline for Prevention of Catheter-Associated Urinary Tract Infections', 'CDC / HICPAC', 2009, 'https://www.cdc.gov/infection-control/', 'en', ['catheters']],
  ['CDC', 'Guideline for Disinfection and Sterilization in Healthcare Facilities', 'CDC / HICPAC', 2008, 'https://www.cdc.gov/infection-control/', 'en', ['sterilization']],
  ['CDC', 'Guidelines for Environmental Infection Control in Health-Care Facilities', 'CDC / HICPAC', 2003, 'https://www.cdc.gov/infection-control/', 'en', ['environment']],
  ['CDC', 'Guideline for the Prevention of Surgical Site Infection', 'CDC', 2017, 'https://www.cdc.gov/infection-control/', 'en', ['surgery']],
  ['IDSA', 'IDSA Guidance on the Treatment of Antimicrobial-Resistant Gram-Negative Infections', 'IDSA', 2024, 'https://www.idsociety.org/practice-guideline/amr-guidance/', 'en', ['treatment', 'mdro']],
  ['ΕΕΕΛ', 'Κατευθυντήριες οδηγίες ΕΕΕΛ (συλλογή)', 'ΕΕΕΛ', null, 'https://www.eeel.gr/1/katefthyntiries-odigies-c4.html', 'el', ['ipc', 'guidelines']],
]

// The feeds and pages the «Νέα» tab is filled from. None was opened from the
// build environment, so all start unverified (N2-sources.md): the first
// successful check marks them as answering.
// [abbreviation of the link it belongs to, name, url, kind, every N hours, keywords]
export const NEWS_SOURCES = Object.freeze([
  ['ECDC', 'ECDC · news', 'https://www.ecdc.europa.eu/en/taxonomy/term/1307/feed', 'rss', 2, []],
  ['ECDC', 'ECDC · Communicable disease threats report', 'https://www.ecdc.europa.eu/en/taxonomy/term/1505/feed', 'rss', 2, []],
  ['ECDC', 'ECDC · Public health guidance', 'https://www.ecdc.europa.eu/en/taxonomy/term/1301/feed', 'rss', 2, []],
  ['CDC', 'CDC · EID ahead of print', 'https://wwwnc.cdc.gov/eid/rss/ahead-of-print.xml', 'rss', 2, []],
  ['CDC', 'CDC · MMWR', 'https://www.cdc.gov/mmwr/index.html', 'page', 6, []],
  ['WHO', 'WHO · news', 'https://www.who.int/rss-feeds/news-english.xml', 'rss', 2, ['infection', 'antimicrobial', 'outbreak', 'hand hygiene', 'patient safety', 'vaccine']],
  ['ΕΟΔΥ', 'ΕΟΔΥ · ανακοινώσεις', 'https://eody.gov.gr/feed/', 'rss', 6, []],
  ['ΕΕΕΛ', 'ΕΕΕΛ · οδηγίες', 'https://www.eeel.gr/1/katefthyntiries-odigies-c4.html', 'page', 24, []],
  ['ΕΝΕ', 'ΕΝΕ · ανακοινώσεις', 'https://www.enne.gr', 'page', 24, []],
].map(([abbreviation, name, url, kind, intervalHours, keywords]) => Object.freeze({ abbreviation, name, url, kind, intervalHours, keywords })))

const seedId = (prefix, index) => `${prefix}-${String(index + 1).padStart(2, '0')}`

export const PLATFORM_LINKS = Object.freeze(LINK_ROWS.map(([abbreviation, name, url, group, descriptionEl, descriptionEn, tags, extra = {}], index) => Object.freeze({
  id: seedId('lib-link', index), organizationId: null, kind: 'link', group, abbreviation, name, organisation: '', url,
  descriptionEl, descriptionEn, tags, year: null, language: /^[Ά-ώ]/u.test(name) ? 'el' : 'en', proposed: Boolean(extra.proposed),
  noteEl: extra.noteEl || '', noteEn: extra.noteEn || '', summaryEl: '', summaryEn: '', limoxisEl: '', limoxisEn: '', status: 'published', sortOrder: (index + 1) * 10,
})))

export const PLATFORM_GUIDELINES = Object.freeze(GUIDELINE_ROWS.map(([abbreviation, name, organisation, year, url, language, tags, extra = {}], index) => Object.freeze({
  id: seedId('lib-guide', index), organizationId: null, kind: 'guideline', group: language === 'el' ? 'greek' : 'international', abbreviation, name, organisation, url,
  descriptionEl: extra.descriptionEl || '', descriptionEn: extra.descriptionEn || '', tags, year, language, proposed: false, noteEl: '', noteEn: '',
  summaryEl: extra.summaryEl || '', summaryEn: extra.summaryEn || '', limoxisEl: extra.limoxisEl || '', limoxisEn: extra.limoxisEn || '', status: 'published', sortOrder: (index + 1) * 10,
})))
