-- Βιβλιοθήκη: καθαρισμός των «Νέων» και διόρθωση συνδέσμων και οδηγιών της πλατφόρμας.
--
-- Νέα:
--   library_sources.link_pattern  ποιοι σύνδεσμοι μιας σελίδας-πηγής είναι άρθρα (κανονική έκφραση στη διαδρομή
--                                 του συνδέσμου)· χωρίς αυτό, κάθε σύνδεσμος με τίτλο (και τα μενού του site).
--   library_news.listed_at        η ημερομηνία της λίστας: της δημοσίευσης ή, όταν η πηγή δεν δίνει, του εντοπισμού.
--   Πηγές: το «CDC · EID ahead of print» (ερευνητικά άρθρα, όχι νέα) σταματά· ο ΕΟΔΥ αρνείται την αυτόματη
--   ανάγνωση (403), οπότε σταματά και μένει ως σύνδεσμος.
-- Σύνδεσμοι: όσοι μετακόμισαν παίρνουν τη νέα διεύθυνση· όσοι δεν υπάρχουν πια αρχειοθετούνται (δεν σβήνονται).
-- Οδηγίες: η σελίδα κάθε οδηγίας (όχι η αρχική του φορέα), περιγραφή και σύνοψη ΕΛ/ΕΝ, νεότερη έκδοση όπου υπάρχει.

alter table public.library_sources add column if not exists link_pattern text;
alter table public.library_news add column if not exists listed_at timestamptz generated always as (coalesce(published_at, detected_at)) stored;
create index if not exists library_news_listed_idx on public.library_news (listed_at desc);

update public.library_sources set active = false, updated_at = now() where url = 'https://wwwnc.cdc.gov/eid/rss/ahead-of-print.xml';
update public.library_sources set active = false, updated_at = now() where url = 'https://eody.gov.gr/feed/';
update public.library_sources set link_pattern = '^/mmwr/volumes/', updated_at = now() where url = 'https://www.cdc.gov/mmwr/index.html';
update public.library_sources set link_pattern = '-p[0-9]+\.html$', updated_at = now() where url = 'https://www.eeel.gr/1/katefthyntiries-odigies-c4.html';
update public.library_sources set link_pattern = '^/nea/deltia_tipou/', updated_at = now() where url = 'https://www.enne.gr';

update public.library_items set url = 'https://ipac-canada.org', updated_at = now() where organization_id is null and kind = 'link' and url = 'https://www.chica.org';
update public.library_items set url = 'https://www.cna-aiic.ca/en', updated_at = now() where organization_id is null and kind = 'link' and url = 'https://www.cna-nurses.ca';
update public.library_items set url = 'https://journals.rcni.com/nursing-standard', updated_at = now() where organization_id is null and kind = 'link' and url = 'https://www.nursing-standard.co.uk';
update public.library_items set url = 'https://www.esne.gr', name = 'Εθνικός Σύνδεσμος Νοσηλευτών Ελλάδος', abbreviation = 'ΕΣΝΕ', updated_at = now() where organization_id is null and kind = 'link' and url = 'https://www.esdne.gr';
update public.library_items set status = 'archived', updated_at = now() where organization_id is null and kind = 'link' and url in ('http://www.icna.co.uk','http://www.sarswatch.ca','http://www.nmap.ac.uk','http://www.rcna.org.au','https://www.aidshellas.gr');

