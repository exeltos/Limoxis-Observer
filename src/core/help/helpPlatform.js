import { BarChart3, Bot, Building2, Database, FlaskConical, LayoutDashboard, Megaphone, Scale, Settings, ShieldCheck } from 'lucide-react'

// User guide for the Platform Owner screens (outside any hospital). Keys match
// the platform routes: path, or path#hash for the Platform Center sections.
export const platformHelpNavigation=[
 {to:'/platform',icon:LayoutDashboard},
 {to:'/platform#organizations',icon:Building2},
 {to:'/platform#demo',icon:FlaskConical},
 {to:'/platform#reports',icon:BarChart3},
 {to:'/platform/audit',icon:ShieldCheck},
 {to:'/platform/announcements',icon:Megaphone},
 {to:'/platform#management',icon:Database},
 {to:'/platform/legislation',icon:Scale},
 {to:'/platform#management?group=lira',icon:Bot},
 {to:'/platform/settings',icon:Settings},
]

const audienceEl='Ιδιοκτήτης Πλατφόρμας'
const audienceEn='Platform Owner'

export const platformHelp={
 el:{
  '/platform':{title:'Κέντρο Πλατφόρμας',summary:'Η συνολική εικόνα της εγκατάστασης χωρίς είσοδο σε κάποιον οργανισμό.',audience:audienceEl,chapters:[
   ['Επισκόπηση','Οι δείκτες στην κορυφή δείχνουν οργανισμούς, ανενεργούς οργανισμούς, ενεργά Demo και Demo που λήγουν σύντομα.'],
   ['Χώροι εργασίας','Από τις κάρτες Διαχείρισης και Διακυβέρνησης μεταβαίνετε σε Οργανισμούς, Demo, Ανάλυση, Κεντρική Διαχείριση, Υγεία, Ιστορικό και Ρυθμίσεις.'],
   ['Επιστροφή','Σε κάθε οθόνη πλατφόρμας η διαδρομή στην πάνω μπάρα («Κέντρο Πλατφόρμας › …») σας επιστρέφει εδώ με ένα κλικ.']
  ],steps:['Ελέγξτε τους δείκτες και τα Demo που λήγουν.','Ανοίξτε τον χώρο εργασίας που χρειάζεστε.','Επιστρέψτε από τη διαδρομή στην πάνω μπάρα.']},
  '/platform#organizations':{title:'Οργανισμοί',summary:'Μητρώο νοσοκομείων και κλινικών της πλατφόρμας.',audience:audienceEl,chapters:[
   ['Μητρώο','Κάθε γραμμή δείχνει τον οργανισμό με κωδικό και πόλη, τους ενεργούς προς το σύνολο των χρηστών, την τελευταία σύνδεση κάποιου χρήστη του (πότε και ποιος) και μία κατάσταση: Ενεργός, Εκκρεμεί διαχειριστής, Σε παύση ή Προς διαγραφή. Τα σύνολα δίπλα στην αναζήτηση φιλτράρουν τη λίστα με ένα κλικ.'],
   ['Νέος οργανισμός','Με «Νέος οργανισμός» καταχωρίζετε ταυτότητα, τοποθεσία και τον αρχικό Διαχειριστή Νοσοκομείου, στον οποίο αποστέλλεται πρόσκληση.'],
   ['Καρτέλα οργανισμού','Η καρτέλα έχει Στοιχεία, Πακέτο & ενότητες, Χρήστες (με την τελευταία σύνδεση και την IP), Δραστηριότητα (Συμβάντα ή Συνδέσεις, όπου τερματίζετε μια σύνδεση) και Αντίγραφο & διαγραφή. Σε κάθε καρτέλα, «Είσοδος» σας βάζει στον οργανισμό για υποστήριξη και το «⋯» έχει παύση ή επανενεργοποίηση, επαναφορά κωδικού του Διαχειριστή Νοσοκομείου και οριστική διαγραφή.'],
   ['Προφίλ λειτουργίας','Στην καρτέλα «Πακέτο & ενότητες» του οργανισμού επιλέγετε πακέτο (Βασική καταγραφή, Εργαστήριο & Επιτήρηση, Πλήρες πρόγραμμα) και μετά πατάτε το κλειδί μιας ενότητας για να την ξεκλειδώσετε ή να την κλειδώσετε. Ό,τι κλειδώνεται κρύβεται από όλους τους χρήστες του νοσοκομείου, χωρίς να διαγράφονται δεδομένα. Η πορτοκαλί προειδοποίηση «Χρειάζεται και…» δείχνει ότι λείπει προαπαιτούμενη ενότητα. Δεν μπλοκάρει την αποθήκευση.']
  ],steps:['Αναζητήστε τον οργανισμό.','Ανοίξτε την καρτέλα του.','Κάντε την αλλαγή ή την είσοδο που χρειάζεται.']},
  '/platform#demo':{title:'Demo',summary:'Χρονικά περιορισμένες προσβάσεις με αποκλειστικά συνθετικά δεδομένα.',audience:audienceEl,chapters:[
   ['Απομόνωση','Τα Demo είναι πλήρως απομονωμένα από τα πραγματικά δεδομένα. Κανένα στοιχείο ασθενούς ή εργαζομένου δεν εμφανίζεται σε αυτά.'],
   ['Νέο Demo','Ορίζετε υποψήφιο οργανισμό, υπεύθυνο επικοινωνίας, email πρόσκλησης και διάρκεια. Η προεπιλεγμένη διάρκεια ορίζεται στις Ρυθμίσεις Πλατφόρμας.'],
   ['Μετατροπή','Όταν ο υποψήφιος γίνει πελάτης, το Demo μετατρέπεται σε πραγματικό οργανισμό από την καρτέλα του.']
  ],steps:['Δημιουργήστε το Demo.','Παρακολουθήστε τη λήξη του.','Μετατρέψτε ή διαγράψτε το όταν ολοκληρωθεί.']},
  '/platform#reports':{title:'Αναφορές πλατφόρμας',summary:'Συγκεντρωτικοί δείκτες σε επίπεδο πλατφόρμας.',audience:audienceEl,chapters:[
   ['Συγκεντρωτικά δεδομένα','Η ανάλυση δείχνει μόνο συγκεντρωτικούς αριθμούς ανά οργανισμό και περίοδο, χωρίς ατομικά κλινικά στοιχεία.'],
   ['Φίλτρα','Επιλέξτε οργανισμό, περίοδο και ενότητα για να συγκρίνετε δραστηριότητα και τάσεις.']
  ],steps:['Επιλέξτε περίοδο και οργανισμούς.','Ελέγξτε τα γραφήματα.','Εκτυπώστε ή εξαγάγετε την αναφορά.']},
  '/platform/announcements':{title:'Ανακοινώσεις',summary:'Ανακοινώσεις και προωθήσεις προς τους διαχειριστές των νοσοκομείων.',audience:audienceEl,chapters:[
   ['Λίστα','Κάθε γραμμή δείχνει τίτλο, είδος, περίοδο, σε ποια νοσοκομεία απευθύνεται, πόσοι την είδαν και αν είναι ενεργή. Με κλικ ανοίγει για επεξεργασία· από το «⋯» τη σταματάτε, την ξαναξεκινάτε ή τη διαγράφετε.'],
   ['Νέα ανακοίνωση','Γράφετε τίτλο και κείμενο, διαλέγετε νοσοκομεία (ή όλα), περίοδο και αν εμφανίζεται μία φορά ή σε κάθε είσοδο. Προαιρετικά επισυνάπτετε εικόνα ή αρχείο και τη δείχνετε και στα Demo.']
  ],steps:['Πατήστε «Νέα ανακοίνωση».','Συμπληρώστε κείμενο, νοσοκομεία και περίοδο.','Αποθηκεύστε· εμφανίζεται στους διαχειριστές μόλις ανοίξουν την εφαρμογή.']},
  '/platform#management':{title:'Λίστες',summary:'Οι κοινές λίστες, οι δέσμες μέτρων, τα κριτήρια λοιμώξεων και οι ορισμοί δεικτών για όλα τα νοσοκομεία.',audience:audienceEl,chapters:[
   ['Κοινό περιεχόμενο','Αριστερά διαλέγετε λίστα ανά ομάδα (Κλινικά, Εργαστήριο, Πρόληψη…)· δεξιά βλέπετε και αλλάζετε τις εγγραφές της. Οι αλλαγές εφαρμόζονται σε όλα τα νοσοκομεία που χρησιμοποιούν το αντίστοιχο κεντρικό στοιχείο.'],
   ['Ενημερώσεις πηγών','Με «Έλεγχος & ενημέρωση πλατφόρμας» ελέγχονται οι κλινικές πηγές. Κάθε αλλαγή εμφανίζεται για έλεγχο: «Ελέγχθηκε» την κλείνει, «Αναβολή» την επαναφέρει σε 7 ημέρες. Το ιστορικό ενημερώσεων είναι στο «⋯».']
  ],steps:['Διαλέξτε λίστα αριστερά.','Κάντε την αλλαγή.','Ελέγξτε τις εκκρεμείς ενημερώσεις πηγών.']},
  '/platform/legislation':{title:'Νομοθεσία & πηγές',summary:'Η βιβλιοθήκη νομοθεσίας που διαβάζουν όλα τα νοσοκομεία, ό,τι βρήκε ο αυτόματος έλεγχος, οι πηγές του, οι οδηγίες & σύνδεσμοι της Βιβλιοθήκης και οι εξωτερικές πηγές.',audience:audienceEl,chapters:[
   ['Νομοθεσία','Τα κείμενα της πλατφόρμας με τις απαιτήσεις τους. Με «Νέο κείμενο» προσθέτετε ένα· τίποτα δεν φτάνει στα νοσοκομεία πριν το δημοσιεύσετε.'],
   ['Προς έλεγχο και πηγές νομοθεσίας','Ο αυτόματος έλεγχος διαβάζει τις πηγές νομοθεσίας κάθε 2 ώρες· ό,τι βρει εμφανίζεται «Προς έλεγχο», όπου το καταχωρίζετε ως νέο κείμενο, ως ενημέρωση υπάρχοντος ή το απορρίπτετε.'],
   ['Οδηγίες & σύνδεσμοι, εξωτερικές πηγές','Το περιεχόμενο της Βιβλιοθήκης σε επίπεδο πλατφόρμας και οι επίσημες πηγές (ΠΟΥ, ECDC, ΕΟΔΥ…) που διαβάζουν όλα τα νοσοκομεία.']
  ],steps:['Διαλέξτε επιλογή από τη γραμμή στην κορυφή.','Ελέγξτε τα ευρήματα «Προς έλεγχο».','Δημοσιεύστε ό,τι πρέπει να δουν τα νοσοκομεία.']},
  '/platform#management?group=lira':{title:'LIRA & AI',summary:'Η γνώση που χρησιμοποιεί η LIRA σε όλα τα νοσοκομεία.',audience:audienceEl,chapters:[
   ['Γνώση της LIRA','Τα κείμενα και οι πηγές στα οποία βασίζεται η LIRA όταν απαντά. Οι αλλαγές ισχύουν για όλα τα νοσοκομεία.']
  ],steps:['Ελέγξτε τη λίστα.','Προσθέστε ή διορθώστε ό,τι χρειάζεται.']},
  '/platform/audit':{title:'Ιστορικό & Ασφάλεια',summary:'Ιχνηλασιμότητα ενεργειών, αλλαγών πρόσβασης και λειτουργικών συμβάντων.',audience:audienceEl,chapters:[
   ['Ενέργειες & πρόσβαση','Κάθε σημαντική διοικητική ενέργεια καταγράφεται με χρήστη, χρόνο και οργανισμό. Το ιστορικό είναι μόνο για ανάγνωση· τα φίλτρα δείχνουν αλλαγές ρόλων, προσκλήσεις και διαγραφές.'],
   ['Συμβάντα & σφάλματα','Η δεύτερη καρτέλα δείχνει αποτυχίες, αποκλεισμούς και προειδοποιήσεις όλων των πραγματικών οργανισμών, χωρίς κλινικό περιεχόμενο.'],
   ['Συνδέσεις','Ποιος συνδέθηκε, από ποια IP και συσκευή, πότε και για πόση ώρα· ποιοι είναι συνδεδεμένοι τώρα. Οι αποτυχημένες προσπάθειες καταγράφονται· 5 λάθη σε 15 λεπτά κλειδώνουν τον λογαριασμό για 15 λεπτά και 20 λάθη την IP. Από το «⋯» μιας σύνδεσης την τερματίζετε ή αποσυνδέετε τον χρήστη από όλες τις συσκευές.']
  ],steps:['Διαλέξτε καρτέλα.','Φιλτράρετε ανά οργανισμό, ενέργεια ή σοβαρότητα.','Ανανεώστε μετά από διόρθωση.']},
  '/platform/settings':{title:'Ρυθμίσεις πλατφόρμας',summary:'Καθολικές ρυθμίσεις για όλη την εγκατάσταση· κάθε αλλαγή καταγράφεται στο Ιστορικό & Υγεία.',audience:audienceEl,chapters:[
   ['Λειτουργικές προεπιλογές','Email υποστήριξης, προεπιλεγμένη διάρκεια και χρήστες νέων Demo, περίοδος χάριτος διαγραφής οργανισμού.'],
   ['Ανακοίνωση συντήρησης','Ενεργοποιήστε ένα μήνυμα προς όλους τους χρήστες. Η προεπισκόπηση δείχνει πώς θα εμφανιστεί.']
  ],steps:['Αλλάξτε την τιμή.','Ελέγξτε την προεπισκόπηση.','Πατήστε «Αποθήκευση».']},
 },
 en:{
  '/platform':{title:'Platform Center',summary:'The overall picture of the installation without entering an organization.',audience:audienceEn,chapters:[
   ['Overview','The top indicators show organizations, inactive organizations, active demos and demos expiring soon.'],
   ['Workspaces','From the Management and Governance cards you open Organizations, Demo, Analysis, Central Management, Health, Audit and Settings.'],
   ['Going back','On every platform screen the topbar breadcrumb ("Platform Center › …") brings you back here in one click.']
  ],steps:['Review the indicators and expiring demos.','Open the workspace you need.','Return from the topbar breadcrumb.']},
  '/platform#organizations':{title:'Organizations',summary:'Registry of the hospitals and clinics on the platform.',audience:audienceEn,chapters:[
   ['Registry','Each row shows the organization with its code and city, active against all users, the latest sign-in of any of its users (when and who) and one status: Active, Admin pending, Paused or Deletion scheduled. The totals beside the search filter the list with one click.'],
   ['New organization','"New organization" records identity, location and the initial Hospital Admin, who receives an invitation.'],
   ['Organization record','The record has Details, Package & modules, Users (with the last sign-in and IP), Activity (Events or Sign-ins, where you can end a session) and Export & deletion. On every tab, “Enter” takes you into the organization for support and “⋯” holds pause or reactivation, the Hospital Admin password reset and permanent deletion.'],
   ['Operating profile','In the organization’s “Package & modules” tab choose a package (Basic records, Laboratory & surveillance, Full programme), then click a module’s lock to unlock or lock it. Whatever is locked is hidden from every user of the hospital, and no data is deleted. The orange “Also needs…” warning shows that a prerequisite module is missing; it does not block saving.']
  ],steps:['Search for the organization.','Open its record.','Make the change or enter as needed.']},
  '/platform#demo':{title:'Demo',summary:'Time-limited access with synthetic data only.',audience:audienceEn,chapters:[
   ['Isolation','Demos are fully isolated from production data. No patient or employee record is ever shown in them.'],
   ['New demo','Set the prospect, contact person, invitation email and duration. The default duration is set in Platform Settings.'],
   ['Conversion','When the prospect becomes a customer, convert the demo into a real organization from its record.']
  ],steps:['Create the demo.','Track its expiry.','Convert or delete it when done.']},
  '/platform#reports':{title:'Platform reports',summary:'Aggregated indicators at platform level.',audience:audienceEn,chapters:[
   ['Aggregated data','Analysis shows only aggregated counts per organization and period, never individual clinical records.'],
   ['Filters','Choose organization, period and module to compare activity and trends.']
  ],steps:['Choose period and organizations.','Review the charts.','Print or export the report.']},
  '/platform/announcements':{title:'Announcements',summary:'Announcements and promotions to the hospital administrators.',audience:audienceEn,chapters:[
   ['List','Each row shows the title, type, period, which hospitals it is for, how many saw it and whether it is active. Click to edit; from the «⋯» you stop it, restart it or delete it.'],
   ['New announcement','Write a title and text, choose the hospitals (or all), the period and whether it shows once or at every visit. Optionally attach an image or a file and show it in the Demos too.']
  ],steps:['Select "New announcement".','Fill in the text, hospitals and period.','Save; the administrators see it when they open the application.']},
  '/platform#management':{title:'Lists',summary:'The shared lists, prevention bundles, infection criteria and indicator definitions for every hospital.',audience:audienceEn,chapters:[
   ['Shared content','On the left pick a list by group (Clinical, Laboratory, Prevention…); on the right view and change its entries. Changes apply to every hospital using the corresponding central item.'],
   ['Source updates','"Check & update platform" checks the clinical sources. Each change is listed for review: "Reviewed" closes it, "Postpone" brings it back in 7 days. The update history is in the «⋯».']
  ],steps:['Pick a list on the left.','Make the change.','Review pending source updates.']},
  '/platform/legislation':{title:'Legislation & sources',summary:'The legislation library every hospital reads, what the automatic check found, its sources, the Library’s guides & links and the external sources.',audience:audienceEn,chapters:[
   ['Legislation','The platform’s texts with their requirements. "New text" adds one; nothing reaches the hospitals before you publish it.'],
   ['To review and legislation sources','The automatic check reads the legislation sources every 2 hours; what it finds is listed under "To review", where you record it as a new text, as an update of an existing one, or dismiss it.'],
   ['Guides & links, external sources','The Library content at platform level and the official sources (WHO, ECDC, EODY…) every hospital reads.']
  ],steps:['Pick a choice from the row at the top.','Check the items "To review".','Publish what the hospitals should see.']},
  '/platform#management?group=lira':{title:'LIRA & AI',summary:'The knowledge LIRA uses in every hospital.',audience:audienceEn,chapters:[
   ['LIRA’s knowledge','The texts and sources LIRA relies on when it answers. Changes apply to every hospital.']
  ],steps:['Check the list.','Add or correct what is needed.']},
  '/platform/audit':{title:'Audit & Security',summary:'Traceability of actions, access changes and operational events.',audience:audienceEn,chapters:[
   ['Actions & access','Every significant administrative action is recorded with user, time and organization. The history is read-only; the filters show role changes, invitations and deletions.'],
   ['Events & errors','The second tab shows failures, blocks and warnings across production organizations, without clinical content.'],
   ['Sign-ins','Who signed in, from which IP and device, when and for how long; who is online now. Failed attempts are recorded; 5 failures in 15 minutes lock the account for 15 minutes and 20 lock the IP. From a session’s «⋯» you end it or sign the user out of every device.']
  ],steps:['Pick a tab.','Filter by organization, action or severity.','Refresh after a fix.']},
  '/platform/settings':{title:'Platform settings',summary:'Global settings for the whole installation; every change is recorded in History & Health.',audience:audienceEn,chapters:[
   ['Operational defaults','Support email, default duration and users of new demos, organization deletion grace period.'],
   ['Maintenance notice','Enable a message to all users. The preview shows how it will appear.']
  ],steps:['Change the value.','Check the preview.','Select "Save".']},
 },
}
