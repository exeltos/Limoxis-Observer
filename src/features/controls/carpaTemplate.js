// Standard contents of the resuscitation trolley (ΚΑΡΠΑ) and of the intubation
// trays, from the hospital's forms: Ε.Δ.ΝΥ.010.Θ-14/2 (trolley with its tray),
// Ε.Δ.ΝΥ.010.Θ-15 (adult tray), Ε.Δ.ΝΥ.010.Θ-4 (neonate tray) and Ε.Δ.ΝΥ.110.Θ-29
// (neonate tray of the maternity ward). A control's list starts from one of them
// with one click; the quantities are the expected ones and each department's head
// fills in the expiry dates. A note comes in both languages (noteEn).
const med=(item,ingredient,quantity,form='ampoule',note=['',''])=>({item,ingredient,quantity:String(quantity),form,note:note[0],noteEn:note[1],category:'medicine'})
const sup=(item,quantity,note=['',''])=>({item,ingredient:'',quantity:String(quantity),form:'piece',note:note[0],noteEn:note[1],category:'supply'})

const PER_TYPE=['2 ανά είδος','2 per type']
const TRAY=['Δίσκος διασωλήνωσης','Intubation tray']
const trayNote=(extra=['',''])=>[`${TRAY[0]}${extra[0]?` · ${extra[0]}`:''}`,`${TRAY[1]}${extra[1]?` · ${extra[1]}`:''}`]

const TROLLEY=[
 med('ADRENALINE amp','Αδρεναλίνη',15),
 med('ATROPINE amp','Ατροπίνη',2),
 med('EPHEDRINE amp','Εφεδρίνη',2),
 med('METOPROLOL/BELOC amp','Metoprolol',2),
 med('EFFORTIL amp','Etilefrin',2),
 med('NORADRENALINE/NORADREN amp','Noradrenaline',2),
 med('HYDROFLUX/LASIX amp','Furosemide',5),
 med('XYLOCAINE 2%/XYLOZAN fl sprey','Lidocaine',1,'other'),
 med('ESMERON fl','Rocuronium',2,'flacon'),
 med('PROPOFOLE 1% 20ml/DIPRIVAN','Propofol',2,'vial'),
 med('HYPNOMIDATE fl','Etomidate',2,'flacon'),
 med('DORMICUM/DORMIXAL amp','Midazolam',1),
 med('N/S 0,9% 10 cc amp','',10),
 med('ΟΡΟΙ R/L, 0,9% 100ml, 250ml, 1000ml','',2,'bag',PER_TYPE),
 sup('ΦΛΕΒΟΚΑΘΕΤΗΡΕΣ 18G',5),
 sup('ΦΛΕΒΟΚΑΘΕΤΗΡΕΣ 20G',5),
 sup('ΦΛΕΒΟΚΑΘΕΤΗΡΕΣ 22G',5),
 sup('ΑΡΤΗΡΙΑΚΟ ABBOCATH LONG 20G',3),
 sup('3 WAY',5),
 sup('ΠΩΜΑΤΑ 3 WAY',5),
 sup('TEGADERM 6X7cm',5),
 sup('ΛΑΣΤΙΧΟ ΑΙΜΟΛΗΨΙΑΣ',1),
 sup('ΑΠΟΣΤΕΙΡΩΜΕΝΕΣ ΓΑΖΕΣ',4),
 sup('ΞΥΡΑΦΑΚΙΑ',1),
 sup('ΡΑΜΜΑΤΑ No 2-0 VYKRIL',2),
 sup('ΝΥΣΤΕΡΙ ΜΕ ΛΑΒΗ No 11',2),
 sup('ΣΥΡΙΓΓΕΣ ΙΝΣΟΥΛΙΝΗΣ',5),
 sup('ΣΥΡΙΓΓΕΣ 5CC',5),
 sup('ΣΥΡΙΓΓΕΣ 10CC',5),
 sup('ΣΥΡΙΓΓΕΣ 20CC',5),
 sup('ΒΕΛΟΝΕΣ',5),
 sup('ΜΑΣΚΕΣ ΟΞΥΓΟΝΟΥ ΑΠΛΕΣ',1),
 sup('ΜΑΣΚΕΣ ΟΞΥΓΟΝΟΥ VENTURI',1),
 sup('ΜΑΣΚΕΣ ΟΞΥΓΟΝΟΥ ΕΠΑΝΕΙΣΠΝΟΗΣ',1),
 sup('ΣΥΝΔΕΤΙΚΑ ΑΝΑΡΡΟΦΗΣΗΣ',1),
 sup('ΚΑΘΕΤΗΡΕΣ ΑΝΑΡΡΟΦΗΣΗΣ',2,['2 ανά μέγεθος','2 per size']),
 sup('ΗΛΕΚΤΡΟΔΙΑ pads ΗΚΓ',1),
 sup('ΣΥΣΚΕΥΕΣ ΟΡΟΥ',2),
 sup('3 WAY ΜΕ ΠΡΟΕΚΤΑΣΗ',2),
 sup('ΣΕΤ ΑΛΛΑΓΗΣ',1),
 sup('ΗΛΕΚΤΡΟΔΙΑ ΑΠΙΝΙΔΩΤΗ',1),
 sup('3LUMEN ΚΑΘΕΤΗΡΑΣ ΚΕΝΤΡΙΚΗΣ ΓΡΑΜΜΗΣ',1),
 sup('ΦΙΑΛΗ ΟΞΥΓΟΝΟΥ',1),
 sup('ΛΑΡΥΓΓΟΣΚΟΠΙΟ ΜΕ ΛΑΜΑ No3/No4/No5 (+ΜΠΑΤΑΡΙΕΣ)',1,trayNote(['1 ανά μέγεθος','1 per size'])),
 sup('ΦΑΚΑΡΟΛΑ',1,trayNote()),
 sup('ΕΝΔΟΤΡΑΧΕΙΑΚΟΙ ΚΑΘΕΤΗΡΕΣ ΣΤΟΝ ΔΙΣΚΟ ΔΙΑΣΩΛΗΝΩΣΗΣ No7, No8',2,trayNote(['2 ανά μέγεθος','2 per size'])),
 sup('ΦΑΚΟΣ (+2 ΜΠΑΤΑΡΙΕΣ)',1,trayNote()),
 sup('ΑΕΡΑΓΩΓΟΙ No2,3',1,trayNote(['1 ανά μέγεθος','1 per size'])),
 sup('ΛΑΡΥΓΓΙΚΗ ΜΑΣΚΑ No 4/ No 5',1,trayNote(['1 ανά μέγεθος','1 per size'])),
 sup('ΟΔΗΓΟΣ ΔΙΑΣΩΛΗΝΩΣΗΣ M & L',1,trayNote(['1 ανά μέγεθος','1 per size'])),
 sup('ΣΥΡΙΓΓΕΣ 10CC (δίσκος διασωλήνωσης)',2,trayNote()),
 sup('AMBU ΣΥΝΑΡΜΟΛΟΓΗΜΕΝΗ ΜΕ ΜΑΣΚΑ',1,trayNote()),
]