update public.library_items set url = $q$https://www.sccm.org/clinical-resources/guidelines/guidelines/surviving-sepsis-campaign-international-guidelines-for-management-of-sepsis-and-septic-shock-2026$q$, description_el = $q$Διεθνείς οδηγίες SCCM και ESICM για τη σήψη και τη σηπτική καταπληξία σε ενήλικες, έκδοση 2026 με 129 δηλώσεις.$q$, description_en = $q$SCCM and ESICM international guidelines for sepsis and septic shock in adults, 2026 edition with 129 statements.$q$, summary_el = $q$Διαλογή ενηλίκων με NEWS/NEWS2, MEWS ή SIRS αντί για qSOFA μόνο του.
Αντιμικροβιακά το συντομότερο, ιδανικά εντός 1 ώρας, σε πιθανή ή βέβαιη σήψη ή σηπτική καταπληξία.
Τουλάχιστον 30 ml/kg ενδοφλέβια κρυσταλλοειδή τις πρώτες 3 ώρες σε υποάρδευση ή σηπτική καταπληξία.
Έλεγχος εστίας ιδανικά εντός 6 ωρών από τη διάγνωση.
Όχι εμπειρική αντιμυκητιασική αγωγή ως ρουτίνα· έμφαση στην ορθή χρήση αντιμικροβιακών.$q$, summary_en = $q$Screen adults with NEWS/NEWS2, MEWS or SIRS rather than qSOFA alone.
Antimicrobials as soon as possible, ideally within 1 hour, for probable or definite sepsis or septic shock.
At least 30 ml/kg IV crystalloid in the first 3 hours for hypoperfusion or septic shock.
Source control ideally within 6 hours of diagnosis.
No routine empirical antifungal therapy; emphasis on antimicrobial stewardship.$q$, year = 2026, name = $q$Surviving Sepsis Campaign: International Guidelines for Management of Sepsis and Septic Shock 2026$q$, updated_at = now()
  where organization_id is null and kind = 'guideline' and name = $q$Surviving Sepsis Campaign: International Guidelines for Management of Sepsis and Septic Shock 2021$q$;

update public.library_items set url = $q$https://www.who.int/publications/i/item/9789241597906$q$, description_el = $q$Οι οδηγίες του ΠΟΥ για την υγιεινή των χεριών στους χώρους υγείας, με τις 5 Στιγμές και την πολυπαραγοντική στρατηγική.$q$, description_en = $q$WHO guidelines on hand hygiene in health care, with the 5 Moments and the multimodal improvement strategy.$q$, summary_el = $q$Οι «5 Στιγμές»: πριν την επαφή με τον ασθενή, πριν από άσηπτη εργασία, μετά από κίνδυνο έκθεσης σε βιολογικά υγρά, μετά την επαφή με τον ασθενή, μετά την επαφή με το περιβάλλον του.
Αλκοολούχο αντισηπτικό ως πρώτη επιλογή όταν τα χέρια δεν είναι εμφανώς λερωμένα.
Πλύσιμο με νερό και σαπούνι όταν τα χέρια είναι εμφανώς λερωμένα ή υπάρχει υποψία έκθεσης σε σπορογόνα (π.χ. C. difficile).
Τα γάντια δεν αντικαθιστούν την υγιεινή των χεριών.
Πολυπαραγοντική στρατηγική: αλλαγή συστήματος, εκπαίδευση, παρακολούθηση με ανατροφοδότηση, υπενθυμίσεις, κουλτούρα ασφάλειας.$q$, summary_en = $q$The 5 Moments: before touching a patient, before a clean/aseptic procedure, after body fluid exposure risk, after touching a patient, after touching patient surroundings.
Alcohol-based handrub is preferred when hands are not visibly soiled.
Wash with soap and water when hands are visibly soiled or exposure to spore-formers (e.g. C. difficile) is suspected.
Gloves do not replace hand hygiene.
Multimodal strategy: system change, training, monitoring with feedback, reminders, institutional safety climate.$q$, year = 2009, updated_at = now()
  where organization_id is null and kind = 'guideline' and name = $q$WHO Guidelines on Hand Hygiene in Health Care$q$;

