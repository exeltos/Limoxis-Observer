-- Βιβλιοθήκη: νέο περιεχόμενο της πλατφόρμας, εγκεκριμένο από τον ιδιοκτήτη.
--   11 κατευθυντήριες οδηγίες (ΕΟΔΥ, ECDC, ΠΟΥ, ESCMID) και 9 κλινικοί οδηγοί μίας σελίδας
--   (υγιεινή χεριών, προφυλάξεις επαφής / σταγονιδίων / αερογενείς, κεντρικός καθετήρας,
--   ουροκαθετήρας, πνευμονία αναπνευστήρα, πολυανθεκτικά, νυγμός / έκθεση σε αίμα), με τις πηγές τους.
-- Μόνο προσθήκες· μία φορά (όχι διπλή εγγραφή αν τρέξει ξανά).

insert into public.library_items (organization_id, kind, link_group, name, organisation, url, description_el, description_en, summary_el, summary_en, note_el, note_en, tags, year, language, sort_order, status)
select null, 'guideline', 'greek', $q$Οδηγίες για τη διάγνωση, την πρόληψη και τον έλεγχο της διασποράς στελεχών Candida auris στο νοσοκομειακό περιβάλλον$q$, $q$ΕΟΔΥ$q$, $q$https://eody.gov.gr/candida-auris-2023$q$, $q$Οδηγίες του ΕΟΔΥ και του Εργαστηρίου Μικροβιολογίας της Ιατρικής ΕΚΠΑ για την ανίχνευση και τον έλεγχο της C. auris στα νοσοκομεία.$q$, $q$NPHO (EODY) and NKUA Microbiology guidance on detecting and controlling Candida auris in hospitals.$q$, $q$Η C. auris προκαλεί σποραδικές λοιμώξεις, επιδημίες και αποικισμό, κυρίως σε ΜΕΘ.
Συχνά ανθεκτική στις αζόλες και ενίοτε σε εχινοκανδίνες και αμφοτερικίνη Β.
Μεταδίδεται κυρίως με τα χέρια από αποικισμένο ασθενή ή από επιμολυσμένο άψυχο περιβάλλον.
Πρώτο μέτρο ελέγχου κρούσματος ή συρροής: έγκαιρη ταυτοποίηση στο εργαστήριο.
Οι λοιμώξεις από C. auris είναι υποχρεωτικά δηλούμενες (ΦΕΚ 1665/2022).$q$, $q$C. auris causes sporadic infections, outbreaks and colonisation, mainly in ICUs.
Often resistant to azoles and sometimes to echinocandins and amphotericin B.
Spread mainly via hands from colonised patients or the contaminated environment.
First control step for a case or cluster: early laboratory identification.
C. auris infections are notifiable in Greece (Government Gazette 1665/2022).$q$, null, null, array['mdro','ipc','laboratory']::text[], 2023, 'el', 200, 'published'
where not exists (select 1 from public.library_items where organization_id is null and kind = 'guideline' and name = $q$Οδηγίες για τη διάγνωση, την πρόληψη και τον έλεγχο της διασποράς στελεχών Candida auris στο νοσοκομειακό περιβάλλον$q$);

insert into public.library_items (organization_id, kind, link_group, name, organisation, url, description_el, description_en, summary_el, summary_en, note_el, note_en, tags, year, language, sort_order, status)
select null, 'guideline', 'greek', $q$Κατευθυντήριες οδηγίες για τη σύνταξη Εσωτερικού Κανονισμού Πρόληψης και Ελέγχου Λοιμώξεων στους Χώρους Παροχής Υπηρεσιών Υγείας$q$, $q$ΕΟΔΥ (πρώην ΚΕΕΛΠΝΟ)$q$, $q$https://eody.gov.gr/wp-content/uploads/2019/07/ma-nosokomeia-odigies-1.pdf$q$, $q$Οδηγίες για τον εσωτερικό κανονισμό πρόληψης λοιμώξεων που κάθε μονάδα υγείας υποχρεούται να συντάξει (ΥΑ Υ1.Γ.Π.114971/2014).$q$, $q$Guidance for the internal infection prevention regulation every Greek healthcare unit must draft (Ministerial Decision Y1.G.P.114971/2014).$q$, $q$Εφαρμόζει την ΥΑ Υ1.Γ.Π.114971/2014, που υποχρεώνει κάθε μονάδα να έχει εσωτερικό κανονισμό πρόληψης λοιμώξεων.
Επιτήρηση λοιμώξεων στους χώρους παροχής υγείας.
Επιτήρηση νοσοκομειακών λοιμώξεων και κατανάλωσης αντιβιοτικών.
Δείκτες ποιότητας οργάνωσης και υποδομών για την πρόληψη λοιμώξεων.
Μέτρα πρόληψης και ελέγχου.$q$, $q$Implements Ministerial Decision Y1.G.P.114971/2014 requiring every unit to have an internal infection prevention regulation.
Surveillance of infections in healthcare settings.
Surveillance of healthcare-associated infections and antibiotic consumption.
Quality indicators for organisation and infrastructure.
Prevention and control measures.$q$, null, null, array['ipc','guidelines','surveillance']::text[], 2015, 'el', 201, 'published'
where not exists (select 1 from public.library_items where organization_id is null and kind = 'guideline' and name = $q$Κατευθυντήριες οδηγίες για τη σύνταξη Εσωτερικού Κανονισμού Πρόληψης και Ελέγχου Λοιμώξεων στους Χώρους Παροχής Υπηρεσιών Υγείας$q$);

insert into public.library_items (organization_id, kind, link_group, name, organisation, url, description_el, description_en, summary_el, summary_en, note_el, note_en, tags, year, language, sort_order, status)
select null, 'guideline', 'international', $q$Point prevalence survey of healthcare-associated infections and antimicrobial use in European acute care hospitals – protocol version 6.1$q$, $q$ECDC$q$, $q$https://www.ecdc.europa.eu/en/publications-data/point-prevalence-survey-healthcare-associated-infections-and-antimicrobial-use-vs-6-1$q$, $q$Το τελικό πρωτόκολλο του ECDC για την 3η ευρωπαϊκή μελέτη επιπολασμού λοιμώξεων και χρήσης αντιμικροβιακών (2022–2023).$q$, $q$ECDC final protocol for the third EU-wide point prevalence survey of HAIs and antimicrobial use (2022–2023).$q$, $q$Πρωτόκολλο της 3ης πανευρωπαϊκής μελέτης επιπολασμού σε νοσοκομεία οξέων (2022–2023).
Ορισμοί δεδομένων χρήσης αντιμικροβιακών και ορισμοί κρουσμάτων νοσοκομειακών λοιμώξεων.
Προτεινόμενος αλγόριθμος εντοπισμού κρουσμάτων και κωδικοί ενδείξεων και λοιμώξεων.
Αλλαγές σε σχέση με την έκδοση 5.3 (2016–2017), μεταξύ άλλων για τη νοσοκομειακή COVID-19.
Η Ελλάδα (ΕΟΔΥ, 2022) εφάρμοσε την έκδοση 6.0 σε 50 νοσοκομεία.$q$, $q$Protocol of the third EU-wide PPS in acute care hospitals (2022–2023).
Antimicrobial use data definitions and HAI case definitions.
Recommended case-finding algorithm and code lists for indications and infections.
Changes from version 5.3 (2016–2017), including healthcare-associated COVID-19.
Greece (EODY, 2022) applied version 6.0 in 50 hospitals.$q$, null, null, array['pps','surveillance','definitions']::text[], 2022, 'en', 202, 'published'
where not exists (select 1 from public.library_items where organization_id is null and kind = 'guideline' and name = $q$Point prevalence survey of healthcare-associated infections and antimicrobial use in European acute care hospitals – protocol version 6.1$q$);

