import { Activity, Bell, BookOpenCheck, Database, HeartPulse, Layers3, ShieldCheck, Sparkles, Users } from 'lucide-react'
import { Page } from '../../design-system/Page'
import { APP_VERSION, BUILD_ID } from '../../core/version'
const features=[
 [Activity,'Επιτήρηση','Κλινική ροή επιτήρησης, MDR/XDR, απομόνωση, επανεκτίμηση και έκβαση.'],
 [Database,'Εργαστήριο','Δείγματα, αποτελέσματα, αντοχή και κρίσιμη επικοινωνία με traceability.'],
 [ShieldCheck,'Πρόληψη','WHO Hand Hygiene, bundles, απόβλητα, αντισηπτικά και πρόληψη λοιμώξεων.'],
 [HeartPulse,'Ποιότητα & Δείκτες','Συμβάντα, CAPA, έλεγχοι και μετρήσιμοι δείκτες απόδοσης.'],
 [BookOpenCheck,'Εκπαίδευση & Επιτροπές','Προγράμματα, συμμετοχές, πρακτικά, αποφάσεις και παρακολούθηση ενεργειών.'],
 [Sparkles,'LIRA','Role-aware operational intelligence πάνω στα δεδομένα του Limoxis με πηγές και traceability.'],
]
export function AboutPage(){
 return <Page fill title="Limoxis Observer" subtitle="Hospital Infection Prevention, Surveillance & Governance Platform">
  <div className="about-page">
   <section className="about-hero"><div><span className="about-eyebrow">LIMOXIS OBSERVER</span><h1>Μία ενιαία επιχειρησιακή εικόνα για την πρόληψη και τον έλεγχο λοιμώξεων.</h1><p>Σχεδιασμένο για πραγματικές νοσοκομειακές ροές: επιτήρηση, εργαστήριο, πρόληψη, προσωπικό, εκπαίδευση, επιτροπές, ποιότητα, δείκτες και διοίκηση — με role-based πρόσβαση, traceability και ελεγχόμενη διακυβέρνηση.</p><div className="about-version">Έκδοση <strong>v{APP_VERSION}</strong><span>Build {BUILD_ID}</span></div></div><div className="about-visual"><div className="about-product-window"><div className="mini-top"/><div className="mini-layout"><aside/><main><div/><div/><div/><section/><section/></main></div></div><small>Limoxis Observer · operational workspace</small></div></section>
   <section className="about-feature-grid">{features.map(([Icon,title,copy])=><article key={title}><span><Icon size={20}/></span><h3>{title}</h3><p>{copy}</p></article>)}</section>
   <section className="about-story"><div><span>ΣΧΕΔΙΑΣΜΟΣ</span><h2>Από τις ανάγκες του νοσοκομείου στην καθημερινή εργασία.</h2><p>Η πληροφορία οργανώνεται γύρω από τον χρήστη και τον ρόλο του. Οι λίστες, οι κάρτες, οι ειδοποιήσεις και οι ενέργειες χρησιμοποιούν κοινά patterns ώστε η εφαρμογή να παραμένει απλή ακόμη και όταν η υποκείμενη διακυβέρνηση είναι σύνθετη.</p></div><div className="about-principles"><div><ShieldCheck/><strong>Least privilege</strong><small>Κεντρικά permissions και scope ανά ρόλο.</small></div><div><Bell/><strong>Actionable alerts</strong><small>Εκκρεμότητες και ανακοινώσεις εκεί που χρειάζονται.</small></div><div><Layers3/><strong>Governed content</strong><small>Versioning, overrides και ιστορικό αντί για ανεξέλεγκτες αλλαγές.</small></div><div><Users/><strong>Human-centered</strong><small>Λιγότερα βήματα, καθαρή πληροφορία, σταθερή πλοήγηση.</small></div></div></section>
   <section className="about-screens"><header><span>PRODUCT TOUR</span><h2>Η εφαρμογή στην πράξη</h2><p>Η ενότητα είναι έτοιμη να φιλοξενήσει πραγματικά screenshots της παραγωγικής εγκατάστασης. Δεν χρησιμοποιούνται mockups ως δήθεν εικόνες του προϊόντος.</p></header><div className="about-screen-grid"><div className="about-screen-placeholder"><Activity/><strong>Dashboard & Surveillance</strong><span>Role-aware αρχική εικόνα και επιχειρησιακές εκκρεμότητες.</span></div><div className="about-screen-placeholder"><ShieldCheck/><strong>Prevention Workspace</strong><span>Καταγραφές πρόληψης και evidence-based bundles.</span></div><div className="about-screen-placeholder"><Sparkles/><strong>LIRA</strong><span>Operational briefing και ερωτήσεις πάνω στα δεδομένα.</span></div></div></section>
  </div>
 </Page>
}
