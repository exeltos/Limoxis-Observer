-- Demo training: a richer, but moderate, training module in the normal Demo
-- hospital (private.demo_seed_data → demo_seed_training + demo_seed_people_training).
--
-- 22 programmes over the last ~17 months plus three planned in the next
-- three months, on realistic hospital topics (hand hygiene, PPE, CLABSI,
-- waste, sharps, BLS/ALS, fire safety, GDPR, medication safety, falls,
-- patient identification, transfusion, pressure ulcers, MDRO precautions,
-- manual handling, patient-safety goals, workplace violence, anaphylaxis,
-- CAUTI), each with method, delivery kind, start time, hours, location and
-- cost. Ten have knowledge questions.
--
-- Participants are the Demo's own employees (EMP-001..). Completed
-- programmes: attended and attested participants, answers that give scores
-- of mostly 85–95 (never under the pass mark), competent, certificates
-- issued the way the app issues them ('CERT-' || assignment key), trainer
-- evaluations of 4–5, and an effectiveness evaluation (mostly effective, two
-- partial) by a fictional quality officer. Loose ends that show the
-- workflow: two answers waiting for manual review, two invitations not yet
-- answered in a running programme, participants assigned to two upcoming
-- programmes. Nothing overdue.
--
-- Keys stay as before (TRN-DEMO-001..005, TRA-DEMO-<n>-<employee>,
-- REQ-DEMO-001/002, TRAINER-FEEDBACK-DEFAULT) and every write is an upsert on
-- them, so the seed can run again on a Demo that already has the old five
-- programmes: the old rows are brought to the new content in place, the new
-- ones are added. No e-mail, notification or access token is created.
-- Same signatures and grants; private.demo_seed_data is unchanged.

