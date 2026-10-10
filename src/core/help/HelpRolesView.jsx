import { useLanguage } from '../i18n/LanguageContext'
import { PREVIEWABLE_ROLES } from '../permissions/roles'
import { navigationFor } from '../../app/navigation'
import { DEMO_ALL_SCENARIOS, DEMO_ROLE_SCENARIOS } from '../../features/demo/demoScenarios'

const l=(el,en)=>({el,en})

// Who each hospital role is and what it does. What it sees is its menu, read
// from the navigation itself, so the table never drifts from the app.
export const ROLE_GUIDE=Object.freeze({
  hospital_admin:{who:l('Ο διαχειριστής του νοσοκομείου, που ορίζει ο Platform Owner.','The hospital administrator, named by the Platform Owner.'),
    does:l('Χρήστες, ρόλοι και προσαρμοσμένοι ρόλοι, τμήματα, βιβλιοθήκες, κλινοημέρες και ρυθμίσεις του οργανισμού. Βλέπει όλες τις ενότητες του νοσοκομείου.','Users, roles and custom roles, departments, libraries, patient days and organization settings. Sees every area of the hospital.')},
  infection_control_lead:{who:l('Ο επικεφαλής της Ομάδας Ελέγχου Λοιμώξεων.','The head of the Infection Control team.'),
    does:l('Επιτήρηση και ταξινόμηση λοιμώξεων, MDRO, πρόληψη, έλεγχοι, δείκτες, επιτροπή λοιμώξεων και αναφορές.','Infection surveillance and classification, MDRO, prevention, inspections, indicators, the infection committee and reports.')},
  infection_control_member:{who:l('Μέλος της Ομάδας Ελέγχου Λοιμώξεων.','A member of the Infection Control team.'),
    does:l('Καταγραφή επιτήρησης και ασθενών, εργαστηριακά ευρήματα, πρόληψη και έλεγχοι.','Records surveillance and patients, laboratory findings, prevention and inspections.')},
  link_nurse:{who:l('Νοσηλευτής ενός τμήματος, σύνδεσμος με την Ομάδα Λοιμώξεων.','A ward nurse who links the ward with the Infection Control team.'),
    does:l('Παρατηρήσεις υγιεινής χεριών, εισαγωγές ασθενών, πρώτη καταγραφή επιτήρησης και συμβάντα του τμήματός του.','Hand hygiene observations, patient admissions, first surveillance records and incidents of the ward.')},
  department_manager:{who:l('Ο προϊστάμενος ή διευθυντής ενός τμήματος.','The head or manager of a department.'),
    does:l('Παρακολουθεί το τμήμα του: ελέγχους, προσωπικό, εκπαίδευση και επιτήρηση. Εκτελεί και διορθώνει ελέγχους.','Follows the department: inspections, staff, training and surveillance. Runs and corrects inspections.')},
  department_user:{who:l('Εργαζόμενος ενός τμήματος.','A member of staff of a department.'),
    does:l('Εκτελεί τους ελέγχους που του ανατίθενται, δηλώνει συμβάντα και βλέπει την εκπαίδευση και τα έγγραφά του.','Runs the inspections assigned to them, reports incidents and sees their training and documents.')},
  laboratory:{who:l('Το προσωπικό του Μικροβιολογικού Εργαστηρίου.','The Microbiology Laboratory staff.'),
    does:l('Δείγματα, καλλιέργειες, αντιβιογράμματα, ταξινόμηση AMR και επικοινωνία κρίσιμων αποτελεσμάτων.','Samples, cultures, susceptibility tests, AMR classification and critical-result communication.')},
  committee_secretariat:{who:l('Η γραμματεία των επιτροπών του νοσοκομείου.','The secretariat of the hospital committees.'),
    does:l('Μέλη, συνεδριάσεις, πρακτικά, αποφάσεις και έγγραφα των επιτροπών.','Committee members, meetings, minutes, decisions and documents.')},
  hr_office:{who:l('Το Γραφείο Προσωπικού.','The HR office.'),
    does:l('Μητρώο εργαζομένων, θέσεις, εκπαίδευση, αξιολογήσεις και έγγραφα προσωπικού.','Staff registry, positions, training, evaluations and staff documents.')},
  pharmacy:{who:l('Το Φαρμακείο του νοσοκομείου.','The hospital pharmacy.'),
    does:l('Χορηγήσεις και κατανάλωση αντιμικροβιακών ανά τμήμα και οι δείκτες κατανάλωσης.','Antimicrobial dispensing and consumption per department, and the consumption indicators.')},
  occupational_physician:{who:l('Ο Ιατρός Εργασίας.','The occupational physician.'),
    does:l('Επισκέψεις, επαγγελματικές εκθέσεις και ο ιατρικός φάκελος εργασίας του προσωπικού.','Visits, occupational exposures and the staff occupational health file.')},
  doctor_reviewer:{who:l('Ιατρός που ελέγχει κλινικά τα περιστατικά.','A physician who reviews cases clinically.'),
    does:l('Κλινική αξιολόγηση και επανεκτίμηση περιστατικών επιτήρησης, αντιμικροβιακή θεραπεία και έκβαση.','Clinical assessment and reassessment of surveillance cases, antimicrobial therapy and outcome.')},
  quality_manager:{who:l('Ο Υπεύθυνος Ποιότητας.','The quality manager.'),
    does:l('Συμβάντα, ευρήματα, διορθωτικές ενέργειες (CAPA), επιθεωρήσεις, έλεγχοι και δείκτες.','Incidents, findings, corrective actions (CAPA), audits, inspections and indicators.')},
})