insert into public.library_items (organization_id, kind, link_group, name, organisation, url, description_el, description_en, summary_el, summary_en, note_el, note_en, tags, year, language, sort_order, status)
select null, 'guideline', 'international', $q$Infection prevention and control measures and tools for the prevention of entry of carbapenem-resistant Enterobacteriaceae into healthcare settings: guidance from the European Centre for Disease Prevention and Control$q$, $q$ECDC$q$, $q$https://doi.org/10.1186/s13756-017-0259-z$q$, $q$Οδηγίες ECDC για την αναγνώριση ασθενών «σε κίνδυνο» για φορεία CRE κατά την εισαγωγή και τα άμεσα μέτρα πρόληψης.$q$, $q$ECDC guidance for identifying patients at risk of CRE carriage on admission and applying prompt IPC measures.$q$, $q$Σε κίνδυνο: διανυκτέρευση σε χώρο υγείας ή αιμοκάθαρση/χημειοθεραπεία τους τελευταίους 12 μήνες, προηγούμενη φορεία, επιδημιολογική σύνδεση με φορέα.
Βασικά μέτρα για όλους τους ασθενείς και συμπληρωματικά για τους ασθενείς σε κίνδυνο.
Κατά την εισαγωγή: προληπτική απομόνωση, ενεργός έλεγχος για CRE και προφυλάξεις επαφής.
Επιβεβαιωμένοι φορείς: πρόσθετα μέτρα και ενημέρωση της μονάδας υποδοχής σε κάθε μεταφορά.
Περιλαμβάνει 6 πίνακες και διάγραμμα ροής· τα μέτρα μπορούν να εφαρμοστούν και σε άλλα πολυανθεκτικά Enterobacterales.$q$, $q$At risk: overnight stay in a healthcare setting, or dialysis/chemotherapy, in the last 12 months; previous carriage; link to a known carrier.
Core measures for all patients, supplemental measures for at-risk patients.
On admission: pre-emptive isolation, active CRE screening and contact precautions.
Confirmed carriers: additional measures and notification of the receiving facility on transfer.
Six tables and a flowchart; measures may also apply to other MDR Enterobacterales.$q$, null, null, array['mdro','ipc','isolation']::text[], 2017, 'en', 203, 'published'
where not exists (select 1 from public.library_items where organization_id is null and kind = 'guideline' and name = $q$Infection prevention and control measures and tools for the prevention of entry of carbapenem-resistant Enterobacteriaceae into healthcare settings: guidance from the European Centre for Disease Prevention and Control$q$);

insert into public.library_items (organization_id, kind, link_group, name, organisation, url, description_el, description_en, summary_el, summary_en, note_el, note_en, tags, year, language, sort_order, status)
select null, 'guideline', 'international', $q$Rapid risk assessment: Carbapenem-resistant Enterobacterales – fourth update$q$, $q$ECDC$q$, $q$https://www.ecdc.europa.eu/en/node/42242$q$, $q$Εκτίμηση κινδύνου ECDC (18/11/2026): η διασπορά των CRE στην ΕΕ επιδεινώνεται, με αύξηση των καρβαπενεμασών NDM.$q$, $q$ECDC risk assessment (18 Nov 2026): CRE spread in the EU/EEA is worsening, driven by rising NDM carbapenemases.$q$, $q$Η εκτιμώμενη επίπτωση βακτηριαιμιών από K. pneumoniae ανθεκτική στις καρβαπενέμες συνεχίζει να αυξάνεται στην ΕΕ/ΕΟΧ.
Η μελέτη CRE25 έδειξε μείωση των KPC και αύξηση των NDM σε σχέση με το 2019.
Η αύξηση των NDM μειώνει γρήγορα τις αποτελεσματικές νέες θεραπευτικές επιλογές.
Η πιθανότητα περαιτέρω διασποράς σε νοσοκομεία και κοινότητα εκτιμάται υψηλή.$q$, $q$Estimated incidence of carbapenem-resistant K. pneumoniae bloodstream infections keeps rising in the EU/EEA.
The CRE25 survey showed fewer KPC and more NDM genes than in 2019.
Rising NDM is rapidly reducing effective new treatment options.
Probability of further spread in healthcare and community is assessed as high.$q$, null, null, array['mdro','amr','surveillance']::text[], 2026, 'en', 204, 'published'
where not exists (select 1 from public.library_items where organization_id is null and kind = 'guideline' and name = $q$Rapid risk assessment: Carbapenem-resistant Enterobacterales – fourth update$q$);

insert into public.library_items (organization_id, kind, link_group, name, organisation, url, description_el, description_en, summary_el, summary_en, note_el, note_en, tags, year, language, sort_order, status)
select null, 'guideline', 'international', $q$Minimum requirements for infection prevention and control programmes$q$, $q$WHO$q$, $q$https://www.who.int/publications/i/item/9789241516945$q$, $q$Οι ελάχιστες απαιτήσεις του ΠΟΥ για προγράμματα πρόληψης λοιμώξεων σε εθνικό επίπεδο και σε μονάδες υγείας, ανά βασικό στοιχείο.$q$, $q$WHO minimum requirements for IPC programmes at national and facility level, organised by core component.$q$, $q$Ορίζει το ελάχιστο επίπεδο IPC για την προστασία ασθενών, προσωπικού και επισκεπτών.
Οργανώνεται ανά βασικό στοιχείο των οδηγιών του 2016 (πρόγραμμα, οδηγίες, εκπαίδευση κ.λπ.).
Απευθύνεται σε εθνικό επίπεδο και σε μονάδες υγείας, ως πρώτο βήμα προς την πλήρη εφαρμογή.
Συνοδεύεται από εργαλείο αξιολόγησης σε εθνικό επίπεδο (2021).$q$, $q$Sets the minimum IPC level needed to protect patients, health workers and visitors.
Organised by the core components of the 2016 guidelines (programme, guidelines, training, etc.).
For national and facility levels, as a first step towards full implementation.
Accompanied by a national-level assessment tool (2021).$q$, null, null, array['ipc','guidelines']::text[], 2019, 'en', 205, 'published'
where not exists (select 1 from public.library_items where organization_id is null and kind = 'guideline' and name = $q$Minimum requirements for infection prevention and control programmes$q$);

