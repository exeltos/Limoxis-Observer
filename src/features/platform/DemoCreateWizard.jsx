import { useState } from 'react'
import { ArrowLeft, ArrowRight, Check, ClipboardCopy, FlaskConical, KeyRound, Mail, Users } from 'lucide-react'
import { ObserverDialog } from '../../design-system/ObserverDialog'
import { Button } from '../../design-system/Button'
import { ManualDateField } from '../../design-system/ManualDateField'
import { LocationAutocompleteField } from '../../design-system/LocationAutocompleteField'
import { CITY_OPTIONS, COUNTRY_OPTIONS } from '../../core/reference/locationOptions'
import { roleLabel } from '../../core/permissions/roleLabels'
import { demoDatesValid } from './platformDemoService'
import './demoWizard.css'

export const GREEK_REGIONS=['Ανατολική Μακεδονία και Θράκη','Κεντρική Μακεδονία','Δυτική Μακεδονία','Ήπειρος','Θεσσαλία','Ιόνια Νησιά','Δυτική Ελλάδα','Στερεά Ελλάδα','Αττική','Πελοπόννησος','Βόρειο Αιγαίο','Νότιο Αιγαίο','Κρήτη']
export const HEALTH_REGIONS=['1η ΥΠΕ Αττικής','2η ΥΠΕ Πειραιώς και Αιγαίου','3η ΥΠΕ Μακεδονίας','4η ΥΠΕ Μακεδονίας και Θράκης','5η ΥΠΕ Θεσσαλίας και Στερεάς Ελλάδας','6η ΥΠΕ Πελοποννήσου, Ιονίων Νήσων, Ηπείρου και Δυτικής Ελλάδας','7η ΥΠΕ Κρήτης']

// Roles an evaluator can be given. The department roles get one of the Demo
// departments (the data pack always creates these eight).
export const DEMO_EVALUATOR_ROLES=['hospital_admin','infection_control_lead','infection_control_member','department_manager','link_nurse','department_user','laboratory','pharmacy','quality_manager','occupational_physician','hr_office','committee_secretariat','doctor_reviewer']
export const DEMO_DEPARTMENT_ROLES=new Set(['department_manager','link_nurse','department_user','laboratory'])
export const DEMO_DEPARTMENTS=[['ΜΕΘ','Μονάδα Εντατικής Θεραπείας'],['ΠΑΘ','Παθολογική Κλινική'],['ΧΕΙΡ','Χειρουργική Κλινική'],['ΚΑΡΔ','Καρδιολογική Κλινική'],['ΟΡΘ','Ορθοπαιδική Κλινική'],['ΝΕΦ','Νεφρολογική Κλινική'],['ΠΑΙΔ','Παιδιατρική Κλινική'],['ΜΕΝΝ','Μονάδα Εντατικής Νοσηλείας Νεογνών']]

const EMAIL=/^[^\s@]+@[^\s@]+\.[^\s@]+$/
const addDays=(isoDate,days)=>{const date=new Date(`${isoDate}T00:00:00Z`);if(Number.isNaN(date.getTime()))return '';date.setUTCDate(date.getUTCDate()+days);return date.toISOString().slice(0,10)}
const fmtDay=(value,en)=>value?new Intl.DateTimeFormat(en?'en-GB':'el-GR').format(new Date(`${value}T12:00:00`)):'—'

export function emptyDemoWizardDraft(days=30){
  const validFrom=new Date().toISOString().slice(0,10)
  return {label:'',type:'hospital',region:'',healthRegion:'',city:'',country:'Ελλάδα',contactPhone:'',bedCapacity:'',contactName:'',contactEmail:'',validFrom,validUntil:addDays(validFrom,days),adminName:'',adminEmail:'',access:'invite'}
}

// The one user the Owner creates: the Demo's Hospital Admin (the contact
// person unless someone else is named). The admin adds the rest inside the Demo.
export function wizardAdmin(draft){
  return {
    fullName:(draft.adminName||draft.contactName||'').trim(),
    email:(draft.adminEmail||draft.contactEmail||'').trim().toLowerCase(),
    role:'hospital_admin',
    departmentCode:null,
    access:draft.access==='password'?'password':'invite',
  }
}