update public.library_items set url = $q$https://www.who.int/publications/i/item/9789241549929$q$, description_el = $q$Οι πρώτες τεκμηριωμένες διεθνείς οδηγίες του ΠΟΥ για τα 8 βασικά στοιχεία ενός προγράμματος πρόληψης λοιμώξεων.$q$, description_en = $q$WHO's first evidence-based international guidelines on the 8 core components of an IPC programme.$q$, summary_el = $q$Οκτώ βασικά στοιχεία: πρόγραμμα IPC, οδηγίες, εκπαίδευση, επιτήρηση λοιμώξεων, πολυπαραγοντικές στρατηγικές, έλεγχος και ανατροφοδότηση, φόρτος εργασίας-στελέχωση-πληρότητα κλινών, υποδομές και εξοπλισμός.
11 συστάσεις και 3 δηλώσεις καλής πρακτικής, για εθνικό επίπεδο και για νοσοκομεία.
Σε κάθε νοσοκομείο, ενεργό πρόγραμμα IPC με ειδικά εκπαιδευμένη ομάδα και σαφείς στόχους.
Τακτικός έλεγχος των πρακτικών με έγκαιρη ανατροφοδότηση στο προσωπικό και τη διοίκηση.
Η πληρότητα δεν πρέπει να ξεπερνά τον τυπικό αριθμό κλινών· επαρκής στελέχωση ανάλογα με τον φόρτο.$q$, summary_en = $q$Eight core components: IPC programme, guidelines, education and training, HAI surveillance, multimodal strategies, monitoring/audit and feedback, workload-staffing-bed occupancy, built environment and equipment.
11 recommendations and 3 good practice statements, at national and facility level.
Every acute facility should have an active IPC programme with a dedicated trained team and clear objectives.
Regular audit of practices with timely feedback to staff and management.
Bed occupancy should not exceed standard capacity; staffing matched to workload.$q$, year = 2016, updated_at = now()
  where organization_id is null and kind = 'guideline' and name = $q$Guidelines on core components of infection prevention and control programmes at the national and acute health care facility level$q$;

update public.library_items set url = $q$https://www.who.int/publications/i/item/9789241550475$q$, description_el = $q$Οι παγκόσμιες οδηγίες του ΠΟΥ για την πρόληψη της λοίμωξης χειρουργικού πεδίου, 2η έκδοση: 29 συστάσεις σε 23 θέματα.$q$, description_en = $q$WHO global guidelines for preventing surgical site infection, 2nd edition: 29 recommendations on 23 topics.$q$, summary_el = $q$29 συστάσεις για την προεγχειρητική, διεγχειρητική και μετεγχειρητική περίοδο, από 28 συστηματικές ανασκοπήσεις.
Όχι αφαίρεση τριχών· αν χρειάζεται, μόνο με κουρευτική μηχανή, όχι ξυράφι.
Αντιμικροβιακή προφύλαξη εντός 120 λεπτών πριν την τομή και όχι παράταση μετά το τέλος της επέμβασης.
Αντισηψία δέρματος με αλκοολούχο διάλυμα χλωρεξιδίνης.
Αποαποικισμός με μουπιροσίνη (± πλύση χλωρεξιδίνης) σε γνωστούς ρινικούς φορείς S. aureus σε καρδιοθωρακοχειρουργικές και ορθοπαιδικές επεμβάσεις.$q$, summary_en = $q$29 recommendations across the pre-, intra- and postoperative periods, based on 28 systematic reviews.
Do not remove hair; if necessary, use clippers only, never razors.
Surgical antibiotic prophylaxis within 120 minutes before incision, not prolonged after the operation.
Skin preparation with alcohol-based chlorhexidine.
Mupirocin (± chlorhexidine body wash) decolonisation for known S. aureus nasal carriers in cardiothoracic and orthopaedic surgery.$q$, year = 2018, updated_at = now()
  where organization_id is null and kind = 'guideline' and name = $q$Global guidelines for the prevention of surgical site infection$q$;