insert into public.library_items (organization_id, kind, link_group, name, organisation, url, description_el, description_en, summary_el, summary_en, note_el, note_en, tags, year, language, sort_order, status)
select null, 'guideline', 'international', $q$Decontamination and reprocessing of medical devices for health-care facilities$q$, $q$WHO / PAHO$q$, $q$https://www.who.int/publications/i/item/9789241549851$q$, $q$Εγχειρίδιο ΠΟΥ/PAHO για τις υποδομές και τις τυπικές διαδικασίες καθαρισμού, απολύμανσης και αποστείρωσης ιατροτεχνολογικών προϊόντων.$q$, $q$WHO/PAHO manual on infrastructure and standard procedures for cleaning, disinfection and sterilization of medical devices.$q$, $q$Υποδομές και τυπικές διαδικασίες για αποτελεσματική απολύμανση και αποστείρωση.
Κεφάλαια για καθαρισμό, χημικά απολυμαντικά, ενδοσκόπια, αποστείρωση και μεταφορά στη μονάδα επανεπεξεργασίας.
Πλήρης αναθεώρηση του εγχειριδίου αποστείρωσης της PAHO του 2009.
Απευθύνεται σε διοικήσεις και προσωπικό μονάδων υγείας.$q$, $q$Infrastructure and standard procedures for effective decontamination and sterilization.
Chapters on cleaning, chemical disinfectants, endoscopes, sterilization and transport to the reprocessing unit.
A full revision of PAHO's 2009 sterilization manual.
Aimed at health facility managers and staff.$q$, null, null, array['sterilization','ipc']::text[], 2016, 'en', 206, 'published'
where not exists (select 1 from public.library_items where organization_id is null and kind = 'guideline' and name = $q$Decontamination and reprocessing of medical devices for health-care facilities$q$);

insert into public.library_items (organization_id, kind, link_group, name, organisation, url, description_el, description_en, summary_el, summary_en, note_el, note_en, tags, year, language, sort_order, status)
select null, 'guideline', 'international', $q$ESCMID guidelines for the management of the infection control measures to reduce transmission of multidrug-resistant Gram-negative bacteria in hospitalized patients$q$, $q$ESCMID$q$, $q$https://doi.org/10.1111/1469-0691.12427$q$, $q$Οδηγίες ESCMID για τα μέτρα ελέγχου της μετάδοσης πολυανθεκτικών Gram-αρνητικών βακτηρίων σε νοσηλευόμενους ασθενείς.$q$, $q$ESCMID guidelines on infection control measures to reduce transmission of MDR Gram-negative bacteria in hospitalised patients.$q$, $q$Συστάσεις ανά είδος μέτρου και ανά μικροοργανισμό (ESBL-Enterobacterales, K. pneumoniae, A. baumannii, P. aeruginosa).
«Βασικά» μέτρα για όλα τα νοσοκομεία οξέων και «πρόσθετα» όταν η μετάδοση συνεχίζεται.
Βασισμένες σε συστηματική ανασκόπηση, με αξιολόγηση τεκμηρίωσης GRADE.
Δημοσίευση: Clin Microbiol Infect 2014;20 Suppl 1.$q$, $q$Recommendations by intervention type and organism (ESBL-Enterobacterales, K. pneumoniae, A. baumannii, P. aeruginosa).
Basic practices for all acute care hospitals and additional measures when transmission persists.
Based on a systematic review with GRADE evidence rating.
Published in Clin Microbiol Infect 2014;20 Suppl 1.$q$, null, null, array['mdro','ipc','isolation']::text[], 2014, 'en', 207, 'published'
where not exists (select 1 from public.library_items where organization_id is null and kind = 'guideline' and name = $q$ESCMID guidelines for the management of the infection control measures to reduce transmission of multidrug-resistant Gram-negative bacteria in hospitalized patients$q$);

insert into public.library_items (organization_id, kind, link_group, name, organisation, url, description_el, description_en, summary_el, summary_en, note_el, note_en, tags, year, language, sort_order, status)
select null, 'guideline', 'international', $q$ESCMID-EUCIC clinical guidelines on decolonization of multidrug-resistant Gram-negative bacteria carriers$q$, $q$ESCMID / EUCIC$q$, $q$https://doi.org/10.1016/j.cmi.2019.01.005$q$, $q$Οδηγίες ESCMID-EUCIC για τον αποαποικισμό φορέων πολυανθεκτικών Gram-αρνητικών βακτηρίων σε όλους τους χώρους.$q$, $q$ESCMID-EUCIC guidelines on decolonisation regimens for carriers of MDR Gram-negative bacteria in all settings.$q$, $q$Δεν συνιστάται αποαποικισμός ρουτίνας σε φορείς Enterobacterales ανθεκτικών στις κεφαλοσπορίνες 3ης γενιάς ή στις καρβαπενέμες.
Ανεπαρκή στοιχεία για σύσταση υπέρ ή κατά σε φορείς CRAB, S. maltophilia, XDR P. aeruginosa και άλλων.
Για ανοσοκατεσταλμένους φορείς CRE προτείνονται προοπτικές μελέτες.
Συστάσεις GRADE από πολυεπιστημονική ομάδα· η μεταμόσχευση κοπράνων εξετάστηκε χωριστά.$q$, $q$Routine decolonisation of 3rd-generation cephalosporin-resistant or carbapenem-resistant Enterobacterales carriers is not recommended.
Insufficient evidence for or against interventions in carriers of CRAB, S. maltophilia, XDR P. aeruginosa and others.
Prospective studies suggested for immunocompromised CRE carriers.
GRADE-based recommendations from a multidisciplinary panel; faecal microbiota transplantation assessed separately.$q$, null, null, array['mdro','treatment']::text[], 2019, 'en', 208, 'published'
where not exists (select 1 from public.library_items where organization_id is null and kind = 'guideline' and name = $q$ESCMID-EUCIC clinical guidelines on decolonization of multidrug-resistant Gram-negative bacteria carriers$q$);

