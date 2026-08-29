import { Activity, Bell, BookOpenCheck, Database, HeartPulse, Layers3, ShieldCheck, Sparkles, Users } from 'lucide-react'
import { Page } from '../../design-system/Page'
import { APP_VERSION, BUILD_ID } from '../../core/version'
import { useLanguage } from '../../core/i18n/LanguageContext'
const features={
 el:[
  [Activity,'Επιτήρηση','Κλινική ροή επιτήρησης, MDR/XDR, απομόνωση, επανεκτίμηση και έκβαση.'],
  [Database,'Εργαστήριο','Δείγματα, αποτελέσματα, αντοχή και κρίσιμη επικοινωνία με traceability.'],
  [ShieldCheck,'Πρόληψη','WHO Hand Hygiene, bundles, απόβλητα, αντισηπτικά και πρόληψη λοιμώξεων.'],
  [HeartPulse,'Ποιότητα & Δείκτες','Συμβάντα, CAPA, έλεγχοι και μετρήσιμοι δείκτες απόδοσης.'],
  [BookOpenCheck,'Εκπαίδευση & Επιτροπές','Προγράμματα, συμμετοχές, πρακτικά, αποφάσεις και παρακολούθηση ενεργειών.'],
  [Sparkles,'LIRA','Role-aware operational intelligence πάνω στα δεδομένα του Limoxis με πηγές και traceability.'],
 ],
 en:[
  [Activity,'Surveillance','Clinical surveillance workflow, MDR/XDR, isolation, reassessment and outcome.'],
  [Database,'Laboratory','Samples, results, antimicrobial resistance and critical communication with traceability.'],
  [ShieldCheck,'Prevention','WHO Hand Hygiene, bundles, waste, antiseptics and infection prevention.'],
  [HeartPulse,'Quality & Indicators','Incidents, CAPA, controls and measurable performance indicators.'],
  [BookOpenCheck,'Training & Committees','Programmes, attendance, minutes, decisions and action follow-up.'],
  [Sparkles,'LIRA','Role-aware operational intelligence over Limoxis data with sources and traceability.'],
 ]
}
export function AboutPage(){
 const {language}=useLanguage(); const en=language==='en'; const featureRows=features[en?'en':'el']
 return <Page fill title="Limoxis Observer" subtitle="Hospital Infection Prevention, Surveillance & Governance Platform">
  <div className="about-page">
   <section className="about-hero"><div><span className="about-eyebrow">LIMOXIS OBSERVER</span><h1>{en?'One unified operational view for infection prevention and control.':'Μία ενιαία επιχειρησιακή εικόνα για την πρόληψη και τον έλεγχο λοιμώξεων.'}</h1><p>{en?'Designed for real hospital workflows: surveillance, laboratory, prevention, staff, training, committees, quality, indicators and administration — with role-based access, traceability and controlled governance.':'Σχεδιασμένο για πραγματικές νοσοκομειακές ροές: επιτήρηση, εργαστήριο, πρόληψη, προσωπικό, εκπαίδευση, επιτροπές, ποιότητα, δείκτες και διοίκηση — με role-based πρόσβαση, traceability και ελεγχόμενη διακυβέρνηση.'}</p><div className="about-version">{en?'Version ':'Έκδοση '}<strong>v{APP_VERSION}</strong><span>Build {BUILD_ID}</span></div></div><div className="about-visual"><div className="about-product-window"><div className="mini-top"/><div className="mini-layout"><aside/><main><div/><div/><div/><section/><section/></main></div></div><small>Limoxis Observer · operational workspace</small></div></section>
   <section className="about-feature-grid">{featureRows.map(([Icon,title,copy])=><article key={title}><span><Icon size={20}/></span><h3>{title}</h3><p>{copy}</p></article>)}</section>
   <section className="about-story"><div><span>{en?'DESIGN':'ΣΧΕΔΙΑΣΜΟΣ'}</span><h2>{en?'From hospital needs to everyday work.':'Από τις ανάγκες του νοσοκομείου στην καθημερινή εργασία.'}</h2><p>{en?'Information is organized around the user and their role. Lists, cards, notifications and actions use shared patterns so the application stays simple even when the underlying governance is complex.':'Η πληροφορία οργανώνεται γύρω από τον χρήστη και τον ρόλο του. Οι λίστες, οι κάρτες, οι ειδοποιήσεις και οι ενέργειες χρησιμοποιούν κοινά patterns ώστε η εφαρμογή να παραμένει απλή ακόμη και όταν η υποκείμενη διακυβέρνηση είναι σύνθετη.'}</p></div><div className="about-principles"><div><ShieldCheck/><strong>Least privilege</strong><small>{en?'Central permissions and scope by role.':'Κεντρικά permissions και scope ανά ρόλο.'}</small></div><div><Bell/><strong>Actionable alerts</strong><small>{en?'Pending work and announcements where they are needed.':'Εκκρεμότητες και ανακοινώσεις εκεί που χρειάζονται.'}</small></div><div><Layers3/><strong>Governed content</strong><small>{en?'Versioning, overrides and history instead of uncontrolled changes.':'Versioning, overrides και ιστορικό αντί για ανεξέλεγκτες αλλαγές.'}</small></div><div><Users/><strong>Human-centered</strong><small>{en?'Fewer steps, clear information and stable navigation.':'Λιγότερα βήματα, καθαρή πληροφορία, σταθερή πλοήγηση.'}</small></div></div></section>
   <section className="about-screens"><header><span>PRODUCT TOUR</span><h2>{en?'The application in practice':'Η εφαρμογή στην πράξη'}</h2><p>{en?'This area is designed for real screenshots of the production application. Mockups are not presented as actual product screens.':'Η ενότητα είναι έτοιμη να φιλοξενήσει πραγματικά screenshots της παραγωγικής εγκατάστασης. Δεν χρησιμοποιούνται mockups ως δήθεν εικόνες του προϊόντος.'}</p></header><div className="about-screen-grid"><div className="about-screen-placeholder"><Activity/><strong>Dashboard & Surveillance</strong><span>{en?'Role-aware dashboard and operational pending work.':'Role-aware αρχική εικόνα και επιχειρησιακές εκκρεμότητες.'}</span></div><div className="about-screen-placeholder"><ShieldCheck/><strong>Prevention Workspace</strong><span>{en?'Prevention records and evidence-based bundles.':'Καταγραφές πρόληψης και evidence-based bundles.'}</span></div><div className="about-screen-placeholder"><Sparkles/><strong>LIRA</strong><span>{en?'Operational briefing and questions over available data.':'Operational briefing και ερωτήσεις πάνω στα δεδομένα.'}</span></div></div></section>
  </div>
 </Page>
}
