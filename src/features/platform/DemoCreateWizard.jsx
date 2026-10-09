import { useMemo, useState } from 'react'
import { ArrowLeft, ArrowRight, Check, ClipboardCopy, FlaskConical, KeyRound, Mail, Plus, Trash2, Users } from 'lucide-react'
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
export const DEMO_SEED_PROFILES=['full','surveillance','empty']

const EMAIL=/^[^\s@]+@[^\s@]+\.[^\s@]+$/
const addDays=(isoDate,days)=>{const date=new Date(`${isoDate}T00:00:00Z`);if(Number.isNaN(date.getTime()))return '';date.setUTCDate(date.getUTCDate()+days);return date.toISOString().slice(0,10)}
const fmtDay=(value,en)=>value?new Intl.DateTimeFormat(en?'en-GB':'el-GR').format(new Date(`${value}T12:00:00`)):'—'
const newEvaluator=(fullName='',email='',role='hospital_admin')=>({key:Math.random().toString(36).slice(2),fullName,email,role,departmentCode:'ΜΕΘ',access:'invite'})

export function emptyDemoWizardDraft(days=30){
  const validFrom=new Date().toISOString().slice(0,10)
  return {label:'',type:'hospital',region:'',healthRegion:'',city:'',country:'Ελλάδα',contactPhone:'',bedCapacity:'',contactName:'',contactEmail:'',validFrom,validUntil:addDays(validFrom,days),seedProfile:'full',evaluators:[]}
}

// Evaluators ready to send: the contact person becomes the first one when the
// owner has not listed anyone.
export function wizardEvaluators(draft){
  const rows=draft.evaluators.length?draft.evaluators:[newEvaluator(draft.contactName,draft.contactEmail)]
  return rows.map(row=>({fullName:row.fullName.trim(),email:row.email.trim().toLowerCase(),role:row.role,departmentCode:DEMO_DEPARTMENT_ROLES.has(row.role)?row.departmentCode:null,access:row.access==='password'?'password':'invite'}))
}

export function evaluatorProblems(evaluators,maxUsers){
  const problems=[]
  if(!evaluators.length)problems.push('none')
  if(evaluators.length>maxUsers)problems.push('too_many')
  if(evaluators.some(e=>!e.fullName))problems.push('name')
  if(evaluators.some(e=>!EMAIL.test(e.email)))problems.push('email')
  if(new Set(evaluators.map(e=>e.email)).size!==evaluators.length)problems.push('duplicate')
  if(!evaluators.some(e=>e.role==='hospital_admin'))problems.push('admin')
  return problems
}