insert into public.library_items (organization_id, kind, link_group, name, organisation, url, description_el, description_en, summary_el, summary_en, note_el, note_en, tags, year, language, sort_order, status)
select null, 'guideline', 'international', $q$European Society of Clinical Microbiology and Infectious Diseases: 2021 update on the treatment guidance document for Clostridioides difficile infection in adults$q$, $q$ESCMID$q$, $q$https://doi.org/10.1016/j.cmi.2021.09.038$q$, $q$Η επικαιροποίηση 2021 της ESCMID για τη θεραπεία της λοίμωξης από C. difficile σε ενήλικες.$q$, $q$ESCMID 2021 update on the treatment of Clostridioides difficile infection in adults.$q$, $q$Η μετρονιδαζόλη δεν συνιστάται πλέον όταν υπάρχει φιδαξομικίνη ή βανκομυκίνη.
Προτιμάται η φιδαξομικίνη λόγω λιγότερων υποτροπών· η βανκομυκίνη είναι αποδεκτή εναλλακτική.
Η θεραπεία επιλέγεται κυρίως με βάση τον κίνδυνο υποτροπής και όχι τη βαρύτητα.
Μπεζλοτοξουμάμπη ως συμπλήρωμα της βανκομυκίνης σε υψηλό κίνδυνο υποτροπής όταν δεν υπάρχει φιδαξομικίνη.$q$, $q$Metronidazole is no longer recommended when fidaxomicin or vancomycin is available.
Fidaxomicin preferred for fewer recurrences; vancomycin an acceptable alternative.
Treatment strategy driven by recurrence risk rather than severity.
Bezlotoxumab as an adjunct to vancomycin at high recurrence risk when fidaxomicin is unavailable.$q$, null, null, array['treatment','stewardship']::text[], 2021, 'en', 209, 'published'
where not exists (select 1 from public.library_items where organization_id is null and kind = 'guideline' and name = $q$European Society of Clinical Microbiology and Infectious Diseases: 2021 update on the treatment guidance document for Clostridioides difficile infection in adults$q$);

insert into public.library_items (organization_id, kind, link_group, name, organisation, url, description_el, description_en, summary_el, summary_en, note_el, note_en, tags, year, language, sort_order, status)
select null, 'guideline', 'international', $q$Guidance document for prevention of Clostridium difficile infection in acute healthcare settings$q$, $q$ESCMID$q$, $q$https://doi.org/10.1016/j.cmi.2018.02.020$q$, $q$Οδηγίες της ομάδας μελέτης ESCMID για την πρόληψη της λοίμωξης από C. difficile σε νοσοκομεία οξέων.$q$, $q$ESCMID study group guidance on preventing C. difficile infection in acute care hospitals.$q$, $q$36 δηλώσεις για την πρόληψη, από τις οποίες 18 ισχυρές συστάσεις.
Χωριστές συστάσεις για επιδημική και για ενδημική κατάσταση.
Βασισμένες σε συστηματική ανασκόπηση και αξιολόγηση GRADE.
Συνδυασμός στοχευμένων μέτρων ελέγχου λοιμώξεων και ορθής χρήσης αντιβιοτικών.$q$, $q$36 statements, 18 of them strong recommendations.
Separate recommendations for outbreak and endemic settings.
Based on a systematic review and GRADE.
Combines targeted infection control measures with antimicrobial stewardship.$q$, null, null, array['ipc','isolation','environment']::text[], 2018, 'en', 210, 'published'
where not exists (select 1 from public.library_items where organization_id is null and kind = 'guideline' and name = $q$Guidance document for prevention of Clostridium difficile infection in acute healthcare settings$q$);

insert into public.library_items (organization_id, kind, link_group, name, organisation, url, description_el, description_en, summary_el, summary_en, note_el, note_en, tags, year, language, sort_order, status)
select null, 'clinical_guide', 'greek', $q$Υγιεινή χεριών – οι 5 στιγμές$q$, $q$ΕΟΔΥ · WHO$q$, $q$https://eody.gov.gr/wp-content/uploads/2020/03/plirofories_gia_epaggelmaties_ygeias_gia_tin_ygieini_ton_xerion.pdf$q$, $q$Πότε και πώς καθαρίζουμε τα χέρια στη φροντίδα του ασθενούς: οι 5 στιγμές του WHO, αντισηπτικό ή σαπούνι, γάντια.$q$, $q$When and how to clean hands during patient care: the WHO 5 moments, handrub or soap and water, gloves.$q$, $q$1. Πριν από την επαφή με τον ασθενή.
2. Πριν από άσηπτο ή καθαρό χειρισμό (π.χ. καθετήρες, τραύματα, προετοιμασία φαρμάκων).
3. Μετά από κίνδυνο έκθεσης σε βιολογικά υγρά (και μετά την αφαίρεση των γαντιών).
4. Μετά από την επαφή με τον ασθενή.
5. Μετά από την επαφή με το άμεσο περιβάλλον του ασθενούς, ακόμη κι αν δεν αγγίξατε τον ίδιο.
Προτιμήστε αλκοολούχο αντισηπτικό (20–30 δευτ.)· σαπούνι και νερό (40–60 δευτ.) όταν τα χέρια είναι εμφανώς λερωμένα ή επί υποψίας ή επιβεβαίωσης C. difficile ή νοροϊού.
Τα γάντια δεν αντικαθιστούν την υγιεινή των χεριών: εφαρμόστε την πριν φορέσετε και αμέσως μετά την αφαίρεσή τους.
Νύχια κοντά και φυσικά· όχι τεχνητά νύχια σε άμεση επαφή με ασθενείς.$q$, $q$1. Before touching a patient.
2. Before a clean or aseptic procedure (e.g. catheters, wounds, medication preparation).
3. After body fluid exposure risk (and after removing gloves).
4. After touching a patient.
5. After touching the patient's immediate surroundings, even if the patient was not touched.
Prefer alcohol-based handrub (20–30 s); use soap and water (40–60 s) when hands are visibly soiled or C. difficile or norovirus is suspected or confirmed.
Gloves do not replace hand hygiene: clean hands before putting them on and immediately after removing them.
Keep nails short and natural; no artificial nails in direct patient contact.$q$, $q$Πηγές: ΕΟΔΥ – Πληροφορίες για επαγγελματίες υγείας για την υγιεινή των χεριών (2020)· WHO Guidelines on Hand Hygiene in Health Care (2009)· WHO – Five moments for hand hygiene (2021)$q$, $q$Sources: ΕΟΔΥ – Πληροφορίες για επαγγελματίες υγείας για την υγιεινή των χεριών (2020); WHO Guidelines on Hand Hygiene in Health Care (2009); WHO – Five moments for hand hygiene (2021)$q$, array['hand_hygiene','ipc','nursing']::text[], 2020, 'el', 300, 'published'
where not exists (select 1 from public.library_items where organization_id is null and kind = 'clinical_guide' and name = $q$Υγιεινή χεριών – οι 5 στιγμές$q$);