-- The knowledge questions of the Demo programmes (compact: required, correct,
-- model answer and manual review only when they differ from the default) and
-- for each one the patterns of questions a participant gets wrong (pattern =
-- (g*5 + n) mod count, g the employee number, n the programme number).
create or replace function private.demo_training_questions()
returns table(program_key text, questions jsonb, patterns jsonb)
language sql immutable set search_path = ''
as $function$
  select * from (values
    ('TRN-DEMO-001', '[{"id":"Q-001","type":"single_choice","text":"Πότε εφαρμόζεται υγιεινή χεριών πριν από άσηπτη πράξη;","points":5,"options":[{"id":"Q-001-O1","text":"Μόνο όταν δεν φοράμε γάντια"},{"id":"Q-001-O2","text":"Αμέσως πριν από κάθε άσηπτη πράξη","correct":true},{"id":"Q-001-O3","text":"Μόνο μετά την επαφή με τον ασθενή"},{"id":"Q-001-O4","text":"Μία φορά στην αρχή της βάρδιας"}]},{"id":"Q-002","type":"true_false","text":"Τα γάντια αντικαθιστούν την υγιεινή χεριών.","points":5,"correctBoolean":false},{"id":"Q-003","type":"multiple_choice","text":"Ποιες από τις παρακάτω είναι «στιγμές» του WHO για την υγιεινή χεριών;","points":5,"options":[{"id":"Q-003-O1","text":"Πριν από την επαφή με τον ασθενή","correct":true},{"id":"Q-003-O2","text":"Μετά από έκθεση σε βιολογικά υγρά","correct":true},{"id":"Q-003-O3","text":"Πριν από την είσοδο στο γραφείο προσωπικού"},{"id":"Q-003-O4","text":"Μετά την επαφή με το περιβάλλον του ασθενούς","correct":true}]},{"id":"Q-004","type":"single_choice","text":"Πόσο διαρκεί η σωστή εντριβή με αλκοολούχο αντισηπτικό;","points":5,"options":[{"id":"Q-004-O1","text":"5–10 δευτερόλεπτα"},{"id":"Q-004-O2","text":"20–30 δευτερόλεπτα","correct":true},{"id":"Q-004-O3","text":"40–60 δευτερόλεπτα"},{"id":"Q-004-O4","text":"2 λεπτά"}]},{"id":"Q-005","type":"true_false","text":"Σε λοίμωξη από Clostridioides difficile προτιμάται πλύσιμο με νερό και σαπούνι.","points":3,"correctBoolean":true},{"id":"Q-006","type":"single_choice","text":"Πόσο διαρκεί το πλύσιμο χεριών με νερό και σαπούνι;","points":2,"options":[{"id":"Q-006-O1","text":"10–15 δευτερόλεπτα"},{"id":"Q-006-O2","text":"20–30 δευτερόλεπτα"},{"id":"Q-006-O3","text":"40–60 δευτερόλεπτα","correct":true},{"id":"Q-006-O4","text":"3 λεπτά"}]},{"id":"Q-007","type":"free_text","text":"Περιγράψτε σε μία πρόταση πότε αλλάζετε γάντια στον ίδιο ασθενή.","points":0,"modelAnswer":"Όταν μετακινούμαι από μολυσμένη σε καθαρή περιοχή του σώματος του ίδιου ασθενούς."}]'::jsonb, '[[],["Q-006"],["Q-005"],["Q-006"],["Q-005"],["Q-006"],["Q-005"],["Q-004"]]'::jsonb),
    ('TRN-DEMO-002', '[{"id":"Q-101","type":"single_choice","text":"Ποια είναι η σωστή σειρά ένδυσης ΜΑΠ;","points":5,"options":[{"id":"Q-101-O1","text":"Γάντια → ποδιά → μάσκα → γυαλιά"},{"id":"Q-101-O2","text":"Ποδιά → μάσκα → γυαλιά → γάντια","correct":true},{"id":"Q-101-O3","text":"Μάσκα → γάντια → ποδιά → γυαλιά"},{"id":"Q-101-O4","text":"Γυαλιά → γάντια → μάσκα → ποδιά"}]},{"id":"Q-102","type":"true_false","text":"Η μάσκα FFP2 απαιτείται σε διαδικασίες που παράγουν αερολύματα.","points":3,"correctBoolean":true},{"id":"Q-103","type":"multiple_choice","text":"Ποιοι μικροοργανισμοί απαιτούν προφυλάξεις επαφής;","points":5,"options":[{"id":"Q-103-O1","text":"CPE / KPC","correct":true},{"id":"Q-103-O2","text":"MRSA","correct":true},{"id":"Q-103-O3","text":"Mycobacterium tuberculosis"},{"id":"Q-103-O4","text":"Clostridioides difficile","correct":true}]},{"id":"Q-104","type":"true_false","text":"Τα γάντια αφαιρούνται τελευταία, μετά τη μάσκα.","points":2,"correctBoolean":false},{"id":"Q-106","type":"single_choice","text":"Πότε φοριέται μάσκα FFP2 αντί για χειρουργική μάσκα;","points":3,"options":[{"id":"Q-106-O1","text":"Σε κάθε επαφή με ασθενή"},{"id":"Q-106-O2","text":"Σε προφυλάξεις αερογενούς μετάδοσης και σε διαδικασίες που παράγουν αερόλυμα","correct":true},{"id":"Q-106-O3","text":"Μόνο στο χειρουργείο"},{"id":"Q-106-O4","text":"Μόνο όταν ο ασθενής έχει πυρετό"}]},{"id":"Q-107","type":"true_false","text":"Η υγιεινή χεριών γίνεται και μετά την αφαίρεση των γαντιών.","points":2,"correctBoolean":true},{"id":"Q-105","type":"free_text","text":"Αναφέρετε ένα σημείο προσοχής κατά την αφαίρεση της ποδιάς.","points":0,"modelAnswer":"Αναδιπλώνεται με τη μολυσμένη πλευρά προς τα μέσα, χωρίς επαφή με τη στολή."}]'::jsonb, '[[],["Q-104"],["Q-107"],["Q-102"],["Q-106"],["Q-104"],["Q-102"]]'::jsonb),
    ('TRN-DEMO-003', '[{"id":"Q-201","type":"single_choice","text":"Ποιο αντισηπτικό προτιμάται για την προετοιμασία του δέρματος πριν από τοποθέτηση CVC;","points":4,"options":[{"id":"Q-201-O1","text":"Ποβιδόνη ιωδίνη 10%"},{"id":"Q-201-O2","text":"Χλωρεξιδίνη > 0,5% σε αλκοόλη","correct":true},{"id":"Q-201-O3","text":"Αλκοόλη 70% μόνη"},{"id":"Q-201-O4","text":"Φυσιολογικός ορός"}]},{"id":"Q-202","type":"multiple_choice","text":"Ποια στοιχεία περιλαμβάνει το bundle τοποθέτησης CVC;","points":5,"options":[{"id":"Q-202-O1","text":"Υγιεινή χεριών","correct":true},{"id":"Q-202-O2","text":"Πλήρη μέτρα άσηπτης τεχνικής (maximal barrier)","correct":true},{"id":"Q-202-O3","text":"Αποφυγή μηριαίας φλέβας σε ενήλικες","correct":true},{"id":"Q-202-O4","text":"Προφυλακτική χορήγηση αντιβιοτικού"}]},{"id":"Q-203","type":"true_false","text":"Η ανάγκη διατήρησης της κεντρικής γραμμής επανεκτιμάται καθημερινά.","points":2,"correctBoolean":true},{"id":"Q-204","type":"single_choice","text":"Κάθε πότε αλλάζει ένα διαφανές επίθεμα CVC, εφόσον είναι ακέραιο;","points":4,"options":[{"id":"Q-204-O1","text":"Κάθε 24 ώρες"},{"id":"Q-204-O2","text":"Κάθε 48 ώρες"},{"id":"Q-204-O3","text":"Κάθε 7 ημέρες","correct":true},{"id":"Q-204-O4","text":"Μόνο κατά την αφαίρεση"}]},{"id":"Q-205","type":"true_false","text":"Τα σημεία πρόσβασης (hubs) δεν χρειάζονται απολύμανση όταν χρησιμοποιούνται συχνά.","points":2,"correctBoolean":false},{"id":"Q-206","type":"single_choice","text":"Ποιος δείκτης μετρά τη συχνότητα CLABSI;","points":3,"options":[{"id":"Q-206-O1","text":"Επεισόδια ανά 100 εισαγωγές"},{"id":"Q-206-O2","text":"Επεισόδια ανά 1.000 ημέρες κεντρικής γραμμής","correct":true},{"id":"Q-206-O3","text":"Επεισόδια ανά κλίνη"},{"id":"Q-206-O4","text":"Επεισόδια ανά μήνα"}]},{"id":"Q-207","type":"free_text","text":"Τι κάνετε αν το επίθεμα είναι υγρό ή αποκολλημένο;","points":0,"modelAnswer":"Αλλάζω άμεσα το επίθεμα με άσηπτη τεχνική και καταγράφω την αλλαγή."}]'::jsonb, '[[],["Q-203"],["Q-205"],["Q-206"],["Q-203"],["Q-206"],["Q-205"]]'::jsonb),
    ('TRN-DEMO-004', '[{"id":"Q-401","type":"single_choice","text":"Σε ποιον περιέκτη απορρίπτονται τα μολυσματικά απόβλητα (ΕΑΑ-ΜΧ);","points":5,"options":[{"id":"Q-401-O1","text":"Μαύρη σακούλα οικιακών απορριμμάτων"},{"id":"Q-401-O2","text":"Κίτρινο κυτίο ή σάκος με σήμανση βιολογικού κινδύνου","correct":true},{"id":"Q-401-O3","text":"Μπλε κάδος ανακύκλωσης"},{"id":"Q-401-O4","text":"Οποιοσδήποτε διαθέσιμος κάδος"}]},{"id":"Q-402","type":"true_false","text":"Τα αιχμηρά απορρίπτονται σε άκαμπτο περιέκτη ανθεκτικό στη διάτρηση.","points":5,"correctBoolean":true},{"id":"Q-403","type":"multiple_choice","text":"Ποια από τα παρακάτω χαρακτηρίζονται μολυσματικά απόβλητα (ΕΑΑ-ΜΧ);","points":5,"options":[{"id":"Q-403-O1","text":"Γάζες εμποτισμένες με αίμα","correct":true},{"id":"Q-403-O2","text":"Χάρτινες συσκευασίες φαρμάκων"},{"id":"Q-403-O3","text":"Σωληνώσεις αιμοκάθαρσης","correct":true},{"id":"Q-403-O4","text":"Υπολείμματα τροφών από θάλαμο χωρίς απομόνωση"}]},{"id":"Q-404","type":"single_choice","text":"Πόσο μπορούν να παραμείνουν τα ΕΑΑ-ΜΧ στον χώρο προσωρινής αποθήκευσης σε θερμοκρασία δωματίου;","points":3,"options":[{"id":"Q-404-O1","text":"Έως 5 ημέρες","correct":true},{"id":"Q-404-O2","text":"Έως 30 ημέρες"},{"id":"Q-404-O3","text":"Χωρίς χρονικό όριο"},{"id":"Q-404-O4","text":"Έως 1 ώρα"}]},{"id":"Q-405","type":"true_false","text":"Οι σάκοι γεμίζουν έως τα 3/4 και κλείνουν χωρίς συμπίεση του περιεχομένου.","points":2,"correctBoolean":true},{"id":"Q-406","type":"free_text","text":"Τι κάνετε αν σχιστεί σάκος μολυσματικών αποβλήτων;","points":0,"modelAnswer":"Τον τοποθετώ σε δεύτερο σάκο, καθαρίζω και απολυμαίνω τον χώρο και ενημερώνω τον υπεύθυνο."}]'::jsonb, '[[],["Q-405"],["Q-404"],["Q-405"],["Q-404"],["Q-405"]]'::jsonb),
    ('TRN-DEMO-005', '[{"id":"Q-301","type":"single_choice","text":"Τι κάνετε αμέσως μετά από τρύπημα με χρησιμοποιημένη βελόνα;","points":5,"options":[{"id":"Q-301-O1","text":"Πιέζω για να σταματήσει η αιμορραγία"},{"id":"Q-301-O2","text":"Πλένω με νερό και σαπούνι και ενημερώνω αμέσως","correct":true},{"id":"Q-301-O3","text":"Εφαρμόζω χλωρίνη στο τραύμα"},{"id":"Q-301-O4","text":"Συνεχίζω και το αναφέρω στο τέλος της βάρδιας"}]},{"id":"Q-302","type":"true_false","text":"Η επανατοποθέτηση του καλύμματος στη βελόνα με δύο χέρια επιτρέπεται.","points":5,"correctBoolean":false},{"id":"Q-303","type":"single_choice","text":"Μέχρι πού γεμίζει ο περιέκτης αιχμηρών;","points":5,"options":[{"id":"Q-303-O1","text":"Μέχρι επάνω"},{"id":"Q-303-O2","text":"Έως τα 3/4 ή τη γραμμή πλήρωσης","correct":true},{"id":"Q-303-O3","text":"Μέχρι τη μέση"},{"id":"Q-303-O4","text":"Δεν υπάρχει όριο"}]},{"id":"Q-304","type":"multiple_choice","text":"Ποια μέτρα μειώνουν τους τραυματισμούς από αιχμηρά;","points":5,"options":[{"id":"Q-304-O1","text":"Συσκευές ασφαλείας","correct":true},{"id":"Q-304-O2","text":"Περιέκτης στο σημείο χρήσης","correct":true},{"id":"Q-304-O3","text":"Μεταφορά βελονών στο χέρι"},{"id":"Q-304-O4","text":"Εκπαίδευση προσωπικού","correct":true}]},{"id":"Q-305","type":"true_false","text":"Κάθε έκθεση σε αίμα καταγράφεται ως περιστατικό έκθεσης στο Ιατρείο Εργασίας.","points":2,"correctBoolean":true},{"id":"Q-306","type":"single_choice","text":"Εντός πόσου χρόνου ξεκινά ιδανικά η προφύλαξη μετά από έκθεση στον HIV;","points":3,"options":[{"id":"Q-306-O1","text":"Εντός 2 ωρών"},{"id":"Q-306-O2","text":"Εντός 72 ωρών — ιδανικά στις 2 πρώτες ώρες","correct":true},{"id":"Q-306-O3","text":"Εντός 1 εβδομάδας"},{"id":"Q-306-O4","text":"Δεν απαιτείται προφύλαξη"}]},{"id":"Q-307","type":"free_text","text":"Ποιον ενημερώνετε μετά από έκθεση;","points":0,"modelAnswer":"Τον προϊστάμενο και το Ιατρείο Εργασίας, με καταγραφή του περιστατικού."}]'::jsonb, '[]'::jsonb),
    ('TRN-DEMO-006', '[{"id":"Q-001","type":"single_choice","text":"Πότε εφαρμόζεται υγιεινή χεριών πριν από άσηπτη πράξη;","points":5,"options":[{"id":"Q-001-O1","text":"Μόνο όταν δεν φοράμε γάντια"},{"id":"Q-001-O2","text":"Αμέσως πριν από κάθε άσηπτη πράξη","correct":true},{"id":"Q-001-O3","text":"Μόνο μετά την επαφή με τον ασθενή"},{"id":"Q-001-O4","text":"Μία φορά στην αρχή της βάρδιας"}]},{"id":"Q-002","type":"true_false","text":"Τα γάντια αντικαθιστούν την υγιεινή χεριών.","points":5,"correctBoolean":false},{"id":"Q-003","type":"multiple_choice","text":"Ποιες από τις παρακάτω είναι «στιγμές» του WHO για την υγιεινή χεριών;","points":5,"options":[{"id":"Q-003-O1","text":"Πριν από την επαφή με τον ασθενή","correct":true},{"id":"Q-003-O2","text":"Μετά από έκθεση σε βιολογικά υγρά","correct":true},{"id":"Q-003-O3","text":"Πριν από την είσοδο στο γραφείο προσωπικού"},{"id":"Q-003-O4","text":"Μετά την επαφή με το περιβάλλον του ασθενούς","correct":true}]},{"id":"Q-004","type":"single_choice","text":"Πόσο διαρκεί η σωστή εντριβή με αλκοολούχο αντισηπτικό;","points":5,"options":[{"id":"Q-004-O1","text":"5–10 δευτερόλεπτα"},{"id":"Q-004-O2","text":"20–30 δευτερόλεπτα","correct":true},{"id":"Q-004-O3","text":"40–60 δευτερόλεπτα"},{"id":"Q-004-O4","text":"2 λεπτά"}]},{"id":"Q-005","type":"true_false","text":"Σε λοίμωξη από Clostridioides difficile προτιμάται πλύσιμο με νερό και σαπούνι.","points":3,"correctBoolean":true},{"id":"Q-006","type":"single_choice","text":"Πόσο διαρκεί το πλύσιμο χεριών με νερό και σαπούνι;","points":2,"options":[{"id":"Q-006-O1","text":"10–15 δευτερόλεπτα"},{"id":"Q-006-O2","text":"20–30 δευτερόλεπτα"},{"id":"Q-006-O3","text":"40–60 δευτερόλεπτα","correct":true},{"id":"Q-006-O4","text":"3 λεπτά"}]},{"id":"Q-007","type":"free_text","text":"Περιγράψτε σε μία πρόταση πότε αλλάζετε γάντια στον ίδιο ασθενή.","points":0,"modelAnswer":"Όταν μετακινούμαι από μολυσμένη σε καθαρή περιοχή του σώματος του ίδιου ασθενούς."}]'::jsonb, '[["Q-006"],["Q-005"],[],["Q-005"],["Q-006"],["Q-004"],["Q-005"]]'::jsonb),
    ('TRN-DEMO-007', '[{"id":"Q-501","type":"single_choice","text":"Ποιος είναι ο σωστός ρυθμός θωρακικών συμπιέσεων σε ενήλικα;","points":4,"options":[{"id":"Q-501-O1","text":"60–80 το λεπτό"},{"id":"Q-501-O2","text":"80–100 το λεπτό"},{"id":"Q-501-O3","text":"100–120 το λεπτό","correct":true},{"id":"Q-501-O4","text":"Πάνω από 140 το λεπτό"}]},{"id":"Q-502","type":"single_choice","text":"Σε τι βάθος γίνονται οι θωρακικές συμπιέσεις σε ενήλικα;","points":4,"options":[{"id":"Q-502-O1","text":"2–3 cm"},{"id":"Q-502-O2","text":"5–6 cm","correct":true},{"id":"Q-502-O3","text":"8–10 cm"},{"id":"Q-502-O4","text":"Όσο το επιτρέπει ο θώρακας"}]},{"id":"Q-503","type":"true_false","text":"Ο αυτόματος εξωτερικός απινιδωτής (AED) συνδέεται μόλις είναι διαθέσιμος.","points":3,"correctBoolean":true},{"id":"Q-504","type":"single_choice","text":"Ποια είναι η αναλογία συμπιέσεων προς εμφυσήσεις στη ΚΑΡΠΑ ενηλίκων από έναν διασώστη;","points":3,"options":[{"id":"Q-504-O1","text":"15:2"},{"id":"Q-504-O2","text":"30:2","correct":true},{"id":"Q-504-O3","text":"5:1"},{"id":"Q-504-O4","text":"30:1"}]},{"id":"Q-505","type":"multiple_choice","text":"Ποια ευρήματα επιβάλλουν άμεση έναρξη ΚΑΡΠΑ;","points":4,"options":[{"id":"Q-505-O1","text":"Ο ασθενής δεν ανταποκρίνεται","correct":true},{"id":"Q-505-O2","text":"Δεν αναπνέει φυσιολογικά","correct":true},{"id":"Q-505-O3","text":"Έχει ταχυκαρδία με σφυγμό"},{"id":"Q-505-O4","text":"Αγωνιώδεις (agonal) αναπνοές","correct":true}]},{"id":"Q-506","type":"true_false","text":"Επιτρέπεται διακοπή των συμπιέσεων για περισσότερο από 10 δευτερόλεπτα για έλεγχο σφυγμού.","points":2,"correctBoolean":false}]'::jsonb, '[[],["Q-506"],["Q-503"],["Q-504"],["Q-506"],["Q-503"]]'::jsonb),
    ('TRN-DEMO-010', '[{"id":"Q-601","type":"single_choice","text":"Πώς χαρακτηρίζονται τα δεδομένα υγείας στον ΓΚΠΔ;","points":4,"options":[{"id":"Q-601-O1","text":"Δημόσια δεδομένα"},{"id":"Q-601-O2","text":"Ειδική κατηγορία δεδομένων","correct":true},{"id":"Q-601-O3","text":"Ανώνυμα δεδομένα"},{"id":"Q-601-O4","text":"Δεδομένα επικοινωνίας"}]},{"id":"Q-602","type":"true_false","text":"Επιτρέπεται η αποστολή αποτελεσμάτων ασθενούς σε προσωπικό e-mail συναδέλφου για διευκόλυνση.","points":3,"correctBoolean":false},{"id":"Q-603","type":"single_choice","text":"Μέσα σε πόσες ώρες γνωστοποιείται μια παραβίαση δεδομένων στην εποπτική αρχή;","points":4,"options":[{"id":"Q-603-O1","text":"24 ώρες"},{"id":"Q-603-O2","text":"48 ώρες"},{"id":"Q-603-O3","text":"72 ώρες","correct":true},{"id":"Q-603-O4","text":"7 ημέρες"}]},{"id":"Q-604","type":"multiple_choice","text":"Ποιες πρακτικές προστατεύουν τα δεδομένα ασθενών;","points":4,"options":[{"id":"Q-604-O1","text":"Κλείδωμα οθόνης όταν απομακρύνομαι","correct":true},{"id":"Q-604-O2","text":"Κοινός κωδικός για όλη τη βάρδια"},{"id":"Q-604-O3","text":"Καταστροφή εντύπων σε καταστροφέα","correct":true},{"id":"Q-604-O4","text":"Συζήτηση περιστατικών μόνο σε κατάλληλο χώρο","correct":true}]},{"id":"Q-605","type":"true_false","text":"Έχω πρόσβαση μόνο στους φακέλους των ασθενών που φροντίζω.","points":3,"correctBoolean":true},{"id":"Q-606","type":"single_choice","text":"Σε ποιον αναφέρεται πρώτα ένα πιθανό περιστατικό παραβίασης δεδομένων;","points":2,"options":[{"id":"Q-606-O1","text":"Στον Υπεύθυνο Προστασίας Δεδομένων (DPO)","correct":true},{"id":"Q-606-O2","text":"Στον ασθενή"},{"id":"Q-606-O3","text":"Στα μέσα ενημέρωσης"},{"id":"Q-606-O4","text":"Σε κανέναν"}]}]'::jsonb, '[[],["Q-606"],["Q-602"],["Q-606"],["Q-605","Q-606"],["Q-602"],["Q-606"]]'::jsonb),
    ('TRN-DEMO-011', '[{"id":"Q-701","type":"single_choice","text":"Ποιο από τα παρακάτω είναι φάρμακο υψηλού κινδύνου (high-alert);","points":4,"options":[{"id":"Q-701-O1","text":"Παρακεταμόλη από το στόμα"},{"id":"Q-701-O2","text":"Πυκνό χλωριούχο κάλιο","correct":true},{"id":"Q-701-O3","text":"Φυσιολογικός ορός 0,9%"},{"id":"Q-701-O4","text":"Βιταμίνη C"}]},{"id":"Q-702","type":"true_false","text":"Τα φάρμακα με παρόμοια ονομασία ή συσκευασία (LASA) φυλάσσονται το ένα δίπλα στο άλλο.","points":3,"correctBoolean":false},{"id":"Q-703","type":"multiple_choice","text":"Ποια από τα «σωστά» ελέγχονται πριν από κάθε χορήγηση;","points":5,"options":[{"id":"Q-703-O1","text":"Σωστός ασθενής","correct":true},{"id":"Q-703-O2","text":"Σωστό φάρμακο και δόση","correct":true},{"id":"Q-703-O3","text":"Σωστή οδός και χρόνος","correct":true},{"id":"Q-703-O4","text":"Σωστή ώρα επισκεπτηρίου"}]},{"id":"Q-704","type":"single_choice","text":"Πότε απαιτείται διπλός ανεξάρτητος έλεγχος;","points":3,"options":[{"id":"Q-704-O1","text":"Σε κάθε δισκίο"},{"id":"Q-704-O2","text":"Σε έγχυση ινσουλίνης ή ηπαρίνης","correct":true},{"id":"Q-704-O3","text":"Μόνο τη νύχτα"},{"id":"Q-704-O4","text":"Ποτέ"}]},{"id":"Q-705","type":"true_false","text":"Μια προφορική ιατρική οδηγία επαναλαμβάνεται και επιβεβαιώνεται (read-back) πριν από την εκτέλεση.","points":3,"correctBoolean":true},{"id":"Q-706","type":"single_choice","text":"Τι κάνετε όταν διαπιστώσετε λάθος στη χορήγηση φαρμάκου;","points":2,"options":[{"id":"Q-706-O1","text":"Ενημερώνω τον θεράποντα και καταγράφω το συμβάν","correct":true},{"id":"Q-706-O2","text":"Περιμένω να δω αν θα έχει συνέπειες"},{"id":"Q-706-O3","text":"Το διορθώνω χωρίς καταγραφή"},{"id":"Q-706-O4","text":"Ενημερώνω μόνο τους συναδέλφους"}]}]'::jsonb, '[[],["Q-706"],["Q-702"],["Q-705"],["Q-706"],["Q-704"]]'::jsonb),
    ('TRN-DEMO-013', '[{"id":"Q-801","type":"single_choice","text":"Πόσα αναγνωριστικά στοιχεία χρησιμοποιούνται για την ταυτοποίηση ασθενούς;","points":5,"options":[{"id":"Q-801-O1","text":"Ένα"},{"id":"Q-801-O2","text":"Τουλάχιστον δύο","correct":true},{"id":"Q-801-O3","text":"Μόνο ο αριθμός κλίνης"},{"id":"Q-801-O4","text":"Κανένα αν γνωρίζω τον ασθενή"}]},{"id":"Q-802","type":"true_false","text":"Ο αριθμός θαλάμου ή κλίνης είναι αποδεκτό αναγνωριστικό στοιχείο.","points":5,"correctBoolean":false},{"id":"Q-803","type":"multiple_choice","text":"Πότε επιβεβαιώνεται η ταυτότητα του ασθενούς;","points":5,"options":[{"id":"Q-803-O1","text":"Πριν από χορήγηση φαρμάκου","correct":true},{"id":"Q-803-O2","text":"Πριν από αιμοληψία","correct":true},{"id":"Q-803-O3","text":"Πριν από μετάγγιση","correct":true},{"id":"Q-803-O4","text":"Μόνο κατά την εισαγωγή"}]},{"id":"Q-804","type":"single_choice","text":"Ασθενής δεν φέρει βραχιόλι ταυτοποίησης. Τι κάνετε;","points":3,"options":[{"id":"Q-804-O1","text":"Συνεχίζω τη νοσηλεία"},{"id":"Q-804-O2","text":"Τοποθετώ βραχιόλι πριν από οποιαδήποτε πράξη","correct":true},{"id":"Q-804-O3","text":"Το καταγράφω στο τέλος της βάρδιας"},{"id":"Q-804-O4","text":"Ρωτώ μόνο τον διπλανό ασθενή"}]},{"id":"Q-805","type":"true_false","text":"Σε ασθενή που δεν επικοινωνεί η ταυτότητα επιβεβαιώνεται με το βραχιόλι και τον φάκελο.","points":2,"correctBoolean":true}]'::jsonb, '[[],["Q-805"],["Q-804"],["Q-805"],["Q-805"],["Q-804"]]'::jsonb),
    ('TRN-DEMO-016', '[{"id":"Q-901","type":"single_choice","text":"Ποιες προφυλάξεις εφαρμόζονται σε ασθενή με CPE;","points":4,"options":[{"id":"Q-901-O1","text":"Μόνο βασικές προφυλάξεις"},{"id":"Q-901-O2","text":"Προφυλάξεις επαφής","correct":true},{"id":"Q-901-O3","text":"Μόνο αερογενούς μετάδοσης"},{"id":"Q-901-O4","text":"Καμία ειδική προφύλαξη"}]},{"id":"Q-902","type":"multiple_choice","text":"Ποιον εξοπλισμό φοράτε για επαφή με ασθενή σε προφυλάξεις επαφής;","points":4,"options":[{"id":"Q-902-O1","text":"Ποδιά μιας χρήσης","correct":true},{"id":"Q-902-O2","text":"Γάντια","correct":true},{"id":"Q-902-O3","text":"Μάσκα FFP3 σε κάθε επαφή"},{"id":"Q-902-O4","text":"Γάντια και ποδιά αλλάζονται ανά ασθενή","correct":true}]},{"id":"Q-903","type":"true_false","text":"Ο εξοπλισμός (π.χ. στηθοσκόπιο) είναι αποκλειστικός για τον ασθενή σε απομόνωση.","points":3,"correctBoolean":true},{"id":"Q-904","type":"single_choice","text":"Πώς καθαρίζονται τα χέρια μετά τη φροντίδα ασθενούς με C. difficile;","points":3,"options":[{"id":"Q-904-O1","text":"Μόνο αλκοολούχο αντισηπτικό"},{"id":"Q-904-O2","text":"Νερό και σαπούνι","correct":true},{"id":"Q-904-O3","text":"Δεν χρειάζεται αν φορούσα γάντια"},{"id":"Q-904-O4","text":"Μόνο υγρά μαντηλάκια"}]},{"id":"Q-905","type":"true_false","text":"Η απομόνωση διακόπτεται μετά από μία αρνητική καλλιέργεια επιτήρησης.","points":2,"correctBoolean":false},{"id":"Q-906","type":"free_text","text":"Περιγράψτε πώς ενημερώνετε το τμήμα υποδοχής όταν ασθενής με CPE μεταφέρεται για εξέταση.","points":4,"modelAnswer":"Ενημερώνω πριν από τη μεταφορά για τις προφυλάξεις επαφής, σημειώνω την απομόνωση στο παραπεμπτικό και φροντίζω για καθαρισμό του εξοπλισμού μετά.","manualReview":true,"required":true}]'::jsonb, '[[],["Q-905"],["Q-904"],["Q-905"],["Q-903"]]'::jsonb)
  ) q(program_key, questions, patterns);
