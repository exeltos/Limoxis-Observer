import { BarChart3, Bot, Building2, Database, FlaskConical, LayoutDashboard, Megaphone, Scale, ShieldCheck, Users } from 'lucide-react'

// User guide for the Platform Owner screens (outside any hospital). Keys match
// the platform routes: path, or path#hash for the Platform Center sections.
import type { HelpBook, HelpNavigationItem } from './helpTypes'

export const platformHelpNavigation: HelpNavigationItem[]=[
 {to:'/platform',icon:LayoutDashboard},
 {to:'/platform#organizations',icon:Building2},
 {to:'/platform#users',icon:Users},
 {to:'/platform#demo',icon:FlaskConical},
 {to:'/platform#reports',icon:BarChart3},
 {to:'/platform/audit',icon:ShieldCheck},
 {to:'/platform/announcements',icon:Megaphone},
 {to:'/platform#management',icon:Database},
 {to:'/platform/legislation',icon:Scale},
 {to:'/platform#management?group=lira',icon:Bot},
]

const audienceEl='Ιδιοκτήτης Πλατφόρμας'
const audienceEn='Platform Owner'

export const platformHelp: Record<'el' | 'en', HelpBook>={
 el:{
  '/platform':{title:'Κέντρο Πλατφόρμας',summary:'Η συνολική εικόνα της εγκατάστασης χωρίς είσοδο σε κάποιον οργανισμό.',audience:audienceEl,chapters:[
   ['Επισκόπηση','Η γραμμή στην κορυφή δείχνει οργανισμούς, χρήστες, ενεργά Demo και σφάλματα του τελευταίου 24ώρου· πατώντας έναν αριθμό ανοίγει η αντίστοιχη οθόνη. Αριστερά είναι τα νοσοκομεία με τη δραστηριότητά τους και δεξιά ένα κουτί με όσα θέλουν προσοχή: ποιος είναι συνδεδεμένος τώρα, αποτυχίες σύνδεσης Demo που λήγουν σύντομα, λογαριασμοί που κλειδώθηκαν ή δεν έχουν αλλάξει ακόμα τον προσωρινό κωδικό, και προτάσεις νομοθεσίας που περιμένουν έλεγχο (οι γραμμές εμφανίζονται μόνο όταν υπάρχει κάτι). Τα «Νέο Demo» και «Νέος οργανισμός» είναι πάνω δεξιά.'],
   ['Χώροι εργασίας','Από τις κάρτες Διαχείρισης και Διακυβέρνησης μεταβαίνετε σε Οργανισμούς, Demo, Ανάλυση, Κεντρική Διαχείριση, Υγεία, Ιστορικό και Ρυθμίσεις.'],
   ['Επιστροφή','Σε κάθε οθόνη πλατφόρμας η διαδρομή στην πάνω μπάρα («Κέντρο Πλατφόρμας › …») σας επιστρέφει εδώ με ένα κλικ.']
  ],steps:['Ελέγξτε τους δείκτες και τα Demo που λήγουν.','Ανοίξτε τον χώρο εργασίας που χρειάζεστε.','Επιστρέψτε από τη διαδρομή στην πάνω μπάρα.']},
  '/platform#organizations':{title:'Οργανισμοί',summary:'Μητρώο νοσοκομείων και κλινικών της πλατφόρμας.',audience:audienceEl,chapters:[
   ['Μητρώο','Κάθε γραμμή δείχνει τον οργανισμό με κωδικό και πόλη, τους ενεργούς προς το σύνολο των χρηστών, την τελευταία σύνδεση κάποιου χρήστη του (πότε και ποιος) και μία κατάσταση: Ενεργός, Εκκρεμεί διαχειριστής, Σε παύση ή Προς διαγραφή. Τα σύνολα δίπλα στην αναζήτηση φιλτράρουν τη λίστα με ένα κλικ.'],
   ['Νέος οργανισμός','Με «Νέος οργανισμός» καταχωρίζετε ταυτότητα, τοποθεσία και τον αρχικό Διαχειριστή Νοσοκομείου, στον οποίο αποστέλλεται πρόσκληση.'],
   ['Καρτέλα οργανισμού','Η καρτέλα έχει Στοιχεία, Πακέτο & ενότητες, Χρήστες (με την τελευταία σύνδεση και την IP), Δραστηριότητα (Συμβάντα ή Συνδέσεις, όπου τερματίζετε μια σύνδεση) και Αντίγραφο & διαγραφή. Σε κάθε καρτέλα, «Είσοδος» σας βάζει στον οργανισμό για υποστήριξη και το «⋯» έχει παύση ή επανενεργοποίηση, επαναφορά κωδικού του Διαχειριστή Νοσοκομείου και οριστική διαγραφή.'],
   ['Προφίλ λειτουργίας','Στην καρτέλα «Πακέτο & ενότητες» του οργανισμού επιλέγετε πακέτο (Βασική καταγραφή, Εργαστήριο & Επιτήρηση, Πλήρες πρόγραμμα) και μετά πατάτε το κλειδί μιας ενότητας για να την ξεκλειδώσετε ή να την κλειδώσετε. Ό,τι κλειδώνεται κρύβεται από όλους τους χρήστες του νοσοκομείου, χωρίς να διαγράφονται δεδομένα. Η πορτοκαλί προειδοποίηση «Χρειάζεται και…» δείχνει ότι λείπει προαπαιτούμενη ενότητα. Δεν μπλοκάρει την αποθήκευση.'],
   ['Ρυθμίσεις','Το γρανάζι δίπλα στην «Εξαγωγή» ανοίγει τις ρυθμίσεις που αφορούν όλους τους οργανισμούς: την περίοδο χάριτος (ημέρες από τον προγραμματισμό έως την οριστική διαγραφή ενός οργανισμού) και το email υποστήριξης που βλέπουν τα νοσοκομεία. Κάθε αλλαγή καταγράφεται στο Ιστορικό & Υγεία.'],
   ['Νέος ενεργός χρήστης','Από «Νέος χρήστης ▾» επιλέγετε «Ενεργός με προσωρινό κωδικό» ή εισαγωγή από αρχείο. Συμπληρώνετε ονοματεπώνυμο, email ή όνομα χρήστη, ρόλο και τμήμα. Προαιρετικά γράφετε το Κινητό τηλέφωνο και επιλέγετε Προσωρινός κωδικός: Τυχαίος ή Το κινητό του χρήστη. Στη δεύτερη περίπτωση ο χρήστης συνδέεται με το όνομα χρήστη και το κινητό ως κωδικό και ορίζει δικό του κωδικό στην πρώτη σύνδεση. Ο προσωρινός κωδικός λήγει σε 7 ημέρες: αν ο χρήστης δεν συνδεθεί, ο λογαριασμός κλειδώνει και του δίνετε νέο. Για τον ρόλο Διευθυντής Διεύθυνσης επιλέγετε τη Διεύθυνση (υπάρχουσα ή νέα, γράφοντας το όνομά της) και, με πολλαπλή επιλογή, τα τμήματα που θα βλέπει. Στο αρχείο Excel υπάρχουν οι στήλες Κινητό, Διεύθυνση και Τμήματα που βλέπει (χωρισμένα με ;). Οι προσωρινοί κωδικοί εμφανίζονται μόνο μία φορά, στην οθόνη και στο Excel αποτελεσμάτων. Όσο ο χρήστης δεν έχει αλλάξει τον προσωρινό κωδικό, δεν βλέπει δεδομένα νοσοκομείου: το κόβει η ίδια η βάση, όχι μόνο η οθόνη. Αν ο κωδικός χαθεί ή ο λογαριασμός κλειδώσει, ανοίγετε τον χρήστη, πατάτε «⋯» και Νέος προσωρινός κωδικός: επιλέγετε Τυχαίος ή Το κινητό του χρήστη, και ο νέος κωδικός ισχύει 7 ημέρες και ξεκλειδώνει τον λογαριασμό.']
  ],steps:['Αναζητήστε τον οργανισμό.','Ανοίξτε την καρτέλα του.','Κάντε την αλλαγή ή την είσοδο που χρειάζεται.']},
  '/platform#users':{title:'Χρήστες πλατφόρμας',summary:'Όλοι οι χρήστες της πλατφόρμας: νοσοκομεία, Demo και Ιδιοκτήτης.',audience:audienceEl,chapters:[
   ['Μητρώο','Κάθε γραμμή δείχνει τον χρήστη, το όνομα χρήστη, τον ρόλο, τον οργανισμό, την τελευταία σύνδεση (πότε και από ποια IP, ή «Συνδεδεμένος τώρα» με πράσινη κουκκίδα) και την κατάσταση. Τα σύνολα δίπλα στην αναζήτηση φιλτράρουν με ένα κλικ: χρήστες νοσοκομείων, συνδεδεμένοι τώρα, Demo, Ιδιοκτήτης, εκκρεμείς προσκλήσεις, ανενεργοί.'],
   ['Νέος χρήστης','Το «Νέος χρήστης» ρωτά πρώτα σε ποιον οργανισμό και συνεχίζει στα γνωστά παράθυρα του οργανισμού: ενεργός με προσωρινό κωδικό, πρόσκληση με email ή εισαγωγή από αρχείο.'],
   ['Καρτέλα χρήστη','Το κλικ σε μια γραμμή ανοίγει την καρτέλα του χρήστη με τρεις καρτέλες: Στοιχεία (με την «Επεξεργασία» και την ενότητα Ασφάλεια: κλείδωμα λογαριασμού με «Ξεκλείδωμα» και αποτυχημένες προσπάθειες 24 ωρών), Συνδέσεις (με τερματισμό σύνδεσης) και Δραστηριότητα (οι ενέργειές του). Το «⋯» έχει επαναφορά κωδικού, παύση ή επανενεργοποίηση, αποσύνδεση από όλες τις συσκευές και διαγραφή.'],
  ],steps:['Αναζητήστε ή φιλτράρετε τον χρήστη.','Ανοίξτε την καρτέλα του.','Κάντε την ενέργεια που χρειάζεται από το «⋯».']},
  '/platform#demo':{title:'Demo',summary:'Χρονικά περιορισμένες προσβάσεις με αποκλειστικά συνθετικά δεδομένα.',audience:audienceEl,chapters:[
   ['Απομόνωση','Τα Demo είναι πλήρως απομονωμένα από τα πραγματικά δεδομένα. Κανένα στοιχείο ασθενούς ή εργαζομένου δεν εμφανίζεται σε αυτά.'],
   ['Νέο Demo','Ορίζετε υποψήφιο οργανισμό, υπεύθυνο επικοινωνίας, email πρόσκλησης και διάρκεια. Η προτεινόμενη διάρκεια και οι χρήστες ανά Demo ορίζονται από το γρανάζι «Ρυθμίσεις Demo» δίπλα στην «Εξαγωγή».'],
   ['Επαναφορά δεδομένων','Κάθε Demo είναι ξεχωριστό νοσοκομείο με δικά του δεδομένα. Ο αξιολογητής πατά «Επαναφορά δεδομένων» στη γραμμή Demo για να σβήσει τις αλλαγές του και να ξαναγραφτούν τα αρχικά δεδομένα· τα άλλα Demo δεν επηρεάζονται.'],
   ['Μετατροπή','Όταν ο υποψήφιος γίνει πελάτης, το Demo μετατρέπεται σε πραγματικό οργανισμό από την καρτέλα του.']
  ],steps:['Δημιουργήστε το Demo.','Παρακολουθήστε τη λήξη του.','Μετατρέψτε ή διαγράψτε το όταν ολοκληρωθεί.']},
  '/platform#reports':{title:'Αναφορές πλατφόρμας',summary:'Συγκεντρωτικοί δείκτες σε επίπεδο πλατφόρμας.',audience:audienceEl,chapters:[
   ['Συγκεντρωτικά δεδομένα','Η ανάλυση δείχνει μόνο συγκεντρωτικούς αριθμούς ανά οργανισμό και περίοδο, χωρίς ατομικά κλινικά στοιχεία.'],
   ['Φίλτρα','Από το κουμπί «Φίλτρα», πάνω δεξιά, επιλέγετε έτος, ανάλυση (έτος, μήνας, τρίμηνο, εξάμηνο), περιφέρεια και νοσοκομείο. Το «Εντάξει» κλείνει το παράθυρο και ο «Καθαρισμός φίλτρων» τα επαναφέρει. Στήλες και ετικέτες που δεν έχουν καμία τιμή κρύβονται μέχρι να υπάρξουν δεδομένα.']
  ],steps:['Επιλέξτε περίοδο και οργανισμούς.','Ελέγξτε τα γραφήματα.','Εκτυπώστε ή εξαγάγετε την αναφορά.']},
  '/platform/announcements':{title:'Ανακοινώσεις',summary:'Ανακοινώσεις και προωθήσεις προς τους διαχειριστές των νοσοκομείων.',audience:audienceEl,chapters:[
   ['Λίστα','Κάθε γραμμή δείχνει τίτλο, είδος, περίοδο, σε ποια νοσοκομεία απευθύνεται, πόσοι την είδαν και αν είναι ενεργή. Με κλικ ανοίγει η καρτέλα της: «Προεπισκόπηση» και «Δημοσίευση» στην κορυφή, και στο «⋯» η διακοπή, η επανενεργοποίηση και η διαγραφή. «Πίσω» επιστρέφει στη λίστα.'],
   ['Μήνυμα συντήρησης','Το πρώτο, καρφιτσωμένο στοιχείο της λίστας είναι η λωρίδα που εμφανίζεται πάνω σε όλες τις οθόνες όλων των χρηστών (π.χ. για προγραμματισμένη συντήρηση). Με κλικ το ενεργοποιείτε ή το σβήνετε και γράφετε το κείμενο, σε μία ή δύο γλώσσες, με προεπισκόπηση.'],
   ['Νέα ανακοίνωση','Γράφετε τίτλο και κείμενο, διαλέγετε περίοδο και αν εμφανίζεται μία φορά ή σε κάθε είσοδο. Στο πεδίο «Πού εμφανίζεται» διαλέγετε, με πολλαπλή επιλογή: «Όλα τα νοσοκομεία (εγγεγραμμένα)», «Όλα τα demo» ή μεμονωμένα νοσοκομεία και demo (τα demo έχουν δίπλα την ένδειξη Demo). Αν δεν διαλέξετε τίποτα, εμφανίζεται σε όλα τα νοσοκομεία και σε όλα τα demo· αν διαλέξετε μόνο «Όλα τα νοσοκομεία», δεν εμφανίζεται στα demo, και αντίστροφα. Όποιος μπαίνει σε ένα demo που ισχύει τη βλέπει, μία φορά ανά συνεδρία. Προαιρετικά επισυνάπτετε εικόνα ή αρχείο.'],
   ['Εικόνα, αρχείο και θέση','Στην καρτέλα της ανακοίνωσης υπάρχουν ξεχωριστά πεδία Εικόνα και Συνημμένο αρχείο (PDF, Word, PowerPoint, Excel) και η Θέση εικόνας: πάνω, αριστερά, δεξιά ή κάτω από το κείμενο. Όταν η ανακοίνωση εμφανίζεται στους χρήστες, δεν κλείνει με κλικ έξω από το παράθυρο ώστε να προλαβαίνουν να τη διαβάσουν· κλείνει από το Χ πάνω δεξιά ή από το κουμπί της ενέργειας. Η εικόνα φορτώνει πρώτα και μετά ανοίγει η ανακοίνωση, χωρίς να αλλάζει μέγεθος.']
  ],steps:['Πατήστε «Νέα ανακοίνωση».','Συμπληρώστε κείμενο, νοσοκομεία και περίοδο.','Αποθηκεύστε· εμφανίζεται στους διαχειριστές μόλις ανοίξουν την εφαρμογή.']},
  '/platform#management':{title:'Λίστες',summary:'Οι κοινές λίστες, οι δέσμες μέτρων, τα κριτήρια λοιμώξεων και οι ορισμοί δεικτών για όλα τα νοσοκομεία.',audience:audienceEl,chapters:[
   ['Κοινό περιεχόμενο','Αριστερά διαλέγετε λίστα ανά ομάδα (Κλινικά, Εργαστήριο, Πρόληψη…)· δεξιά βλέπετε και αλλάζετε τις εγγραφές της. Οι αλλαγές εφαρμόζονται σε όλα τα νοσοκομεία που χρησιμοποιούν το αντίστοιχο κεντρικό στοιχείο.'],
   ['Ενημερώσεις πηγών','Με «Έλεγχος τώρα» ελέγχονται οι κλινικές πηγές. Το «Ενημερώσεις» ανοίγει όσες περιμένουν έλεγχο (ο αριθμός τους φαίνεται στο κουμπί) μαζί με το ιστορικό: «Ελέγχθηκε» κλείνει μια αλλαγή, «Αναβολή» την επαναφέρει σε 7 ημέρες.']
  ],steps:['Διαλέξτε λίστα αριστερά.','Κάντε την αλλαγή.','Ελέγξτε τις εκκρεμείς ενημερώσεις πηγών.']},
  '/platform/legislation':{title:'Νομοθεσία & πηγές',summary:'Η βιβλιοθήκη νομοθεσίας που διαβάζουν όλα τα νοσοκομεία, ό,τι βρήκε ο αυτόματος έλεγχος, οι πηγές του, οι οδηγίες & σύνδεσμοι της Βιβλιοθήκης και οι εξωτερικές πηγές.',audience:audienceEl,chapters:[
   ['Νομοθεσία','Τα κείμενα της πλατφόρμας με τις απαιτήσεις τους. Με «Νέο κείμενο» προσθέτετε ένα· τίποτα δεν φτάνει στα νοσοκομεία πριν το δημοσιεύσετε.'],
   ['Προς έλεγχο και πηγές νομοθεσίας','Ο αυτόματος έλεγχος διαβάζει τις πηγές νομοθεσίας κάθε 2 ώρες· ό,τι βρει εμφανίζεται «Προς έλεγχο», όπου το καταχωρίζετε ως νέο κείμενο, ως ενημέρωση υπάρχοντος ή το απορρίπτετε.'],
   ['Οδηγίες & σύνδεσμοι, εξωτερικές πηγές','Το περιεχόμενο της Βιβλιοθήκης σε επίπεδο πλατφόρμας και οι επίσημες πηγές (ΠΟΥ, ECDC, ΕΟΔΥ…) που διαβάζουν όλα τα νοσοκομεία.']
  ],steps:['Διαλέξτε επιλογή από τη γραμμή στην κορυφή.','Ελέγξτε τα ευρήματα «Προς έλεγχο».','Δημοσιεύστε ό,τι πρέπει να δουν τα νοσοκομεία.']},
  '/platform#management?group=lira':{title:'LIRA & AI',summary:'Η γνώση που χρησιμοποιεί η LIRA σε όλα τα νοσοκομεία.',audience:audienceEl,chapters:[
   ['Γνώση της LIRA','Η LIRA είναι ο βοηθός τεχνητής νοημοσύνης που απαντά μέσα στα νοσοκομεία. Η σελίδα (στο μενού «LIRA & AI») έχει τίτλο «Πηγές γνώσης της LIRA (βοηθός AI)» και δείχνει τα κείμενα και τις πηγές στα οποία βασίζεται όταν απαντά: φορέας, πηγή, έκδοση, έγκριση και αν η γνώση είναι έτοιμη. Οι αλλαγές ισχύουν για όλα τα νοσοκομεία.']
  ],steps:['Ελέγξτε τη λίστα.','Προσθέστε ή διορθώστε ό,τι χρειάζεται.']},
  '/platform/audit':{title:'Ιστορικό & Ασφάλεια',summary:'Ιχνηλασιμότητα ενεργειών, αλλαγών πρόσβασης και λειτουργικών συμβάντων.',audience:audienceEl,chapters:[
   ['Ενέργειες & πρόσβαση','Κάθε σημαντική διοικητική ενέργεια καταγράφεται με χρήστη, χρόνο και οργανισμό. Το ιστορικό είναι μόνο για ανάγνωση· τα φίλτρα δείχνουν αλλαγές ρόλων, προσκλήσεις και διαγραφές.'],
   ['Συμβάντα & σφάλματα','Η δεύτερη καρτέλα δείχνει αποτυχίες, αποκλεισμούς και προειδοποιήσεις όλων των πραγματικών οργανισμών, χωρίς κλινικό περιεχόμενο.'],
   ['Συνδέσεις','Ποιος συνδέθηκε, από ποια IP και συσκευή, πότε και για πόση ώρα· ποιοι είναι συνδεδεμένοι τώρα. Οι αποτυχημένες προσπάθειες καταγράφονται· 5 λάθη σε 15 λεπτά κλειδώνουν τον λογαριασμό για 15 λεπτά και 20 λάθη την IP. Από το «⋯» μιας σύνδεσης την τερματίζετε ή αποσυνδέετε τον χρήστη από όλες τις συσκευές.']
  ],steps:['Διαλέξτε καρτέλα.','Φιλτράρετε ανά οργανισμό, ενέργεια ή σοβαρότητα.','Ανανεώστε μετά από διόρθωση.']},
 },
 en:{
  '/platform':{title:'Platform Center',summary:'The overall picture of the installation without entering an organization.',audience:audienceEn,chapters:[
   ['Overview','The strip at the top shows organizations, users, active demos and the errors of the last 24 hours; click a number to open its screen. On the left are the hospitals with their activity and on the right one box for what needs attention: who is connected now, failed sign-ins demos expiring soon, accounts that were locked or have not yet changed their temporary password, and legislation proposals waiting for review (a row shows only when there is something). “New Demo” and “New organization” are at the top right.'],
   ['Workspaces','From the Management and Governance cards you open Organizations, Demo, Analysis, Central Management, Health, Audit and Settings.'],
   ['Going back','On every platform screen the topbar breadcrumb ("Platform Center › …") brings you back here in one click.']
  ],steps:['Review the indicators and expiring demos.','Open the workspace you need.','Return from the topbar breadcrumb.']},
  '/platform#organizations':{title:'Organizations',summary:'Registry of the hospitals and clinics on the platform.',audience:audienceEn,chapters:[
   ['Registry','Each row shows the organization with its code and city, active against all users, the latest sign-in of any of its users (when and who) and one status: Active, Admin pending, Paused or Deletion scheduled. The totals beside the search filter the list with one click.'],
   ['New organization','"New organization" records identity, location and the initial Hospital Admin, who receives an invitation.'],
   ['Organization record','The record has Details, Package & modules, Users (with the last sign-in and IP), Activity (Events or Sign-ins, where you can end a session) and Export & deletion. On every tab, “Enter” takes you into the organization for support and “⋯” holds pause or reactivation, the Hospital Admin password reset and permanent deletion.'],
   ['Operating profile','In the organization’s “Package & modules” tab choose a package (Basic records, Laboratory & surveillance, Full programme), then click a module’s lock to unlock or lock it. Whatever is locked is hidden from every user of the hospital, and no data is deleted. The orange “Also needs…” warning shows that a prerequisite module is missing; it does not block saving.'],
   ['Settings','The gear beside “Export” opens the settings that apply to every organization: the grace period (days from scheduling until an organization is deleted for good) and the support email the hospitals see. Every change is recorded in History & Health.'],
   ['New active user','From New user choose Active with a temporary password, or import from a file. Fill in the full name, e-mail or username, role and department. Optionally enter the Mobile number and choose Temporary password: Random or The user mobile number. With the second the user signs in with the username and the mobile number as the password and sets their own at the first sign-in. The temporary password expires in 7 days: if the user does not sign in, the account is locked and you give a new one. For the Division Director role choose the Division (an existing one, or a new one by typing its name) and, with multiple choice, the departments they will see. The Excel file has the columns Mobile, Division and Departments seen (separated by ;). Temporary passwords are shown only once, on screen and in the results Excel. Until the user changes the temporary password they see no hospital data: the database itself blocks it, not only the screen. If the password is lost or the account gets locked, open the user, choose the ⋯ menu and New temporary password: pick Random or The user\'s mobile number, and the new password is valid for 7 days and unlocks the account.']
  ],steps:['Search for the organization.','Open its record.','Make the change or enter as needed.']},
  '/platform#users':{title:'Platform users',summary:'Everyone on the platform: hospitals, Demo and the Owner.',audience:audienceEn,chapters:[
   ['Registry','Each row shows the user, username, role, organization, last sign-in (when and from which IP, or “Online now” with a green dot) and status. The totals beside the search filter with one click: hospital users, online now, Demo, Owner, pending invitations, inactive.'],
   ['New user','“New user” first asks for the organization, then continues into that organization’s own dialogs: active with a temporary password, invitation by e-mail or import from a file.'],
   ['User record','A click on a row opens the user’s record with three tabs: Details (with “Edit” and the Security section: account lock with “Unlock” and the failed attempts of 24 hours), Sign-ins (with ending a session) and Activity (their actions). The “⋯” holds password reset, suspend or reactivate, sign out of every device and delete.'],
  ],steps:['Search or filter for the user.','Open the record.','Take the action you need from “⋯”.']},
  '/platform#demo':{title:'Demo',summary:'Time-limited access with synthetic data only.',audience:audienceEn,chapters:[
   ['Isolation','Demos are fully isolated from production data. No patient or employee record is ever shown in them.'],
   ['New demo','Set the prospect, contact person, invitation email and duration. The suggested duration and the users per Demo are set from the “Demo settings” gear beside “Export”.'],
   ['Reset data','Each Demo is a separate hospital with its own data. The evaluator clicks “Reset data” on the Demo line to clear their changes and write the starting data again; other Demos are not affected.'],
   ['Conversion','When the prospect becomes a customer, convert the demo into a real organization from its record.']
  ],steps:['Create the demo.','Track its expiry.','Convert or delete it when done.']},
  '/platform#reports':{title:'Platform reports',summary:'Aggregated indicators at platform level.',audience:audienceEn,chapters:[
   ['Aggregated data','Analysis shows only aggregated counts per organization and period, never individual clinical records.'],
   ['Filters','Use the Filters button at the top right to choose the year, breakdown (year, month, quarter, half-year), region and hospital. “OK” closes the window and “Clear filters” resets them. Columns and chips with no value at all stay hidden until data exists.']
  ],steps:['Choose period and organizations.','Review the charts.','Print or export the report.']},
  '/platform/announcements':{title:'Announcements',summary:'Announcements and promotions to the hospital administrators.',audience:audienceEn,chapters:[
   ['List','Each row shows the title, type, period, which hospitals it is for, how many saw it and whether it is active. A click opens its record: “Preview” and “Publish” at the top, and in the «⋯» stop, resume and delete. “Back” returns to the list.'],
   ['Maintenance message','The first, pinned item of the list is the band shown over every screen for every user (e.g. for planned maintenance). Click it to turn it on or off and write the text, in one or two languages, with a preview.'],
   ['New announcement','Write a title and text, choose the period and whether it shows once or at every visit. In the “Where it shows” field choose, with multiple selection: “Every registered hospital”, “Every demo”, or single hospitals and demos (demos carry a Demo mark). If you choose nothing it shows in every hospital and every demo; choose only “Every registered hospital” and it does not show in demos, and the other way round. Whoever opens a demo it applies to sees it, once per session. Optionally attach an image or a file.'],
   ['Image, file and position','The announcement card has separate Image and Attached file fields (PDF, Word, PowerPoint, Excel) and the Image position: above, left, right or below the text. When the announcement is shown to users it does not close by clicking outside the window, so they have time to read it; it closes with the X at the top right or with the action button. The image loads first and then the announcement opens, without changing size.']
  ],steps:['Select "New announcement".','Fill in the text, hospitals and period.','Save; the administrators see it when they open the application.']},
  '/platform#management':{title:'Lists',summary:'The shared lists, prevention bundles, infection criteria and indicator definitions for every hospital.',audience:audienceEn,chapters:[
   ['Shared content','On the left pick a list by group (Clinical, Laboratory, Prevention…); on the right view and change its entries. Changes apply to every hospital using the corresponding central item.'],
   ['Source updates','"Check now" checks the clinical sources. "Updates" opens those waiting for review (their number shows on the button) together with the history: "Reviewed" closes a change, "Postpone" brings it back in 7 days.']
  ],steps:['Pick a list on the left.','Make the change.','Review pending source updates.']},
  '/platform/legislation':{title:'Legislation & sources',summary:'The legislation library every hospital reads, what the automatic check found, its sources, the Library’s guides & links and the external sources.',audience:audienceEn,chapters:[
   ['Legislation','The platform’s texts with their requirements. "New text" adds one; nothing reaches the hospitals before you publish it.'],
   ['To review and legislation sources','The automatic check reads the legislation sources every 2 hours; what it finds is listed under "To review", where you record it as a new text, as an update of an existing one, or dismiss it.'],
   ['Guides & links, external sources','The Library content at platform level and the official sources (WHO, ECDC, EODY…) every hospital reads.']
  ],steps:['Pick a choice from the row at the top.','Check the items "To review".','Publish what the hospitals should see.']},
  '/platform#management?group=lira':{title:'LIRA & AI',summary:'The knowledge LIRA uses in every hospital.',audience:audienceEn,chapters:[
   ['LIRA’s knowledge','LIRA is the AI assistant that answers inside the hospitals. The page (in the “LIRA & AI” menu) is titled “LIRA knowledge sources (AI assistant)” and shows the texts and sources it relies on when it answers: authority, source, version, approval and whether the knowledge is ready. Changes apply to every hospital.']
  ],steps:['Check the list.','Add or correct what is needed.']},
  '/platform/audit':{title:'Audit & Security',summary:'Traceability of actions, access changes and operational events.',audience:audienceEn,chapters:[
   ['Actions & access','Every significant administrative action is recorded with user, time and organization. The history is read-only; the filters show role changes, invitations and deletions.'],
   ['Events & errors','The second tab shows failures, blocks and warnings across production organizations, without clinical content.'],
   ['Sign-ins','Who signed in, from which IP and device, when and for how long; who is online now. Failed attempts are recorded; 5 failures in 15 minutes lock the account for 15 minutes and 20 lock the IP. From a session’s «⋯» you end it or sign the user out of every device.']
  ],steps:['Pick a tab.','Filter by organization, action or severity.','Refresh after a fix.']},
 },
}