insert into public.library_items (organization_id, kind, link_group, name, organisation, url, description_el, description_en, summary_el, summary_en, note_el, note_en, tags, year, language, sort_order, status)
select null, 'clinical_guide', 'international', $q$Προφυλάξεις επαφής$q$, $q$CDC/HICPAC$q$, $q$https://www.cdc.gov/infection-control/hcp/isolation-precautions/index.html$q$, $q$Μέτρα για ασθενή με λοίμωξη ή αποικισμό που μεταδίδεται με επαφή (π.χ. πολυανθεκτικά, C. difficile), επιπλέον των βασικών προφυλάξεων.$q$, $q$Measures for a patient infected or colonised with an organism spread by contact (e.g. MDROs, C. difficile), on top of standard precautions.$q$, $q$Μονόκλινος θάλαμος όταν υπάρχει· αλλιώς κοινή νοσηλεία με ασθενείς με το ίδιο μικρόβιο, σε συνεννόηση με την Ομάδα Ελέγχου Λοιμώξεων.
Γάντια και ποδιά κατά την είσοδο στον θάλαμο, για κάθε επαφή με τον ασθενή ή το περιβάλλον του.
Αφαίρεση γαντιών και ποδιάς και υγιεινή χεριών πριν βγείτε από τον θάλαμο.
Αποκλειστικός ή μίας χρήσης εξοπλισμός (στηθοσκόπιο, περιχειρίδα, θερμόμετρο)· αν μοιράζεται, καθαρισμός και απολύμανση πριν τον επόμενο ασθενή.
Μετακινήσεις εκτός θαλάμου μόνο όταν χρειάζονται· οι αποικισμένες ή μολυσμένες περιοχές καλύπτονται και το τμήμα υποδοχής ενημερώνεται.
Συχνός καθαρισμός και απολύμανση του θαλάμου, τουλάχιστον καθημερινά, με έμφαση στις επιφάνειες που αγγίζονται συχνά.$q$, $q$Single room when available; otherwise cohort with patients carrying the same organism, in agreement with the Infection Prevention team.
Gloves and gown on entering the room, for any contact with the patient or their surroundings.
Remove gloves and gown and clean hands before leaving the room.
Dedicated or single-use equipment (stethoscope, BP cuff, thermometer); if shared, clean and disinfect before the next patient.
Transport outside the room only when necessary; cover colonised or infected areas and inform the receiving unit.
Clean and disinfect the room frequently, at least daily, focusing on frequently touched surfaces.$q$, $q$Πηγές: CDC/HICPAC – 2007 Guideline for Isolation Precautions (Siegel et al.) (2007)· CDC – Transmission-Based Precautions (2024)$q$, $q$Sources: CDC/HICPAC – 2007 Guideline for Isolation Precautions (Siegel et al.) (2007); CDC – Transmission-Based Precautions (2024)$q$, array['isolation','ipc','mdro','nursing']::text[], 2007, 'el', 301, 'published'
where not exists (select 1 from public.library_items where organization_id is null and kind = 'clinical_guide' and name = $q$Προφυλάξεις επαφής$q$);

insert into public.library_items (organization_id, kind, link_group, name, organisation, url, description_el, description_en, summary_el, summary_en, note_el, note_en, tags, year, language, sort_order, status)
select null, 'clinical_guide', 'international', $q$Προφυλάξεις σταγονιδίων$q$, $q$CDC/HICPAC$q$, $q$https://www.cdc.gov/infection-control/hcp/isolation-precautions/index.html$q$, $q$Μέτρα για λοιμώξεις που μεταδίδονται με μεγάλα σταγονίδια σε κοντινή απόσταση (π.χ. γρίπη, κοκκύτης, μηνιγγιτιδόκοκκος).$q$, $q$Measures for infections spread by large respiratory droplets at close range (e.g. influenza, pertussis, meningococcus).$q$, $q$Μονόκλινος θάλαμος όταν υπάρχει· αλλιώς απόσταση τουλάχιστον 1 μέτρου (3 πόδια) ανάμεσα στις κλίνες και κουρτίνα.
Χειρουργική μάσκα κατά την είσοδο στον θάλαμο.
Προστασία ματιών και ποδιά όταν αναμένεται εκτίναξη, όπως σε όλες τις βασικές προφυλάξεις.
Ο ασθενής φορά χειρουργική μάσκα όταν βγαίνει από τον θάλαμο και τηρεί την υγιεινή του βήχα.
Μετακινήσεις εκτός θαλάμου μόνο όταν χρειάζονται.
Υγιεινή χεριών μετά την αφαίρεση της μάσκας και κάθε επαφή με αναπνευστικές εκκρίσεις.
Διάρκεια ανά νόσημα: π.χ. μηνιγγιτιδόκοκκος έως 24 ώρες αποτελεσματικής αγωγής, κοκκύτης έως 5 ημέρες αποτελεσματικής αγωγής.$q$, $q$Single room when available; otherwise keep at least 1 metre (3 feet) between beds and draw the curtain.
Surgical mask on entering the room.
Eye protection and gown when splashes are expected, as in all standard precautions.
The patient wears a surgical mask when outside the room and follows cough etiquette.
Transport outside the room only when necessary.
Clean hands after removing the mask and after any contact with respiratory secretions.
Duration depends on the disease: e.g. meningococcus until 24 hours of effective therapy, pertussis until 5 days of effective therapy.$q$, $q$Πηγές: CDC/HICPAC – 2007 Guideline for Isolation Precautions (Siegel et al.) (2007)· CDC – Transmission-Based Precautions (2024)· CDC – Appendix A: Type and Duration of Precautions Recommended for Selected Infections and Conditions (2007)$q$, $q$Sources: CDC/HICPAC – 2007 Guideline for Isolation Precautions (Siegel et al.) (2007); CDC – Transmission-Based Precautions (2024); CDC – Appendix A: Type and Duration of Precautions Recommended for Selected Infections and Conditions (2007)$q$, array['isolation','ipc','nursing']::text[], 2007, 'el', 302, 'published'
where not exists (select 1 from public.library_items where organization_id is null and kind = 'clinical_guide' and name = $q$Προφυλάξεις σταγονιδίων$q$);