const roleLabelKey=role=>`${role.replace(/_([a-z])/g,(_,c)=>c.toUpperCase())}Role`
const scenarioTitle=(key,en)=>{const scenario=DEMO_ALL_SCENARIOS.find(item=>item.key===key);return scenario?(en?scenario.titleEn:scenario.titleEl):key}

export function HelpRolesView(){
  const {language,t}=useLanguage();const en=language==='en'
  const pick=text=>en?text.en:text.el
  return <main className="manual-special manual-roles">
    <span className="manual-step-label">{en?'WHO IS WHO':'ΠΟΙΟΣ ΕΙΝΑΙ ΠΟΙΟΣ'}</span>
    <h1>{en?'Roles in Limoxis Observer':'Ρόλοι στο Limoxis Observer'}</h1>
    <p>{en?'Who each role is, what its menu shows and what it does. In a Demo, each role is guided through the scenarios of its own work.':'Ποιος είναι κάθε ρόλος, τι δείχνει το μενού του και τι κάνει. Στο Demo, κάθε ρόλος καθοδηγείται στα σενάρια της δικής του δουλειάς.'}</p>
    <div className="manual-roles-table" role="table" aria-label={en?'Roles':'Ρόλοι'}>
      <div className="manual-roles-head" role="row">{[en?'Role':'Ρόλος',en?'Who':'Ποιος είναι',en?'Sees':'Τι βλέπει',en?'Does':'Τι κάνει'].map(label=><span key={label} role="columnheader">{label}</span>)}</div>
      {PREVIEWABLE_ROLES.filter(role=>ROLE_GUIDE[role]).map(role=>{const guide=ROLE_GUIDE[role];const scenarios=DEMO_ROLE_SCENARIOS[role]||[]
        return <div className="manual-roles-row" role="row" key={role}>
          <b role="cell">{t(roleLabelKey(role))}</b>
          <span role="cell">{pick(guide.who)}</span>
          <span role="cell">{navigationFor({role}).map(item=>t(item.key)).join(', ')}</span>
          <span role="cell">{pick(guide.does)}{scenarios.length>0&&<small>{en?'Demo scenarios':'Σενάρια Demo'}: {scenarios.map(key=>scenarioTitle(key,en)).join(' · ')}</small>}</span>
        </div>})}
    </div>
  </main>
}