export function DemoCreateWizard({language,defaultDurationDays=30,maxUsers=5,saving=false,result=null,onSubmit,onClose,initialStep=0,initialDraft=null}){
  const en=language==='en';const tx=(el,enText)=>en?enText:el
  const [step,setStep]=useState(initialStep)
  const [draft,setDraft]=useState(()=>initialDraft||emptyDemoWizardDraft(defaultDurationDays))
  const set=(key,value)=>setDraft(c=>({...c,[key]:value}))
  const evaluators=useMemo(()=>wizardEvaluators(draft),[draft])
  const problems=evaluatorProblems(evaluators,maxUsers)
  const stepValid=[
    Boolean(draft.label.trim())&&EMAIL.test(draft.contactEmail.trim())&&demoDatesValid(draft.validFrom,draft.validUntil),
    DEMO_SEED_PROFILES.includes(draft.seedProfile),
    problems.length===0,
    true,
  ]
  const steps=[tx('Πελάτης & διάρκεια','Customer & duration'),tx('Σενάριο δεδομένων','Data scenario'),tx('Χρήστες αξιολόγησης','Evaluators'),tx('Έλεγχος & αποστολή','Review & send')]
  const goTo=next=>{
    if(next===2&&!draft.evaluators.length)set('evaluators',[newEvaluator(draft.contactName,draft.contactEmail)])
    setStep(next)
  }
  const updateEvaluator=(key,patch)=>set('evaluators',draft.evaluators.map(e=>e.key===key?{...e,...patch}:e))
  const durationDays=Math.round((new Date(draft.validUntil)-new Date(draft.validFrom))/86400000)

  if(result)return <DemoCreatedDialog language={language} result={result} onClose={onClose}/>

  const footer=<div className="demo-wizard-footer">
    <span className="demo-wizard-footer-step">{tx('Βήμα','Step')} {step+1} / 4</span>
    {step>0&&<Button variant="secondary" disabled={saving} onClick={()=>setStep(step-1)}><ArrowLeft size={15}/>{tx('Πίσω','Back')}</Button>}
    {step<3&&<Button disabled={!stepValid[step]} onClick={()=>goTo(step+1)}>{tx('Επόμενο','Next')}<ArrowRight size={15}/></Button>}
    {step===3&&<Button loading={saving} disabled={!stepValid.every(Boolean)} onClick={()=>onSubmit?.({...draft,label:draft.label.trim(),contactEmail:draft.contactEmail.trim().toLowerCase(),evaluators})}><FlaskConical size={15}/>{tx('Δημιουργία Demo','Create Demo')}</Button>}
  </div>

  return <ObserverDialog width="workspace" className="platform-demo-create-dialog demo-wizard" eyebrow="Platform Owner" title={tx('Νέο Demo','New Demo')} subtitle={tx('Απομονωμένος οργανισμός με συνθετικά δεδομένα, για αξιολόγηση από τον υποψήφιο πελάτη.','An isolated organization with synthetic data, for the prospect to evaluate.')} onClose={()=>!saving&&onClose?.()} footer={footer}>
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
      <section className="platform-form-section"><header><strong>{tx('Υπεύθυνος επικοινωνίας','Contact person')}</strong><span>{tx('Γίνεται και ο πρώτος χρήστης αξιολόγησης.','Also becomes the first evaluator.')}</span></header><div className="platform-form-grid">
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

    {step===1&&<div className="demo-wizard-scenarios" role="radiogroup" aria-label={tx('Σενάριο δεδομένων','Data scenario')}>
      {DEMO_SEED_PROFILES.map(profile=><button type="button" role="radio" aria-checked={draft.seedProfile===profile} key={profile} className={`demo-wizard-scenario${draft.seedProfile===profile?' is-selected':''}`} onClick={()=>set('seedProfile',profile)}>
        <span className="demo-wizard-scenario-head"><strong>{scenarioTitle(profile,en)}</strong>{profile==='full'&&<em>{tx('Προτείνεται','Recommended')}</em>}<span className="demo-wizard-radio" aria-hidden="true"/></span>
        <span className="demo-wizard-scenario-text">{scenarioText(profile,en)}</span>
        <ul>{scenarioContents(profile,en).map(item=><li key={item}><Check size={13}/>{item}</li>)}</ul>
      </button>)}
    </div>}

    {step===2&&<section className="platform-form-section demo-wizard-evaluators">
      <header><div><strong>{tx('Χρήστες αξιολόγησης','Evaluators')}</strong><span>{tx('Κάθε χρήστης μπαίνει με πραγματικό ρόλο και μπορεί να αλλάζει ρόλο μέσα στο Demo.','Each user gets a real role and can switch role inside the Demo.')}</span></div><span className="demo-wizard-count">{draft.evaluators.length} / {maxUsers}</span></header>
      <div className="demo-wizard-evaluator-head" aria-hidden="true"><span>{tx('Ονοματεπώνυμο','Full name')}</span><span>Email</span><span>{tx('Ρόλος','Role')}</span><span>{tx('Τμήμα','Department')}</span><span>{tx('Πρόσβαση','Access')}</span><span/></div>
      {draft.evaluators.map(row=><div className="demo-wizard-evaluator" key={row.key}>
        <input aria-label={tx('Ονοματεπώνυμο','Full name')} value={row.fullName} onChange={e=>updateEvaluator(row.key,{fullName:e.target.value})}/>
        <input aria-label="Email" type="email" value={row.email} onChange={e=>updateEvaluator(row.key,{email:e.target.value})}/>
        <select aria-label={tx('Ρόλος','Role')} value={row.role} onChange={e=>updateEvaluator(row.key,{role:e.target.value})}>{DEMO_EVALUATOR_ROLES.map(role=><option key={role} value={role}>{roleLabel(role,language)}</option>)}</select>
        <select aria-label={tx('Τμήμα','Department')} value={row.departmentCode} disabled={!DEMO_DEPARTMENT_ROLES.has(row.role)} onChange={e=>updateEvaluator(row.key,{departmentCode:e.target.value})}>{DEMO_DEPARTMENT_ROLES.has(row.role)?DEMO_DEPARTMENTS.map(([code,name])=><option key={code} value={code}>{name}</option>):<option value={row.departmentCode}>{tx('Όλο το νοσοκομείο','Whole hospital')}</option>}</select>
        <select aria-label={tx('Πρόσβαση','Access')} value={row.access} onChange={e=>updateEvaluator(row.key,{access:e.target.value})}><option value="invite">{tx('Πρόσκληση email','Email invitation')}</option><option value="password">{tx('Προσωρινός κωδικός','Temporary password')}</option></select>
        <Button variant="secondary" className="demo-wizard-remove" disabled={draft.evaluators.length<2} aria-label={tx('Αφαίρεση','Remove')} onClick={()=>set('evaluators',draft.evaluators.filter(e=>e.key!==row.key))}><Trash2 size={15}/></Button>
      </div>)}
      <div className="demo-wizard-evaluator-actions">
        <Button variant="secondary" disabled={draft.evaluators.length>=maxUsers} onClick={()=>set('evaluators',[...draft.evaluators,newEvaluator('','','infection_control_lead')])}><Plus size={15}/>{tx('Προσθήκη χρήστη','Add user')}</Button>
        {problems.length>0&&draft.evaluators.length>0&&<span className="field-error" role="alert">{problemText(problems[0],en,maxUsers)}</span>}
      </div>
      <p className="demo-wizard-note"><KeyRound size={14}/>{tx('Ο προσωρινός κωδικός εμφανίζεται μία φορά μετά τη δημιουργία, για παρουσίαση από κοντά. Η πρόσκληση email στέλνεται μόλις το Demo γεμίσει με δεδομένα.','The temporary password is shown once after creation, for an in-person presentation. The email invitation is sent once the Demo has its data.')}</p>
    </section>}

    {step===3&&<div className="demo-wizard-review">
      <section className="platform-form-section">
        <header><strong>{tx('Σύνοψη','Summary')}</strong></header>
        <dl className="demo-wizard-summary">
          <div><dt>{tx('Οργανισμός','Organization')}</dt><dd>{draft.label}{draft.city?` · ${draft.city}`:''}</dd></div>
          <div><dt>{tx('Διάρκεια','Duration')}</dt><dd>{fmtDay(draft.validFrom,en)} – {fmtDay(draft.validUntil,en)} ({durationDays} {tx('ημέρες','days')})</dd></div>
          <div><dt>{tx('Σενάριο','Scenario')}</dt><dd>{scenarioTitle(draft.seedProfile,en)}</dd></div>
          <div><dt>{tx('Υπεύθυνος','Contact')}</dt><dd>{draft.contactName||'—'} · {draft.contactEmail}</dd></div>
        </dl>
        <table className="demo-wizard-review-users">
          <thead><tr><th>{tx('Χρήστης','User')}</th><th>{tx('Ρόλος','Role')}</th><th>{tx('Πρόσβαση','Access')}</th></tr></thead>
          <tbody>{evaluators.map(e=><tr key={e.email}><td><strong>{e.fullName}</strong><small>{e.email}</small></td><td>{roleLabel(e.role,language)}{e.departmentCode?<small>{DEMO_DEPARTMENTS.find(([code])=>code===e.departmentCode)?.[1]}</small>:null}</td><td>{e.access==='password'?<span className="demo-wizard-access"><KeyRound size={13}/>{tx('Προσωρινός κωδικός','Temporary password')}</span>:<span className="demo-wizard-access"><Mail size={13}/>{tx('Πρόσκληση email','Email invitation')}</span>}</td></tr>)}</tbody>
        </table>
      </section>
      <section className="platform-form-section demo-wizard-email">
        <header><div><strong>{tx('Προεπισκόπηση email','Email preview')}</strong><span>{tx('Ό,τι θα λάβει κάθε χρήστης με πρόσκληση email.','What each user with an email invitation receives.')}</span></div></header>
        <DemoEmailPreview language={language} name={evaluators.find(e=>e.access==='invite')?.fullName||draft.contactName} label={draft.label} validFrom={draft.validFrom} validUntil={draft.validUntil}/>
      </section>
    </div>}
  </ObserverDialog>
}