insert into public.library_items (organization_id, kind, link_group, name, organisation, url, description_el, description_en, summary_el, summary_en, note_el, note_en, tags, year, language, sort_order, status)
select null, 'clinical_guide', 'international', $q$Αερογενείς προφυλάξεις$q$, $q$CDC/HICPAC$q$, $q$https://www.cdc.gov/infection-control/hcp/isolation-precautions/index.html$q$, $q$Μέτρα για νοσήματα που μεταδίδονται με τον αέρα σε απόσταση: φυματίωση, ιλαρά, ανεμευλογιά, διάσπαρτος έρπης ζωστήρας.$q$, $q$Measures for diseases spread through the air over distance: tuberculosis, measles, chickenpox, disseminated zoster.$q$, $q$Θάλαμος αρνητικής πίεσης (αερογενούς απομόνωσης) με την πόρτα πάντα κλειστή.
Αν δεν υπάρχει τέτοιος θάλαμος: μονόκλινος με κλειστή πόρτα, χειρουργική μάσκα στον ασθενή και μεταφορά όπου υπάρχει θάλαμος αρνητικής πίεσης.
Μάσκα υψηλής αναπνευστικής προστασίας (N95/FFP2 ή ανώτερη) πριν την είσοδο, με έλεγχο εφαρμογής.
Προσωπικό χωρίς ανοσία δεν μπαίνει σε θάλαμο ασθενούς με ιλαρά ή ανεμευλογιά, όταν υπάρχει προσωπικό με ανοσία.
Ο ασθενής φορά χειρουργική μάσκα εκτός θαλάμου· οι δερματικές βλάβες καλύπτονται.
Ανεμευλογιά και διάσπαρτος ζωστήρας: αερογενείς και προφυλάξεις επαφής έως ότου όλες οι βλάβες γίνουν εφελκίδες.
Μετακινήσεις εκτός θαλάμου μόνο όταν χρειάζονται.$q$, $q$Airborne infection isolation room (negative pressure) with the door kept closed.
If no such room is available: single room with the door closed, a surgical mask on the patient, and transfer to a facility with one.
Respirator (N95/FFP2 or higher) before entering, with a seal check.
Staff without immunity do not enter the room of a patient with measles or chickenpox when immune staff are available.
The patient wears a surgical mask outside the room; skin lesions are covered.
Chickenpox and disseminated zoster: airborne plus contact precautions until all lesions are crusted.
Transport outside the room only when necessary.$q$, $q$Πηγές: CDC/HICPAC – 2007 Guideline for Isolation Precautions (Siegel et al.) (2007)· CDC – Transmission-Based Precautions (2024)· CDC – Appendix A: Type and Duration of Precautions Recommended for Selected Infections and Conditions (2007)$q$, $q$Sources: CDC/HICPAC – 2007 Guideline for Isolation Precautions (Siegel et al.) (2007); CDC – Transmission-Based Precautions (2024); CDC – Appendix A: Type and Duration of Precautions Recommended for Selected Infections and Conditions (2007)$q$, array['isolation','ipc','nursing']::text[], 2007, 'el', 303, 'published'
where not exists (select 1 from public.library_items where organization_id is null and kind = 'clinical_guide' and name = $q$Αερογενείς προφυλάξεις$q$);

insert into public.library_items (organization_id, kind, link_group, name, organisation, url, description_el, description_en, summary_el, summary_en, note_el, note_en, tags, year, language, sort_order, status)
select null, 'clinical_guide', 'international', $q$Δέσμη μέτρων κεντρικού φλεβικού καθετήρα$q$, $q$SHEA/IDSA/APIC · CDC$q$, $q$https://doi.org/10.1017/ice.2022.87$q$, $q$Εισαγωγή και συντήρηση του κεντρικού φλεβικού καθετήρα για την πρόληψη της βακτηριαιμίας από καθετήρα (CLABSI).$q$, $q$Insertion and maintenance of a central venous catheter to prevent central line-associated bloodstream infection (CLABSI).$q$, $q$Υγιεινή χεριών πριν την εισαγωγή και κάθε χειρισμό· λίστα ελέγχου (checklist) κατά την εισαγωγή.
Πλήρη μέτρα άσηπτης τεχνικής: σκούφος, μάσκα, αποστειρωμένη μπλούζα, αποστειρωμένα γάντια, μεγάλο αποστειρωμένο πεδίο που καλύπτει όλο τον ασθενή.
Αντισηψία δέρματος με αλκοολούχο διάλυμα χλωρεξιδίνης >0,5%· αφήστε το να στεγνώσει πριν την παρακέντηση.
Σε ενήλικες αποφύγετε τη μηριαία φλέβα· καθοδήγηση με υπερήχους κατά την εισαγωγή.
Απολύμανση του σημείου σύνδεσης ή της βαλβίδας πριν από κάθε πρόσβαση στη γραμμή.
Επίδεσμος με χλωρεξιδίνη (ασθενείς >2 μηνών)· αλλαγή διαφανούς κάθε 7 ημέρες, γάζας κάθε 2, ή νωρίτερα αν λερωθεί, υγρανθεί ή ξεκολλήσει.
Στη ΜΕΘ, καθημερινό λουτρό με χλωρεξιδίνη (ασθενείς >2 μηνών).
Καθημερινή αξιολόγηση της ανάγκης· αφαίρεση μόλις ο καθετήρας δεν είναι απαραίτητος.$q$, $q$Hand hygiene before insertion and every manipulation; use an insertion checklist.
Maximal sterile barriers: cap, mask, sterile gown, sterile gloves, large sterile drape covering the whole patient.
Skin antisepsis with >0.5% chlorhexidine in alcohol; let it dry before puncture.
In adults avoid the femoral vein; use ultrasound guidance for insertion.
Disinfect the hub or needleless connector before every access.
Chlorhexidine dressing (patients >2 months); change transparent dressings every 7 days, gauze every 2, or sooner if soiled, damp or loose.
In the ICU, daily chlorhexidine bathing (patients >2 months).
Review the need daily; remove the catheter as soon as it is no longer essential.$q$, $q$Πηγές: SHEA/IDSA/APIC – Strategies to prevent CLABSI in acute-care hospitals: 2022 Update (Buetti et al., ICHE 2022;43:553-569) (2022)· CDC/HICPAC – Guidelines for the Prevention of Intravascular Catheter-Related Infections (O'Grady et al.) (2011)$q$, $q$Sources: SHEA/IDSA/APIC – Strategies to prevent CLABSI in acute-care hospitals: 2022 Update (Buetti et al., ICHE 2022;43:553-569) (2022); CDC/HICPAC – Guidelines for the Prevention of Intravascular Catheter-Related Infections (O'Grady et al.) (2011)$q$, array['catheters','icu','ipc','nursing']::text[], 2022, 'el', 304, 'published'
where not exists (select 1 from public.library_items where organization_id is null and kind = 'clinical_guide' and name = $q$Δέσμη μέτρων κεντρικού φλεβικού καθετήρα$q$);