$function$;
revoke all on function private.demo_training_questions() from public, anon, authenticated;

create or replace function private.demo_seed_training(p_organization_id uuid, p_actor uuid)
returns void language plpgsql security definer set search_path = ''
as $function$
declare
  v_org uuid := p_organization_id;
  d0 date := current_date;
  v_nurse constant text := 'Νοσηλευτής / Νοσηλεύτρια';
  v_doctor constant text := 'Ιατρός';
  v_assistant constant text := 'Βοηθός Νοσηλευτή';
  v_reviewer constant text := 'Α. Νικολάου, Νοσηλεύτρια Επιτήρησης Λοιμώξεων';
  v_quality constant text := 'Ε. Σταματίου, Υπεύθυνη Ποιότητας';
begin
  if not exists (select 1 from public.organizations o where o.id = v_org and o.is_demo) then
    raise exception 'Only Demo organizations can be filled with Demo data' using errcode = '42501';
  end if;

  -- 1. Programmes ------------------------------------------------------------
  -- start / len: days from today / length of the period in days.
  insert into public.training_programs as t(organization_id, program_key, title, title_en, category, method, delivery_kind, status,
    owner, trainer, audience, description, start_date, due_date, start_time, duration_hours, location, cost,
    valid_months, requires_assessment, pass_score, feedback_template_key, feedback_title_el, feedback_title_en, created_at, created_by, updated_by)
  select v_org, p.key, p.title, p.title_en, p.category, p.method, p.delivery, p.status,
    p.owner, p.trainer, p.audience, p.descr, d0 + p.start, d0 + p.start + p.len, p.at::time, p.hours, p.location, p.cost,
    p.valid, p.assess, p.pass, 'TRAINER-FEEDBACK-DEFAULT', 'Αξιολόγηση εκπαιδευτή', 'Trainer evaluation',
    ((d0 + p.start - 20) + time '09:00') at time zone 'Europe/Athens', p_actor, p_actor
  from (values
    ('TRN-DEMO-001', 'Υγιεινή των χεριών – 5 στιγμές ΠΟΥ (κύκλος 2026)', 'Hand hygiene – WHO 5 Moments (2026 cycle)', 'ipc', 'in_person', 'internal', 'completed',
      'Ομάδα Ελέγχου Λοιμώξεων', 'Νοσηλεύτρια Επιτήρησης Λοιμώξεων', 'Όλο το προσωπικό', 'Ετήσια εκπαίδευση: οι 5 στιγμές, τεχνική αντισηψίας και πλυσίματος χεριών, χρήση γαντιών.',
      -40, 21, '10:00', 2.0, 'Αίθουσα εκπαίδευσης, 1ος όροφος', 0, 12, true, 80),
    ('TRN-DEMO-002', 'Ατομικός προστατευτικός εξοπλισμός (ΑΠΕ)', 'Personal protective equipment (PPE)', 'ipc', 'on_the_job', 'intra_department', 'completed',
      'Ομάδα Ελέγχου Λοιμώξεων', 'Νοσηλεύτρια Επιτήρησης Λοιμώξεων', 'Νοσηλευτικό και εργαστηριακό προσωπικό', 'Ένδυση και αφαίρεση ΑΠΕ, προφυλάξεις επαφής, σταγονιδίων και αερογενούς μετάδοσης, με επίδειξη στο τμήμα.',
      -150, 30, '13:30', 1.5, 'Στα τμήματα νοσηλείας', 0, 24, true, 80),
    ('TRN-DEMO-003', 'Bundle πρόληψης CLABSI', 'CLABSI prevention bundle', 'clinical', 'hybrid', 'internal', 'completed',
      'Διευθυντής ΜΕΘ', 'Ιατρός ΜΕΘ και Νοσηλεύτρια Επιτήρησης Λοιμώξεων', 'Ιατρικό και νοσηλευτικό προσωπικό', 'Τοποθέτηση και φροντίδα κεντρικών φλεβικών καθετήρων σύμφωνα με το bundle, με ηλεκτρονικό υλικό και πρακτική άσκηση.',
      -120, 21, '12:00', 3.0, 'Αίθουσα προσομοίωσης ΜΕΘ', 150, 24, true, 80),
    ('TRN-DEMO-004', 'Διαχείριση νοσοκομειακών αποβλήτων', 'Healthcare waste management', 'mandatory', 'online', 'internal', 'completed',
      'Υπεύθυνος Περιβαλλοντικής Υγιεινής', 'Υπεύθυνος Περιβαλλοντικής Υγιεινής', 'Όλο το προσωπικό', 'Διαλογή, συσκευασία, προσωρινή αποθήκευση και μεταφορά ΕΑΑ-ΜΧ και αιχμηρών.',
      -210, 30, '09:00', 1.0, 'Διαδικτυακή πλατφόρμα εκπαίδευσης', 0, 36, true, 80),
    ('TRN-DEMO-005', 'Ασφαλής χρήση αιχμηρών και PEP', 'Safe use of sharps and PEP', 'occupational_health', 'in_person', 'internal', 'planned',
      'Ιατρείο Εργασίας', 'Ιατρός Εργασίας', 'Νοσηλευτικό και ιατρικό προσωπικό', 'Πρόληψη τρυπημάτων από βελόνες, συσκευές ασφαλείας και διαδικασία μετά από έκθεση σε αίμα.',
      21, 30, '14:00', 1.5, 'Αμφιθέατρο', 0, 24, true, 80),
    ('TRN-DEMO-006', 'Υγιεινή των χεριών – 5 στιγμές ΠΟΥ (κύκλος 2025)', 'Hand hygiene – WHO 5 Moments (2025 cycle)', 'ipc', 'in_person', 'internal', 'completed',
      'Ομάδα Ελέγχου Λοιμώξεων', 'Νοσηλεύτρια Επιτήρησης Λοιμώξεων', 'Όλο το προσωπικό', 'Ετήσια εκπαίδευση του προηγούμενου κύκλου στην υγιεινή των χεριών.',
      -400, 30, '10:00', 2.0, 'Αίθουσα εκπαίδευσης, 1ος όροφος', 0, 12, true, 80),
    ('TRN-DEMO-007', 'Βασική υποστήριξη ζωής και χρήση απινιδωτή (BLS-AED)', 'Basic life support and AED (BLS-AED)', 'clinical', 'in_person', 'external', 'completed',
      'Διεύθυνση Νοσηλευτικής Υπηρεσίας', 'Πιστοποιημένοι εκπαιδευτές BLS (εξωτερικός φορέας)', 'Ιατροί και νοσηλευτές', 'Αναγνώριση ανακοπής, θωρακικές συμπιέσεις, εμφυσήσεις και ασφαλής χρήση AED, με πρακτική εξέταση σε πρόπλασμα.',
      -300, 14, '09:00', 5.0, 'Αίθουσα προσομοίωσης', 1800, 24, true, 80),
    ('TRN-DEMO-008', 'Εξειδικευμένη υποστήριξη ζωής (ALS)', 'Advanced life support (ALS)', 'clinical', 'in_person', 'external', 'completed',
      'Διευθυντής ΜΕΘ', 'Πιστοποιημένοι εκπαιδευτές ALS (εξωτερικός φορέας)', 'Ιατροί και νοσηλευτές ΜΕΘ, ΜΕΝΝ και Καρδιολογικής', 'Διήμερο σεμινάριο: αλγόριθμοι ALS, διαχείριση αεραγωγού, αρρυθμίες περί την ανακοπή, ομαδική εργασία.',
      -260, 1, '08:30', 16.0, 'Εξωτερικό εκπαιδευτικό κέντρο', 3200, 24, false, null),
    ('TRN-DEMO-009', 'Πυρασφάλεια και εκκένωση κτηρίου', 'Fire safety and building evacuation', 'mandatory', 'in_person', 'internal', 'completed',
      'Τεχνικός Ασφαλείας', 'Τεχνικός Ασφαλείας', 'Όλο το προσωπικό (1η ομάδα)', 'Χρήση πυροσβεστήρων, σχέδιο εκκένωσης, οριζόντια εκκένωση κλινών και άσκηση ετοιμότητας.',
      -480, 7, '11:00', 2.0, 'Αμφιθέατρο και αύλειος χώρος', 0, 24, false, null),
    ('TRN-DEMO-010', 'Προστασία προσωπικών δεδομένων (ΓΚΠΔ)', 'Personal data protection (GDPR)', 'mandatory', 'online', 'external', 'completed',
      'Υπεύθυνος Προστασίας Δεδομένων', 'Εξωτερικός σύμβουλος προστασίας δεδομένων', 'Όλο το προσωπικό', 'Αρχές του ΓΚΠΔ στο νοσοκομείο: δεδομένα υγείας, πρόσβαση, εμπιστευτικότητα και αναφορά παραβίασης.',
      -360, 30, '12:00', 1.5, 'Διαδικτυακή πλατφόρμα εκπαίδευσης', 450, 36, true, 70),
    ('TRN-DEMO-011', 'Ασφαλής χορήγηση φαρμάκων – φάρμακα υψηλού κινδύνου και LASA', 'Medication safety – high-alert and LASA medicines', 'quality', 'hybrid', 'internal', 'completed',
      'Φαρμακείο και Γραφείο Ποιότητας', 'Υπεύθυνη Φαρμακοποιός', 'Νοσηλευτές και ιατροί', 'Τα «σωστά» της χορήγησης, διπλός έλεγχος, φάρμακα υψηλού κινδύνου, LASA και αναφορά λαθών.',
      -200, 21, '13:00', 2.0, 'Αίθουσα εκπαίδευσης, 1ος όροφος', 0, 24, true, 80),
    ('TRN-DEMO-012', 'Πρόληψη πτώσεων ασθενών', 'Patient falls prevention', 'quality', 'in_person', 'intra_department', 'completed',
      'Γραφείο Ποιότητας', 'Προϊσταμένη Νοσηλευτικού Τομέα', 'Νοσηλευτικό προσωπικό', 'Εκτίμηση κινδύνου πτώσης (κλίμακα Morse), μέτρα πρόληψης και διαχείριση μετά από πτώση.',
      -170, 14, '14:00', 1.5, 'Στα τμήματα νοσηλείας', 0, 24, false, null),
    ('TRN-DEMO-013', 'Σωστή ταυτοποίηση ασθενούς', 'Correct patient identification', 'quality', 'on_the_job', 'intra_department', 'completed',
      'Γραφείο Ποιότητας', 'Προϊστάμενοι τμημάτων', 'Νοσηλευτικό προσωπικό', 'Δύο αναγνωριστικά στοιχεία, βραχιόλι ταυτοποίησης και επιβεβαίωση πριν από κάθε πράξη.',
      -90, 14, '13:30', 1.0, 'Στα τμήματα νοσηλείας', 0, 24, true, 80),
    ('TRN-DEMO-014', 'Ασφαλής μετάγγιση αίματος και bedside test', 'Safe blood transfusion and bedside test', 'clinical', 'in_person', 'internal', 'completed',
      'Αιμοδοσία', 'Ιατρός Αιμοδοσίας', 'Νοσηλευτές και ιατροί κλινικών', 'Αίτηση, ταυτοποίηση, έλεγχος συμβατότητας στην κλίνη, παρακολούθηση και αντιδράσεις μετάγγισης.',
      -330, 7, '12:30', 2.0, 'Αίθουσα πολλαπλών χρήσεων', 0, 24, false, null),
    ('TRN-DEMO-015', 'Πρόληψη και φροντίδα κατακλίσεων', 'Pressure ulcer prevention and care', 'clinical', 'in_person', 'intra_department', 'completed',
      'Διεύθυνση Νοσηλευτικής Υπηρεσίας', 'Νοσηλεύτρια Τραυμάτων', 'Νοσηλευτικό προσωπικό', 'Κλίμακα Braden, αλλαγή θέσης, ειδικά στρώματα και φροντίδα δέρματος.',
      -230, 14, '14:00', 1.5, 'Στα τμήματα νοσηλείας', 0, 24, false, null),
    ('TRN-DEMO-016', 'Προφυλάξεις επαφής για πολυανθεκτικούς μικροοργανισμούς', 'Contact precautions for multidrug-resistant organisms', 'ipc', 'in_person', 'internal', 'active',
      'Ομάδα Ελέγχου Λοιμώξεων', 'Νοσηλεύτρια Επιτήρησης Λοιμώξεων', 'Ιατρικό και νοσηλευτικό προσωπικό', 'Μέτρα απομόνωσης για CPE, MRSA, VRE και C. difficile, μεταφορές ασθενών και καθαρισμός εξοπλισμού.',
      -30, 40, '12:00', 2.0, 'Αίθουσα εκπαίδευσης, 1ος όροφος', 0, 24, true, 80),
    ('TRN-DEMO-017', 'Χειρωνακτική διακίνηση φορτίων και ασθενών', 'Manual handling of loads and patients', 'occupational_health', 'in_person', 'internal', 'completed',
      'Τεχνικός Ασφαλείας', 'Φυσικοθεραπευτής', 'Νοσηλευτικό προσωπικό', 'Εργονομία, ασφαλής μετακίνηση ασθενών και χρήση βοηθημάτων μεταφοράς.',
      -440, 7, '14:00', 1.5, 'Αίθουσα πολλαπλών χρήσεων', 0, 36, false, null),
    ('TRN-DEMO-018', 'Διεθνείς στόχοι για την ασφάλεια των ασθενών', 'International patient safety goals', 'quality', 'in_person', 'internal', 'completed',
      'Γραφείο Ποιότητας', 'Υπεύθυνη Ποιότητας', 'Όλο το προσωπικό (1η ομάδα)', 'Οι έξι στόχοι ασφάλειας: ταυτοποίηση, επικοινωνία, φάρμακα, ασφαλής χειρουργική, λοιμώξεις, πτώσεις.',
      -520, 7, '11:00', 3.0, 'Αμφιθέατρο', 0, 36, false, null),
    ('TRN-DEMO-019', 'Βία και παρενόχληση στον χώρο εργασίας', 'Violence and harassment at work', 'occupational_health', 'online', 'external', 'completed',
      'Διεύθυνση Ανθρώπινου Δυναμικού', 'Εξωτερικός εκπαιδευτικός φορέας', 'Όλο το προσωπικό (1η ομάδα)', 'Αναγνώριση, πρόληψη και αναφορά περιστατικών βίας και παρενόχλησης.',
      -280, 30, '15:00', 2.0, 'Διαδικτυακή πλατφόρμα εκπαίδευσης', 300, 36, false, null),
    ('TRN-DEMO-020', 'Αναγνώριση και αντιμετώπιση αναφυλαξίας', 'Recognition and management of anaphylaxis', 'clinical', 'in_person', 'intra_department', 'active',
      'Διεύθυνση Νοσηλευτικής Υπηρεσίας', 'Ιατρός Παθολογικής Κλινικής', 'Ιατροί και νοσηλευτές Παθολογικής, Παιδιατρικής και ΜΕΝΝ', 'Συμπτώματα, αδρεναλίνη ενδομυϊκά, θέση ασθενούς και παρακολούθηση μετά το επεισόδιο.',
      -14, 28, '13:00', 1.0, 'Στα τμήματα νοσηλείας', 0, 24, false, null),
    ('TRN-DEMO-021', 'Πρόληψη λοιμώξεων ουροποιητικού από καθετήρα (CAUTI)', 'Catheter-associated urinary tract infection prevention (CAUTI)', 'ipc', 'in_person', 'internal', 'planned',
      'Ομάδα Ελέγχου Λοιμώξεων', 'Νοσηλεύτρια Επιτήρησης Λοιμώξεων', 'Νοσηλευτικό προσωπικό χειρουργικών τμημάτων και ΜΕΘ', 'Ένδειξη, άσηπτη τοποθέτηση, φροντίδα και έγκαιρη αφαίρεση του ουροκαθετήρα.',
      35, 14, '13:30', 1.5, 'Αίθουσα εκπαίδευσης, 1ος όροφος', 0, 24, false, null),
    ('TRN-DEMO-022', 'Πυρασφάλεια – ετήσια άσκηση εκκένωσης', 'Fire safety – annual evacuation drill', 'mandatory', 'in_person', 'internal', 'planned',
      'Τεχνικός Ασφαλείας', 'Τεχνικός Ασφαλείας', 'Όλο το προσωπικό (2η ομάδα)', 'Άσκηση εκκένωσης με την Πυροσβεστική Υπηρεσία και ανασκόπηση των χρόνων εκκένωσης.',
      70, 7, '11:00', 2.0, 'Όλα τα κτήρια', 0, 24, false, null)
  ) p(key, title, title_en, category, method, delivery, status, owner, trainer, audience, descr, start, len, at, hours, location, cost, valid, assess, pass)
  on conflict (organization_id, program_key) do update set
    title = excluded.title, title_en = excluded.title_en, category = excluded.category, method = excluded.method, delivery_kind = excluded.delivery_kind,
    status = excluded.status, owner = excluded.owner, trainer = excluded.trainer, audience = excluded.audience, description = excluded.description,
    start_date = excluded.start_date, due_date = excluded.due_date, start_time = excluded.start_time, duration_hours = excluded.duration_hours,
    location = excluded.location, cost = excluded.cost, valid_months = excluded.valid_months, requires_assessment = excluded.requires_assessment,
    pass_score = excluded.pass_score, feedback_template_key = excluded.feedback_template_key, feedback_title_el = excluded.feedback_title_el,
    feedback_title_en = excluded.feedback_title_en, created_at = excluded.created_at, updated_by = excluded.updated_by;

  -- 2. Material, trainer-evaluation questions, effectiveness ---------------------
  insert into public.training_program_materials as t(organization_id, program_id, material_key, position, title, material_type, url, created_by, updated_by)
  select v_org, p.id, m.key, m.pos, m.title, m.kind, null, p_actor, p_actor
  from (values
    ('TRN-DEMO-001', 'MAT-DEMO-001-1', 1, 'Οι 5 στιγμές υγιεινής χεριών (ΠΟΥ) — αφίσα', 'PDF'),
    ('TRN-DEMO-001', 'MAT-DEMO-001-2', 2, 'Τεχνική αντισηψίας χεριών με αλκοολούχο διάλυμα — βίντεο', 'Βίντεο'),
    ('TRN-DEMO-001', 'MAT-DEMO-001-3', 3, 'Παρουσίαση εκπαίδευσης', 'Παρουσίαση'),
    ('TRN-DEMO-002', 'MAT-DEMO-002-1', 1, 'Σειρά ένδυσης και αφαίρεσης ΑΠΕ — οδηγός', 'PDF'),
    ('TRN-DEMO-002', 'MAT-DEMO-002-2', 2, 'Πρωτόκολλο απομόνωσης ασθενών με πολυανθεκτικά', 'Διαδικασία'),
    ('TRN-DEMO-002', 'MAT-DEMO-002-3', 3, 'Παρουσιολόγιο πρακτικής άσκησης', 'Έντυπο'),
    ('TRN-DEMO-003', 'MAT-DEMO-003-1', 1, 'Δέσμη μέτρων πρόληψης CLABSI', 'Διαδικασία'),
    ('TRN-DEMO-003', 'MAT-DEMO-003-2', 2, 'Λίστα ελέγχου τοποθέτησης κεντρικού φλεβικού καθετήρα', 'Έντυπο'),
    ('TRN-DEMO-003', 'MAT-DEMO-003-3', 3, 'Παρουσίαση εκπαίδευσης', 'Παρουσίαση'),
    ('TRN-DEMO-004', 'MAT-DEMO-004-1', 1, 'Οδηγός διαλογής ΕΑΑ-ΜΧ', 'PDF'),
    ('TRN-DEMO-004', 'MAT-DEMO-004-2', 2, 'Σήμανση περιεκτών αποβλήτων — αφίσα', 'PDF'),
    ('TRN-DEMO-005', 'MAT-DEMO-005-1', 1, 'Διαδικασία μετά από έκθεση σε αίμα (PEP)', 'Διαδικασία'),
    ('TRN-DEMO-005', 'MAT-DEMO-005-2', 2, 'Ασφαλής χρήση και απόρριψη αιχμηρών', 'Παρουσίαση'),
    ('TRN-DEMO-006', 'MAT-DEMO-006-1', 1, 'Οι 5 στιγμές υγιεινής χεριών (ΠΟΥ) — αφίσα', 'PDF'),
    ('TRN-DEMO-006', 'MAT-DEMO-006-2', 2, 'Παρουσίαση εκπαίδευσης', 'Παρουσίαση'),
    ('TRN-DEMO-007', 'MAT-DEMO-007-1', 1, 'Αλγόριθμος BLS-AED ενηλίκων', 'PDF'),
    ('TRN-DEMO-007', 'MAT-DEMO-007-2', 2, 'Φύλλο πρακτικής αξιολόγησης σε πρόπλασμα', 'Έντυπο'),
    ('TRN-DEMO-008', 'MAT-DEMO-008-1', 1, 'Εγχειρίδιο σεμιναρίου ALS', 'PDF'),
    ('TRN-DEMO-009', 'MAT-DEMO-009-1', 1, 'Σχέδιο έκτακτης ανάγκης και εκκένωσης', 'Διαδικασία'),
    ('TRN-DEMO-009', 'MAT-DEMO-009-2', 2, 'Χρήση πυροσβεστήρα — βίντεο', 'Βίντεο'),
    ('TRN-DEMO-010', 'MAT-DEMO-010-1', 1, 'Πολιτική προστασίας προσωπικών δεδομένων', 'Διαδικασία'),
    ('TRN-DEMO-010', 'MAT-DEMO-010-2', 2, 'Ηλεκτρονικό μάθημα ΓΚΠΔ', 'Σύνδεσμος'),
    ('TRN-DEMO-011', 'MAT-DEMO-011-1', 1, 'Κατάλογος φαρμάκων υψηλού κινδύνου', 'PDF'),
    ('TRN-DEMO-011', 'MAT-DEMO-011-2', 2, 'Λίστα φαρμάκων LASA του νοσοκομείου', 'PDF'),
    ('TRN-DEMO-011', 'MAT-DEMO-011-3', 3, 'Παρουσίαση εκπαίδευσης', 'Παρουσίαση'),
    ('TRN-DEMO-012', 'MAT-DEMO-012-1', 1, 'Κλίμακα Morse — οδηγός συμπλήρωσης', 'PDF'),
    ('TRN-DEMO-012', 'MAT-DEMO-012-2', 2, 'Διαδικασία πρόληψης και διαχείρισης πτώσεων', 'Διαδικασία'),
    ('TRN-DEMO-013', 'MAT-DEMO-013-1', 1, 'Διαδικασία ταυτοποίησης ασθενών', 'Διαδικασία'),
    ('TRN-DEMO-014', 'MAT-DEMO-014-1', 1, 'Διαδικασία μετάγγισης αίματος και παραγώγων', 'Διαδικασία'),
    ('TRN-DEMO-014', 'MAT-DEMO-014-2', 2, 'Έντυπο παρακολούθησης μετάγγισης', 'Έντυπο'),
    ('TRN-DEMO-015', 'MAT-DEMO-015-1', 1, 'Κλίμακα Braden — οδηγός', 'PDF'),
    ('TRN-DEMO-015', 'MAT-DEMO-015-2', 2, 'Πρωτόκολλο φροντίδας κατακλίσεων', 'Διαδικασία'),
    ('TRN-DEMO-016', 'MAT-DEMO-016-1', 1, 'Πρωτόκολλο απομόνωσης ασθενών με πολυανθεκτικά', 'Διαδικασία'),
    ('TRN-DEMO-016', 'MAT-DEMO-016-2', 2, 'Παρουσίαση εκπαίδευσης', 'Παρουσίαση'),
    ('TRN-DEMO-017', 'MAT-DEMO-017-1', 1, 'Οδηγός ασφαλούς μετακίνησης ασθενών', 'PDF'),
    ('TRN-DEMO-018', 'MAT-DEMO-018-1', 1, 'Οι διεθνείς στόχοι ασφάλειας ασθενών — παρουσίαση', 'Παρουσίαση'),
    ('TRN-DEMO-019', 'MAT-DEMO-019-1', 1, 'Πολιτική για την πρόληψη της βίας και της παρενόχλησης', 'Διαδικασία'),
    ('TRN-DEMO-020', 'MAT-DEMO-020-1', 1, 'Αλγόριθμος αντιμετώπισης αναφυλαξίας', 'PDF'),
    ('TRN-DEMO-021', 'MAT-DEMO-021-1', 1, 'Δέσμη μέτρων πρόληψης CAUTI', 'Διαδικασία'),
    ('TRN-DEMO-022', 'MAT-DEMO-022-1', 1, 'Σχέδιο έκτακτης ανάγκης και εκκένωσης', 'Διαδικασία')
  ) m(program_key, key, pos, title, kind)
  join public.training_programs p on p.organization_id = v_org and p.program_key = m.program_key
  on conflict (program_id, material_key) do update set position = excluded.position, title = excluded.title,
    material_type = excluded.material_type, url = excluded.url, updated_by = excluded.updated_by;

  insert into public.training_program_feedback_questions as t(organization_id, program_id, question_key, position, label_el, label_en, created_by, updated_by)
  select v_org, p.id, fq.key, fq.pos, fq.label_el, fq.label_en, p_actor, p_actor
  from public.training_programs p
  cross join (values
    ('clarity', 1, 'Σαφήνεια παρουσίασης', 'Clarity of presentation'),
    ('knowledge', 2, 'Γνώση και επάρκεια εκπαιδευτή', 'Trainer knowledge and competence'),
    ('usefulness', 3, 'Χρησιμότητα για την εργασία μου', 'Usefulness for my work'),
    ('organization', 4, 'Οργάνωση της εκπαίδευσης', 'Organization of the training'),
    ('materials', 5, 'Ποιότητα εκπαιδευτικού υλικού', 'Quality of training material')
  ) fq(key, pos, label_el, label_en)
  where p.organization_id = v_org and p.program_key ~ '^TRN-DEMO-[0-9]{3}$'
  on conflict (program_id, question_key) do update set position = excluded.position, label_el = excluded.label_el, label_en = excluded.label_en;

  -- Effectiveness (level 3): planned 60 days after the period; recorded once
  -- that date has passed.
  insert into public.training_program_effectiveness as t(program_id, organization_id, planned_date, method, criterion, result, evaluated_at, evaluated_by, notes, created_by, updated_by)
  select p.id, v_org, p.due_date + 60, x.method, x.criterion,
    case when p.due_date + 64 <= d0 then x.result end,
    case when p.due_date + 64 <= d0 and x.result is not null then p.due_date + 64 end,
    case when p.due_date + 64 <= d0 and x.result is not null then v_quality end,
    case when p.due_date + 64 <= d0 then x.notes end, p_actor, p_actor
  from (values
    ('TRN-DEMO-001', 'observation', 'Συμμόρφωση στην υγιεινή χεριών ≥ 85% στις παρατηρήσεις ΠΟΥ του τριμήνου', null, null),
    ('TRN-DEMO-002', 'audit', 'Ορθή ένδυση/αφαίρεση ΑΠΕ σε ≥ 90% των ελέγχων θαλάμων απομόνωσης', 'effective', 'Ορθή ένδυση/αφαίρεση στο 94% των 32 ελέγχων.'),
    ('TRN-DEMO-003', 'indicator', 'Συχνότητα CLABSI στη ΜΕΘ < 2 ανά 1.000 ημέρες καθετήρα', 'effective', '1,4 CLABSI ανά 1.000 ημέρες καθετήρα στο τρίμηνο· πλήρης τεκμηρίωση bundle στο 92%.'),
    ('TRN-DEMO-004', 'audit', 'Ορθή διαλογή αποβλήτων ≥ 95% στους ελέγχους τμημάτων', 'effective', 'Ορθή διαλογή 97% σε 18 ελέγχους· καμία ανάμιξη αιχμηρών με κοινά απορρίμματα.'),
    ('TRN-DEMO-005', 'indicator', 'Καμία μη αναφερθείσα έκθεση σε αιχμηρά στο τρίμηνο', null, null),
    ('TRN-DEMO-006', 'observation', 'Συμμόρφωση στην υγιεινή χεριών ≥ 85% στις παρατηρήσεις ΠΟΥ του τριμήνου', 'partial', 'Συμμόρφωση 81%· χαμηλότερη στη στιγμή «μετά την επαφή με το περιβάλλον του ασθενούς». Ενισχύθηκε στον κύκλο 2026.'),
    ('TRN-DEMO-007', 'observation', 'Ορθή εφαρμογή BLS σε ≥ 90% των ασκήσεων ετοιμότητας', 'effective', 'Σωστή ακολουθία BLS και έναρξη AED < 3 λεπτά σε 11 από 12 ασκήσεις.'),
    ('TRN-DEMO-008', 'observation', 'Τήρηση του αλγορίθμου ALS στις ασκήσεις προσομοίωσης της ΜΕΘ', 'effective', 'Πλήρης τήρηση του αλγορίθμου σε 4 ασκήσεις προσομοίωσης.'),
    ('TRN-DEMO-009', 'observation', 'Εκκένωση ορόφου άσκησης εντός 8 λεπτών', 'effective', 'Οριζόντια εκκένωση σε 6,5 λεπτά· όλο το προσωπικό γνώριζε το σημείο συγκέντρωσης.'),
    ('TRN-DEMO-010', 'audit', 'Καμία παραβίαση δεδομένων λόγω ανθρώπινου λάθους στο εξάμηνο', 'effective', 'Κανένα περιστατικό· ο έλεγχος κλειδώματος οθονών έδειξε 96% συμμόρφωση.'),
    ('TRN-DEMO-011', 'indicator', 'Μείωση των αναφερόμενων λαθών χορήγησης κατά 20%', 'effective', 'Μείωση 28% των λαθών χορήγησης σε σχέση με το προηγούμενο εξάμηνο.'),
    ('TRN-DEMO-012', 'indicator', 'Πτώσεις ασθενών < 1,5 ανά 1.000 ημέρες νοσηλείας', 'partial', '1,7 πτώσεις ανά 1.000 ημέρες νοσηλείας· βελτίωση στην Ορθοπαιδική, όχι ακόμη στην Παθολογική. Επανεκτίμηση στο επόμενο τρίμηνο.'),
    ('TRN-DEMO-013', 'audit', 'Βραχιόλι ταυτοποίησης σε ≥ 98% των ασθενών στους ελέγχους', 'effective', 'Βραχιόλι σε 99% των 140 ασθενών που ελέγχθηκαν.'),
    ('TRN-DEMO-014', 'audit', 'Πλήρες έντυπο μετάγγισης και bedside test σε ≥ 95% των μεταγγίσεων', 'effective', 'Πλήρης τεκμηρίωση σε 97% των μεταγγίσεων του τριμήνου.'),
    ('TRN-DEMO-015', 'indicator', 'Νέες κατακλίσεις σταδίου ≥ 2 < 2% των νοσηλευομένων', 'effective', 'Επίπτωση 1,3% στο τρίμηνο· εκτίμηση Braden κατά την εισαγωγή στο 95%.'),
    ('TRN-DEMO-016', 'audit', 'Σωστή εφαρμογή προφυλάξεων επαφής σε ≥ 90% των ελέγχων απομόνωσης', null, null),
    ('TRN-DEMO-017', 'indicator', 'Λιγότερα εργατικά ατυχήματα μυοσκελετικής αιτιολογίας στο έτος', 'effective', 'Δύο περιστατικά έναντι πέντε το προηγούμενο έτος.'),
    ('TRN-DEMO-018', 'audit', 'Γνώση των στόχων ασφάλειας ≥ 90% σε τυχαίες συνεντεύξεις', 'effective', 'Σωστές απαντήσεις 93% σε 30 συνεντεύξεις προσωπικού.'),
    ('TRN-DEMO-019', 'indicator', 'Αναφορά όλων των περιστατικών βίας μέσω του συστήματος συμβάντων', 'effective', 'Όλα τα περιστατικά του εξαμήνου αναφέρθηκαν εντός 24 ωρών.'),
    ('TRN-DEMO-020', 'observation', 'Σωστή αντιμετώπιση στις ασκήσεις αναφυλαξίας των τμημάτων', null, null)
  ) x(program_key, method, criterion, result, notes)
  join public.training_programs p on p.organization_id = v_org and p.program_key = x.program_key
  on conflict (program_id) do update set planned_date = excluded.planned_date, method = excluded.method, criterion = excluded.criterion,
    result = excluded.result, evaluated_at = excluded.evaluated_at, evaluated_by = excluded.evaluated_by, notes = excluded.notes, updated_by = excluded.updated_by;

  -- 3. Knowledge questions and their options ------------------------------------
  insert into public.training_assessment_questions as t(organization_id, program_id, question_key, position, question_type, text, points, required,
    correct_boolean, model_answer, manual_review, created_by, updated_by)
  select v_org, p.id, x.value->>'id', x.ord::integer, x.value->>'type', x.value->>'text', (x.value->>'points')::numeric,
    coalesce((x.value->>'required')::boolean, x.value->>'type' <> 'free_text'), coalesce((x.value->>'correctBoolean')::boolean, true),
    nullif(x.value->>'modelAnswer', ''), coalesce((x.value->>'manualReview')::boolean, false), p_actor, p_actor
  from private.demo_training_questions() q
  join public.training_programs p on p.organization_id = v_org and p.program_key = q.program_key
  cross join lateral jsonb_array_elements(q.questions) with ordinality x(value, ord)
  on conflict (program_id, question_key) do update set position = excluded.position, question_type = excluded.question_type, text = excluded.text,
    points = excluded.points, required = excluded.required, correct_boolean = excluded.correct_boolean, model_answer = excluded.model_answer,
    manual_review = excluded.manual_review;

  insert into public.training_assessment_options as t(organization_id, question_id, option_key, position, text, correct, created_by, updated_by)
  select v_org, aq.id, o.value->>'id', o.ord::integer, o.value->>'text', coalesce((o.value->>'correct')::boolean, false), p_actor, p_actor
  from private.demo_training_questions() q
  join public.training_programs p on p.organization_id = v_org and p.program_key = q.program_key
  cross join lateral jsonb_array_elements(q.questions) x(value)
  join public.training_assessment_questions aq on aq.program_id = p.id and aq.question_key = x.value->>'id'
  cross join lateral jsonb_array_elements(coalesce(x.value->'options', '[]'::jsonb)) with ordinality o(value, ord)
  on conflict (question_id, option_key) do update set position = excluded.position, text = excluded.text, correct = excluded.correct;

  -- 4. Requirements ------------------------------------------------------------
  insert into public.training_requirements as t(organization_id, requirement_key, title, renewal_months, active, created_by, updated_by)
  select v_org, r.key, r.title, r.renewal, true, p_actor, p_actor
  from (values
    ('REQ-DEMO-001', 'Ετήσια εκπαίδευση υγιεινής χεριών', 12),
    ('REQ-DEMO-002', 'ΑΠΕ για νοσηλευτικό προσωπικό', 24),
    ('REQ-DEMO-003', 'BLS-AED για ιατρούς και νοσηλευτές', 24)
  ) r(key, title, renewal)
  on conflict (organization_id, requirement_key) do update set title = excluded.title, renewal_months = excluded.renewal_months, active = true;
  insert into public.training_requirement_programs(requirement_id, program_id, organization_id, position, created_by, updated_by)
  select r.id, p.id, v_org, x.pos, p_actor, p_actor
  from (values ('REQ-DEMO-001', 'TRN-DEMO-001', 1), ('REQ-DEMO-001', 'TRN-DEMO-006', 2), ('REQ-DEMO-002', 'TRN-DEMO-002', 1), ('REQ-DEMO-003', 'TRN-DEMO-007', 1)) x(requirement_key, program_key, pos)
  join public.training_requirements r on r.organization_id = v_org and r.requirement_key = x.requirement_key
  join public.training_programs p on p.organization_id = v_org and p.program_key = x.program_key
  on conflict (requirement_id, program_id) do nothing;
  insert into public.training_requirement_targets(organization_id, requirement_id, target_kind, value, position, created_by, updated_by)
  select v_org, r.id, 'profession', x.value, x.pos, p_actor, p_actor
  from (values ('REQ-DEMO-002', v_nurse, 1), ('REQ-DEMO-003', v_doctor, 1), ('REQ-DEMO-003', v_nurse, 2)) x(requirement_key, value, pos)
  join public.training_requirements r on r.organization_id = v_org and r.requirement_key = x.requirement_key
  on conflict (requirement_id, target_kind, value) do nothing;

  -- 5. Participants ------------------------------------------------------------
  -- Who attends each programme (by profession / department / employee
  -- number g). The first five keep everyone they had before. Programmes of
  -- the last month and the upcoming ones leave out staff on leave.
  with prog as (
    select p.id, p.program_key, substring(p.program_key from 10)::int n, p.start_date, p.due_date, p.start_time, p.duration_hours,
      p.requires_assessment
    from public.training_programs p
    where p.organization_id = v_org and p.program_key ~ '^TRN-DEMO-[0-9]{3}$'
  ), emp as (
    select e.*, substring(e.employee_code from 5)::int g
    from public.employees e
    where e.organization_id = v_org and e.employee_code ~ '^EMP-[0-9]{3}$'
  ), pick as (
    select pr.*, e.employee_code, e.last_name, e.first_name, e.department_name, e.email, e.g,
      row_number() over (partition by pr.n order by e.g desc) rk
    from prog pr
    join emp e on (pr.n <= 5 or e.hire_date is null or e.hire_date <= pr.start_date)
      and (pr.n not in (16, 20, 21) or coalesce(e.employment_status, 'active') = 'active')
      and case pr.n
        when 1 then true
        when 2 then e.profession_name = v_nurse or (e.g + 2) % 4 <> 0
        when 3 then (e.g + 3) % 4 <> 0
        when 4 then e.g % 4 <> 0
        when 5 then e.profession_name in (v_nurse, v_doctor)
        when 6 then true
        when 7 then e.profession_name in (v_nurse, v_doctor)
        when 8 then e.profession_name in (v_nurse, v_doctor) and e.department_name in ('Μονάδα Εντατικής Θεραπείας', 'Μονάδα Εντατικής Νοσηλείας Νεογνών', 'Καρδιολογική Κλινική')
        when 9 then e.g % 2 = 1
        when 10 then e.g % 3 <> 0
        when 11 then e.profession_name = v_nurse or (e.profession_name = v_doctor and e.g % 4 = 1)
        when 12 then e.profession_name in (v_nurse, v_assistant)
        when 13 then e.profession_name in (v_nurse, v_assistant) and e.g % 2 = 0
        when 14 then e.profession_name in (v_nurse, v_doctor) and e.department_name in ('Παθολογική Κλινική', 'Χειρουργική Κλινική', 'Ορθοπαιδική Κλινική', 'Μονάδα Εντατικής Θεραπείας')
        when 15 then e.profession_name in (v_nurse, v_assistant) and e.department_name in ('Παθολογική Κλινική', 'Χειρουργική Κλινική', 'Ορθοπαιδική Κλινική', 'Μονάδα Εντατικής Θεραπείας', 'Νεφρολογική Κλινική')
        when 16 then e.profession_name in (v_nurse, v_doctor) and e.g % 2 = 1
        when 17 then e.profession_name in (v_nurse, v_assistant)
        when 18 then e.g % 2 = 0
        when 19 then e.g % 3 = 1
        when 20 then e.profession_name in (v_nurse, v_doctor, v_assistant) and e.department_name in ('Παθολογική Κλινική', 'Παιδιατρική Κλινική', 'Μονάδα Εντατικής Νοσηλείας Νεογνών')
        when 21 then e.profession_name in (v_nurse, v_assistant) and e.department_name in ('Χειρουργική Κλινική', 'Ορθοπαιδική Κλινική', 'Μονάδα Εντατικής Θεραπείας', 'Νεφρολογική Κλινική')
        else false end
  ), r0 as (
    select k.*,
      case when k.n in (5, 21) then 'assigned'
           when k.n = 16 and k.rk <= 2 then 'in_progress'
           when k.n = 20 and k.rk <= 2 then 'assigned'
           else 'completed' end st,
      least(k.start_date + (k.g * 7) % (k.due_date - k.start_date + 1), d0 - case when k.n = 16 then 2 else 1 end) attended
    from pick k
  ), x as (
    select r.*,
      ((r.attended + coalesce(r.start_time, time '10:00')) + make_interval(mins => (coalesce(r.duration_hours, 1) * 60)::int + 10)) at time zone 'Europe/Athens' submitted,
      ((r.attended + 1 + time '11:30') at time zone 'Europe/Athens') reviewed,
      case when r.n in (5, 21) then d0 - 3 else r.start_date - 14 end assigned
    from r0 r
  )
  insert into public.training_assignments as t(organization_id, assignment_key, program_id, employee_code, employee_name, department_name, email,
    manual_entry, assigned_date, due_date, status, invitation_sent_at, access_token, attendance_response, attendance, attendance_confirmed_at,
    attendance_attested, attendance_attested_at, attendance_attestation_method, attendance_attestation_version, completion_confirmed_at,
    feedback_submitted_at, assessment_submitted_at, assessment_review_status, assessment_reviewed_at, assessment_reviewed_by,
    assessment_review_acknowledged, assessment_review_note, score, competent, completed_date, created_at, created_by, updated_by)
  select v_org, 'TRA-DEMO-' || x.n || '-' || lpad(x.g::text, 3, '0'), x.id, x.employee_code, x.last_name || ' ' || x.first_name, x.department_name, x.email,
    false, x.assigned, x.due_date, x.st,
    case when x.n in (5, 21) then null else (x.assigned + time '09:00') at time zone 'Europe/Athens' end,
    null,
    case when x.n in (5, 21) then 'not_sent' when x.st = 'assigned' then 'sent' else 'confirmed' end,
    case when x.st in ('completed', 'in_progress') then true end,
    case when x.st in ('completed', 'in_progress') then (x.attended + time '08:50') at time zone 'Europe/Athens' end,
    case when x.st in ('completed', 'in_progress') then true end,
    case when x.st in ('completed', 'in_progress') then x.submitted end,
    case when x.st in ('completed', 'in_progress') then 'personal_email_token' end,
    case when x.st in ('completed', 'in_progress') then '1.0' end,
    case when x.st = 'completed' then case when x.n = 16 then x.reviewed else x.submitted end end,
    case when x.st in ('completed', 'in_progress') then x.submitted end,
    case when x.st in ('completed', 'in_progress') and x.requires_assessment then x.submitted end,
    case when x.st = 'in_progress' then 'pending' when x.st = 'completed' and x.n = 16 then 'reviewed' when x.st = 'completed' then 'not_required' end,
    case when x.st = 'completed' and x.n = 16 then x.reviewed end,
    case when x.st = 'completed' and x.n = 16 then v_reviewer end,
    case when x.st = 'completed' and x.n = 16 then true end,
    null,
    null,
    case when x.st = 'completed' then true end,
    case when x.st = 'completed' then case when x.n = 16 then x.attended + 1 else x.attended end end,
    (x.assigned + time '09:00') at time zone 'Europe/Athens', p_actor, p_actor
  from x
  on conflict (organization_id, assignment_key) do update set
    program_id = excluded.program_id, employee_code = excluded.employee_code, employee_name = excluded.employee_name,
    department_name = excluded.department_name, email = excluded.email, manual_entry = excluded.manual_entry,
    assigned_date = excluded.assigned_date, due_date = excluded.due_date, status = excluded.status,
    invitation_sent_at = excluded.invitation_sent_at, access_token = null, attendance_response = excluded.attendance_response,
    attendance = excluded.attendance, attendance_confirmed_at = excluded.attendance_confirmed_at, attendance_attested = excluded.attendance_attested,
    attendance_attested_at = excluded.attendance_attested_at, attendance_attestation_method = excluded.attendance_attestation_method,
    attendance_attestation_version = excluded.attendance_attestation_version, completion_confirmed_at = excluded.completion_confirmed_at,
    feedback_submitted_at = excluded.feedback_submitted_at, assessment_submitted_at = excluded.assessment_submitted_at,
    assessment_review_status = excluded.assessment_review_status, assessment_reviewed_at = excluded.assessment_reviewed_at,
    assessment_reviewed_by = excluded.assessment_reviewed_by, assessment_review_acknowledged = excluded.assessment_review_acknowledged,
    assessment_review_note = excluded.assessment_review_note, score = excluded.score, competent = excluded.competent,
    completed_date = excluded.completed_date, created_at = excluded.created_at, updated_by = excluded.updated_by;

  -- 6. Answers: right, or wrong on the questions of the participant's pattern;
  -- the points awarded as the app awards them (free text: by the reviewer,
  -- once reviewed). Then the score and competence follow from them.
  with sub as (
    select a.id, a.assessment_review_status rs, p.id program_id, q.patterns,
      split_part(a.assignment_key, '-', 3)::int n, split_part(a.assignment_key, '-', 4)::int g
    from public.training_assignments a
    join public.training_programs p on p.id = a.program_id
    join private.demo_training_questions() q on q.program_key = p.program_key
    where a.organization_id = v_org and a.assignment_key ~ '^TRA-DEMO-[0-9]+-[0-9]{3}$'
      and p.requires_assessment and a.assessment_submitted_at is not null
  )
  insert into public.training_assessment_answers as t(organization_id, assignment_id, question_key, answer_kind, answer_text, answer_boolean,
    answer_number, answer_option_keys, awarded_points, created_by, updated_by)
  select v_org, s.id, aq.question_key,
    case aq.question_type when 'true_false' then 'boolean' when 'multiple_choice' then 'options' else 'text' end,
    case aq.question_type when 'single_choice' then case when m.miss then o.w_opt else o.r_opt end when 'free_text' then aq.model_answer end,
    case when aq.question_type = 'true_false' then (coalesce(aq.correct_boolean, false) <> m.miss) end,
    null,
    case when aq.question_type = 'multiple_choice' then case when m.miss then o.rights[1:greatest(cardinality(o.rights) - 1, 0)] else o.rights end end,
    case when aq.question_type = 'free_text' then
           case when aq.manual_review and s.rs = 'reviewed' then aq.points - case when s.g % 3 = 0 then 1 else 0 end end
         when m.miss then 0 else aq.points end,
    p_actor, p_actor
  from sub s
  join public.training_assessment_questions aq on aq.program_id = s.program_id
  cross join lateral (select case when jsonb_array_length(s.patterns) = 0 then false
      else aq.question_key = any(array(select jsonb_array_elements_text(s.patterns -> ((s.g * 5 + s.n) % jsonb_array_length(s.patterns))))) end miss) m
  cross join lateral (select
      (select ao.option_key from public.training_assessment_options ao where ao.question_id = aq.id and ao.correct order by ao.position, ao.option_key limit 1) r_opt,
      (select ao.option_key from public.training_assessment_options ao where ao.question_id = aq.id and not ao.correct order by ao.position, ao.option_key limit 1) w_opt,
      array(select ao.option_key from public.training_assessment_options ao where ao.question_id = aq.id and ao.correct order by ao.position, ao.option_key) rights) o
  on conflict (assignment_id, question_key) do update set answer_kind = excluded.answer_kind, answer_text = excluded.answer_text,
    answer_boolean = excluded.answer_boolean, answer_number = excluded.answer_number, answer_option_keys = excluded.answer_option_keys,
    awarded_points = excluded.awarded_points, updated_by = excluded.updated_by;

  with s as (
    select a.id, coalesce(p.pass_score, 0) pass,
      round(100.0 * sum(coalesce(x.awarded_points, 0)) / nullif(sum(q.points), 0))::int score
    from public.training_assignments a
    join public.training_programs p on p.id = a.program_id
    join public.training_assessment_questions q on q.program_id = p.id
      and (q.question_type <> 'free_text' or (q.manual_review and a.assessment_review_status = 'reviewed'))
    left join public.training_assessment_answers x on x.assignment_id = a.id and x.question_key = q.question_key
    where a.organization_id = v_org and a.assignment_key ~ '^TRA-DEMO-[0-9]+-[0-9]{3}$'
      and p.requires_assessment and a.assessment_submitted_at is not null
    group by a.id, p.pass_score
  )
  update public.training_assignments a
  set score = s.score, competent = case when a.status = 'completed' then s.score >= s.pass end
  from s
  where a.id = s.id;

  -- 7. Certificates, as the app issues them ------------------------------------
  insert into public.training_certificates as t(organization_id, certificate_key, assignment_id, employee_code, title, issued_date, valid_until, issuer,
    issued_at, issued_by, department_id, employee_user_id, created_by, updated_by)
  select v_org, 'CERT-' || a.assignment_key, a.id, a.employee_code, p.title, a.completion_confirmed_at::date,
    case when p.valid_months is null then null else (a.completion_confirmed_at::date + make_interval(months => p.valid_months))::date end,
    'Limoxis Observer', a.completion_confirmed_at, null, a.department_id, a.employee_user_id, p_actor, p_actor
  from public.training_assignments a
  join public.training_programs p on p.id = a.program_id
  where a.organization_id = v_org and a.assignment_key ~ '^TRA-DEMO-[0-9]+-[0-9]{3}$' and a.status = 'completed' and a.competent
  on conflict (assignment_id) do update set certificate_key = excluded.certificate_key, employee_code = excluded.employee_code, title = excluded.title,
    issued_date = excluded.issued_date, valid_until = excluded.valid_until, issuer = excluded.issuer, issued_at = excluded.issued_at,
    issued_by = excluded.issued_by, department_id = excluded.department_id, employee_user_id = excluded.employee_user_id, updated_by = excluded.updated_by;

  -- 8. Trainer evaluations (4–5) of everyone who submitted -----------------------
  insert into public.training_feedback_responses as t(assignment_id, organization_id, program_id, employee_code, user_id, submitted_at, comment, created_by, updated_by)
  select a.id, v_org, a.program_id, a.employee_code, null, a.feedback_submitted_at,
    (array['Πολύ πρακτική παρουσίαση.', null, 'Χρήσιμη η επίδειξη στην πράξη.', null, 'Σαφείς οδηγίες, εφαρμόσιμες στο τμήμα.', null,
      'Καλή οργάνωση και σωστός χρόνος.', null, 'Θα ήθελα ένα σύντομο βίντεο για επανάληψη.', null])[1 + (split_part(a.assignment_key, '-', 4)::int * 3 + split_part(a.assignment_key, '-', 3)::int) % 10],
    p_actor, p_actor
  from public.training_assignments a
  where a.organization_id = v_org and a.assignment_key ~ '^TRA-DEMO-[0-9]+-[0-9]{3}$' and a.feedback_submitted_at is not null
  on conflict (assignment_id) do update set program_id = excluded.program_id, employee_code = excluded.employee_code, user_id = excluded.user_id,
    submitted_at = excluded.submitted_at, comment = excluded.comment, updated_by = excluded.updated_by;

  insert into public.training_feedback_scores as t(organization_id, assignment_id, question_key, score, created_by, updated_by)
  select v_org, a.id, f.key, f.score, p_actor, p_actor
  from public.training_assignments a
  cross join lateral (select split_part(a.assignment_key, '-', 3)::int n, split_part(a.assignment_key, '-', 4)::int g) k
  cross join lateral (values
    ('clarity', case when (k.g * 3 + k.n) % 5 = 0 then 4 else 5 end),
    ('knowledge', case when (k.g * 7 + k.n) % 9 = 0 then 4 else 5 end),
    ('usefulness', case when (k.g + k.n * 2) % 4 = 0 then 4 else 5 end),
    ('organization', case when (k.g * 5 + k.n) % 6 = 0 then 4 else 5 end),
    ('materials', case when (k.g * 2 + k.n) % 3 = 0 then 4 else 5 end)
  ) f(key, score)
  where a.organization_id = v_org and a.assignment_key ~ '^TRA-DEMO-[0-9]+-[0-9]{3}$' and a.feedback_submitted_at is not null
  on conflict (assignment_id, question_key) do update set score = excluded.score, updated_by = excluded.updated_by;
