import { Activity, BarChart3, Building2, FlaskConical, LayoutDashboard, Settings, ShieldCheck, SlidersHorizontal } from 'lucide-react'

// User guide for the Platform Owner screens (outside any hospital). Keys match
// the platform routes: path, or path#hash for the Platform Center sections.
export const platformHelpNavigation=[
 {to:'/platform',icon:LayoutDashboard},
 {to:'/platform#organizations',icon:Building2},
 {to:'/platform#demo',icon:FlaskConical},
 {to:'/platform#reports',icon:BarChart3},
 {to:'/platform#management',icon:SlidersHorizontal},
 {to:'/platform/health',icon:Activity},
 {to:'/platform/audit',icon:ShieldCheck},
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
   ['Μητρώο','Κάθε γραμμή δείχνει κωδικό, πόλη/περιφέρεια, πλήθος χρηστών, κατάσταση Διαχειριστή Νοσοκομείου και κατάσταση οργανισμού.'],
   ['Νέος οργανισμός','Με «Νέος οργανισμός» καταχωρίζετε ταυτότητα, τοποθεσία και τον αρχικό Διαχειριστή Νοσοκομείου, στον οποίο αποστέλλεται πρόσκληση.'],
   ['Καρτέλα οργανισμού','Από την καρτέλα βλέπετε στοιχεία, χρήστες και διαγνωστικά, και μπαίνετε στον οργανισμό όταν χρειάζεται υποστήριξη.']
  ],steps:['Αναζητήστε τον οργανισμό.','Ανοίξτε την καρτέλα του.','Κάντε την αλλαγή ή την είσοδο που χρειάζεται.']},
  '/platform#demo':{title:'Demo',summary:'Χρονικά περιορισμένες προσβάσεις με αποκλειστικά συνθετικά δεδομένα.',audience:audienceEl,chapters:[
   ['Απομόνωση','Τα Demo είναι πλήρως απομονωμένα από τα πραγματικά δεδομένα. Κανένα στοιχείο ασθενούς ή εργαζομένου δεν εμφανίζεται σε αυτά.'],
   ['Νέο Demo','Ορίζετε υποψήφιο οργανισμό, υπεύθυνο επικοινωνίας, email πρόσκλησης και διάρκεια. Η προεπιλεγμένη διάρκεια ορίζεται στις Ρυθμίσεις Πλατφόρμας.'],
   ['Μετατροπή','Όταν ο υποψήφιος γίνει πελάτης, το Demo μετατρέπεται σε πραγματικό οργανισμό από την καρτέλα του.']
  ],steps:['Δημιουργήστε το Demo.','Παρακολουθήστε τη λήξη του.','Μετατρέψτε ή διαγράψτε το όταν ολοκληρωθεί.']},
  '/platform#reports':{title:'Ανάλυση Πλατφόρμας',summary:'Συγκεντρωτικοί δείκτες σε επίπεδο πλατφόρμας.',audience:audienceEl,chapters:[
   ['Συγκεντρωτικά δεδομένα','Η ανάλυση δείχνει μόνο συγκεντρωτικούς αριθμούς ανά οργανισμό και περίοδο, χωρίς ατομικά κλινικά στοιχεία.'],
   ['Φίλτρα','Επιλέξτε οργανισμό, περίοδο και ενότητα για να συγκρίνετε δραστηριότητα και τάσεις.']
  ],steps:['Επιλέξτε περίοδο και οργανισμούς.','Ελέγξτε τα γραφήματα.','Εκτυπώστε ή εξαγάγετε την αναφορά.']},
  '/platform#management':{title:'Κεντρική Διαχείριση',summary:'Κοινές βιβλιοθήκες, δείκτες, δέσμες μέτρων και πηγές για όλα τα νοσοκομεία.',audience:audienceEl,chapters:[
   ['Κοινό περιεχόμενο','Οι αλλαγές εδώ εφαρμόζονται σε όλα τα νοσοκομεία που χρησιμοποιούν το αντίστοιχο κεντρικό στοιχείο.'],
   ['Ενημερώσεις πηγών','Με «Έλεγχος & ενημέρωση πλατφόρμας» ελέγχονται οι κλινικές πηγές. Κάθε αλλαγή εμφανίζεται για έλεγχο: «Ελέγχθηκε» την κλείνει, «Αναβολή» την επαναφέρει σε 7 ημέρες.']
  ],steps:['Επιλέξτε καρτέλα (π.χ. Βιβλιοθήκες).','Κάντε την αλλαγή.','Ελέγξτε τις εκκρεμείς ενημερώσεις πηγών.']},
  '/platform/health':{title:'Υγεία Πλατφόρμας',summary:'Λειτουργικά συμβάντα όλων των πραγματικών οργανισμών, χωρίς κλινικό περιεχόμενο.',audience:audienceEl,chapters:[
   ['Κατάσταση','Οι δείκτες δείχνουν αποτυχίες, προειδοποιήσεις και πόσοι οργανισμοί έχουν συμβάντα.'],
   ['Διερεύνηση','Φιλτράρετε ανά οργανισμό ή σοβαρότητα και ανοίξτε το συμβάν για λεπτομέρειες.']
  ],steps:['Ελέγξτε την κατάσταση.','Φιλτράρετε τα συμβάντα.','Ανανεώστε μετά από διόρθωση.']},
  '/platform/audit':{title:'Ιστορικό & Ασφάλεια',summary:'Ιχνηλασιμότητα ενεργειών Ιδιοκτήτη Πλατφόρμας και αλλαγών πρόσβασης.',audience:audienceEl,chapters:[
   ['Ιστορικό ενεργειών','Κάθε σημαντική διοικητική ενέργεια καταγράφεται με χρήστη, χρόνο και οργανισμό. Το ιστορικό είναι μόνο για ανάγνωση.'],
   ['Αλλαγές πρόσβασης','Χρησιμοποιήστε τα φίλτρα για αλλαγές ρόλων, προσκλήσεις και διαγραφές.']
  ],steps:['Αναζητήστε την ενέργεια.','Φιλτράρετε ανά οργανισμό ή τύπο.','Εξετάστε τις λεπτομέρειες.']},
  '/platform/settings':{title:'Ρυθμίσεις Πλατφόρμας',summary:'Καθολικές ρυθμίσεις για όλη την εγκατάσταση.',audience:audienceEl,chapters:[
   ['Λειτουργικές προεπιλογές','Email υποστήριξης και προεπιλεγμένη διάρκεια νέων Demo.'],
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
   ['Registry','Each row shows code, city/region, user count, Hospital Admin status and organization status.'],
   ['New organization','"New organization" records identity, location and the initial Hospital Admin, who receives an invitation.'],
   ['Organization record','The record shows details, users and diagnostics, and lets you enter the organization when support is needed.']
  ],steps:['Search for the organization.','Open its record.','Make the change or enter as needed.']},
  '/platform#demo':{title:'Demo',summary:'Time-limited access with synthetic data only.',audience:audienceEn,chapters:[
   ['Isolation','Demos are fully isolated from production data. No patient or employee record is ever shown in them.'],
   ['New demo','Set the prospect, contact person, invitation email and duration. The default duration is set in Platform Settings.'],
   ['Conversion','When the prospect becomes a customer, convert the demo into a real organization from its record.']
  ],steps:['Create the demo.','Track its expiry.','Convert or delete it when done.']},
  '/platform#reports':{title:'Platform Analysis',summary:'Aggregated indicators at platform level.',audience:audienceEn,chapters:[
   ['Aggregated data','Analysis shows only aggregated counts per organization and period, never individual clinical records.'],
   ['Filters','Choose organization, period and module to compare activity and trends.']
  ],steps:['Choose period and organizations.','Review the charts.','Print or export the report.']},
  '/platform#management':{title:'Central Management',summary:'Shared libraries, indicators, bundles and sources for every hospital.',audience:audienceEn,chapters:[
   ['Shared content','Changes here apply to every hospital using the corresponding central item.'],
   ['Source updates','"Check & update platform" checks the clinical sources. Each change is listed for review: "Reviewed" closes it, "Postpone" brings it back in 7 days.']
  ],steps:['Choose a tab (e.g. Libraries).','Make the change.','Review pending source updates.']},
  '/platform/health':{title:'Platform Health',summary:'Operational events across production organizations, without clinical content.',audience:audienceEn,chapters:[
   ['Status','The indicators show failures, warnings and how many organizations have events.'],
   ['Investigation','Filter by organization or severity and open an event for details.']
  ],steps:['Check the status.','Filter the events.','Refresh after a fix.']},
  '/platform/audit':{title:'Audit & Security',summary:'Traceability of Platform Owner actions and access changes.',audience:audienceEn,chapters:[
   ['Action history','Every significant administrative action is recorded with user, time and organization. The history is read-only.'],
   ['Access changes','Use the filters for role changes, invitations and deletions.']
  ],steps:['Search for the action.','Filter by organization or type.','Review the details.']},
  '/platform/settings':{title:'Platform Settings',summary:'Global settings for the whole installation.',audience:audienceEn,chapters:[
   ['Operational defaults','Support email and default duration of new demos.'],
   ['Maintenance notice','Enable a message to all users. The preview shows how it will appear.']
  ],steps:['Change the value.','Check the preview.','Select "Save".']},
 },
}