insert into public.library_items (organization_id, kind, link_group, name, organisation, url, description_el, description_en, summary_el, summary_en, note_el, note_en, tags, year, language, sort_order, status)
select null, 'clinical_guide', 'international', $q$Δέσμη μέτρων ουροκαθετήρα$q$, $q$SHEA/IDSA/APIC · CDC$q$, $q$https://pmc.ncbi.nlm.nih.gov/articles/PMC11287483/$q$, $q$Ένδειξη, άσηπτη τοποθέτηση, φροντίδα και έγκαιρη αφαίρεση του ουροκαθετήρα για την πρόληψη της ουρολοίμωξης (CAUTI).$q$, $q$Indication, aseptic insertion, care and timely removal of the urinary catheter to prevent catheter-associated UTI (CAUTI).$q$, $q$Ουροκαθετήρας μόνο με ένδειξη (π.χ. οξεία επίσχεση, ακριβής διούρηση σε βαρέως πάσχοντα, επιλεγμένες επεμβάσεις)· όχι για τη διαχείριση της ακράτειας.
Εξετάστε εναλλακτικές: διαλείπων καθετηριασμός, εξωτερικός καθετήρας, έλεγχος υπολειπόμενων ούρων με υπερηχογράφο κύστης.
Άσηπτη τοποθέτηση από εκπαιδευμένο προσωπικό, με αποστειρωμένα γάντια, πεδίο και λιπαντικό μίας χρήσης· όσο το δυνατόν μικρότερη διάμετρος.
Στερέωση του καθετήρα και κλειστό σύστημα παροχέτευσης· αν ανοίξει ή διαρρεύσει, αλλάζουν καθετήρας και ουροσυλλέκτης με άσηπτη τεχνική.
Ο ουροσυλλέκτης πάντα κάτω από το επίπεδο της κύστης, ποτέ στο πάτωμα· σωλήνες χωρίς αναδιπλώσεις.
Άδειασμα τακτικά σε καθαρό δοχείο ανά ασθενή, χωρίς επαφή της βαλβίδας με το δοχείο.
Καθαριότητα του στομίου της ουρήθρας στο καθημερινό λουτρό· όχι αντισηπτικά, όχι αλλαγή καθετήρα σε σταθερά διαστήματα.
Καθημερινή αξιολόγηση της ανάγκης· αφαίρεση το συντομότερο (μετεγχειρητικά κατά προτίμηση εντός 24 ωρών), με νοσηλευτικό πρωτόκολλο αφαίρεσης.$q$, $q$Catheter only with an indication (e.g. acute retention, accurate output in the critically ill, selected surgery); not to manage incontinence.
Consider alternatives: intermittent catheterisation, external catheter, bladder scanner for residual volume.
Aseptic insertion by trained staff, with sterile gloves, drape and single-use lubricant; the smallest suitable bore.
Secure the catheter and keep the drainage system closed; if it is opened or leaks, replace catheter and bag aseptically.
Keep the bag below bladder level at all times, never on the floor; no kinks in the tubing.
Empty regularly into a clean container per patient, without the spigot touching the container.
Clean the meatus during daily bathing; no antiseptics, no catheter changes at fixed intervals.
Review the need daily; remove as soon as possible (post-op preferably within 24 hours), using a nurse-driven removal protocol.$q$, $q$Πηγές: SHEA/IDSA/APIC – Strategies to prevent CAUTI in acute-care hospitals: 2022 Update (Patel et al., ICHE 2023;44:1209-1231) (2023)· CDC/HICPAC – Guideline for Prevention of Catheter-Associated Urinary Tract Infections (2009)$q$, $q$Sources: SHEA/IDSA/APIC – Strategies to prevent CAUTI in acute-care hospitals: 2022 Update (Patel et al., ICHE 2023;44:1209-1231) (2023); CDC/HICPAC – Guideline for Prevention of Catheter-Associated Urinary Tract Infections (2009)$q$, array['catheters','ipc','nursing']::text[], 2023, 'el', 305, 'published'
where not exists (select 1 from public.library_items where organization_id is null and kind = 'clinical_guide' and name = $q$Δέσμη μέτρων ουροκαθετήρα$q$);

insert into public.library_items (organization_id, kind, link_group, name, organisation, url, description_el, description_en, summary_el, summary_en, note_el, note_en, tags, year, language, sort_order, status)
select null, 'clinical_guide', 'international', $q$Πρόληψη πνευμονίας σχετιζόμενης με αναπνευστήρα$q$, $q$SHEA/IDSA/APIC$q$, $q$https://pmc.ncbi.nlm.nih.gov/articles/PMC10903147/$q$, $q$Βασικά μέτρα σε διασωληνωμένους ενήλικες για την πρόληψη της πνευμονίας από αναπνευστήρα (VAP) στη ΜΕΘ.$q$, $q$Essential measures for intubated adults to prevent ventilator-associated pneumonia (VAP) in the ICU.$q$, $q$Αποφυγή διασωλήνωσης και επαναδιασωλήνωσης όπου είναι ασφαλές: οξυγόνο υψηλής ροής ή μη επεμβατικός αερισμός.
Ελάχιστη δυνατή καταστολή με πρωτόκολλο· αποφυγή βενζοδιαζεπινών.
Καθημερινή διακοπή καταστολής μαζί με δοκιμή αυτόματης αναπνοής για έγκαιρη αποσωλήνωση.
Ανύψωση της κεφαλής του κρεβατιού στις 30–45°.
Στοματική φροντίδα με βούρτσισμα δοντιών, χωρίς χλωρεξιδίνη.
Πρώιμη κινητοποίηση και άσκηση.
Αλλαγή κυκλώματος αναπνευστήρα μόνο αν είναι εμφανώς λερωμένο ή δυσλειτουργεί.
Επιπλέον μέτρο: τραχειοσωλήνας με αναρρόφηση υπογλωττιδικών εκκρίσεων όταν αναμένεται διασωλήνωση >48–72 ωρών.$q$, $q$Avoid intubation and reintubation where safe: high-flow nasal oxygen or non-invasive ventilation.
Minimise sedation with a protocol; avoid benzodiazepines.
Daily sedation interruption paired with a spontaneous breathing trial for timely extubation.
Elevate the head of the bed to 30–45°.
Oral care with toothbrushing, without chlorhexidine.
Early exercise and mobilisation.
Change the ventilator circuit only if visibly soiled or malfunctioning.
Additional measure: endotracheal tube with subglottic secretion drainage when intubation >48–72 hours is expected.$q$, $q$Πηγές: SHEA/IDSA/APIC – Strategies to prevent VAP, VAE and NV-HAP in acute-care hospitals: 2022 Update (Klompas et al., ICHE 2022;43:687-713) (2022)$q$, $q$Sources: SHEA/IDSA/APIC – Strategies to prevent VAP, VAE and NV-HAP in acute-care hospitals: 2022 Update (Klompas et al., ICHE 2022;43:687-713) (2022)$q$, array['icu','ipc','nursing']::text[], 2022, 'el', 306, 'published'
where not exists (select 1 from public.library_items where organization_id is null and kind = 'clinical_guide' and name = $q$Πρόληψη πνευμονίας σχετιζόμενης με αναπνευστήρα$q$);