end;
$function$;

-- The trainer-evaluation questionnaire and the training history. (The
-- programme content and the participants are written by demo_seed_training.)
create or replace function private.demo_seed_people_training(p_organization_id uuid, p_actor uuid)
returns void language plpgsql security definer set search_path = ''
as $function$
declare
  v_org uuid := p_organization_id;
  d0 date := current_date;
begin
  if not exists (select 1 from public.organizations o where o.id = v_org and o.is_demo) then
    raise exception 'Only Demo organizations can be filled with Demo data' using errcode = '42501';
  end if;

  insert into public.training_feedback_templates(organization_id, template_key, title_el, title_en, created_by, updated_by)
  values (v_org, 'TRAINER-FEEDBACK-DEFAULT', 'Αξιολόγηση εκπαιδευτή', 'Trainer evaluation', p_actor, p_actor)
  on conflict (organization_id, template_key) do nothing;
  insert into public.training_feedback_template_questions(organization_id, template_id, question_key, position, label_el, label_en, created_by, updated_by)
  select v_org, t.id, q.key, q.pos, q.label_el, q.label_en, p_actor, p_actor
  from public.training_feedback_templates t
  cross join (values
      ('clarity', 1, 'Σαφήνεια παρουσίασης', 'Clarity of presentation'),
      ('knowledge', 2, 'Γνώση και επάρκεια εκπαιδευτή', 'Trainer knowledge and competence'),
      ('usefulness', 3, 'Χρησιμότητα για την εργασία μου', 'Usefulness for my work'),
      ('organization', 4, 'Οργάνωση της εκπαίδευσης', 'Organization of the training'),
      ('materials', 5, 'Ποιότητα εκπαιδευτικού υλικού', 'Quality of training material')
  ) q(key, pos, label_el, label_en)
  where t.organization_id = v_org and t.template_key = 'TRAINER-FEEDBACK-DEFAULT'
  on conflict (template_id, question_key) do nothing;

  -- Training history, newest first (position 1). Rows are matched by
  -- position, so running the seed again rewrites them in place.
  with h(at, actor, action) as (values
    ((d0 - 540) + time '09:00', 'Γραφείο Ποιότητας', 'Δημιουργήθηκε το πρόγραμμα «Διεθνείς στόχοι για την ασφάλεια των ασθενών»'),
    ((d0 - 500) + time '10:00', 'Τεχνικός Ασφαλείας', 'Δημιουργήθηκε το πρόγραμμα «Πυρασφάλεια και εκκένωση κτηρίου»'),
    ((d0 - 420) + time '09:10', 'Ομάδα Ελέγχου Λοιμώξεων', 'Δημιουργήθηκε ο ετήσιος κύκλος «Υγιεινή των χεριών – 5 στιγμές ΠΟΥ (κύκλος 2025)»'),
    ((d0 - 414) + time '09:00', 'Ομάδα Ελέγχου Λοιμώξεων', 'Στάλθηκαν προσκλήσεις για την υγιεινή των χεριών (κύκλος 2025)'),
    ((d0 - 380) + time '11:30', 'Υπεύθυνος Προστασίας Δεδομένων', 'Δημιουργήθηκε το πρόγραμμα «Προστασία προσωπικών δεδομένων (ΓΚΠΔ)»'),
    ((d0 - 320) + time '10:00', 'Διεύθυνση Νοσηλευτικής Υπηρεσίας', 'Δημιουργήθηκε το πρόγραμμα «Βασική υποστήριξη ζωής και χρήση απινιδωτή (BLS-AED)»'),
    ((d0 - 306) + time '13:00', 'Ε. Σταματίου, Υπεύθυνη Ποιότητας', 'Καταγράφηκε η αποτελεσματικότητα της υγιεινής των χεριών (κύκλος 2025): μερικώς αποτελεσματική'),
    ((d0 - 300) + time '11:00', 'Διεύθυνση Νοσηλευτικής Υπηρεσίας', 'Ορίστηκε απαίτηση «BLS-AED για ιατρούς και νοσηλευτές»'),
    ((d0 - 230) + time '09:00', 'Υπεύθυνος Περιβαλλοντικής Υγιεινής', 'Δημιουργήθηκε το πρόγραμμα «Διαχείριση νοσοκομειακών αποβλήτων»'),
    ((d0 - 220) + time '10:30', 'Γραφείο Ποιότητας', 'Δημιουργήθηκε το πρόγραμμα «Ασφαλής χορήγηση φαρμάκων – φάρμακα υψηλού κινδύνου και LASA»'),
    ((d0 - 170) + time '11:30', 'Ομάδα Ελέγχου Λοιμώξεων', 'Ορίστηκε απαίτηση «ΑΠΕ για νοσηλευτικό προσωπικό»'),
    ((d0 - 140) + time '10:00', 'Διευθυντής ΜΕΘ', 'Δημιουργήθηκε το πρόγραμμα «Bundle πρόληψης CLABSI»'),
    ((d0 - 100) + time '13:00', 'Ε. Σταματίου, Υπεύθυνη Ποιότητας', 'Καταγράφηκε η αποτελεσματικότητα της πρόληψης πτώσεων: μερικώς αποτελεσματική'),
    ((d0 - 60) + time '09:10', 'Ομάδα Ελέγχου Λοιμώξεων', 'Δημιουργήθηκε ο ετήσιος κύκλος «Υγιεινή των χεριών – 5 στιγμές ΠΟΥ (κύκλος 2026)»'),
    ((d0 - 54) + time '09:00', 'Ομάδα Ελέγχου Λοιμώξεων', 'Στάλθηκαν προσκλήσεις για την υγιεινή των χεριών (κύκλος 2026)'),
    ((d0 - 44) + time '09:00', 'Ομάδα Ελέγχου Λοιμώξεων', 'Στάλθηκαν προσκλήσεις για τις προφυλάξεις επαφής για πολυανθεκτικούς μικροοργανισμούς'),
    ((d0 - 28) + time '09:00', 'Διεύθυνση Νοσηλευτικής Υπηρεσίας', 'Στάλθηκαν προσκλήσεις για την αναγνώριση και αντιμετώπιση αναφυλαξίας'),
    ((d0 - 12) + time '13:00', 'Ε. Σταματίου, Υπεύθυνη Ποιότητας', 'Καταγράφηκε η αποτελεσματικότητα της σωστής ταυτοποίησης ασθενούς: αποτελεσματική'),
    ((d0 - 3) + time '09:30', 'Ιατρείο Εργασίας', 'Προστέθηκαν συμμετέχοντες στο «Ασφαλής χρήση αιχμηρών και PEP»'),
    ((d0 - 2) + time '10:15', 'Ομάδα Ελέγχου Λοιμώξεων', 'Προστέθηκαν συμμετέχοντες στο «Πρόληψη λοιμώξεων ουροποιητικού από καθετήρα (CAUTI)»')
  ), n as (
    select (row_number() over (order by h.at desc))::integer pos, h.at at time zone 'Europe/Athens' at, h.actor, h.action from h
  ), upd as (
    update public.training_history_events e set occurred_at = n.at, actor = n.actor, action = n.action, updated_by = p_actor
    from n
    where e.organization_id = v_org and e.position = n.pos
    returning e.position
  )
  insert into public.training_history_events(organization_id, position, occurred_at, actor, action, created_by, updated_by)
  select v_org, n.pos, n.at, n.actor, n.action, p_actor, p_actor
  from n
  where not exists (select 1 from upd u where u.position = n.pos)
    and not exists (select 1 from public.training_history_events e where e.organization_id = v_org and e.position = n.pos);
end;
$function$;

revoke all on function private.demo_seed_training(uuid, uuid) from public, anon, authenticated;
revoke all on function private.demo_seed_people_training(uuid, uuid) from public, anon, authenticated;
