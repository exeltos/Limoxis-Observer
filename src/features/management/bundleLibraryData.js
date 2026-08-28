export const SYSTEM_BUNDLE_LIBRARY=[
 {id:'CLABSI',name:'CLABSI',titleEl:'Κεντρικός φλεβικός καθετήρας',titleEn:'Central venous catheter',version:'1.0',status:'published',scope:'CVC insertion / maintenance',source:'WHO · CDC',sourceVersion:'reviewed 2026',system:true,departments:['ΜΕΘ'],elements:[
  {id:'necessity',labelEl:'Τεκμηριωμένη ένδειξη / καθημερινή ανάγκη για CVC',labelEn:'Documented indication / daily CVC necessity review',required:true},
  {id:'hand_hygiene',labelEl:'Υγιεινή χεριών πριν από χειρισμό',labelEn:'Hand hygiene before manipulation',required:true},
  {id:'aseptic',labelEl:'Άσηπτη τεχνική κατά την εισαγωγή / χειρισμό',labelEn:'Aseptic technique during insertion / manipulation',required:true},
  {id:'barrier',labelEl:'Μέγιστες στείρες προφυλάξεις κατά την εισαγωγή',labelEn:'Maximal sterile barrier precautions during insertion',required:true},
  {id:'skin',labelEl:'Κατάλληλη αντισηψία δέρματος και χρόνος στεγνώματος',labelEn:'Appropriate skin antisepsis and drying time',required:true},
  {id:'site',labelEl:'Καθημερινή αξιολόγηση σημείου εισόδου',labelEn:'Daily insertion-site assessment',required:true},
  {id:'hub',labelEl:'Απολύμανση συνδέσμου πριν από πρόσβαση',labelEn:'Hub disinfection before access',required:true},
  {id:'dressing',labelEl:'Επίδεση καθαρή, στεγνή και ακέραιη',labelEn:'Dressing clean, dry and intact',required:true},
  {id:'remove',labelEl:'Άμεση αφαίρεση όταν δεν είναι πλέον απαραίτητος',labelEn:'Prompt removal when no longer necessary',required:true},
 ]},
 {id:'CAUTI',name:'CAUTI',titleEl:'Ουροκαθετήρας',titleEn:'Urinary catheter',version:'1.0',status:'published',scope:'Urinary catheter insertion / maintenance',source:'CDC / HICPAC',sourceVersion:'reviewed 2026',system:true,departments:['Παθολογική','ΜΕΘ'],elements:[
  {id:'indication',labelEl:'Τεκμηριωμένη κατάλληλη ένδειξη καθετηριασμού',labelEn:'Documented appropriate indication for catheterization',required:true},
  {id:'aseptic',labelEl:'Άσηπτη εισαγωγή με κατάλληλο αποστειρωμένο εξοπλισμό',labelEn:'Aseptic insertion with appropriate sterile equipment',required:true},
  {id:'trained',labelEl:'Εισαγωγή / χειρισμός από εκπαιδευμένο προσωπικό',labelEn:'Insertion / handling by trained personnel',required:true},
  {id:'closed',labelEl:'Διατήρηση κλειστού συστήματος παροχέτευσης',labelEn:'Maintain a closed drainage system',required:true},
  {id:'flow',labelEl:'Ανεμπόδιστη ροή ούρων και σωστή θέση συλλέκτη',labelEn:'Unobstructed urine flow and proper bag position',required:true},
  {id:'handling',labelEl:'Άσηπτος χειρισμός κατά δειγματοληψία / πρόσβαση',labelEn:'Aseptic handling during sampling / access',required:true},
  {id:'daily',labelEl:'Καθημερινή επανεκτίμηση της ανάγκης',labelEn:'Daily review of necessity',required:true},
  {id:'remove',labelEl:'Έγκαιρη αφαίρεση όταν παύει η ένδειξη',labelEn:'Prompt removal when indication ends',required:true},
 ]},
 {id:'VAP',name:'VAP / VAE',titleEl:'Μηχανικός αερισμός',titleEn:'Mechanical ventilation',version:'1.0',status:'published',scope:'Ventilated patient prevention',source:'SHEA / IDSA / APIC / AHA / TJC',sourceVersion:'2022 strategy update',system:true,departments:['ΜΕΘ'],elements:[
  {id:'necessity',labelEl:'Καθημερινή αξιολόγηση ετοιμότητας για αποδέσμευση από αερισμό',labelEn:'Daily assessment of readiness to liberate from ventilation',required:true},
  {id:'sedation',labelEl:'Ελαχιστοποίηση καταστολής σύμφωνα με το κλινικό πρωτόκολλο',labelEn:'Minimize sedation according to clinical protocol',required:true},
  {id:'mobility',labelEl:'Πρώιμη κινητοποίηση όταν είναι κλινικά εφικτή',labelEn:'Early mobility when clinically feasible',required:false},
  {id:'oral',labelEl:'Τεκμηριωμένη στοματική φροντίδα σύμφωνα με το πρωτόκολλο',labelEn:'Documented oral care according to protocol',required:true},
  {id:'position',labelEl:'Κατάλληλη θέση κεφαλής κλίνης όταν δεν αντενδείκνυται',labelEn:'Appropriate head-of-bed positioning when not contraindicated',required:true},
  {id:'circuit',labelEl:'Αποφυγή μη αναγκαίων χειρισμών / αλλαγών κυκλώματος',labelEn:'Avoid unnecessary ventilator-circuit manipulation / changes',required:true},
  {id:'secretion',labelEl:'Ασφαλής διαχείριση εκκρίσεων και αναρρόφησης',labelEn:'Safe secretion and suction management',required:true},
 ]},
 {id:'SSI',name:'SSI',titleEl:'Χειρουργική λοίμωξη',titleEn:'Surgical site infection',version:'1.0',status:'published',scope:'Perioperative SSI prevention',source:'WHO · CDC',sourceVersion:'reviewed 2026',system:true,departments:['Χειρουργική'],elements:[
  {id:'antibiotic',labelEl:'Κατάλληλη χειρουργική αντιμικροβιακή προφύλαξη σύμφωνα με τοπικό πρωτόκολλο',labelEn:'Appropriate surgical antimicrobial prophylaxis per local protocol',required:true},
  {id:'hair',labelEl:'Αποφυγή ξυρίσματος· κατάλληλη αποτρίχωση μόνο όταν απαιτείται',labelEn:'Avoid shaving; appropriate hair removal only when necessary',required:true},
  {id:'skin',labelEl:'Κατάλληλη προεγχειρητική αντισηψία δέρματος',labelEn:'Appropriate preoperative skin antisepsis',required:true},
  {id:'glucose',labelEl:'Περιεγχειρητικός γλυκαιμικός έλεγχος όπου ενδείκνυται',labelEn:'Perioperative glycemic control where indicated',required:false},
  {id:'temperature',labelEl:'Διατήρηση νορμοθερμίας όπου ενδείκνυται',labelEn:'Maintain normothermia where indicated',required:false},
  {id:'asepsis',labelEl:'Τήρηση άσηπτης τεχνικής / αποστειρωμένου πεδίου',labelEn:'Maintain aseptic technique / sterile field',required:true},
  {id:'wound',labelEl:'Τεκμηριωμένη μετεγχειρητική φροντίδα τραύματος',labelEn:'Documented postoperative wound care',required:true},
 ]},
 {id:'PIV',name:'Peripheral IV',titleEl:'Περιφερικός φλεβικός καθετήρας',titleEn:'Peripheral intravenous catheter',version:'1.0',status:'published',scope:'PIV insertion / maintenance',source:'WHO',sourceVersion:'Peripheral catheter guideline 2024',system:true,departments:['ΜΕΘ','Χειρουργική','Παθολογική'],elements:[
  {id:'indication',labelEl:'Υπάρχει τεκμηριωμένη κλινική ένδειξη για τον περιφερικό καθετήρα',labelEn:'Documented clinical indication for the peripheral catheter',required:true},
  {id:'hand_hygiene',labelEl:'Υγιεινή χεριών πριν από εισαγωγή ή χειρισμό',labelEn:'Hand hygiene before insertion or manipulation',required:true},
  {id:'aseptic',labelEl:'Άσηπτη τεχνική no-touch κατά εισαγωγή και χειρισμό',labelEn:'Aseptic no-touch technique during insertion and manipulation',required:true},
  {id:'skin',labelEl:'Κατάλληλη αντισηψία δέρματος και πλήρης ξήρανση',labelEn:'Appropriate skin antisepsis and complete drying',required:true},
  {id:'site',labelEl:'Καθημερινή αξιολόγηση σημείου για πόνο, ερυθρότητα, διήθηση ή φλεβίτιδα',labelEn:'Daily site assessment for pain, erythema, infiltration or phlebitis',required:true},
  {id:'hub',labelEl:'Απολύμανση συνδέσμου πριν από κάθε πρόσβαση',labelEn:'Hub disinfection before every access',required:true},
  {id:'dressing',labelEl:'Επίδεση καθαρή, στεγνή, ακέραιη και σταθεροποίηση καθετήρα',labelEn:'Clean, dry, intact dressing and secure catheter fixation',required:true},
  {id:'remove',labelEl:'Αφαίρεση όταν δεν χρειάζεται ή όταν υπάρχουν σημεία επιπλοκής',labelEn:'Remove when no longer needed or when complication signs occur',required:true},
 ]},
 {id:'HD',name:'Hemodialysis',titleEl:'Αγγειακή προσπέλαση αιμοκάθαρσης',titleEn:'Hemodialysis vascular access',version:'1.0',status:'published',scope:'Hemodialysis catheter / vascular access care',source:'CDC',sourceVersion:'Dialysis infection prevention reviewed 2026',system:true,departments:[],elements:[
  {id:'hand_hygiene',labelEl:'Υγιεινή χεριών πριν και μετά τον χειρισμό της αγγειακής προσπέλασης',labelEn:'Hand hygiene before and after vascular-access manipulation',required:true},
  {id:'aseptic',labelEl:'Άσηπτη τεχνική κατά σύνδεση, αποσύνδεση και χειρισμό καθετήρα',labelEn:'Aseptic technique during connection, disconnection and catheter handling',required:true},
  {id:'hub',labelEl:'Κατάλληλη απολύμανση hub/συνδέσεων πριν από πρόσβαση',labelEn:'Appropriate hub/connection disinfection before access',required:true},
  {id:'site',labelEl:'Αξιολόγηση σημείου προσπέλασης για σημεία λοίμωξης',labelEn:'Access-site assessment for signs of infection',required:true},
  {id:'dressing',labelEl:'Κατάλληλη φροντίδα και ακεραιότητα επιδέσμου καθετήρα',labelEn:'Appropriate catheter dressing care and integrity',required:true},
  {id:'medication',labelEl:'Άσηπτη προετοιμασία και χορήγηση ενέσιμων φαρμάκων',labelEn:'Aseptic preparation and administration of injectable medications',required:true},
  {id:'cleaning',labelEl:'Καθαρισμός/απολύμανση σταθμού και εξοπλισμού μεταξύ ασθενών',labelEn:'Station and equipment cleaning/disinfection between patients',required:true},
  {id:'surveillance',labelEl:'Έλεγχος για πρόσφατα συμβάντα λοίμωξης ή καλλιέργειες σχετιζόμενες με την προσπέλαση',labelEn:'Review for recent access-related infection events or cultures',required:false},
 ]},
]

export function cloneBundleLibrary(){return JSON.parse(JSON.stringify(SYSTEM_BUNDLE_LIBRARY))}
export function publishedBundleTemplates(library=SYSTEM_BUNDLE_LIBRARY){return library.filter(x=>x.status==='published')}

const STORAGE_KEY='limoxis.bundleLibrary.v1'
export function loadBundleLibrary(){
 if(typeof window==='undefined')return cloneBundleLibrary()
 try{
  const saved=JSON.parse(window.localStorage.getItem(STORAGE_KEY)||'null')
  return Array.isArray(saved)&&saved.length?saved:cloneBundleLibrary()
 }catch{return cloneBundleLibrary()}
}
export function saveBundleLibrary(library){
 if(typeof window==='undefined')return
 window.localStorage.setItem(STORAGE_KEY,JSON.stringify(library))
 window.dispatchEvent(new CustomEvent('limoxis:bundle-library-changed',{detail:library}))
}
