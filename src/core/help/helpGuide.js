// Setup and user guide: ONE source for the in-app "Getting started" help and the PDF manual
// (tools/build-manual-pdf.mjs). Every text is a {el,en} pair so the two languages cannot drift.
// Module and add-on names/contents come from core/organization/operatingProfile.js at render time.
const l = (el, en) => ({ el, en })

export const guideContent = {
  title: l('Limoxis Observer — Οδηγός εγκατάστασης και χρήσης', 'Limoxis Observer — Setup and user guide'),
  subtitle: l('Από την πρώτη ημέρα μέχρι την καθημερινή λειτουργία', 'From day one to everyday operation'),

  intro: {
    purpose: l(
      'Το Limoxis Observer οργανώνει σε ένα περιβάλλον την καθημερινή εργασία πρόληψης και ελέγχου λοιμώξεων ενός νοσοκομείου: ασθενείς, εργαστήριο, επιτήρηση, πρόληψη, έλεγχοι, ποιότητα, εκπαίδευση, επιτροπές και έγγραφα. Κάθε νοσοκομείο χρησιμοποιεί μόνο τις ενότητες που του έχουν δοθεί και κάθε χρήστης βλέπει μόνο όσα επιτρέπει ο ρόλος του.',
      'Limoxis Observer brings a hospital’s day-to-day infection prevention and control work into one environment: patients, laboratory, surveillance, prevention, controls, quality, training, committees and documents. Each hospital uses only the modules it has been given and each user sees only what their role allows.'
    ),
    audience: l(
      'Ο οδηγός απευθύνεται σε τρεις ανθρώπους: τον Ιδιοκτήτη Πλατφόρμας (Platform Owner), που δημιουργεί το νοσοκομείο και επιλέγει τι θα βλέπει· τον Διαχειριστή Νοσοκομείου, που το στήνει· και τους χρήστες του νοσοκομείου, που το χρησιμοποιούν καθημερινά.',
      'The guide is for three people: the Platform Owner, who creates the hospital and chooses what it sees; the Hospital Admin, who sets it up; and the hospital users, who use it every day.'
    ),
    howToRead: l(
      'Αν ξεκινάτε από το μηδέν, διαβάστε με τη σειρά τα Κεφάλαια 1 έως 4. Αν ήδη δουλεύετε, ανοίξτε το Κεφάλαιο 2 («Πού βρίσκομαι;») και πηγαίνετε κατευθείαν στο επόμενο βήμα σας.',
      'If you start from zero, read Chapters 1 to 4 in order. If you are already working, open Chapter 2 (“Where am I?”) and go straight to your next step.'
    ),
  },

  // Chapter 2: situation -> what to do now.
  whereAmI: [
    [l('Δεν έχει δημιουργηθεί ακόμη το νοσοκομείο στην πλατφόρμα.', 'The hospital does not exist on the platform yet.'), l('Στάδιο 2: δημιουργήστε τον οργανισμό (Platform Owner).', 'Stage 2: create the organization (Platform Owner).')],
    [l('Ο οργανισμός υπάρχει αλλά δεν έχει επιλεγεί πακέτο ή ενότητες.', 'The organization exists but no package or modules have been chosen.'), l('Στάδιο 3: ορίστε το Προφίλ λειτουργίας (Platform Owner).', 'Stage 3: set the Operating profile (Platform Owner).')],
    [l('Ο Διαχειριστής Νοσοκομείου δεν έχει μπει ποτέ.', 'The Hospital Admin has never signed in.'), l('Στάδιο 4: ενεργοποίηση λογαριασμού· αν δεν ήρθε email, επαναποστολή πρόσκλησης.', 'Stage 4: account activation; if no email arrived, resend the invitation.')],
    [l('Ο Διαχειριστής μπήκε αλλά δεν υπάρχουν τμήματα ή χρήστες.', 'The admin is in, but there are no departments or users.'), l('Στάδιο 5: στήσιμο νοσοκομείου (τμήματα → χρήστες → βιβλιοθήκες).', 'Stage 5: set up the hospital (departments → users → libraries).')],
    [l('Όλα είναι έτοιμα και ξεκινά η πραγματική χρήση.', 'Everything is ready and real use starts.'), l('Στάδιο 6: ακολουθήστε τα βήματα του πακέτου σας (Κεφάλαιο 4).', 'Stage 6: follow the steps of your package (Chapter 4).')],
    [l('Δεν βλέπω μια ενότητα ή μια ενέργεια που περίμενα.', 'I cannot see a module or action I expected.'), l('Κεφάλαιο 8, «Δεν βλέπω μια ενότητα».', 'Chapter 8, “I cannot see a module”.')],
    [l('Θέλω να προσθέσω ή να αφαιρέσω ενότητα αργότερα.', 'I want to add or remove a module later.'), l('Στάδιο 9: αλλαγή πακέτου ή ενοτήτων (Platform Owner).', 'Stage 9: change the package or modules (Platform Owner).')],
    [l('Χρειάζομαι αναφορά για τη διοίκηση ή τον ΕΟΔΥ.', 'I need a report for management or ΕΟΔΥ.'), l('Στάδιο 8: Αναλύσεις και εκτύπωση/PDF.', 'Stage 8: Analysis and print/PDF.')],
  ],

  // Chapter 1: the nine stages, in order.
  journey: [
    {
      id: 'prepare', who: l('Υπεύθυνος έργου / Platform Owner', 'Project lead / Platform Owner'), where: l('Εκτός εφαρμογής', 'Outside the application'),
      title: l('Προετοιμασία', 'Preparation'),
      steps: [
        l('Συγκεντρώστε τα στοιχεία του νοσοκομείου: ονομασία, κωδικό, πόλη και περιφέρεια, αριθμό κλινών, email επικοινωνίας.', 'Gather the hospital’s details: name, code, city and region, bed count, contact email.'),
        l('Αποφασίστε ποιος θα είναι ο Διαχειριστής Νοσοκομείου και σημειώστε ονοματεπώνυμο και ένα email που διαβάζει πραγματικά. Εκεί θα σταλεί η πρόσκληση.', 'Decide who will be the Hospital Admin and note their full name and an email they actually read. The invitation is sent there.'),
        l('Διαλέξτε πακέτο (Κεφάλαιο 4). Αν διστάζετε, ξεκινήστε με το μικρότερο: μπορείτε να ξεκλειδώσετε ενότητες αργότερα και τίποτα δεν χάνεται.', 'Choose a package (Chapter 4). If unsure, start with the smaller one: you can unlock modules later and nothing is lost.'),
        l('Ετοιμάστε τη λίστα τμημάτων και τη λίστα χρηστών με τον ρόλο του καθενός.', 'Prepare the list of departments and the list of users with each one’s role.'),
      ],
      done: l('Έχετε πακέτο, email διαχειριστή, λίστα τμημάτων και λίστα χρηστών.', 'You have a package, the admin’s email, a department list and a user list.'),
    },
    {
      id: 'organization', who: l('Platform Owner', 'Platform Owner'), where: l('Κέντρο Πλατφόρμας › Οργανισμοί › Νέος οργανισμός', 'Platform Center › Organizations › New organization'),
      title: l('Δημιουργία οργανισμού', 'Create the organization'),
      steps: [
        l('Ανοίξτε το Κέντρο Πλατφόρμας και μπείτε στους Οργανισμούς.', 'Open the Platform Center and go to Organizations.'),
        l('Πατήστε «Νέος οργανισμός» και συμπληρώστε ταυτότητα και τοποθεσία.', 'Select “New organization” and fill in identity and location.'),
        l('Συμπληρώστε τον αρχικό Διαχειριστή Νοσοκομείου (όνομα και email). Του στέλνεται πρόσκληση.', 'Fill in the initial Hospital Admin (name and email). An invitation is sent to them.'),
        l('Αποθηκεύστε. Ο οργανισμός εμφανίζεται στο μητρώο.', 'Save. The organization appears in the registry.'),
      ],
      done: l('Ο οργανισμός φαίνεται στο μητρώο και ο διαχειριστής έχει κατάσταση «Εκκρεμής».', 'The organization is in the registry and the admin shows as “Pending”.'),
    },
    {
      id: 'profile', who: l('Platform Owner', 'Platform Owner'), where: l('Οργανισμοί › καρτέλα οργανισμού › Προφίλ λειτουργίας', 'Organizations › organization record › Operating profile'),
      title: l('Επιλογή πακέτου και ενοτήτων', 'Choose the package and modules'),
      steps: [
        l('Στην καρτέλα του οργανισμού βρείτε την ενότητα «Προφίλ λειτουργίας».', 'In the organization record find the “Operating profile” section.'),
        l('Βήμα 1: επιλέξτε το πακέτο. Η λίστα κάθε πακέτου δείχνει με τικ τι περιλαμβάνει και με κλειδί τι όχι.', 'Step 1: choose the package. Each package’s list shows with a tick what it includes and with a lock what it does not.'),
        l('Στο επιλεγμένο πακέτο, πατήστε το κλειδί μιας ενότητας για να την ξεκλειδώσετε (πορτοκαλί, έντονη γραφή) ή το τικ για να την κλειδώσετε. Το ίδιο ισχύει για τα πρόσθετα (Υγεία εργαζομένων, Φαρμακείο, Μελέτη επιπολασμού, LIRA & AI).', 'In the chosen package, click a module’s lock to unlock it (orange, bold) or its tick to lock it. The same applies to add-ons (Occupational health, Pharmacy, Prevalence survey, LIRA & AI).'),
        l('Αν εμφανιστεί πορτοκαλί προειδοποίηση («Χρειάζεται και: …»), ξεκλειδώστε και την ενότητα που λείπει. Είναι προειδοποίηση, δεν μπλοκάρει την αποθήκευση.', 'If an orange warning appears (“Also needs: …”), unlock the missing module too. It is a warning; it does not block saving.'),
        l('Βήμα 2: διαβάστε τη «Σύνοψη αλλαγών» και πατήστε «Αποθήκευση». Αν κλείνετε ενότητες, ζητείται επιβεβαίωση.', 'Step 2: read the “Summary of changes” and select “Save”. If you are switching modules off, confirmation is requested.'),
      ],
      done: l('Μετά την αποθήκευση η Σύνοψη γράφει «Καμία αλλαγή σε σχέση με το αποθηκευμένο προφίλ».', 'After saving, the Summary reads “No change from the saved profile”.'),
    },
    {
      id: 'activate', who: l('Διαχειριστής Νοσοκομείου', 'Hospital Admin'), where: l('Email πρόσκλησης › σελίδα ενεργοποίησης', 'Invitation email › activation page'),
      title: l('Ενεργοποίηση του λογαριασμού του διαχειριστή', 'Activate the admin’s account'),
      steps: [
        l('Ανοίξτε το email πρόσκλησης και πατήστε τον σύνδεσμο.', 'Open the invitation email and follow the link.'),
        l('Ορίστε προσωπικό κωδικό πρόσβασης. Τον κωδικό τον ορίζετε μόνο εσείς: ούτε ο Platform Owner ούτε άλλος διαχειριστής τον βλέπει.', 'Set a personal password. Only you set it: neither the Platform Owner nor another admin can see it.'),
        l('Πατήστε «Μετάβαση στη σύνδεση» και συνδεθείτε με το όνομα χρήστη που εμφανίζεται.', 'Select “Go to sign in” and sign in with the username shown.'),
        l('Αν δεν ήρθε email: ο Platform Owner ανοίγει την καρτέλα του οργανισμού, βρίσκει τον Hospital Admin και πατά «Επαναποστολή πρόσκλησης».', 'If no email arrived: the Platform Owner opens the organization record, finds the Hospital Admin and selects “Resend invitation”.'),
      ],
      done: l('Ο Διαχειριστής συνδέεται και στην καρτέλα του οργανισμού φαίνεται «Ενεργός».', 'The admin signs in and the organization record shows “Active”.'),
    },
    {
      id: 'setup', who: l('Διαχειριστής Νοσοκομείου', 'Hospital Admin'), where: l('Κέντρο Διαχείρισης', 'Management Center'),
      title: l('Στήσιμο του νοσοκομείου', 'Set up the hospital'),
      steps: [
        l('Βιβλιοθήκες › Τμήματα: δημιουργήστε πρώτα όλα τα τμήματα. Οι χρήστες συνδέονται με τμήμα.', 'Libraries › Departments: create all departments first. Users are linked to a department.'),
        l('Χρήστες & Ρόλοι: δημιουργήστε τους χρήστες, δώστε ρόλο και τμήμα. Κάθε χρήστης παίρνει πρόσκληση και ορίζει μόνος τον κωδικό του.', 'Users & Roles: create the users, give each a role and department. Each user receives an invitation and sets their own password.'),
        l('Βιβλιοθήκες: ελέγξτε τα μικρόβια, τα αντιβιοτικά και τις λοιπές κοινές τιμές. Τα βασικά (core) στοιχεία δεν διαγράφονται· κρύβονται ή παρακάμπτονται.', 'Libraries: review microorganisms, antibiotics and other shared values. Core items are not deleted; they are hidden or overridden.'),
        l('Κλινοημέρες: καταχωρίστε τις (αν υπάρχουν Δείκτες ή Επιτήρηση). Είναι ο παρονομαστής των δεικτών.', 'Patient-days: enter them (if Indicators or Surveillance exist). They are the denominator of the indicators.'),
        l('Δομικοί δείκτες: συμπληρώστε τα δομικά στοιχεία του νοσοκομείου όπου ζητούνται.', 'Structural indicators: fill in the hospital’s structural items where requested.'),
      ],
      done: l('Υπάρχουν τμήματα και οι βασικοί χρήστες έχουν μπει τουλάχιστον μία φορά.', 'Departments exist and the key users have signed in at least once.'),
    },
    {
      id: 'golive', who: l('Όλοι οι χρήστες', 'All users'), where: l('Ανά πακέτο — Κεφάλαιο 4', 'Per package — Chapter 4'),
      title: l('Εκκίνηση λειτουργίας', 'Go live'),
      steps: [
        l('Ακολουθήστε τα βήματα του πακέτου σας, με τη σειρά, από το Κεφάλαιο 4.', 'Follow the steps of your package, in order, from Chapter 4.'),
        l('Πρώτη εβδομάδα: χρησιμοποιήστε πραγματικά δεδομένα μόνο όταν οι ρόλοι και τα τμήματα έχουν ελεγχθεί.', 'First week: use real data only once roles and departments have been checked.'),
      ],
      done: l('Η πρώτη πραγματική εγγραφή έχει καταχωριστεί και φαίνεται στις Αναλύσεις.', 'The first real record has been entered and shows in Analysis.'),
    },
    {
      id: 'daily', who: l('Όλοι οι χρήστες', 'All users'), where: l('Κεντρική εικόνα και οι ενότητες του ρόλου σας', 'Dashboard and your role’s modules'),
      title: l('Καθημερινή χρήση', 'Daily use'),
      steps: [
        l('Ξεκινήστε από την Κεντρική εικόνα: δείχνει μόνο όσα χρειάζονται προσοχή και όσα δικαιούστε να γνωρίζετε.', 'Start from the Dashboard: it shows only what needs attention and what you are entitled to know.'),
        l('Ανοίξτε την εργασία που περιμένει και ολοκληρώστε την. Μην ξαναγράφετε δεδομένα που υπάρχουν ήδη: το Εργαστήριο, η Επιτήρηση και οι Δείκτες μοιράζονται τα ίδια στοιχεία.', 'Open the task that is waiting and complete it. Do not re-enter data that already exists: Laboratory, Surveillance and Indicators share the same data.'),
        l('Στο τέλος της εβδομάδας δείτε τις εκκρεμότητες του τμήματος και τα καθυστερημένα.', 'At the end of the week check the department’s pending and overdue items.'),
      ],
      done: l('Δεν υπάρχουν εκπρόθεσμες εργασίες χωρίς λόγο.', 'There are no overdue tasks without a reason.'),
    },
    {
      id: 'reports', who: l('Ομάδα Ελέγχου Λοιμώξεων, Διοίκηση', 'Infection Control team, management'), where: l('Αναλύσεις', 'Analysis'),
      title: l('Αναλύσεις και αναφορές', 'Analysis and reports'),
      steps: [
        l('Ανοίξτε τις Αναλύσεις και διαλέξτε έτος και περίοδο (έτος, εξάμηνο, τρίμηνο ή μήνα).', 'Open Analysis and choose year and period (year, half-year, quarter or month).'),
        l('Διαλέξτε την καρτέλα της ενότητας. Κάθε ενότητα που έχει ανοιχτεί έχει δική της καρτέλα· οι κλειδωμένες δεν εμφανίζονται.', 'Choose the module’s tab. Every unlocked module has its own tab; locked ones do not appear.'),
        l('Προαιρετικά, επιλέξτε έτος σύγκρισης ή τμήμα.', 'Optionally choose a comparison year or a department.'),
        l('Χρησιμοποιήστε την εκτύπωση ή την εξαγωγή PDF για να αποθηκεύσετε ή να στείλετε την αναφορά της καρτέλας.', 'Use print or PDF export to save or send the tab’s report.'),
      ],
      done: l('Έχετε PDF ή εκτύπωση της αναφοράς για την περίοδο.', 'You have a PDF or printout of the report for the period.'),
    },
    {
      id: 'change', who: l('Platform Owner', 'Platform Owner'), where: l('Οργανισμοί › καρτέλα › Προφίλ λειτουργίας', 'Organizations › record › Operating profile'),
      title: l('Αλλαγή πακέτου ή ενοτήτων αργότερα', 'Change the package or modules later'),
      steps: [
        l('Ανοίξτε ξανά το Προφίλ λειτουργίας του νοσοκομείου και ξεκλειδώστε ή κλειδώστε ό,τι χρειάζεται.', 'Reopen the hospital’s Operating profile and unlock or lock whatever is needed.'),
        l('Ό,τι κλειδώνεται κρύβεται από όλους τους χρήστες: μενού, ενέργειες, καρτέλες Αναλύσεων. Δεν διαγράφεται τίποτα· αν ξεκλειδωθεί ξανά, επανέρχεται όπως ήταν.', 'Whatever is locked is hidden from every user: menu, actions, Analysis tabs. Nothing is deleted; if unlocked again it comes back as it was.'),
        l('Οι αλλαγές ισχύουν για όλο το νοσοκομείο. Αν κάποιος δεν τις δει αμέσως, ζητήστε του να ανανεώσει τη σελίδα.', 'Changes apply to the whole hospital. If someone does not see them at once, ask them to refresh the page.'),
      ],
      done: l('Οι χρήστες βλέπουν τις νέες ενότητες ή δεν βλέπουν πια τις κλειδωμένες.', 'Users see the new modules, or no longer see the locked ones.'),
    },
  ],

  // Chapter 4: the three packages with ordered go-live steps.
  packages: [
    {
      id: 'basic',
      forWhom: l('Νοσοκομείο ή μονάδα που ξεκινά μόνο με το μητρώο ασθενών ή θέλει να προσθέτει ενότητες σταδιακά.', 'A hospital or unit that starts with the patient registry only, or wants to add modules gradually.'),
      goal: l('Να υπάρχει σωστό, χωρίς διπλοεγγραφές μητρώο ασθενών, πάνω στο οποίο θα προστεθούν οι υπόλοιπες ενότητες.', 'A correct registry of patients without duplicates, on which the other modules are added later.'),
      steps: [
        { title: l('Επιλογή πακέτου', 'Choose the package'), who: l('Platform Owner', 'Platform Owner'), text: l('Στο Προφίλ λειτουργίας επιλέξτε «Βασική καταγραφή» και αποθηκεύστε.', 'In the Operating profile choose “Basic records” and save.') },
        { title: l('Τμήματα', 'Departments'), who: l('Διαχειριστής Νοσοκομείου', 'Hospital Admin'), text: l('Κέντρο Διαχείρισης › Βιβλιοθήκες › Τμήματα: δημιουργήστε όλα τα τμήματα.', 'Management Center › Libraries › Departments: create all departments.') },
        { title: l('Χρήστες', 'Users'), who: l('Διαχειριστής Νοσοκομείου', 'Hospital Admin'), text: l('Χρήστες & Ρόλοι: δημιουργήστε τον Υπεύθυνο Ελέγχου Λοιμώξεων και όσους θα καταχωρούν ασθενείς. Δώστε τον κατάλληλο ρόλο και τμήμα.', 'Users & Roles: create the Infection Control Lead and those who will register patients. Give the right role and department.') },
        { title: l('Πρώτος ασθενής', 'First patient'), who: l('Εξουσιοδοτημένος χρήστης', 'Authorized user'), text: l('Ασθενείς: αναζητήστε πρώτα τον ασθενή. Μόνο αν δεν υπάρχει, δημιουργήστε νέα καρτέλα με τα ελάχιστα απαραίτητα στοιχεία.', 'Patients: search for the patient first. Only if not found, create a new record with the minimum required details.') },
        { title: l('Επέκταση', 'Expand'), who: l('Platform Owner', 'Platform Owner'), text: l('Όταν χρειαστεί εργαστήριο ή αναφορές ΕΟΔΥ/EARS-Net, ξεκλειδώστε τις ενότητες στο Προφίλ λειτουργίας (βλ. «Εργαστηριακή καταγραφή» παρακάτω).', 'When you need laboratory or ΕΟΔΥ/EARS-Net reports, unlock the modules in the Operating profile (see “Laboratory records” below).') },
      ],
      firstWeek: [
        l('Όλοι οι χρήστες έχουν ενεργοποιήσει λογαριασμό και βλέπουν τα σωστά τμήματα.', 'All users have activated their account and see the right departments.'),
        l('Η αναζήτηση πριν από κάθε νέα καρτέλα έχει γίνει συνήθεια: δεν υπάρχουν διπλοεγγραφές.', 'Searching before every new record is a habit: there are no duplicates.'),
        l('Έχετε αποφασίσει ποια ενότητα προστίθεται επόμενη και πότε.', 'You have decided which module is added next and when.'),
      ],
      success: l('Κάθε ασθενής υπάρχει μία φορά και μπορεί να βρεθεί αμέσως.', 'Every patient exists once and can be found at once.'),
    },
    {
      id: 'surveillance',
      forWhom: l('Νοσοκομείο που θέλει εργαστηριακή καταγραφή, αναφορές ΕΟΔΥ/EARS-Net και επιτήρηση λοιμώξεων με δείκτες, χωρίς το πλήρες πρόγραμμα ελέγχου.', 'A hospital that wants laboratory records, ΕΟΔΥ/EARS-Net reports and infection surveillance with indicators, without the full control programme.'),
      goal: l('Κάθε θετική καλλιέργεια να καταλήγει σε επεισόδιο επιτήρησης με ταξινόμηση HAI, αγωγή, απομόνωση και έκβαση, και οι δείκτες να βγαίνουν αυτόματα.', 'Every positive culture ends up in a surveillance episode with HAI classification, therapy, isolation and outcome, and indicators are produced automatically.'),
      steps: [
        { title: l('Επιλογή πακέτου', 'Choose the package'), who: l('Platform Owner', 'Platform Owner'), text: l('Επιλέξτε «Εργαστήριο & Επιτήρηση λοιμώξεων» και αποθηκεύστε.', 'Choose “Laboratory & infection surveillance” and save.') },
        { title: l('Τμήματα και χρήστες', 'Departments and users'), who: l('Διαχειριστής Νοσοκομείου', 'Hospital Admin'), text: l('Δημιουργήστε τα τμήματα και μετά τους χρήστες: Εργαστήριο (για δείγματα και αποτελέσματα), Υπεύθυνο και Μέλη Ελέγχου Λοιμώξεων (για επιτήρηση).', 'Create the departments and then the users: Laboratory (samples and results), Infection Control Lead and Members (surveillance).') },
        { title: l('Κλινοημέρες', 'Patient-days'), who: l('Διαχειριστής Νοσοκομείου', 'Hospital Admin'), text: l('Κέντρο Διαχείρισης › Κλινοημέρες: καταχωρίστε τις ανά τμήμα και περίοδο. Χωρίς αυτές οι δείκτες δεν έχουν παρονομαστή.', 'Management Center › Patient-days: enter them per department and period. Without them, indicators have no denominator.') },
        { title: l('Δείγμα και αποτέλεσμα', 'Sample and result'), who: l('Εργαστήριο', 'Laboratory'), text: l('Εργαστήριο: ανοίξτε την ουρά εκκρεμών, επιλέξτε δείγμα, καταχωρίστε και επικυρώστε αποτέλεσμα και AST. Το δείγμα συνδέεται με τον ασθενή, χωρίς δεύτερη εγγραφή.', 'Laboratory: open the pending queue, choose a sample, enter and validate the result and AST. The sample is linked to the patient with no second entry.') },
        { title: l('Κρίσιμα αποτελέσματα', 'Critical results'), who: l('Εργαστήριο', 'Laboratory'), text: l('Για κρίσιμο αποτέλεσμα, τεκμηριώστε την επικοινωνία: ποιος ενημερώθηκε και πότε.', 'For a critical result, document the communication: who was informed and when.') },
        { title: l('Επεισόδιο επιτήρησης', 'Surveillance episode'), who: l('Ομάδα Ελέγχου Λοιμώξεων', 'Infection Control team'), text: l('Επιτήρηση: ανοίξτε το ενεργό επεισόδιο του ασθενή. Συμπληρώστε κλινική αξιολόγηση και ταξινόμηση HAI. Η μικροβιολογία έρχεται από το Εργαστήριο.', 'Surveillance: open the patient’s active episode. Fill in the clinical assessment and HAI classification. Microbiology comes from the Laboratory.') },
        { title: l('Αγωγή, απομόνωση, έκβαση', 'Therapy, isolation, outcome'), who: l('Ομάδα Ελέγχου Λοιμώξεων', 'Infection Control team'), text: l('Στο ίδιο επεισόδιο καταχωρίστε αγωγή, μέτρα απομόνωσης και επανεκτιμήσεις. Κλείστε το με έκβαση μόνο όταν ολοκληρωθεί.', 'In the same episode record therapy, isolation measures and reassessments. Close it with an outcome only when complete.') },
        { title: l('Δείκτες και Αναλύσεις', 'Indicators and Analysis'), who: l('Ομάδα Ελέγχου Λοιμώξεων', 'Infection Control team'), text: l('Δείκτες: ελέγξτε αριθμητή και παρονομαστή. Αναλύσεις: δείτε Επιτήρηση & HAI, Μικροβιολογία, AMR και Εθνική Επιτήρηση.', 'Indicators: check numerator and denominator. Analysis: see Surveillance & HAI, Microbiology, AMR and National surveillance.') },
      ],
      firstWeek: [
        l('Υπάρχουν κλινοημέρες για την τρέχουσα περίοδο.', 'Patient-days exist for the current period.'),
        l('Τουλάχιστον ένα δείγμα έχει φτάσει από το Εργαστήριο στην Επιτήρηση χωρίς διπλοκαταχώριση.', 'At least one sample has gone from the Laboratory to Surveillance without double entry.'),
        l('Τα ενεργά επεισόδια έχουν επανεκτίμηση απομόνωσης που δεν έχει λήξει.', 'Active episodes have an isolation review that is not overdue.'),
      ],
      success: l('Ο Υπεύθυνος βλέπει στις Αναλύσεις τα HAI και την αντοχή της περιόδου χωρίς χειροκίνητη επεξεργασία.', 'The Lead sees the period’s HAI and resistance in Analysis without manual processing.'),
    },
    {
      id: 'full',
      forWhom: l('Νοσοκομείο που θέλει ολόκληρο το πρόγραμμα ελέγχου λοιμώξεων: επιτήρηση και, επιπλέον, πρόληψη, ελέγχους, ποιότητα, εκπαίδευση, επιτροπές και έγγραφα.', 'A hospital that wants the whole infection control programme: surveillance plus prevention, controls, quality, training, committees and documents.'),
      goal: l('Να λειτουργεί ένας πλήρης κύκλος: καταγραφή, έλεγχος, διορθωτική ενέργεια, εκπαίδευση και τεκμηρίωση.', 'A complete cycle works: recording, checking, corrective action, training and documentation.'),
      steps: [
        { title: l('Επιλογή πακέτου', 'Choose the package'), who: l('Platform Owner', 'Platform Owner'), text: l('Επιλέξτε «Πλήρες πρόγραμμα Ελέγχου Λοιμώξεων» και αποθηκεύστε.', 'Choose “Full infection control programme” and save.') },
        { title: l('Βασική λειτουργία', 'Core operation'), who: l('Όλοι', 'Everyone'), text: l('Κάντε πρώτα τα βήματα του πακέτου «Εργαστήριο & Επιτήρηση» (προηγούμενη ενότητα). Το πλήρες πρόγραμμα τα περιλαμβάνει.', 'First do the steps of the “Laboratory & surveillance” package (previous section). The full programme includes them.') },
        { title: l('Πρόληψη', 'Prevention'), who: l('Ομάδα Ελέγχου Λοιμώξεων', 'Infection Control team'), text: l('Πρόληψη: καταγράψτε παρατηρήσεις Υγιεινής Χεριών (WHO), αξιολογήσεις δεσμών μέτρων (CLABSI, CAUTI, VAP/VAE, SSI), αντισηπτικά και απόβλητα.', 'Prevention: record WHO hand hygiene observations, bundle assessments (CLABSI, CAUTI, VAP/VAE, SSI), antiseptics and waste.') },
        { title: l('Έλεγχοι', 'Controls'), who: l('Υπεύθυνος και Προϊστάμενοι', 'Lead and Department Managers'), text: l('Έλεγχοι: ορίστε τους ελέγχους και αναθέστε τους σε τμήματα. Οι χρήστες τους εκτελούν με αποτέλεσμα και τεκμηρίωση.', 'Controls: define the controls and assign them to departments. Users perform them with a result and documentation.') },
        { title: l('Ποιότητα', 'Quality'), who: l('Υπεύθυνος Ποιότητας', 'Quality Manager'), text: l('Κέντρο Ποιότητας: καταγράψτε συμβάντα, audits και ευρήματα. Για κάθε εύρημα ανοίξτε CAPA με υπεύθυνο και προθεσμία.', 'Quality Center: record incidents, audits and findings. For each finding open a CAPA with an owner and due date.') },
        { title: l('Εκπαίδευση', 'Training'), who: l('Διαχειριστές εκπαίδευσης', 'Training managers'), text: l('Εκπαίδευση: φτιάξτε πρόγραμμα, προσθέστε συμμετέχοντες και καταγράψτε ολοκληρώσεις και βαθμολογίες.', 'Training: create a programme, add participants and record completions and scores.') },
        { title: l('Επιτροπές και Έγγραφα', 'Committees and Documents'), who: l('Γραμματεία Επιτροπής', 'Committee Secretariat'), text: l('Επιτροπές: προγραμματίστε συνεδριάσεις, γράψτε πρακτικά και αποφάσεις. Έγγραφα: οδηγήστε κάθε ελεγχόμενο έγγραφο από προσχέδιο σε έγκριση και δημοσίευση.', 'Committees: schedule meetings, write minutes and decisions. Documents: take each controlled document from draft to approval and publication.') },
        { title: l('Αναθεώρηση', 'Review'), who: l('Ομάδα Ελέγχου Λοιμώξεων', 'Infection Control team'), text: l('Στις Αναλύσεις δείτε Πρόληψη, Υγιεινή Χεριών, Έλεγχοι, Ποιότητα, Εκπαίδευση και Διακυβέρνηση και αποφασίστε διορθωτικές ενέργειες.', 'In Analysis review Prevention, Hand hygiene, Controls, Quality, Training and Governance and decide corrective actions.') },
      ],
      firstWeek: [
        l('Έχει οριστεί ο πρώτος κύκλος ελέγχων και ανατεθεί σε τμήματα.', 'The first cycle of controls has been defined and assigned to departments.'),
        l('Η πρώτη παρατήρηση Υγιεινής Χεριών και η πρώτη αξιολόγηση δέσμης έχουν καταχωριστεί.', 'The first hand hygiene observation and first bundle assessment have been recorded.'),
        l('Υπάρχει προγραμματισμένη συνεδρίαση επιτροπής και τουλάχιστον ένα ελεγχόμενο έγγραφο σε εξέλιξη.', 'A committee meeting is scheduled and at least one controlled document is in progress.'),
      ],
      success: l('Κάθε εύρημα έχει CAPA με υπεύθυνο, κάθε έλεγχος έχει αποτέλεσμα και τίποτα δεν είναι εκπρόθεσμο χωρίς λόγο.', 'Every finding has a CAPA with an owner, every control has a result and nothing is overdue without a reason.'),
    },
  ],

  // The most common custom combination.
  recipes: [
    {
      id: 'laboratory',
      title: l('Εργαστηριακή καταγραφή (Βασική + Εργαστήριο + ΕΟΔΥ/EARS-Net)', 'Laboratory records (Basic + Laboratory + ΕΟΔΥ/EARS-Net)'),
      when: l('Όταν το νοσοκομείο θέλει εργαστήριο, μικροβιολογία/AMR και αναφορές ΕΟΔΥ & EARS-Net, αλλά όχι επιτήρηση λοιμώξεων.', 'When the hospital wants the laboratory, microbiology/AMR and ΕΟΔΥ & EARS-Net reports, but not infection surveillance.'),
      steps: [
        l('Platform Owner: επιλέξτε «Βασική καταγραφή» και ξεκλειδώστε «Εργαστήριο & μικροβιολογία/AMR» και «Αναφορές ΕΟΔΥ & EARS-Net». Η κάρτα εμφανίζει «Προσαρμοσμένο». Αποθηκεύστε.', 'Platform Owner: choose “Basic records” and unlock “Laboratory & microbiology/AMR” and “ΕΟΔΥ & EARS-Net reports”. The card shows “Custom”. Save.'),
        l('Διαχειριστής: δημιουργήστε τα τμήματα και έναν χρήστη με ρόλο Εργαστήριο.', 'Admin: create the departments and a user with the Laboratory role.'),
        l('Εργαστήριο: ουρά εκκρεμών → δείγμα → αποτέλεσμα και AST → κρίσιμη επικοινωνία όπου χρειάζεται.', 'Laboratory: pending queue → sample → result and AST → critical communication where needed.'),
        l('Αναλύσεις: Μικροβιολογία, AMR / MDR-XDR, Εθνική Επιτήρηση και Αναφορές & ποιότητα δεδομένων (ποιότητα δεδομένων, ειδοποιήσεις ΕΟΔΥ, εξαγωγή EARS-Net).', 'Analysis: Microbiology, AMR / MDR-XDR, National surveillance and Reporting & data quality (data quality, ΕΟΔΥ notifications, EARS-Net export).'),
      ],
    },
  ],

  // Chapter 5: every module and add-on, keyed like MODULES / ADDONS in operatingProfile.js.
  modules: {
    patients: {
      what: l('Το μητρώο ασθενών και το σημείο εισόδου στον φάκελο επιτήρησης. Είναι πάντα ανοιχτό.', 'The patient registry and the entry point to the surveillance record. Always on.'),
      users: l('Ομάδα Ελέγχου Λοιμώξεων και εξουσιοδοτημένοι κλινικοί ρόλοι.', 'Infection Control team and authorized clinical roles.'),
      needs: null,
      analysis: l('Δεν έχει δική του καρτέλα: τα στοιχεία των ασθενών δεν εμφανίζονται στις Αναλύσεις.', 'No tab of its own: patient details never appear in Analysis.'),
      start: l('Αναζητήστε πρώτα τον ασθενή, δημιουργήστε μόνο αν δεν υπάρχει.', 'Search for the patient first; create only if not found.'),
    },
    laboratory: {
      what: l('Δείγματα, καλλιέργειες, ευαισθησία (AST) και επικοινωνία κρίσιμων αποτελεσμάτων. Είναι η πηγή αλήθειας για τη μικροβιολογία.', 'Samples, cultures, susceptibility (AST) and communication of critical results. It is the source of truth for microbiology.'),
      users: l('Εργαστήριο, Ομάδα Ελέγχου Λοιμώξεων.', 'Laboratory, Infection Control team.'),
      needs: null,
      analysis: l('Καρτέλες «Μικροβιολογία» και «AMR / MDR-XDR»: θετικές καλλιέργειες, MDR/XDR/PDR, κρίσιμα αποτελέσματα, τμήματα με ευρήματα, ευαισθησία ανά οργανισμό.', 'Tabs “Microbiology” and “AMR / MDR-XDR”: positive cultures, MDR/XDR/PDR, critical results, departments with findings, susceptibility per organism.'),
      start: l('Ανοίξτε την ουρά εκκρεμών δειγμάτων και καταχωρίστε το πρώτο αποτέλεσμα.', 'Open the pending sample queue and enter the first result.'),
    },
    national: {
      what: l('Αναφορές προς τον ΕΟΔΥ και το EARS-Net, με έλεγχο ποιότητας δεδομένων πριν την αποστολή.', 'Reports to ΕΟΔΥ and EARS-Net, with a data quality check before submission.'),
      users: l('Υπεύθυνος και Μέλη Ελέγχου Λοιμώξεων.', 'Infection Control Lead and Members.'),
      needs: ['laboratory'],
      analysis: l('Καρτέλες «Εθνική Επιτήρηση» και «Αναφορές & ποιότητα δεδομένων»: ειδοποιήσεις ΕΟΔΥ, εξαγωγή EARS-Net και ελλείψεις δεδομένων.', 'Tabs “National surveillance” and “Reporting & data quality”: ΕΟΔΥ notifications, EARS-Net export and data gaps.'),
      start: l('Ανοίξτε «Αναφορές & ποιότητα δεδομένων» και διορθώστε πρώτα τις ελλείψεις.', 'Open “Reporting & data quality” and fix the gaps first.'),
    },
    surveillance: {
      what: l('Ο φάκελος επιτήρησης λοίμωξης: κλινική αξιολόγηση, ταξινόμηση HAI, μικροβιολογία, αγωγή, απομόνωση, συσκευές, επανεκτιμήσεις και έκβαση, σε ενιαίο χρονολόγιο.', 'The infection surveillance record: clinical assessment, HAI classification, microbiology, therapy, isolation, devices, reassessments and outcome, in one timeline.'),
      users: l('Ομάδα Ελέγχου Λοιμώξεων, Ιατρός Αξιολογητής, Link Nurse.', 'Infection Control team, Doctor Reviewer, Link Nurse.'),
      needs: ['laboratory'],
      analysis: l('Καρτέλες «Επιτήρηση & HAI» και «Αντιμικροβιακά»: επεισόδια, επιβεβαιωμένα και πιθανά HAI, ενεργές απομονώσεις, επεμβατικές συσκευές, έκβαση, χρήση αντιμικροβιακών.', 'Tabs “Surveillance & HAI” and “Antimicrobials”: episodes, confirmed and probable HAI, active isolations, invasive devices, outcome, antimicrobial use.'),
      start: l('Ανοίξτε το ενεργό επεισόδιο ενός ασθενή και συμπληρώστε την κλινική αξιολόγηση.', 'Open a patient’s active episode and fill in the clinical assessment.'),
    },
    indicators: {
      what: l('Δείκτες με ορισμό, αριθμητή, παρονομαστή και περίοδο, που υπολογίζονται από τα δεδομένα της επιτήρησης και τις κλινοημέρες.', 'Indicators with a definition, numerator, denominator and period, computed from surveillance data and patient-days.'),
      users: l('Ομάδα Ελέγχου Λοιμώξεων, Διοίκηση.', 'Infection Control team, management.'),
      needs: ['surveillance'],
      analysis: l('Δεν έχει δική του καρτέλα: οι δείκτες φαίνονται στην οθόνη «Δείκτες» και τροφοδοτούν τη Σύνοψη.', 'No tab of its own: indicators appear on the “Indicators” screen and feed the Overview.'),
      start: l('Καταχωρίστε πρώτα τις κλινοημέρες, μετά ανοίξτε τους Δείκτες.', 'Enter patient-days first, then open Indicators.'),
    },
    prevention: {
      what: l('Υγιεινή Χεριών (WHO), δέσμες μέτρων πρόληψης, αντισηπτικά και απόβλητα.', 'Hand hygiene (WHO), prevention bundles, antiseptics and waste.'),
      users: l('Ομάδα Ελέγχου Λοιμώξεων και χρήστες με αντίστοιχη αρμοδιότητα.', 'Infection Control team and users with the matching responsibility.'),
      needs: null,
      analysis: l('Καρτέλες «Πρόληψη» και «Υγιεινή Χεριών»: συμμόρφωση δεσμών μέτρων, συμμόρφωση υγιεινής χεριών (στόχος ≥ 80% ΠΟΥ), απόβλητα ανά τμήμα.', 'Tabs “Prevention” and “Hand hygiene”: bundle compliance, hand hygiene compliance (WHO target ≥ 80%), waste per department.'),
      start: l('Καταχωρίστε την πρώτη παρατήρηση Υγιεινής Χεριών.', 'Enter the first hand hygiene observation.'),
    },
    controls: {
      what: l('Έλεγχοι που ανατίθενται σε τμήματα και εκτελούνται με αποτέλεσμα και τεκμηρίωση.', 'Controls assigned to departments and performed with a result and documentation.'),
      users: l('Υπεύθυνος, Προϊστάμενοι και Χρήστες Τμήματος.', 'Lead, Department Managers and Department Users.'),
      needs: null,
      analysis: l('Καρτέλα «Έλεγχοι»: εκτελέσεις, ποσοστό με εύρημα, εκπρόθεσμοι έλεγχοι, εκτελέσεις και ευρήματα ανά τμήμα.', 'Tab “Controls”: executions, share with findings, overdue controls, executions and findings per department.'),
      start: l('Ορίστε έναν έλεγχο και αναθέστε τον σε ένα τμήμα.', 'Define a control and assign it to a department.'),
    },
    quality: {
      what: l('Συμβάντα, audits, ευρήματα και CAPA (διορθωτικές και προληπτικές ενέργειες) σε ελεγχόμενη ροή.', 'Incidents, audits, findings and CAPA (corrective and preventive actions) in a controlled flow.'),
      users: l('Υπεύθυνος Ποιότητας, Ομάδα Ελέγχου Λοιμώξεων, κάθε εργαζόμενος για αναφορά συμβάντος.', 'Quality Manager, Infection Control team, any employee to report an incident.'),
      needs: null,
      analysis: l('Καρτέλα «Ποιότητα»: συμβάντα, συμβάντα με βλάβη, ανοιχτά και εκπρόθεσμα CAPA, σοβαρότητα και κατάσταση.', 'Tab “Quality”: incidents, incidents with harm, open and overdue CAPA, severity and status.'),
      start: l('Αναφέρετε ένα συμβάν και ανοίξτε CAPA με υπεύθυνο και προθεσμία.', 'Report an incident and open a CAPA with an owner and due date.'),
    },
    training: {
      what: l('Εκπαιδευτικά προγράμματα, συμμετέχοντες, ολοκληρώσεις, αξιολογήσεις και πιστοποιητικά.', 'Training programmes, participants, completions, assessments and certificates.'),
      users: l('Διαχειριστές εκπαίδευσης· ο εργαζόμενος βλέπει μόνο τις δικές του εκπαιδεύσεις.', 'Training managers; an employee sees only their own training.'),
      needs: null,
      analysis: l('Καρτέλα «Εκπαίδευση»: ποσοστό ολοκλήρωσης, εκπρόθεσμες αναθέσεις, μέση βαθμολογία, ανά τμήμα.', 'Tab “Training”: completion rate, overdue assignments, average score, per department.'),
      start: l('Δημιουργήστε ένα πρόγραμμα και αναθέστε το σε ένα τμήμα.', 'Create a programme and assign it to a department.'),
    },
    governance: {
      what: l('Επιτροπές (συνεδριάσεις, θέματα, πρακτικά, αποφάσεις) και ελεγχόμενα Έγγραφα με κύκλο ζωής από προσχέδιο έως δημοσίευση και αρχειοθέτηση.', 'Committees (meetings, agenda, minutes, decisions) and controlled Documents with a lifecycle from draft to publication and archiving.'),
      users: l('Γραμματεία Επιτροπής, Υπεύθυνος, εξουσιοδοτημένοι χρήστες.', 'Committee Secretariat, Lead, authorized users.'),
      needs: null,
      analysis: l('Καρτέλα «Διακυβέρνηση»: ελεγχόμενα έγγραφα και έγγραφα προς αναθεώρηση, συνεδριάσεις επιτροπών και εκκρεμή πρακτικά.', 'Tab “Governance”: controlled documents and documents due for review, committee meetings and pending minutes.'),
      start: l('Προγραμματίστε την πρώτη συνεδρίαση ή δημιουργήστε το πρώτο έγγραφο.', 'Schedule the first meeting or create the first document.'),
    },
    occupational_health: {
      what: l('Επισκέψεις Ιατρού Εργασίας, εμβολιασμοί και επανέλεγχοι εργαζομένων. Τα ιατρικά στοιχεία μένουν χωριστά από το HR.', 'Occupational physician visits, vaccinations and employee follow-ups. Medical data stays separate from HR.'),
      users: l('Ιατρός Εργασίας (το HR δεν βλέπει ιατρικά στοιχεία).', 'Occupational Physician (HR does not see medical data).'),
      needs: null,
      analysis: l('Καρτέλα «Εργαζόμενοι»: εμβολιαστική κάλυψη, επισκέψεις, εκπρόθεσμοι επανέλεγχοι. Μόνο συγκεντρωτικά και μόνο με το κατάλληλο δικαίωμα.', 'Tab “Employees”: vaccination coverage, visits, overdue follow-ups. Aggregated only, and only with the right permission.'),
      start: l('Καταχωρίστε την πρώτη επίσκεψη ή τον πρώτο εμβολιασμό.', 'Enter the first visit or vaccination.'),
    },
    pharmacy: {
      what: l('Κατανάλωση και χορηγήσεις αντιμικροβιακών, εγκρίσεις περιορισμένης χρήσης, σύνδεση με την αγωγή της επιτήρησης.', 'Antimicrobial consumption and dispensing, restricted-use approvals, link with surveillance therapy.'),
      users: l('Φαρμακείο, Ομάδα Ελέγχου Λοιμώξεων.', 'Pharmacy, Infection Control team.'),
      needs: null,
      analysis: l('Καρτέλα «Αντιμικροβιακά»: αγωγές, σε αναμονή έγκρισης, συχνότερες ουσίες. Εμφανίζεται αν είναι ανοιχτή η Επιτήρηση ή το Φαρμακείο.', 'Tab “Antimicrobials”: therapies, pending approval, most used agents. Shown if Surveillance or Pharmacy is on.'),
      start: l('Δείτε τις εκκρεμείς εγκρίσεις αντιβιοτικών.', 'Review the pending antibiotic approvals.'),
    },
    prevalence_survey: {
      what: l('Περιοδικές μελέτες επιπολασμού (PPS): πόσοι ασθενείς έχουν HAI και πόσοι λαμβάνουν αντιβιοτικά σε μία ημέρα.', 'Periodic point prevalence surveys (PPS): how many patients have HAI and how many receive antibiotics on a given day.'),
      users: l('Ομάδα Ελέγχου Λοιμώξεων.', 'Infection Control team.'),
      needs: null,
      analysis: l('Καρτέλα «Μελέτη επιπολασμού»: επιπολασμός HAI, χρήση αντιβιοτικών και σύγκριση με την προηγούμενη μέτρηση, τάση ανά μέτρηση.', 'Tab “Prevalence survey”: HAI prevalence, antibiotic use and comparison with the previous survey, trend per survey.'),
      start: l('Κέντρο Διαχείρισης › Επιπολασμός λοιμώξεων (PPS): καταχωρίστε την πρώτη μέτρηση.', 'Management Center › Prevalence survey (PPS): enter the first survey.'),
    },
    lira: {
      what: l('Ο βοηθός LIRA και οι διερευνήσεις εξάρσεων (outbreaks). Χωρίς πάροχο AI, η LIRA λειτουργεί με τους ενσωματωμένους κανόνες της. Λειτουργεί μόνο πάνω σε δεδομένα που ο χρήστης δικαιούται ήδη να δει.', 'The LIRA assistant and outbreak investigations. Without an AI provider, LIRA works with its built-in rules. It works only on data the user is already entitled to see.'),
      users: l('Ομάδα Ελέγχου Λοιμώξεων, Διαχειριστής Νοσοκομείου (σύνδεση παρόχου).', 'Infection Control team, Hospital Admin (provider connection).'),
      needs: null,
      analysis: l('Καρτέλα «LIRA & AI»: διερευνήσεις (ενεργές, κλειστές, μέσος χρόνος ολοκλήρωσης), ενεργές συρροές, κατανομή ανά μικροοργανισμό και μήνα.', 'Tab “LIRA & AI”: investigations (active, closed, average time to close), active clusters, distribution per organism and month.'),
      start: l('Κέντρο Διαχείρισης › LIRA & AI: συνδέστε πάροχο (προαιρετικά). Οι διερευνήσεις γίνονται από Κέντρο Διαχείρισης › Διερευνήσεις εξάρσεων.', 'Management Center › LIRA & AI: connect a provider (optional). Investigations are run from Management Center › Outbreak investigations.'),
    },
  },

  // Chapter 6: roles.
  roles: [
    ['platform_owner', l('Δημιουργεί νοσοκομεία, ορίζει πακέτο και ενότητες, διαχειρίζεται Demo, κεντρικές βιβλιοθήκες και ρυθμίσεις πλατφόρμας. Δεν βλέπει κλινικά στοιχεία ασθενών.', 'Creates hospitals, sets package and modules, manages demos, central libraries and platform settings. Does not see patient clinical data.')],
    ['hospital_admin', l('Στήνει το νοσοκομείο: τμήματα, χρήστες και ρόλοι, βιβλιοθήκες, κλινοημέρες, δείκτες και ρυθμίσεις του Κέντρου Διαχείρισης.', 'Sets up the hospital: departments, users and roles, libraries, patient-days, indicators and Management Center settings.')],
    ['infection_control_lead', l('Ηγείται του προγράμματος ελέγχου λοιμώξεων: επιτήρηση, πρόληψη, έλεγχοι, αναλύσεις.', 'Leads the infection control programme: surveillance, prevention, controls, analysis.')],
    ['infection_control_member', l('Εκτελεί την καθημερινή επιτήρηση και πρόληψη υπό τον Υπεύθυνο.', 'Performs daily surveillance and prevention under the Lead.')],
    ['department_manager', l('Βλέπει την εικόνα του τμήματός του και τις εκκρεμότητές του και ολοκληρώνει ό,τι του ανατίθεται.', 'Sees their department’s picture and pending items and completes what is assigned.')],
    ['department_user', l('Εκτελεί τις εργασίες που ανατίθενται στο τμήμα του, με τις ελάχιστες απαραίτητες πληροφορίες.', 'Performs the tasks assigned to their department, with the minimum necessary information.')],
    ['link_nurse', l('Συνδετικός κρίκος του τμήματος με την ομάδα ελέγχου λοιμώξεων.', 'The department’s link to the infection control team.')],
    ['laboratory', l('Καταχωρεί δείγματα, αποτελέσματα και AST και επικοινωνεί τα κρίσιμα αποτελέσματα.', 'Enters samples, results and AST and communicates critical results.')],
    ['doctor_reviewer', l('Αξιολογεί κλινικά τα επεισόδια επιτήρησης.', 'Clinically reviews surveillance episodes.')],
    ['quality_manager', l('Διαχειρίζεται συμβάντα, audits, ευρήματα και CAPA.', 'Manages incidents, audits, findings and CAPA.')],
    ['committee_secretariat', l('Οργανώνει συνεδριάσεις, πρακτικά και αποφάσεις επιτροπών.', 'Organizes committee meetings, minutes and decisions.')],
    ['pharmacy', l('Παρακολουθεί κατανάλωση και εγκρίσεις αντιμικροβιακών.', 'Tracks antimicrobial consumption and approvals.')],
    ['occupational_physician', l('Διαχειρίζεται επισκέψεις και εμβολιασμούς εργαζομένων. Έχει πρόσβαση στα ιατρικά στοιχεία.', 'Manages employee visits and vaccinations. Has access to the medical data.')],
    ['hr_office', l('Διοικητικό μητρώο εργαζομένων, χωρίς πρόσβαση σε ιατρικά στοιχεία.', 'Administrative employee registry, without access to medical data.')],
    ['staff_user', l('Βλέπει την προσωπική του καρτέλα, τις δικές του εκπαιδεύσεις και πιστοποιητικά και ό,τι του έχει ανατεθεί.', 'Sees their own record, their own training and certificates and whatever is assigned to them.')],
  ],
  rolesNote: l(
    'Τα ακριβή δικαιώματα κάθε ρόλου φαίνονται στο Κέντρο Διαχείρισης › Χρήστες & Ρόλοι. Ένας ρόλος δεν μπορεί να χρησιμοποιήσει ενότητα που είναι κλειδωμένη για το νοσοκομείο.',
    'The exact permissions of each role are shown in Management Center › Users & Roles. A role cannot use a module that is locked for the hospital.'
  ),

  // Chapter 7: terminology of the platform (clinical terms come from helpContent.glossary).
  terms: [
    { term: l('Οργανισμός', 'Organization'), def: l('Ένα νοσοκομείο ή μια κλινική στην πλατφόρμα, με δικούς του χρήστες και δεδομένα.', 'A hospital or clinic on the platform, with its own users and data.') },
    { term: l('Platform Owner', 'Platform Owner'), def: l('Ο ιδιοκτήτης της πλατφόρμας. Δημιουργεί οργανισμούς και ορίζει τι βλέπει ο καθένας, χωρίς πρόσβαση σε κλινικά δεδομένα.', 'The platform owner. Creates organizations and sets what each one sees, without access to clinical data.') },
    { term: l('Διαχειριστής Νοσοκομείου', 'Hospital Admin'), def: l('Ο υπεύθυνος που στήνει και διαχειρίζεται έναν οργανισμό.', 'The person who sets up and manages one organization.') },
    { term: l('Προφίλ λειτουργίας', 'Operating profile'), def: l('Η επιλογή του Platform Owner για το τι χρησιμοποιεί ένα νοσοκομείο: πακέτο, ενότητες και πρόσθετα.', 'The Platform Owner’s choice of what a hospital uses: package, modules and add-ons.') },
    { term: l('Πακέτο', 'Package'), def: l('Έτοιμος συνδυασμός ενοτήτων: Βασική καταγραφή, Εργαστήριο & Επιτήρηση, Πλήρες πρόγραμμα. Είναι συντόμευση, όχι περιορισμός.', 'A ready-made combination of modules: Basic records, Laboratory & surveillance, Full programme. It is a shortcut, not a limit.') },
    { term: l('Ενότητα (module)', 'Module'), def: l('Ένα τμήμα της πλατφόρμας, π.χ. Εργαστήριο ή Έλεγχοι, που ανοίγει ή κλείνει ανεξάρτητα.', 'A part of the platform, e.g. Laboratory or Controls, switched on or off independently.') },
    { term: l('Πρόσθετο (add-on)', 'Add-on'), def: l('Ενότητα εκτός πακέτου: Υγεία εργαζομένων, Φαρμακείο, Μελέτη επιπολασμού, LIRA & AI.', 'A module outside the packages: Occupational health, Pharmacy, Prevalence survey, LIRA & AI.') },
    { term: l('Κλείδωμα / Ξεκλείδωμα', 'Lock / Unlock'), def: l('Κλειδωμένη ενότητα κρύβεται από όλους τους χρήστες του νοσοκομείου. Τα δεδομένα της διατηρούνται.', 'A locked module is hidden from every user of the hospital. Its data is kept.') },
    { term: l('Προσαρμοσμένο (Custom)', 'Custom'), def: l('Συνδυασμός ενοτήτων που δεν ταυτίζεται με κανένα πακέτο.', 'A combination of modules that matches no package.') },
    { term: l('Προαπαιτούμενο', 'Prerequisite'), def: l('Ενότητα που χρειάζεται μια άλλη για να έχει νόημα, π.χ. οι Δείκτες χρειάζονται την Επιτήρηση. Η πλατφόρμα προειδοποιεί, δεν μπλοκάρει.', 'A module that needs another to make sense, e.g. Indicators need Surveillance. The platform warns; it does not block.') },
    { term: l('Demo', 'Demo'), def: l('Χρονικά περιορισμένη πρόσβαση με αποκλειστικά συνθετικά δεδομένα, χωρίς πραγματικούς ασθενείς.', 'Time-limited access with synthetic data only, without real patients.') },
    { term: l('Εύρος (scope)', 'Scope'), def: l('Το σύνολο των δεδομένων που ένας χρήστης δικαιούται να δει: ο οργανισμός και τα τμήματά του.', 'The set of data a user is entitled to see: the organization and its departments.') },
    { term: l('Δικαίωμα (capability)', 'Capability'), def: l('Μία συγκεκριμένη ενέργεια που επιτρέπεται, π.χ. «δημιουργία επιτήρησης». Οι ρόλοι είναι σύνολα δικαιωμάτων.', 'One specific permitted action, e.g. “create surveillance”. Roles are sets of capabilities.') },
    { term: l('Επεισόδιο επιτήρησης', 'Surveillance episode'), def: l('Ο ενιαίος φάκελος μιας πιθανής λοίμωξης, από την αξιολόγηση έως την έκβαση.', 'The single record of a possible infection, from assessment to outcome.') },
    { term: l('Δέσμη μέτρων (bundle)', 'Bundle'), def: l('Ομάδα πρακτικών πρόληψης που αξιολογείται με Ναι/Όχι/Δ.Ε., π.χ. CLABSI, CAUTI.', 'A group of prevention practices assessed Yes/No/N/A, e.g. CLABSI, CAUTI.') },
    { term: l('CAPA', 'CAPA'), def: l('Διορθωτική και προληπτική ενέργεια, με υπεύθυνο και προθεσμία, που ανοίγει από ένα εύρημα ή συμβάν.', 'Corrective and preventive action, with an owner and due date, opened from a finding or incident.') },
    { term: l('Κλινοημέρες', 'Patient-days'), def: l('Ο αριθμός ημερών νοσηλείας. Είναι ο παρονομαστής των περισσότερων δεικτών.', 'The number of days of hospital stay. The denominator of most indicators.') },
    { term: l('Κρίσιμο αποτέλεσμα', 'Critical result'), def: l('Εργαστηριακό αποτέλεσμα που απαιτεί άμεση ενημέρωση. Η ενημέρωση καταγράφεται με χρόνο και υπεύθυνο.', 'A laboratory result that requires immediate notification. The notification is recorded with time and person.') },
    { term: l('ΕΟΔΥ / EARS-Net', 'ΕΟΔΥ / EARS-Net'), def: l('Εθνικός Οργανισμός Δημόσιας Υγείας και ευρωπαϊκό δίκτυο επιτήρησης αντιμικροβιακής αντοχής, προς τα οποία γίνονται οι αναφορές.', 'The Greek national public health organization and the European antimicrobial resistance surveillance network to which reports are made.') },
    { term: l('Συρροή / έξαρση (cluster / outbreak)', 'Cluster / outbreak'), def: l('Ομάδα σχετιζόμενων περιστατικών που απαιτεί διερεύνηση.', 'A group of related cases that requires investigation.') },
    { term: l('Ιστορικό (audit trail)', 'Audit trail'), def: l('Το αμετάβλητο αρχείο των σημαντικών ενεργειών: ποιος, τι, πότε.', 'The immutable record of significant actions: who, what, when.') },
  ],

  // Chapter 8: common problems.
  faq: [
    {
      q: l('Δεν βλέπω μια ενότητα ή μια ενέργεια.', 'I cannot see a module or action.'),
      a: [
        l('Ελέγξτε πρώτα αν η ενότητα είναι ξεκλείδωτη για το νοσοκομείο (ρωτήστε τον Platform Owner): αν είναι κλειδωμένη δεν τη βλέπει κανείς.', 'First check whether the module is unlocked for the hospital (ask the Platform Owner): if locked, nobody sees it.'),
        l('Αν είναι ξεκλείδωτη, ελέγξτε τον ρόλο και τα δικαιώματά σας στο Κέντρο Διαχείρισης › Χρήστες & Ρόλοι.', 'If unlocked, check your role and permissions in Management Center › Users & Roles.'),
        l('Ανανεώστε τη σελίδα αν η αλλαγή έγινε μόλις τώρα.', 'Refresh the page if the change was made just now.'),
      ],
    },
    {
      q: l('Ο χρήστης δεν έλαβε την πρόσκληση.', 'The user did not receive the invitation.'),
      a: [
        l('Ελέγξτε τον φάκελο ανεπιθύμητων και ότι το email είναι σωστό.', 'Check the spam folder and that the email address is correct.'),
        l('Κέντρο Διαχείρισης › Χρήστες & Ρόλοι: ανοίξτε τον χρήστη (διάλογος «Πρόσβαση χρήστη») και επιλέξτε επαναποστολή πρόσκλησης. Για τον ίδιο τον Διαχειριστή Νοσοκομείου, το κάνει ο Platform Owner από την καρτέλα του οργανισμού.', 'Management Center › Users & Roles: open the user (“User access” dialog) and choose to resend the invitation. For the Hospital Admin themselves, the Platform Owner does it from the organization record.'),
      ],
    },
    {
      q: l('Ξέχασα τον κωδικό μου.', 'I forgot my password.'),
      a: [
        l('Από τη σελίδα σύνδεσης χρησιμοποιήστε τον σύνδεσμο ανάκτησης πρόσβασης: οι οδηγίες στέλνονται μόνο στο email που είναι δηλωμένο στον λογαριασμό σας.', 'On the sign-in page use the account recovery link: instructions are sent only to the email registered to your account.'),
        l('Εναλλακτικά, ο Διαχειριστής Νοσοκομείου επαναφέρει τον κωδικό σας από Χρήστες & Ρόλοι › «Πρόσβαση χρήστη». Για τον διαχειριστή, το κάνει ο Platform Owner.', 'Alternatively, the Hospital Admin resets your password from Users & Roles › “User access”. For the admin, the Platform Owner does it.'),
      ],
    },
    {
      q: l('Αν κλειδώσω μια ενότητα, χάνονται τα δεδομένα;', 'If I lock a module, is data lost?'),
      a: [
        l('Όχι. Τα δεδομένα κρύβονται και δεν διαγράφονται. Αν ξεκλειδώσετε ξανά την ενότητα, επανέρχονται όπως ήταν.', 'No. Data is hidden, not deleted. If you unlock the module again, it comes back as it was.'),
      ],
    },
    {
      q: l('Η πλατφόρμα με προειδοποιεί: «Χρειάζεται και: …».', 'The platform warns me: “Also needs: …”.'),
      a: [
        l('Η ενότητα που ξεκλειδώσατε χρειάζεται μια άλλη, που είναι ακόμη κλειδωμένη. Ξεκλειδώστε και αυτήν. Μπορείτε να αποθηκεύσετε και χωρίς, αλλά η ενότητα θα έχει λίγα ή καθόλου δεδομένα.', 'The module you unlocked needs another one that is still locked. Unlock that too. You can save without it, but the module will have little or no data.'),
      ],
    },
    {
      q: l('Μια καρτέλα Αναλύσεων είναι άδεια.', 'An Analysis tab is empty.'),
      a: [
        l('Ελέγξτε την περίοδο και το τμήμα που έχετε επιλέξει.', 'Check the period and department you selected.'),
        l('Ελέγξτε ότι έχουν καταχωριστεί δεδομένα στην αντίστοιχη ενότητα για αυτή την περίοδο. Για δείκτες χρειάζονται και κλινοημέρες.', 'Check that data has been entered in the matching module for that period. Indicators also need patient-days.'),
      ],
    },
    {
      q: l('Θέλω να δοκιμάσω την πλατφόρμα χωρίς πραγματικούς ασθενείς.', 'I want to try the platform without real patients.'),
      a: [
        l('Ζητήστε από τον Platform Owner ένα Demo: έχει αποκλειστικά συνθετικά δεδομένα και λήγει αυτόματα. Η προεπισκόπηση στο Κέντρο Βοήθειας δείχνει επίσης τις πραγματικές οθόνες με δεδομένα demo.', 'Ask the Platform Owner for a Demo: it has synthetic data only and expires automatically. The preview in the Help Center also shows the real screens with demo data.'),
      ],
    },
  ],
}

// {el,en} pairs -> one language, recursively.
export function pickGuide(value, language = 'el') {
  const lang = language === 'en' ? 'en' : 'el'
  if (Array.isArray(value)) return value.map(item => pickGuide(item, lang))
  if (value && typeof value === 'object') {
    const keys = Object.keys(value)
    if (keys.length === 2 && keys.includes('el') && keys.includes('en')) return value[lang]
    return Object.fromEntries(keys.map(key => [key, pickGuide(value[key], lang)]))
  }
  return value
}