export function DemoEmailPreview({language,name,label,validFrom,validUntil}){
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
  return <ObserverDialog width="wide" className="demo-wizard-done" eyebrow={tx('Το Demo είναι έτοιμο','The Demo is ready')} title={result?.organization?.name||tx('Νέο Demo','New Demo')} subtitle={tx('Οι κωδικοί εμφανίζονται μόνο τώρα. Δώστε τους στον πελάτη από κοντά.','Passwords are shown only now. Hand them to the customer in person.')} onClose={onClose} footer={<Button onClick={onClose}><Check size={15}/>{tx('Τέλος','Done')}</Button>}>
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

function scenarioTitle(profile,en){return {full:en?'Full hospital':'Πλήρες νοσοκομείο',surveillance:en?'Surveillance only':'Μόνο επιτήρηση',empty:en?'Empty':'Κενό'}[profile]||profile}
function scenarioText(profile,en){return {
  full:en?'Six months of activity in every area, so every screen and report has data.':'Έξι μήνες δραστηριότητας σε όλες τις ενότητες, ώστε κάθε οθόνη και αναφορά να έχει δεδομένα.',
  surveillance:en?'For infection-control teams: patients, surveillance, laboratory and hand hygiene.':'Για ομάδες ελέγχου λοιμώξεων: ασθενείς, επιτήρηση, εργαστήριο και υγιεινή χεριών.',
  empty:en?'Departments only. The customer enters their own data from the start.':'Μόνο τα τμήματα. Ο πελάτης καταχωρεί δικά του δεδομένα από την αρχή.',
}[profile]}
function scenarioContents(profile,en){
  const surveillance=en?['8 departments, 48 patients','14 surveillance cases with HAI','43 samples, antibiograms','36 hand-hygiene sessions']:['8 τμήματα, 48 ασθενείς','14 περιστατικά επιτήρησης με HAI','43 δείγματα, αντιβιογράμματα','36 συνεδρίες υγιεινής χεριών']
  if(profile==='surveillance')return surveillance
  if(profile==='empty')return en?['8 departments','Libraries and settings']:['8 τμήματα','Βιβλιοθήκες και ρυθμίσεις']
  return [...surveillance,...(en?['Controls, training, pharmacy','Quality: incidents and CAPA','Occupational health, prevention, bundles']:['Έλεγχοι, εκπαιδεύσεις, φαρμακείο','Ποιότητα: συμβάντα και CAPA','Επαγγελματική υγεία, πρόληψη, bundles'])]
}
function problemText(problem,en,maxUsers){return {
  none:en?'Add at least one user.':'Προσθέστε τουλάχιστον έναν χρήστη.',
  too_many:en?`Up to ${maxUsers} users.`:`Έως ${maxUsers} χρήστες.`,
  name:en?'Every user needs a name.':'Κάθε χρήστης χρειάζεται ονοματεπώνυμο.',
  email:en?'Check the email addresses.':'Ελέγξτε τις διευθύνσεις email.',
  duplicate:en?'Each email can be used once.':'Κάθε email χρησιμοποιείται μία φορά.',
  admin:en?'At least one user must be Hospital Admin.':'Τουλάχιστον ένας χρήστης πρέπει να είναι Διαχειριστής Νοσοκομείου.',
}[problem]}
function seedSummary(seed,en){
  if(seed?.ok===false)return en?'The data could not be written; use "Reset data" on the Demo record.':'Τα δεδομένα δεν γράφτηκαν· χρησιμοποιήστε «Επαναφορά δεδομένων» στην καρτέλα του Demo.'
  return en?`Data: ${seed.patients??0} patients, ${seed.surveillanceCases??0} surveillance cases, ${seed.departments??0} departments.`:`Δεδομένα: ${seed.patients??0} ασθενείς, ${seed.surveillanceCases??0} περιστατικά επιτήρησης, ${seed.departments??0} τμήματα.`
}