update public.library_items set url = $q$https://www.who.int/publications/i/item/9789241550178$q$, description_el = $q$Οι πρώτες παγκόσμιες οδηγίες του ΠΟΥ για την πρόληψη και τον έλεγχο των CRE, CRAB και CRPsA στα νοσοκομεία.$q$, description_en = $q$WHO's first global guidelines on preventing and controlling CRE, CRAB and CRPsA in health care facilities.$q$, summary_el = $q$Οκτώ συστάσεις, με πρώτη την πολυπαραγοντική στρατηγική πρόληψης και ελέγχου.
Ενεργό πρόγραμμα IPC και αυστηρή τήρηση της υγιεινής των χεριών.
Επιτήρηση λοιμώξεων και αποικισμού, με καλλιέργειες επιτήρησης για ασυμπτωματικούς φορείς.
Προφυλάξεις επαφής και απομόνωση σε μονόκλινο ή ομαδοποίηση φορέων.
Τακτικός καθαρισμός του περιβάλλοντος του ασθενή και, κατά περίπτωση, καλλιέργειες περιβάλλοντος.$q$, summary_en = $q$Eight recommendations, the first being a multimodal IPC strategy.
An active IPC programme and strict hand hygiene compliance.
Surveillance of infection and colonisation, with surveillance cultures for asymptomatic carriage.
Contact precautions and isolation in single rooms or cohorting.
Regular cleaning of the patient environment and, where indicated, environmental surveillance cultures.$q$, year = 2017, updated_at = now()
  where organization_id is null and kind = 'guideline' and name = $q$Guidelines for the prevention and control of carbapenem-resistant Enterobacteriaceae, Acinetobacter baumannii and Pseudomonas aeruginosa in health care facilities$q$;

update public.library_items set url = $q$https://www.who.int/publications/i/item/9789240062382$q$, description_el = $q$Πρακτικός οδηγός του ΠΟΥ για την εμπειρική αντιβιοτική αγωγή πάνω από 30 συχνών λοιμώξεων με την κατάταξη AWaRe.$q$, description_en = $q$WHO practical guide to empirical antibiotic treatment of over 30 common infections using the AWaRe classification.$q$, summary_el = $q$Επιλογή αντιβιοτικού, δόση, οδός και διάρκεια για περισσότερες από 30 συχνές λοιμώξεις σε ενήλικες και παιδιά.
Κατάταξη Access (πρώτη επιλογή), Watch (περιορισμένες ενδείξεις) και Reserve (έσχατη λύση).
Ρητή καθοδήγηση για τις περιπτώσεις όπου δεν χρειάζεται αντιβιοτικό.
Ευθυγραμμίζεται με τους Πρότυπους Καταλόγους Βασικών Φαρμάκων του ΠΟΥ.
Συνοδεύεται από συνοπτικά infographics και δωρεάν εφαρμογή.$q$, summary_en = $q$Antibiotic choice, dose, route and duration for more than 30 common infections in adults and children.
Access (first choice), Watch (limited indications) and Reserve (last resort) groups.
Explicit guidance on when no antibiotic is needed.
Aligned with the WHO Model Lists of Essential Medicines.
Accompanied by summary infographics and a free app.$q$, year = 2022, updated_at = now()
  where organization_id is null and kind = 'guideline' and name = $q$The WHO AWaRe (Access, Watch, Reserve) antibiotic book$q$;