const ADULT_TRAY=[
 sup('ΛΑΡΥΓΓΟΣΚΟΠΙΟ (+ΜΠΑΤΑΡΙΕΣ)',1),
 sup('ΛΑΜΕΣ Νο 3, 4, 5',1,['1 ανά νούμερο','1 per size']),
 sup('ΦΑΚΑΡΟΛΑ',1,['1 ρολό','1 roll']),
 sup('ΦΑΚΟΣ (+ΜΠΑΤΑΡΙΕΣ)',1),
 sup('ΟΔΗΓΟΣ ΕΝΔΟΤΡ/ΚΩΝ LARGE VYGON 5576.01',1),
 sup('ΟΔΗΓΟΣ ΕΝΔΟΤΡ/ΚΩΝ MED. 100/120/200',1),
 sup('ΟΔΗΓΟΣ ΕΝΔΟΤΡ/ΚΩΝ LARGE 100/120/300',1),
 sup('ΛΑΡΥΓΓΙΚΗ ΜΑΣΚΑ Νο 4 & 5',1,['1 ανά νούμερο','1 per size']),
 sup('ΕΝΔΟΤΡΑΧΕΙΑΚΟΙ Νο 6, 7, 8',2,['2 ανά νούμερο','2 per size']),
 med('XYLOCAINE SPRAY 10% FL 50ML','Lidocaine',1,'other'),
 sup('ΑΕΡΑΓΩΓΟΙ Νο 2, 3',1,['1 ανά νούμερο','1 per size']),
 sup('ΣΥΡΙΓΓΕΣ 10cc',2),
 sup('AMBU ΣΥΝΑΡΜΟΛΟΓΗΜΕΝΗ ΚΑΙ ΜΑΣΚΑ',1),
]