// What every Demo contains (the full data pack).
function demoContents(en){
  return en
    ?['8 departments, 48 patients and their stays','Surveillance with HAI, isolation, microbiology and antibiograms','Hand hygiene, bundles, waste and antiseptics','Recurring controls with findings, training with certificates','Pharmacy DDD, quality incidents and CAPA, committees and documents','Occupational health: vaccinations, visits, exposures']
    :['8 τμήματα, 48 ασθενείς με τις νοσηλείες τους','Επιτήρηση με HAI, απομονώσεις, μικροβιολογικά και αντιβιογράμματα','Υγιεινή χεριών, bundles, απόβλητα και αντισηπτικά','Επαναλαμβανόμενοι έλεγχοι με ευρήματα, εκπαιδεύσεις με πιστοποιητικά','Φαρμακείο DDD, συμβάντα ποιότητας και CAPA, επιτροπές και έγγραφα','Επαγγελματική υγεία: εμβολιασμοί, επισκέψεις, εκθέσεις']
}

export function DemoCreateWizard({language,defaultDurationDays=30,maxUsers=5,saving=false,result=null,onSubmit,onClose,initialStep=0,initialDraft=null}){
  const en=language==='en';const tx=(el,enText)=>en?enText:el
  const [step,setStep]=useState(initialStep)
  const [draft,setDraft]=useState(()=>initialDraft||emptyDemoWizardDraft(defaultDurationDays))
  const set=(key,value)=>setDraft(c=>({...c,[key]:value}))
  const admin=wizardAdmin(draft)
  const stepValid=[
    Boolean(draft.label.trim())&&EMAIL.test(draft.contactEmail.trim())&&demoDatesValid(draft.validFrom,draft.validUntil),
    Boolean(admin.fullName)&&EMAIL.test(admin.email),
    true,
  ]
  const steps=[tx('Πελάτης & διάρκεια','Customer & duration'),tx('Διαχειριστής Demo','Demo admin'),tx('Έλεγχος & αποστολή','Review & send')]
  const goTo=next=>{
    if(next===1)setDraft(c=>({...c,adminName:c.adminName||c.contactName,adminEmail:c.adminEmail||c.contactEmail}))
    setStep(next)
  }
  const durationDays=Math.round((new Date(draft.validUntil)-new Date(draft.validFrom))/86400000)

  if(result)return <DemoCreatedDialog language={language} result={result} onClose={onClose}/>

  const footer=<div className="demo-wizard-footer">
    <span className="demo-wizard-footer-step">{tx('Βήμα','Step')} {step+1} / {steps.length}</span>
    {step>0&&<Button variant="secondary" disabled={saving} onClick={()=>setStep(step-1)}><ArrowLeft size={15}/>{tx('Πίσω','Back')}</Button>}
    {step<steps.length-1&&<Button disabled={!stepValid[step]} onClick={()=>goTo(step+1)}>{tx('Επόμενο','Next')}<ArrowRight size={15}/></Button>}
    {step===steps.length-1&&<Button loading={saving} disabled={!stepValid.every(Boolean)} onClick={()=>onSubmit?.({...draft,label:draft.label.trim(),contactEmail:draft.contactEmail.trim().toLowerCase(),evaluators:[admin]})}><FlaskConical size={15}/>{tx('Δημιουργία Demo','Create Demo')}</Button>}
  </div>

  return <ObserverDialog width="workspace" className="platform-demo-create-dialog demo-wizard" eyebrow="Platform Owner" title={tx('Νέο Demo','New Demo')} subtitle={tx('Απομονωμένος οργανισμός με πλήρη συνθετικά δεδομένα, για αξιολόγηση και εκμάθηση από τον υποψήφιο πελάτη.','An isolated organization with full synthetic data, for the prospect to evaluate and learn.')} onClose={()=>!saving&&onClose?.()} footer={footer}>
    <ol className="demo-wizard-steps" aria-label={tx('Βήματα','Steps')}>
      {steps.map((label,index)=><li key={label} className={index===step?'is-current':index<step?'is-done':''}>
        <button type="button" disabled={saving||index>step&&!stepValid.slice(0,index).every(Boolean)} onClick={()=>goTo(index)}>
          <span className="demo-wizard-step-number">{index<step?<Check size={13}/>:index+1}</span>
          <span>{label}</span>
        </button>
      </li>)}
    </ol>

    {step===0&&<div className="platform-form-shell">
      <section className="platform-form-section"><header><strong>{tx('Υποψήφιος πελάτης','Prospect')}</strong></header><div className="platform-form-grid">
        <label className="field field-wide"><span>{tx('Επωνυμία οργανισμού','Organization name')} *</span><input autoFocus value={draft.label} onChange={e=>set('label',e.target.value)}/></label>
        <label className="field"><span>{tx('Τύπος','Type')}</span><select value={draft.type} onChange={e=>set('type',e.target.value)}><option value="hospital">{tx('Νοσοκομείο','Hospital')}</option><option value="clinic">{tx('Κλινική','Clinic')}</option><option value="group">{tx('Όμιλος','Group')}</option><option value="other">{tx('Άλλο','Other')}</option></select></label>
        <label className="field"><span>{tx('Περιφέρεια','Region')}</span><select value={draft.region} onChange={e=>set('region',e.target.value)}><option value="">{tx('Επιλογή…','Select…')}</option>{GREEK_REGIONS.map(r=><option key={r}>{r}</option>)}</select></label>
        <label className="field field-wide"><span>{tx('Υγειονομική Περιφέρεια (ΥΠΕ)','Health Region')}</span><select value={draft.healthRegion} onChange={e=>set('healthRegion',e.target.value)}><option value="">{tx('Επιλογή…','Select…')}</option>{HEALTH_REGIONS.map(r=><option key={r}>{r}</option>)}</select></label>
        <LocationAutocompleteField label={tx('Πόλη','City')} value={draft.city} onChange={v=>set('city',v)} options={CITY_OPTIONS}/>
        <LocationAutocompleteField label={tx('Χώρα','Country')} value={draft.country} onChange={v=>set('country',v)} options={COUNTRY_OPTIONS}/>
        <label className="field"><span>{tx('Δυναμικότητα κλινών','Bed capacity')}</span><input type="number" min="0" value={draft.bedCapacity} onChange={e=>set('bedCapacity',e.target.value)}/></label>
      </div></section>
      <section className="platform-form-section"><header><strong>{tx('Υπεύθυνος επικοινωνίας','Contact person')}</strong><span>{tx('Προτείνεται ως Διαχειριστής του Demo.','Suggested as the Demo admin.')}</span></header><div className="platform-form-grid">
        <label className="field"><span>{tx('Ονοματεπώνυμο','Full name')}</span><input value={draft.contactName} onChange={e=>set('contactName',e.target.value)}/></label>
        <label className="field"><span>Email *</span><input type="email" value={draft.contactEmail} onChange={e=>set('contactEmail',e.target.value)}/></label>
        <label className="field"><span>{tx('Τηλέφωνο','Phone')}</span><input value={draft.contactPhone} onChange={e=>set('contactPhone',e.target.value)}/></label>
      </div></section>
      <section className="platform-form-section"><header><strong>{tx('Διάρκεια','Duration')}</strong><span>{tx('Μετά τη λήξη η πρόσβαση κλείνει μόνη της.','Access closes by itself after the end date.')}</span></header>
        <div className="demo-wizard-duration">
          <ManualDateField label={tx('Έναρξη','Start')} value={draft.validFrom} onChange={v=>setDraft(c=>({...c,validFrom:v,validUntil:addDays(v,Math.max(1,durationDays||defaultDurationDays))}))}/>
          <ManualDateField label={`${tx('Λήξη','End')} *`} value={draft.validUntil} onChange={v=>set('validUntil',v)}/>
          <div className="demo-wizard-chips" role="group" aria-label={tx('Διάρκεια','Duration')}>
            {[14,30,60].map(days=><button type="button" key={days} className={durationDays===days?'is-active':''} onClick={()=>set('validUntil',addDays(draft.validFrom,days))}>{days} {tx('ημέρες','days')}</button>)}
          </div>
        </div>
        {draft.validFrom&&draft.validUntil&&!demoDatesValid(draft.validFrom,draft.validUntil)&&<p className="field-error" role="alert">{tx('Η λήξη πρέπει να είναι μετά την έναρξη.','The end date must be after the start date.')}</p>}
      </section>
    </div>}

    {step===1&&<div className="demo-wizard-admin">
      <section className="platform-form-section">
        <header><div><strong>{tx('Διαχειριστής Νοσοκομείου του Demo','Demo Hospital Admin')}</strong><span>{tx('Ο λογαριασμός που δημιουργείτε εσείς.','The account you create.')}</span></div></header>
        <div className="platform-form-grid">
          <label className="field"><span>{tx('Ονοματεπώνυμο','Full name')} *</span><input autoFocus value={draft.adminName} onChange={e=>set('adminName',e.target.value)}/></label>
          <label className="field"><span>Email *</span><input type="email" value={draft.adminEmail} onChange={e=>set('adminEmail',e.target.value)}/></label>
          <label className="field"><span>{tx('Πρόσβαση','Access')}</span><select value={draft.access} onChange={e=>set('access',e.target.value)}><option value="invite">{tx('Πρόσκληση email','Email invitation')}</option><option value="password">{tx('Προσωρινός κωδικός','Temporary password')}</option></select></label>
        </div>
        <p className="demo-wizard-note">{draft.access==='password'?<KeyRound size={14}/>:<Mail size={14}/>}{draft.access==='password'?tx('Ο κωδικός εμφανίζεται μία φορά μετά τη δημιουργία, για παρουσίαση από κοντά.','The password is shown once after creation, for an in-person presentation.'):tx('Το email πρόσβασης στέλνεται μόλις το Demo γεμίσει με δεδομένα.','The access email is sent once the Demo has its data.')}</p>
        <p className="demo-wizard-note"><Users size={14}/>{tx(`Ο Διαχειριστής δημιουργεί μόνος του τους υπόλοιπους χρήστες μέσα στο Demo (Διαχείριση → Χρήστες), έως ${maxUsers} συνολικά, με όποιους ρόλους θέλει να δοκιμάσει.`,`The admin creates the other users inside the Demo (Management → Users), up to ${maxUsers} in total, with any roles they want to try.`)}</p>
      </section>
      <section className="platform-form-section demo-wizard-contents">
        <header><div><strong>{tx('Τι θα βρει στο Demo','What the Demo contains')}</strong><span>{tx('Κάθε Demo γεμίζει με το πλήρες πακέτο έξι μηνών, με συνοχή σε όλες τις ενότητες.','Every Demo gets the full six-month pack, consistent across all areas.')}</span></div></header>
        <ul>{demoContents(en).map(item=><li key={item}><Check size={13}/>{item}</li>)}</ul>
      </section>
    </div>}

    {step===2&&<div className="demo-wizard-review">
      <section className="platform-form-section">
        <header><strong>{tx('Σύνοψη','Summary')}</strong></header>
        <dl className="demo-wizard-summary">
          <div><dt>{tx('Οργανισμός','Organization')}</dt><dd>{draft.label}{draft.city?` · ${draft.city}`:''}</dd></div>
          <div><dt>{tx('Διάρκεια','Duration')}</dt><dd>{fmtDay(draft.validFrom,en)} – {fmtDay(draft.validUntil,en)} ({durationDays} {tx('ημέρες','days')})</dd></div>
          <div><dt>{tx('Δεδομένα','Data')}</dt><dd>{tx('Πλήρες νοσοκομείο, 6 μήνες','Full hospital, 6 months')}</dd></div>
          <div><dt>{tx('Χρήστες','Users')}</dt><dd>{tx(`Έως ${maxUsers}, τους δημιουργεί ο Διαχειριστής`,`Up to ${maxUsers}, created by the admin`)}</dd></div>
        </dl>
        <table className="demo-wizard-review-users">
          <thead><tr><th>{tx('Διαχειριστής','Admin')}</th><th>{tx('Ρόλος','Role')}</th><th>{tx('Πρόσβαση','Access')}</th></tr></thead>
          <tbody><tr><td><strong>{admin.fullName}</strong><small>{admin.email}</small></td><td>{roleLabel('hospital_admin',language)}</td><td>{admin.access==='password'?<span className="demo-wizard-access"><KeyRound size={13}/>{tx('Προσωρινός κωδικός','Temporary password')}</span>:<span className="demo-wizard-access"><Mail size={13}/>{tx('Πρόσκληση email','Email invitation')}</span>}</td></tr></tbody>
        </table>
      </section>
      <section className="platform-form-section demo-wizard-email">
        <header><div><strong>{tx('Προεπισκόπηση email','Email preview')}</strong><span>{admin.access==='password'?tx('Με προσωρινό κωδικό δεν στέλνεται email.','No email is sent with a temporary password.'):tx('Ό,τι θα λάβει ο Διαχειριστής.','What the admin receives.')}</span></div></header>
        <DemoEmailPreview language={language} name={admin.fullName} label={draft.label} validFrom={draft.validFrom} validUntil={draft.validUntil}/>
      </section>
    </div>}
  </ObserverDialog>
}