update public.library_items set url = $q$https://www.cdc.gov/infection-control/hcp/isolation-precautions/index.html$q$, description_el = $q$Οι οδηγίες CDC/HICPAC για τις βασικές προφυλάξεις και τις προφυλάξεις ανάλογα με τον τρόπο μετάδοσης σε όλους τους χώρους υγείας.$q$, description_en = $q$CDC/HICPAC guideline on Standard Precautions and transmission-based precautions across all healthcare settings.$q$, summary_el = $q$Βασικές προφυλάξεις για όλους τους ασθενείς, μαζί με υγιεινή αναπνοής, ασφαλείς ενέσεις και μάσκα σε οσφυονωτιαία παρακέντηση.
Τρεις κατηγορίες προφυλάξεων μετάδοσης: επαφής, σταγονιδίων, αερογενούς.
Παράρτημα Α: είδος και διάρκεια προφυλάξεων ανά μικροοργανισμό και κλινική εικόνα.
Προτεινόμενη σειρά εφαρμογής και αφαίρεσης του ατομικού εξοπλισμού προστασίας.
Προστατευτικό περιβάλλον για λήπτες αλλογενούς μεταμόσχευσης αιμοποιητικών κυττάρων.$q$, summary_en = $q$Standard Precautions for all patients, including respiratory hygiene, safe injection practices and masks for lumbar puncture.
Three transmission-based categories: Contact, Droplet, Airborne.
Appendix A: type and duration of precautions by infectious agent and condition.
Recommended sequence for donning and removing PPE.
Protective Environment for allogeneic haematopoietic stem cell transplant recipients.$q$, year = 2007, updated_at = now()
  where organization_id is null and kind = 'guideline' and name = $q$Guideline for Isolation Precautions: Preventing Transmission of Infectious Agents in Healthcare Settings$q$;

update public.library_items set url = $q$https://www.cdc.gov/infection-control/hcp/intravascular-catheter-related-infection/index.html$q$, description_el = $q$Οι οδηγίες CDC/HICPAC για την πρόληψη των λοιμώξεων από ενδαγγειακούς καθετήρες, με την ενημέρωση του 2017.$q$, description_en = $q$CDC/HICPAC guideline for preventing intravascular catheter-related infections, with the 2017 update.$q$, summary_el = $q$Εκπαίδευση και εκπαίδευση επανάληψης του προσωπικού που τοποθετεί και φροντίζει καθετήρες.
Μέγιστα μέτρα άσηπτης τεχνικής κατά την τοποθέτηση κεντρικού φλεβικού καθετήρα.
Αντισηψία δέρματος με χλωρεξιδίνη >0,5% σε αλκοόλη.
Όχι προγραμματισμένη αλλαγή κεντρικών καθετήρων ως ρουτίνα· αφαίρεση όταν δεν χρειάζονται πλέον.
Δέσμες μέτρων με καταγραφή της συμμόρφωσης ως δείκτη ποιότητας· επιθέματα με χλωρεξιδίνη σε μη σηραγγοποιημένους καθετήρες ενηλίκων (2017).$q$, summary_en = $q$Education and training of staff who insert and maintain catheters.
Maximal sterile barrier precautions during central venous catheter insertion.
Skin antisepsis with >0.5% chlorhexidine in alcohol.
No routine scheduled replacement of central lines; remove when no longer needed.
Bundles with compliance tracked as a quality benchmark; chlorhexidine dressings for non-tunnelled CVCs in adults (2017).$q$, year = 2011, updated_at = now()
  where organization_id is null and kind = 'guideline' and name = $q$Guidelines for the Prevention of Intravascular Catheter-Related Infections$q$;

update public.library_items set url = $q$https://www.cdc.gov/infection-control/hcp/cauti/index.html$q$, description_el = $q$Οι οδηγίες CDC/HICPAC για την πρόληψη των ουρολοιμώξεων που σχετίζονται με καθετήρα κύστεως.$q$, description_en = $q$CDC/HICPAC guideline for preventing catheter-associated urinary tract infections.$q$, summary_el = $q$Καθετήρας μόνο για κατάλληλες ενδείξεις και αφαίρεση το συντομότερο δυνατό.
Ελαχιστοποίηση της χρήσης ιδίως σε γυναίκες, ηλικιωμένους και ανοσοκατεσταλμένους.
Τοποθέτηση με άσηπτη τεχνική και αποστειρωμένο εξοπλισμό.
Κλειστό σύστημα παροχέτευσης, ασκός κάτω από το επίπεδο της κύστης, ανεμπόδιστη ροή.
Εξέταση εναλλακτικών λύσεων, όπως διαλείπων καθετηριασμός ή εξωτερικός καθετήρας.$q$, summary_en = $q$Use catheters only for appropriate indications and remove as soon as possible.
Minimise use especially in women, the elderly and immunocompromised patients.
Insert with aseptic technique and sterile equipment.
Closed drainage system, bag below bladder level, unobstructed flow.
Consider alternatives such as intermittent or external catheterisation.$q$, year = 2009, updated_at = now()
  where organization_id is null and kind = 'guideline' and name = $q$Guideline for Prevention of Catheter-Associated Urinary Tract Infections$q$;