const NEONATE_TRAY=[
 sup('ΛΑΡΥΓΓΟΣΚΟΠΙΟ',1),
 sup('ΛΑΜΜΕΣ Νο 0 - 00',1,['1 ανά νούμερο','1 per size']),
 sup('ΤΡΑΧΕΙΟΣΩΛΗΝΕΣ Νο 2 - 2,5 - 3 - 3,5 - 4',1,['1 ανά νούμερο','1 per size']),
 sup('ΠΡΟΣΩΠΙΔΑ Νο 1 - 2 - 3',1,['1 ανά νούμερο','1 per size']),
 sup('ΚΑΘΕΤΗΡΑΣ ΟΜΦΑΛΙΚΟΣ Νο 3,5',1),
 sup('ΟΜΦΑΛΟΔΕΜΑ (ΦΑΚΑΡΟΛΑ)',1),
 sup('ΡΑΜΜΑ MERSILK ETHICON 3-0',1),
 sup('AMBU',1),
 sup('ΣΥΡΙΓΓΕΣ 1ml & 10ml',2,['2 ανά μέγεθος','2 per size']),
 med('ADRENALINE','Αδρεναλίνη',1),
 med('SODIUM CHLORIDE 0,9% amp','',1),
 med('SODIUM BICARBONATE 4% amp','',1),
 med('CALCIUM GLUCONATE 5% ή 10%','',1),
 med('BETADINE','Povidone-iodine',1,'bottle'),
 sup('ΟΙΝΟΠΝΕΥΜΑ',1),
]

const MATERNITY_NEONATE_TRAY=[
 sup('ΛΑΡΥΓΓΟΣΚΟΠΙΟ & ΕΦΕΔΡΙΚΕΣ ΜΠΑΤΑΡΙΕΣ',1),
 sup('ΦΑΚΟΣ & ΕΦΕΔΡΙΚΕΣ ΜΠΑΤΑΡΙΕΣ',1),
 sup('ΑΕΡΑΓΩΓΟΣ Νο 1 & Νο 0',2,['ένας Νο 1 και ένας Νο 0','one No 1 and one No 0']),
 sup('ΛΑΜΜΕΣ MILLER Νο 0',1,['1 ανά νούμερο','1 per size']),
 sup('ΤΡΑΧΕΙΟΣΩΛΗΝΕΣ Νο 3 - 3,5 - 4',2,['2 ανά νούμερο','2 per size']),
 sup('ΣΥΡΙΓΓΕΣ 1ml & 10ml',2,['2 ανά μέγεθος','2 per size']),
 sup('ΝΥΣΤΕΡΑΚΙ Νο 21',1),
 sup('DURAPORE',1),
 sup('ΡΑΜΜΑ MERSILK ETHICON 3-0',1),
 sup('AMBU & ΜΑΣΚΕΣ Νο 1 / Νο 2',1,['1 AMBU και 1 μάσκα ανά νούμερο','1 AMBU and 1 mask per size']),
 med('ATROPINE amp','Ατροπίνη',1),
 med('ADRENALINE amp','Αδρεναλίνη',1),
 med('N/S 0,9% amp 10 ml','',1),
 med('D/W 5% 100 ml και 10% 250 ml','',1,'bag',['1 από κάθε είδος','1 of each']),
 sup('ΑΠΟΣΤΕΙΡΩΜΕΝΑ ΓΑΝΤΙΑ',1),
 sup('ΑΠΟΣΤΕΙΡΩΜΕΝΕΣ ΓΑΖΕΣ',1),
 sup('ΒΕΛΟΝΟΚΑΤΟΧΟ',1),
 sup('ΙΜΑΝΤΑΣ ΑΙΜΟΛΗΨΙΑΣ',1),
 sup('ΠΕΤΑΛΟΥΔΑ 25G',2),
 sup('ΒΕΛΟΝΕΣ 21G ΚΑΙ 23G',2,['2 ανά μέγεθος','2 per size']),
 sup('ΚΑΘΕΤΗΡΑΣ ΑΝΑΡΡΟΦΗΣΗΣ',2),
]

// key: stored nowhere, only picks the template; code: the form's number.
export const CARPA_TEMPLATES=[
 {key:'trolley',code:'Ε.Δ.ΝΥ.010.Θ-14/2',el:'Τροχήλατο ΚΑΡΠΑ και δίσκος διασωλήνωσης',en:'Resuscitation trolley and intubation tray',items:TROLLEY},
 {key:'adult-tray',code:'Ε.Δ.ΝΥ.010.Θ-15',el:'Δίσκος διασωλήνωσης ενηλίκων',en:'Adult intubation tray',items:ADULT_TRAY},
 {key:'neonate-tray',code:'Ε.Δ.ΝΥ.010.Θ-4',el:'Δίσκος διασωλήνωσης νεογνού',en:'Neonate intubation tray',items:NEONATE_TRAY},
 {key:'maternity-neonate-tray',code:'Ε.Δ.ΝΥ.110.Θ-29',el:'Δίσκος διασωλήνωσης νεογνού μαιευτικού τμήματος',en:'Neonate intubation tray, maternity ward',items:MATERNITY_NEONATE_TRAY},
]