insert into public.library_items (organization_id, kind, link_group, name, organisation, url, description_el, description_en, summary_el, summary_en, note_el, note_en, tags, year, language, sort_order, status)
select null, 'clinical_guide', 'international', $q$Ασθενής με πολυανθεκτικό μικρόβιο$q$, $q$WHO · ECDC · CDC$q$, $q$https://www.who.int/publications/i/item/9789241550178$q$, $q$Άμεσες ενέργειες όταν απομονωθεί CRE/KPC, A. baumannii ή P. aeruginosa ανθεκτικά στις καρβαπενέμες ή C. auris: απομόνωση και ενημέρωση.$q$, $q$Immediate steps when CRE/KPC, carbapenem-resistant A. baumannii or P. aeruginosa, or C. auris is isolated: isolation and notification.$q$, $q$Ενημερώστε αμέσως τον θεράποντα και την Ομάδα Ελέγχου Λοιμώξεων μόλις ειδοποιήσει το εργαστήριο.
Προφυλάξεις επαφής χωρίς καθυστέρηση: γάντια και ποδιά, αυστηρή υγιεινή χεριών, αποκλειστικός εξοπλισμός.
Μονόκλινος θάλαμος ή κοινή νοσηλεία μόνο με ασθενείς με το ίδιο μικρόβιο· για C. auris και αποκλειστικό νοσηλευτικό προσωπικό όπου είναι εφικτό.
Εντατικός καθημερινός και τελικός καθαρισμός του θαλάμου· για C. auris απολυμαντικό με αποδεδειγμένη δράση έναντι του μύκητα.
Καλλιέργειες επιτήρησης (π.χ. ορθικό επίχρισμα) στους ασθενείς υψηλού κινδύνου, σύμφωνα με το πρωτόκολλο του νοσοκομείου.
Για C. auris: έλεγχος φορείας των στενών επαφών και διερεύνηση του κρούσματος.
Σε μεταφορά ή διακομιδή, ενημερώστε το τμήμα ή το νοσοκομείο υποδοχής για το μικρόβιο και τα μέτρα.$q$, $q$Inform the attending physician and the Infection Prevention team as soon as the laboratory reports the result.
Contact precautions without delay: gloves and gown, strict hand hygiene, dedicated equipment.
Single room, or cohort only with patients carrying the same organism; for C. auris also dedicated nursing staff where feasible.
Enhanced daily and terminal cleaning of the room; for C. auris a disinfectant proven effective against it.
Surveillance cultures (e.g. rectal swab) of high-risk patients, according to the hospital protocol.
For C. auris: screen close contacts for carriage and investigate the case.
On transfer, inform the receiving unit or hospital of the organism and the precautions.$q$, $q$Πηγές: WHO – Guidelines for the prevention and control of carbapenem-resistant Enterobacteriaceae, Acinetobacter baumannii and Pseudomonas aeruginosa in health care facilities (2017)· ECDC – Rapid risk assessment: Candida auris in healthcare settings – Europe (first update) (2018)· CDC – Infection Control Guidance: Candida auris (2024)$q$, $q$Sources: WHO – Guidelines for the prevention and control of carbapenem-resistant Enterobacteriaceae, Acinetobacter baumannii and Pseudomonas aeruginosa in health care facilities (2017); ECDC – Rapid risk assessment: Candida auris in healthcare settings – Europe (first update) (2018); CDC – Infection Control Guidance: Candida auris (2024)$q$, array['mdro','isolation','amr','ipc']::text[], 2017, 'el', 307, 'published'
where not exists (select 1 from public.library_items where organization_id is null and kind = 'clinical_guide' and name = $q$Ασθενής με πολυανθεκτικό μικρόβιο$q$);

insert into public.library_items (organization_id, kind, link_group, name, organisation, url, description_el, description_en, summary_el, summary_en, note_el, note_en, tags, year, language, sort_order, status)
select null, 'clinical_guide', 'greek', $q$Τραυματισμός από βελόνα ή έκθεση σε αίμα$q$, $q$ΕΟΔΥ · CDC$q$, $q$https://eody.gov.gr/hiv-aidskat-odigies-pep-20210510$q$, $q$Τι κάνει αμέσως ο επαγγελματίας υγείας μετά από τρύπημα, κόψιμο ή εκτίναξη αίματος σε βλεννογόνο ή μη ακέραιο δέρμα.$q$, $q$What a healthcare worker does immediately after a needlestick, cut, or blood splash onto mucosa or non-intact skin.$q$, $q$Πλύνετε αμέσως το τραύμα με σαπούνι και νερό· μη χρησιμοποιείτε καυστικές ουσίες.
Εκτίναξη σε μύτη, στόμα ή δέρμα: ξέπλυμα με άφθονο νερό· στα μάτια, καταιόνηση με καθαρό νερό ή φυσιολογικό ορό.
Δηλώστε αμέσως το συμβάν στον προϊστάμενο και στον υπεύθυνο του νοσοκομείου για την επαγγελματική έκθεση.
Άμεση εκτίμηση από γιατρό: είδος έκθεσης και έλεγχος του ασθενούς-πηγή για HBsAg, anti-HCV και HIV, με τη συγκατάθεσή του.
Αν χρειάζεται προφύλαξη για HIV, ξεκινά όσο το δυνατόν νωρίτερα, ιδανικά μέσα σε λίγες ώρες και όχι μετά τις 72 ώρες.
Έλεγχος του εμβολιασμού και των αντισωμάτων (anti-HBs) του εκτεθέντος για ηπατίτιδα B· εμβόλιο ή ανοσοσφαιρίνη ανάλογα με την κατάσταση.
Αρχικός ορολογικός έλεγχος του εκτεθέντος και παρακολούθηση σύμφωνα με τις οδηγίες.
Πρόληψη: μην ξανακαλύπτετε βελόνες· απόρριψη αμέσως σε δοχείο αιχμηρών.$q$, $q$Wash the wound with soap and water immediately; do not use caustic agents.
Splash to nose, mouth or skin: flush with plenty of water; eyes: irrigate with clean water or saline.
Report the incident immediately to your supervisor and to the hospital's occupational exposure lead.
Prompt medical assessment: type of exposure, and testing of the source patient for HBsAg, anti-HCV and HIV, with consent.
If HIV prophylaxis is needed, start as soon as possible, ideally within hours and not after 72 hours.
Check the exposed worker's hepatitis B vaccination and anti-HBs; vaccine or immunoglobulin according to status.
Baseline serology of the exposed worker and follow-up as per guidance.
Prevention: never recap needles; discard immediately into a sharps container.$q$, $q$Πηγές: ΕΟΔΥ – Οδηγίες για την προφύλαξη μετά από έκθεση στον HIV (PEP) (2021)· ΕΟΔΥ – Επαγγελματικός κίνδυνος για ηπατίτιδα B και C (2019)· 2025 US Public Health Service Guidelines for the Management of Occupational Exposures to HIV and Recommendations for PEP (ICHE 2025) (2025)· CDC MMWR RR-11 – Updated USPHS Guidelines for the Management of Occupational Exposures to HBV, HCV and HIV (2001)· CDC/NIOSH – Bloodborne Infectious Disease Risk Factors (2024)$q$, $q$Sources: ΕΟΔΥ – Οδηγίες για την προφύλαξη μετά από έκθεση στον HIV (PEP) (2021); ΕΟΔΥ – Επαγγελματικός κίνδυνος για ηπατίτιδα B και C (2019); 2025 US Public Health Service Guidelines for the Management of Occupational Exposures to HIV and Recommendations for PEP (ICHE 2025) (2025); CDC MMWR RR-11 – Updated USPHS Guidelines for the Management of Occupational Exposures to HBV, HCV and HIV (2001); CDC/NIOSH – Bloodborne Infectious Disease Risk Factors (2024)$q$, array['hiv','ipc','nursing']::text[], 2021, 'el', 308, 'published'
where not exists (select 1 from public.library_items where organization_id is null and kind = 'clinical_guide' and name = $q$Τραυματισμός από βελόνα ή έκθεση σε αίμα$q$);