update public.library_items set url = $q$https://www.cdc.gov/infection-control/hcp/disinfection-and-sterilization/index.html$q$, description_el = $q$Οι οδηγίες CDC/HICPAC για τον καθαρισμό, την απολύμανση και την αποστείρωση ιατροτεχνολογικών προϊόντων και του περιβάλλοντος.$q$, description_en = $q$CDC/HICPAC guideline on cleaning, disinfection and sterilization of patient-care devices and the environment.$q$, summary_el = $q$Ταξινόμηση Spaulding: κρίσιμα, ημικρίσιμα και μη κρίσιμα αντικείμενα.
Επιμελής καθαρισμός πριν από κάθε απολύμανση ή αποστείρωση.
Τα κρίσιμα αντικείμενα αποστειρώνονται· τα ημικρίσιμα χρειάζονται τουλάχιστον απολύμανση υψηλού επιπέδου.
Παρακολούθηση της αποστείρωσης με φυσικούς, χημικούς και βιολογικούς δείκτες.
Όχι ψεκασμός απολυμαντικού (fogging) ως ρουτίνα στους χώρους ασθενών.$q$, summary_en = $q$Spaulding classification: critical, semicritical and noncritical items.
Meticulous cleaning before any disinfection or sterilization.
Critical items are sterilized; semicritical items need at least high-level disinfection.
Monitor sterilization with mechanical, chemical and biological indicators.
No routine disinfectant fogging in patient-care areas.$q$, year = 2008, updated_at = now()
  where organization_id is null and kind = 'guideline' and name = $q$Guideline for Disinfection and Sterilization in Healthcare Facilities$q$;

update public.library_items set url = $q$https://www.cdc.gov/infection-control/hcp/environmental-control/index.html$q$, description_el = $q$Οι οδηγίες CDC/HICPAC για τον έλεγχο λοιμώξεων από αέρα, νερό, επιφάνειες και κατασκευαστικές εργασίες στα νοσοκομεία.$q$, description_en = $q$CDC/HICPAC guideline on infection control related to air, water, surfaces and construction in healthcare facilities.$q$, summary_el = $q$Εκτίμηση κινδύνου λοιμώξεων πριν από κάθε κατασκευή ή ανακαίνιση που παράγει σκόνη ή αεροζόλ νερού.
Αξιολόγηση των συστημάτων αερισμού και νερού για την επίπτωσή τους στις λοιμώξεις (π.χ. Legionella).
Όχι προγραμματισμένες περιβαλλοντικές καλλιέργειες ως ρουτίνα, εκτός ειδικών περιπτώσεων (π.χ. επιδημιολογική διερεύνηση, νερό αιμοκάθαρσης).
Στρατηγικές καθαρισμού και απολύμανσης επιφανειών, και για πολυανθεκτικά μικρόβια.$q$, summary_en = $q$Infection-control risk assessment before any construction or renovation generating dust or water aerosols.
Assess ventilation and water systems for infection impact (e.g. Legionella).
No routine environmental sampling except where epidemiologically directed or for haemodialysis water quality.
Surface cleaning and disinfection strategies, including for resistant organisms.$q$, year = 2003, updated_at = now()
  where organization_id is null and kind = 'guideline' and name = $q$Guidelines for Environmental Infection Control in Health-Care Facilities$q$;

