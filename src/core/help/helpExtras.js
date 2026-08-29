export const helpExtras={
 '/':{
  checks:{el:['Ελέγξτε αν οι επείγουσες εκκρεμότητες έχουν ανοίξει.','Επιβεβαιώστε ότι οι ειδοποιήσεις που διαβάσατε έχουν μειωθεί από το badge.'],en:['Confirm that urgent pending items have been opened.','Check that notifications you read are removed from the unread badge.']},
  tip:{el:'Χρησιμοποιήστε το Dashboard ως σημείο εκκίνησης, όχι ως δεύτερο μητρώο. Η πραγματική εργασία ολοκληρώνεται στις αντίστοιχες ενότητες.',en:'Use the Dashboard as a starting point, not as a second registry. Complete the actual work in the underlying modules.'},
  related:['/surveillance','/controls','/training']
 },
 '/my-department':{
  checks:{el:['Ελέγξτε ότι εργάζεστε στο σωστό τμήμα/scope.','Μην ολοκληρώνετε εργασία που έχει ανατεθεί σε άλλο scope.'],en:['Confirm that you are working in the correct department/scope.','Do not complete work assigned to another scope.']},
  tip:{el:'Η τμηματική εικόνα πρέπει να απαντά «τι χρειάζεται να κάνουμε τώρα;» χωρίς να εκθέτει πληροφορίες άλλων τμημάτων.',en:'The department view should answer “what do we need to do now?” without exposing information from other departments.'},
  related:['/controls','/training','/documents']
 },
 '/my-profile':{
  checks:{el:['Ελέγξτε τα διοικητικά στοιχεία που εμφανίζονται.','Για λάθος τμήμα ή ιδιότητα ζητήστε διόρθωση από εξουσιοδοτημένο χρήστη.'],en:['Review the administrative details displayed in your record.','For an incorrect department or position, request a correction from an authorized user.']},
  tip:{el:'Η προσωπική καρτέλα δεν δίνει αυτόματα πρόσβαση σε ευαίσθητα δεδομένα υγείας.',en:'Your personal record does not automatically grant access to sensitive health information.'},
  related:['/training','/documents']
 },
 '/patients':{
  checks:{el:['Αναζητήστε πρώτα τον ασθενή για αποφυγή διπλοεγγραφής.','Επιβεβαιώστε τα βασικά στοιχεία πριν ανοίξετε νέα επιτήρηση.'],en:['Search for the patient first to prevent duplicate records.','Verify the core details before starting a new surveillance episode.']},
  tip:{el:'Μία σωστή ταυτοποίηση στην αρχή μειώνει λάθη σε εργαστήριο, επιτήρηση και αναφορές.',en:'Correct identification at the start reduces errors across Laboratory, Surveillance and reporting.'},
  related:['/surveillance','/laboratory']
 },
 '/surveillance':{
  checks:{el:['Ελέγξτε το timeline πριν προσθέσετε νέα πληροφορία.','Επιβεβαιώστε αν υπάρχουν νέα εργαστηριακά αποτελέσματα.','Ελέγξτε αν απαιτείται επανεκτίμηση απομόνωσης ή αγωγής.'],en:['Review the timeline before adding new information.','Check for newly validated laboratory results.','Confirm whether isolation or therapy requires reassessment.']},
  tip:{el:'Κρατήστε το επεισόδιο ενιαίο. Η επανακαταχώρηση των ίδιων δεδομένων σε διαφορετικά σημεία μειώνει την ιχνηλασιμότητα.',en:'Keep the episode as one continuous record. Re-entering the same information in multiple places reduces traceability.'},
  related:['/patients','/laboratory','/pharmacy']
 },
 '/laboratory':{
  checks:{el:['Παραλάβετε το δείγμα πριν την καταχώρηση αποτελέσματος.','Οριστικοποιήστε AST όπου απαιτείται.','Για κρίσιμο αποτέλεσμα τεκμηριώστε επικοινωνία.'],en:['Receive the sample before recording a result.','Complete AST where required.','For a critical result, document the communication.']},
  tip:{el:'Το Εργαστήριο είναι η πηγή αλήθειας για δείγματα, μικροβιολογία και AST. Μην αντιγράφετε αποτελέσματα χειροκίνητα στην Επιτήρηση.',en:'Laboratory is the source of truth for samples, microbiology and AST. Do not manually duplicate results in Surveillance.'},
  related:['/surveillance','/indicators']
 },
 '/prevention':{
  checks:{el:['Επιβεβαιώστε τμήμα και ημερομηνία καταγραφής.','Χρησιμοποιήστε την κατάλληλη βιβλιοθήκη/έκδοση bundle.','Ελέγξτε το αποτέλεσμα πριν την οριστική αποθήκευση.'],en:['Confirm department and record date.','Use the correct library/bundle version.','Review the calculated result before final save.']},
  tip:{el:'Η απλή καταχώρηση είναι σημαντικότερη από ένα βαρύ workflow. Συμπληρώστε μόνο ό,τι χρειάζεται για αξιόπιστο δείκτη και τεκμηρίωση.',en:'Simple recording is more valuable than a heavy workflow. Capture only what is needed for reliable indicators and evidence.'},
  related:['/indicators','/controls','/training']
 },
 '/controls':{
  checks:{el:['Ελέγξτε ότι ο έλεγχος αφορά το δικό σας scope.','Συμπληρώστε όλα τα υποχρεωτικά κριτήρια.','Προσθέστε τεκμηρίωση όπου ζητείται πριν την ολοκλήρωση.'],en:['Confirm that the control belongs to your scope.','Complete all mandatory criteria.','Attach required evidence before completing the control.']},
  tip:{el:'Η ολοκλήρωση ενός τμήματος δεν πρέπει να κλείνει τις εκκρεμότητες άλλων τμημάτων.',en:'Completion by one department must not close outstanding work for other departments.'},
  related:['/quality','/my-department']
 },
 '/quality':{
  checks:{el:['Ελέγξτε owner, προθεσμία και status κάθε CAPA.','Συνδέστε εύρημα και διορθωτική ενέργεια όπου υπάρχει σχέση.','Τεκμηριώστε effectiveness πριν το τελικό κλείσιμο.'],en:['Review owner, due date and status for every CAPA.','Link findings to corrective actions where relevant.','Document effectiveness before final closure.']},
  tip:{el:'Σε governed records προτιμάται διόρθωση/αρχειοθέτηση/void αντί για φυσική διαγραφή ιστορικού.',en:'For governed records, prefer correction, archiving or voiding rather than physically deleting history.'},
  related:['/controls','/indicators','/documents']
 },
 '/indicators':{
  checks:{el:['Ελέγξτε περίοδο, scope και denominator.','Επιβεβαιώστε την πηγή του αριθμητή και του παρονομαστή.','Χρησιμοποιήστε drill-down πριν ερμηνεύσετε ασυνήθιστη τιμή.'],en:['Check period, scope and denominator.','Verify the numerator and denominator data sources.','Use drill-down before interpreting an unusual value.']},
  tip:{el:'Ένας δείκτης πρέπει να είναι αναπαραγώγιμος: η ίδια πηγή και μέθοδος να δίνουν το ίδιο αποτέλεσμα.',en:'An indicator should be reproducible: the same source and method should produce the same result.'},
  related:['/prevention','/quality','/laboratory']
 },
 '/training':{
  checks:{el:['Ελέγξτε συμμετέχοντες και attendance.','Ολοκληρώστε assessment όπου απαιτείται.','Επιβεβαιώστε ότι το πιστοποιητικό εκδίδεται μόνο μετά την πραγματική ολοκλήρωση.'],en:['Review participants and attendance.','Complete the assessment where required.','Ensure certificates are issued only after actual completion.']},
  tip:{el:'Ο εργαζόμενος πρέπει να βλέπει μόνο τις δικές του αναθέσεις και πιστοποιήσεις, ενώ ο διαχειριστής έχει συνολική εικόνα.',en:'Employees should see only their own assignments and certificates, while administrators have the broader programme view.'},
  related:['/employees','/my-profile']
 },
 '/committees':{
  checks:{el:['Ελέγξτε απαρτία και συμμετέχοντες.','Καταγράψτε σαφείς αποφάσεις.','Κάθε follow-up ενέργεια πρέπει να έχει owner και deadline.'],en:['Confirm quorum and participants.','Record clear decisions.','Every follow-up action should have an owner and deadline.']},
  tip:{el:'Το πρακτικό έχει αξία όταν οι αποφάσεις μετατρέπονται σε παρακολουθήσιμες ενέργειες.',en:'Minutes become operationally useful when decisions are converted into trackable actions.'},
  related:['/documents','/quality']
 },
 '/documents':{
  checks:{el:['Ανοίξτε την τρέχουσα δημοσιευμένη έκδοση.','Μην αλλάζετε σιωπηλά published περιεχόμενο.','Ελέγξτε scope/κοινοποίηση πριν τη δημοσίευση.'],en:['Open the current published version.','Do not silently overwrite published content.','Review scope/sharing before publication.']},
  tip:{el:'Η διαχείριση εγγράφων πρέπει να διαχωρίζει πρόχειρο, δημοσιευμένο και αρχειοθετημένο περιεχόμενο.',en:'Document control should clearly separate draft, published and archived content.'},
  related:['/quality','/committees','/training']
 },
 '/employees':{
  checks:{el:['Ελέγξτε ότι τμήμα και ιδιότητα προέρχονται από τις κεντρικές βιβλιοθήκες.','Μην καταχωρείτε ιατρικές σημειώσεις σε διοικητικά πεδία.'],en:['Ensure department and position come from central libraries.','Do not store medical notes in administrative fields.']},
  tip:{el:'Η πρόσβαση HR και η κλινική πρόσβαση Ιατρού Εργασίας πρέπει να παραμένουν διακριτές.',en:'HR access and Occupational Health clinical access should remain clearly separated.'},
  related:['/occupational-health','/training','/my-profile']
 },
 '/pharmacy':{
  checks:{el:['Ελέγξτε ένδειξη και απαιτούμενη έγκριση.','Επιβεβαιώστε ότι η αγωγή συνδέεται με το σωστό επεισόδιο.','Αποφύγετε διπλή καταχώρηση θεραπείας.'],en:['Review indication and required approval.','Confirm therapy is linked to the correct episode.','Avoid duplicate therapy recording.']},
  tip:{el:'Stewardship σημαίνει ελεγχόμενη χρήση με τεκμηρίωση, όχι απλώς καταγραφή κατανάλωσης.',en:'Stewardship means controlled, documented use—not only consumption recording.'},
  related:['/surveillance','/indicators']
 },
 '/occupational-health':{
  checks:{el:['Επιβεβαιώστε την ταυτότητα εργαζομένου.','Ελέγξτε δόση, lot και ημερομηνίες εμβολιασμού.','Προγραμματίστε follow-up όπου απαιτείται.'],en:['Confirm employee identity.','Review vaccine dose, lot and dates.','Schedule follow-up where required.']},
  tip:{el:'Οι ιατρικές επισκέψεις είναι ευαίσθητες εγγραφές και δεν πρέπει να εμφανίζονται σε διοικητικούς ρόλους.',en:'Clinical visits are sensitive records and should not be exposed to administrative roles.'},
  related:['/employees','/my-profile']
 },
 '/lira':{
  checks:{el:['Διατυπώστε συγκεκριμένη ερώτηση.','Ελέγξτε τα underlying records πριν από κρίσιμη απόφαση.','Μην θεωρείτε τη σύνοψη AI ως αυτόνομη κλινική απόφαση.'],en:['Ask a specific question.','Review the underlying records before a critical decision.','Do not treat an AI summary as an autonomous clinical decision.']},
  tip:{el:'Η LIRA πρέπει να εξηγεί και να κατευθύνει προς την πηγή, όχι να αντικαθιστά την τεκμηριωμένη ανθρώπινη απόφαση.',en:'LIRA should explain and guide users to the source, not replace documented human decision-making.'},
  related:['/surveillance','/quality','/indicators']
 },
 '/management':{
  checks:{el:['Ελέγξτε οργανισμό και scope πριν από αλλαγή.','Για core περιεχόμενο χρησιμοποιήστε override/hide όπου προβλέπεται.','Επιβεβαιώστε ότι ρόλοι και permissions συμφωνούν με την πραγματική λειτουργία.'],en:['Verify organization and scope before making a change.','Use override/hide patterns for core content where applicable.','Confirm roles and permissions match the intended operational workflow.']},
  tip:{el:'Οι κεντρικές ρυθμίσεις πρέπει να μειώνουν τις ασυνέπειες στην εφαρμογή, όχι να δημιουργούν διαφορετικούς κανόνες ανά οθόνη.',en:'Central configuration should reduce inconsistency across the application, not create different rules for each screen.'},
  related:['/employees','/documents','/indicators']
 }
}