function DemoEmailPreview({language,name,label,validFrom,validUntil}){
  const en=language==='en'
  return <div className="demo-email-preview" aria-label={en?'Email preview':'Προεπισκόπηση email'}>
    <div className="demo-email-preview-head">Limoxis Observer</div>
    <div className="demo-email-preview-body">
      <p className="demo-email-preview-greeting">{name?`Καλησπέρα ${name},`:'Demo πρόσβαση'}</p>
      <p>Ενεργοποιήθηκε απομονωμένο Demo περιβάλλον για <strong>{label||'—'}</strong>.</p>
      <div className="demo-email-preview-info"><div><strong>Username:</strong> {en?'assigned on creation':'δίνεται με τη δημιουργία'}</div><div><strong>Ισχύς:</strong> {fmtDay(validFrom,false)} έως {fmtDay(validUntil,false)}</div></div>
      <p>Τα δεδομένα του Demo είναι συνθετικά και δεν συνδέονται με πραγματικά δεδομένα νοσοκομείων.</p>
      <span className="demo-email-preview-button">Ενεργοποίηση Demo</span>
    </div>
  </div>
}

function DemoCreatedDialog({language,result,onClose}){
  const en=language==='en';const tx=(el,enText)=>en?enText:el
  const [copied,setCopied]=useState('')
  const users=result?.evaluators||[]
  const copy=async user=>{try{await navigator.clipboard?.writeText(`${user.username} / ${user.temporaryPassword}`);setCopied(user.username)}catch{setCopied('')}}
  return <ObserverDialog width="wide" className="demo-wizard-done" eyebrow={tx('Το Demo είναι έτοιμο','The Demo is ready')} title={result?.organization?.name||tx('Νέο Demo','New Demo')} subtitle={tx('Ο κωδικός εμφανίζεται μόνο τώρα. Δώστε τον στον πελάτη από κοντά.','The password is shown only now. Hand it to the customer in person.')} onClose={onClose} footer={<Button onClick={onClose}><Check size={15}/>{tx('Τέλος','Done')}</Button>}>
    <table className="demo-wizard-review-users">
      <thead><tr><th>{tx('Χρήστης','User')}</th><th>Username</th><th>{tx('Πρόσβαση','Access')}</th></tr></thead>
      <tbody>{users.map(user=><tr key={user.username}>
        <td><strong>{user.fullName}</strong><small>{roleLabel(user.role,language)}</small></td>
        <td><code>{user.username}</code></td>
        <td>{user.temporaryPassword?<span className="demo-wizard-password"><code>{user.temporaryPassword}</code><Button variant="secondary" onClick={()=>copy(user)}><ClipboardCopy size={14}/>{copied===user.username?tx('Αντιγράφηκε','Copied'):tx('Αντιγραφή','Copy')}</Button></span>:<span className="demo-wizard-access"><Mail size={13}/>{user.emailSent?tx('Στάλθηκε πρόσκληση','Invitation sent'):tx('Η πρόσκληση δεν στάλθηκε','Invitation not sent')}</span>}</td>
      </tr>)}</tbody>
    </table>
    {result?.seed&&<p className="demo-wizard-note"><Users size={14}/>{seedSummary(result.seed,en)}</p>}
  </ObserverDialog>
}

function seedSummary(seed,en){
  if(seed?.ok===false)return en?'The data could not be written; use "Reset data" on the Demo record.':'Τα δεδομένα δεν γράφτηκαν· χρησιμοποιήστε «Επαναφορά δεδομένων» στην καρτέλα του Demo.'
  return en?`Data: ${seed.patients??0} patients, ${seed.surveillanceCases??0} surveillance cases, ${seed.departments??0} departments.`:`Δεδομένα: ${seed.patients??0} ασθενείς, ${seed.surveillanceCases??0} περιστατικά επιτήρησης, ${seed.departments??0} τμήματα.`
}