update public.library_items set url = $q$https://www.cdc.gov/infection-control/hcp/surgical-site-infection/index.html$q$, description_el = $q$Οι οδηγίες CDC/HICPAC 2017 για την πρόληψη της λοίμωξης χειρουργικού πεδίου, βασισμένες σε συστηματική ανασκόπηση.$q$, description_en = $q$CDC/HICPAC 2017 guideline for preventing surgical site infection, based on a systematic review.$q$, summary_el = $q$Όχι επιπλέον δόσεις προφύλαξης μετά τη σύγκλειση σε καθαρές και καθαρές-μολυσμένες επεμβάσεις, ακόμη και με παροχέτευση.
Αντισηψία δέρματος με αλκοολούχο διάλυμα, εκτός αν αντενδείκνυται.
Γλυκόζη αίματος κάτω από 200 mg/dL διεγχειρητικά, σε διαβητικούς και μη.
Διατήρηση νορμοθερμίας σε όλους τους ασθενείς.
Όχι τοπικά αντιμικροβιακά στην τομή.$q$, summary_en = $q$No additional prophylactic doses after closure in clean and clean-contaminated procedures, even with a drain.
Alcohol-based skin preparation unless contraindicated.
Perioperative blood glucose below 200 mg/dL in patients with and without diabetes.
Maintain normothermia in all patients.
No topical antimicrobials on the incision.$q$, year = 2017, updated_at = now()
  where organization_id is null and kind = 'guideline' and name = $q$Guideline for the Prevention of Surgical Site Infection$q$;

update public.library_items set url = $q$https://www.idsociety.org/practice-guideline/amr-guidance/$q$, description_el = $q$Η καθοδήγηση της IDSA για τη θεραπεία λοιμώξεων από ανθεκτικά Gram-αρνητικά, έκδοση 2026· επικαιροποιείται κάθε 1–2 χρόνια.$q$, description_en = $q$IDSA guidance on treating antimicrobial-resistant Gram-negative infections, 2026 edition; updated every 1–2 years.$q$, summary_el = $q$Καλύπτει ESBL και AmpC Enterobacterales, CRE, P. aeruginosa δύσκολα θεραπεύσιμη, CRAB και S. maltophilia.
Όλα τα ερωτήματα της έκδοσης 2024 αναθεωρήθηκαν.
Αζτρεονάμη-αβιμπακτάμη για CRE που παράγουν NDM.
Σεφιδεροκόλη ως μονοθεραπεία προτιμώμενη επιλογή σε διηθητικές λοιμώξεις από S. maltophilia.
Η θεραπεία επιλέγεται με βάση τον μηχανισμό αντοχής· οι συστάσεις διατυπώνονται ως «προτείνεται».$q$, summary_en = $q$Covers ESBL and AmpC Enterobacterales, CRE, difficult-to-treat P. aeruginosa, CRAB and S. maltophilia.
Every question from the 2024 edition was revised.
Aztreonam-avibactam for NDM-producing CRE.
Cefiderocol monotherapy as preferred option for invasive S. maltophilia infections.
Treatment chosen by resistance mechanism; statements phrased as suggestions.$q$, year = 2026, updated_at = now()
  where organization_id is null and kind = 'guideline' and name = $q$IDSA Guidance on the Treatment of Antimicrobial-Resistant Gram-Negative Infections$q$;

update public.library_items set url = $q$https://www.eeel.gr/1/katefthyntiries-odigies-c4.html$q$, description_el = $q$Συλλογή κατευθυντήριων οδηγιών της Ελληνικής Εταιρείας Ελέγχου Λοιμώξεων για τον έλεγχο λοιμώξεων στα νοσοκομεία.$q$, description_en = $q$Collection of guidelines from the Hellenic Society for Infection Control on infection control in hospitals.$q$, summary_el = null, summary_en = null, updated_at = now()
  where organization_id is null and kind = 'guideline' and name = $q$Κατευθυντήριες οδηγίες ΕΕΕΛ (συλλογή)$q$;
