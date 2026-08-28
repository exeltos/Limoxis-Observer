export const BUNDLE_TEMPLATES=[
 {id:'CLABSI',name:'CLABSI',title:'Κεντρικός φλεβικός καθετήρας',version:'1.0',scope:'CVC insertion / maintenance',source:'WHO 2026 · CDC',elements:[
  ['necessity','Τεκμηριωμένη ένδειξη / καθημερινή ανάγκη για CVC'],
  ['hand_hygiene','Υγιεινή χεριών πριν από χειρισμό'],
  ['aseptic','Άσηπτη τεχνική κατά την εισαγωγή / χειρισμό'],
  ['barrier','Μέγιστες στείρες προφυλάξεις κατά την εισαγωγή'],
  ['skin','Κατάλληλη αντισηψία δέρματος και χρόνος στεγνώματος'],
  ['site','Κατάλληλη επιλογή / καθημερινή αξιολόγηση σημείου'],
  ['hub','Απολύμανση συνδέσμου πριν από πρόσβαση'],
  ['dressing','Επίδεση καθαρή, στεγνή και ακέραιη'],
  ['remove','Άμεση αφαίρεση όταν δεν είναι πλέον απαραίτητος'],
 ]},
 {id:'CAUTI',name:'CAUTI',title:'Ουροκαθετήρας',version:'1.0',scope:'Urinary catheter insertion / maintenance',source:'CDC/HICPAC',elements:[
  ['indication','Υπάρχει τεκμηριωμένη κατάλληλη ένδειξη καθετηριασμού'],
  ['aseptic','Άσηπτη εισαγωγή με κατάλληλο αποστειρωμένο εξοπλισμό'],
  ['trained','Εισαγωγή / χειρισμός από εκπαιδευμένο προσωπικό'],
  ['closed','Διατήρηση κλειστού συστήματος παροχέτευσης'],
  ['flow','Ανεμπόδιστη ροή ούρων και σωστή θέση συλλέκτη'],
  ['handling','Άσηπτος χειρισμός κατά δειγματοληψία / πρόσβαση'],
  ['daily','Καθημερινή επανεκτίμηση της ανάγκης'],
  ['remove','Έγκαιρη αφαίρεση όταν παύει η ένδειξη'],
 ]},
 {id:'VAP',name:'VAP / VAE',title:'Μηχανικός αερισμός',version:'1.0',scope:'Ventilated patient prevention',source:'SHEA/IDSA/APIC/AHA/TJC 2022',elements:[
  ['necessity','Καθημερινή αξιολόγηση ετοιμότητας για αποδέσμευση από αερισμό'],
  ['sedation','Ελαχιστοποίηση καταστολής σύμφωνα με το κλινικό πρωτόκολλο'],
  ['mobility','Πρώιμη κινητοποίηση όταν είναι κλινικά εφικτή'],
  ['oral','Τεκμηριωμένη στοματική φροντίδα σύμφωνα με το πρωτόκολλο'],
  ['position','Κατάλληλη θέση κεφαλής κλίνης όταν δεν αντενδείκνυται'],
  ['circuit','Αποφυγή μη αναγκαίων χειρισμών / αλλαγών κυκλώματος'],
  ['secretion','Ασφαλής διαχείριση εκκρίσεων και αναρρόφησης'],
 ]},
 {id:'SSI',name:'SSI',title:'Χειρουργική λοίμωξη',version:'1.0',scope:'Perioperative SSI prevention',source:'CDC · WHO',elements:[
  ['antibiotic','Κατάλληλη χειρουργική αντιμικροβιακή προφύλαξη σύμφωνα με τοπικό πρωτόκολλο'],
  ['hair','Αποφυγή ξυρίσματος· κατάλληλη αποτρίχωση μόνο όταν απαιτείται'],
  ['skin','Κατάλληλη προεγχειρητική αντισηψία δέρματος'],
  ['glucose','Περιεγχειρητικός γλυκαιμικός έλεγχος όπου ενδείκνυται'],
  ['temperature','Διατήρηση νορμοθερμίας όπου ενδείκνυται'],
  ['asepsis','Τήρηση άσηπτης τεχνικής / αποστειρωμένου πεδίου'],
  ['wound','Τεκμηριωμένη μετεγχειρητική φροντίδα τραύματος'],
 ]},
]

export function getBundleTemplate(id){return BUNDLE_TEMPLATES.find(x=>x.id===id)||BUNDLE_TEMPLATES[0]}
export function bundleScore(answers={}){
 const applicable=Object.values(answers).filter(x=>x==='yes'||x==='no')
 if(!applicable.length)return null
 const yes=applicable.filter(x=>x==='yes').length
 return Math.round(yes/applicable.length*100)
}
export function bundleAllOrNone(answers={}){
 const applicable=Object.values(answers).filter(x=>x==='yes'||x==='no')
 return applicable.length>0&&applicable.every(x=>x==='yes')
}
