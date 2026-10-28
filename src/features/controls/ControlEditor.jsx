import { Fragment,useEffect,useMemo,useState } from 'react'
import { Building2,ClipboardCheck,FileText,Hash,ListChecks,ListTodo,LockKeyhole,PauseCircle,Pencil,Plus,ToggleLeft,Trash2,Type } from 'lucide-react'
import { useLanguage } from '../../core/i18n/LanguageContext'
import { useTenant } from '../../core/tenant/TenantContext'
import { Page } from '../../design-system/Page'
import { Button } from '../../design-system/Button'
import { IconButton } from '../../design-system/IconButton'
import { FormSubmit,useFormValidation } from '../../design-system/FormValidation'
import { MultiSelect } from '../../design-system/MultiSelect'
import { SearchableSelect } from '../../design-system/SearchableSelect'
import { ChoiceChips } from '../../design-system/ChoiceChips'
import { ModeSwitch } from '../../design-system/ModeSwitch'
import { Field } from '../../design-system/Field'
import { YesNoField } from '../../design-system/YesNoField'
import { EntityRecordShell } from '../../design-system/EntityRecordShell'
import { Link } from 'react-router-dom'
import { similarControls } from './controlSimilarity'
import { ControlDepartmentResponses } from './ControlDepartmentResponses'
import { ControlDepartmentSchedules } from './ControlDepartmentSchedules'
import { ControlTimesList } from './ControlTimesList'
import { useEmployeesData } from '../employees/useEmployeesData'
import { findLibraryItem,libraryOptions,useLibraries } from '../management/useLibraries'
import { loadBundleLibrary } from '../management/bundleLibraryData'
import { loadBundleTemplates } from '../management/bundleLibraryCloudService'
import { isDemoDataEnvironment } from '../../core/data/dataEnvironment'
import { DEFAULT_EXPIRY_AFTER_DAYS,DEFAULT_EXPIRY_BEFORE_DAYS,expiryCatalogue,expiryWindow } from './controlExpiry'
import { ControlExpiryCatalogueDialog } from './ControlExpiryCatalogueDialog'
import { CRITICALITY_LEVELS,controlCriticality,criticalityLabel,requiresEvidence } from './controlCriticality'
import { answerLabel,categoryPreset,choiceOptions } from './controlVocabulary'
import { employeeOptions,personFromEmployee } from '../employees/peopleOptions'
import { slotMargin } from './controlDueRules'
import './controlEditor.css'

const pickPolicy=config=>Object.fromEntries(['criticality','requiresEvidence','deviationActions'].filter(key=>config?.[key]!==undefined).map(key=>[key,config[key]]))
const newItemId=()=>`chk-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,6)}`
const FREQUENCIES=['daily','weekly','monthly','yearly','custom']

// Bundle templates, whose elements a checklist can start from.
function useBundleTemplates(){
 const {tenant}=useTenant()
 const [templates,setTemplates]=useState([])
 useEffect(()=>{
  let active=true
  if(isDemoDataEnvironment()){setTemplates(loadBundleLibrary().filter(x=>x.status!=='retired'));return()=>{active=false}}
  if(!tenant?.id)return()=>{active=false}
  loadBundleTemplates(tenant.id).then(rows=>{if(active)setTemplates(rows.filter(x=>x.status!=='retired'))}).catch(()=>{if(active)setTemplates([])})
  return()=>{active=false}
 },[tenant?.id])
 return templates
}

// One form for a new control and for editing one. Every list it offers comes
// from the libraries (Management > Libraries): control types, units, status
// answers, positions, people, locations and equipment; a value the library does
// not have yet can still be typed.
export function ControlEditor({initial,onCancel,onSave,departmentOnly=false,fixedDepartment='',usedCategories=[],existingControls=[]}){
 const {language}=useLanguage();const en=language==='en'
 const {libraries,departments:departmentRows,loading:departmentsLoading,error:departmentsError}=useLibraries()
 const {data:employees}=useEmployeesData()
 const bundleTemplates=useBundleTemplates()
 const [draft,setDraft]=useState(()=>initial?JSON.parse(JSON.stringify({...initial,departmentFrequencies:Object.fromEntries(Object.entries(initial.assignments||{}).filter(([,a])=>a?.frequency).map(([department,a])=>[department,a.frequency])),departmentResponses:Object.fromEntries(Object.entries(initial.assignments||{}).filter(([,a])=>a?.responseOverride).map(([department,a])=>[department,a.responseOverride]))})):{departmentFrequencies:{},departmentResponses:{},title:'',category:'',departments:departmentOnly&&fixedDepartment?[fixedDepartment]:[],owner:'',ownerPerson:null,assignees:{},location:'',equipment:'',description:'',goal:'',acceptanceCriteria:'',guideNotes:'',createdByScope:departmentOnly?'department':'infection_control',lastCompletedAt:null,responseConfig:{mode:'text',label:'Αποτέλεσμα'},frequency:{kind:'daily',timesPerDay:1,times:['09:00'],interval:1}})
 const [catalogueOpen,setCatalogueOpen]=useState(false)
 const [tab,setTab]=useState('details')
 // The margin after a time is rarely changed: its field opens from a link.
 const [showMargin,setShowMargin]=useState(false)
 const [editingPerson,setEditingPerson]=useState(null)
 const [newAnswer,setNewAnswer]=useState('')
 const lib=key=>libraries[key]||[]
// Departments where the control is paused: those saved so, and those paused now (their history stays).
 const pausedDepartments=useMemo(()=>[...new Set([...(initial?.pausedDepartments||[]),...(initial?.departments||[])])].filter(dep=>!draft.departments.includes(dep)),[initial,draft.departments])
 const departments=useMemo(()=>departmentOnly&&fixedDepartment?[fixedDepartment]:departmentRows.map(x=>x.name).filter(Boolean),[departmentRows,departmentOnly,fixedDepartment])
 const set=(k,v)=>setDraft(d=>({...d,[k]:v})),setF=(k,v)=>setDraft(d=>({...d,frequency:{...d.frequency,[k]:v}})),setR=(k,v)=>setDraft(d=>({...d,responseConfig:{...(d.responseConfig||{mode:'text',label:'Αποτέλεσμα'}),[k]:v}}))
 const response=draft.responseConfig||{mode:'text'}
 const mode=response.mode||'text'
 const count=Math.max(1,Number(draft.frequency.timesPerDay)||1)
 const times=Array.from({length:count},(_,i)=>draft.frequency.times?.[i]||`${String(Math.min(23,8+i*4)).padStart(2,'0')}:00`)
 const checklist=response.checklist||[]
 const options=choiceOptions(response,lib('controlAnswers'))
 // A new control needs a responsible position or person. Controls brought in
 // without one (the FileMaker import) can still be edited and saved as they are.
 const ownerRequired=!initial?.dbId||Boolean(initial?.owner?.trim()||initial?.ownerPerson)
 const hasOwner=Boolean(draft.owner?.trim()||draft.ownerPerson)
 const similar=useMemo(()=>similarControls(draft.title,existingControls,{selfId:initial?.id}),[draft.title,existingControls,initial?.id])
 const valid=draft.title.trim()&&draft.category.trim()&&draft.departments.length>0&&(hasOwner||!ownerRequired)&&(draft.frequency.kind!=='daily'||times.every(Boolean))&&(mode!=='checklist'||checklist.some(item=>String(item.el||'').trim()))&&(mode!=='choice'||options.length>=2)
 // The same rule as every form: what is missing is named beside Save once it is pressed, never before.
 const form=useFormValidation([
  {key:'title',label:en?'Control name':'Ονομασία ελέγχου',valid:Boolean(draft.title.trim())},
  {key:'category',label:en?'Control type':'Είδος ελέγχου',valid:Boolean(draft.category.trim())},
  {key:'departments',label:en?'Departments':'Τμήματα εφαρμογής',valid:draft.departments.length>0},
  ownerRequired&&{key:'owner',label:en?'Responsible position or person':'Θέση ή πρόσωπο ευθύνης',valid:hasOwner},
  draft.frequency.kind==='daily'&&{key:'times',label:en?'Execution times':'Ώρες εκτέλεσης',valid:times.every(Boolean)},
  mode==='checklist'&&{key:'checklist',label:en?'Checklist items':'Λίστα ελέγχου',valid:checklist.some(item=>String(item.el||'').trim())},
  mode==='choice'&&{key:'options',label:en?'At least two choices':'Τουλάχιστον δύο επιλογές',valid:options.length>=2},
 ])

 // Three tabs: «Details» (all that a new control needs), «Departments» (what differs
 // per department) and «Instructions». Every required field is on «Details».

 // Control types: the library first, then types already in use that it lacks.
 const typeOptions=useMemo(()=>{
  const base=libraryOptions(lib('controlTypes'),language)
  const known=new Set(lib('controlTypes').map(x=>x.value))
  return [...base,...usedCategories.filter(x=>x&&!known.has(x)).map(x=>({value:x,label:x,description:en?'In use':'Σε χρήση'}))]
 },[libraries,usedCategories,language])// eslint-disable-line react-hooks/exhaustive-deps
 const people=useMemo(()=>employeeOptions(employees,language,draft.departments),[employees,language,draft.departments])
 const employeeById=id=>employees.find(x=>String(x.dbId||x.id)===String(id))
 const equipmentOptions=useMemo(()=>[...libraryOptions(lib('equipment'),language),...libraryOptions(lib('surfacePoints'),language)],[libraries,language])// eslint-disable-line react-hooks/exhaustive-deps

 function changeCategory(value){setDraft(d=>{const keep=pickPolicy(d.responseConfig);const preset=categoryPreset(value,lib('controlTypes'));return {...d,category:value,responseConfig:{...(preset||(d.category===value?d.responseConfig:{mode:d.responseConfig?.mode||'text',label:d.responseConfig?.label||'Αποτέλεσμα'})),...keep}}})}
 function changeMode(next){setDraft(d=>{const keep=pickPolicy(d.responseConfig);const base={mode:next,label:d.responseConfig?.label||'Αποτέλεσμα'};return {...d,responseConfig:{...base,...(next==='list'?{template:d.responseConfig?.template||'generic_findings'}:{}),...(next==='checklist'?{checklist:d.responseConfig?.checklist||[]}:{}),...(next==='choice'?{options:d.responseConfig?.options,reportOn:d.responseConfig?.reportOn}:{}),...(next==='numeric'?{unit:d.responseConfig?.unit||'',min:d.responseConfig?.min??'',max:d.responseConfig?.max??''}:{}),...keep}}})}
 function setOptions(values){const current=new Set(options.filter(x=>x.finding).map(x=>x.value));setDraft(d=>({...d,responseConfig:{...d.responseConfig,options:values,reportOn:values.filter(v=>current.has(v))}}))}
 function toggleFinding(value){const current=options.filter(x=>x.finding).map(x=>x.value);setR('reportOn',current.includes(value)?current.filter(x=>x!==value):[...current,value])}
 function addAnswer(value){const text=String(value||'').trim();if(!text||options.some(x=>x.value===text))return;setOptions([...options.map(x=>x.value),text]);setNewAnswer('')}
 const setChecklist=next=>setR('checklist',next)
 function importBundle(id){const template=bundleTemplates.find(x=>String(x.id)===String(id));if(!template)return;const existing=new Set(checklist.map(x=>x.el));setChecklist([...checklist.filter(x=>String(x.el||'').trim()),...(template.elements||[]).filter(el=>!existing.has(el.labelEl)).map(el=>({id:newItemId(),el:el.labelEl,en:el.labelEn||el.labelEl,required:el.required!==false}))])}
 function submit(){if(!valid)return;onSave({...draft,titleEn:draft.titleEn||draft.title,responseConfig:mode==='checklist'?{...response,checklist:checklist.filter(x=>String(x.el||'').trim())}:response,frequency:{...draft.frequency,timesPerDay:count,times:draft.frequency.kind==='daily'?times:[]}})}

 const title=initial?(en?'Edit control':'Επεξεργασία ελέγχου'):(en?'New control':'Νέος έλεγχος')
 const freqLabel={daily:en?'Daily':'Ημερήσια',weekly:en?'Weekly':'Εβδομαδιαία',monthly:en?'Monthly / every N months':'Μηνιαία / ανά Χ μήνες',yearly:en?'Yearly':'Ετήσια',custom:en?'Every N days':'Κάθε Χ ημέρες'}
 const intervalUnit={weekly:en?'weeks':'εβδομάδες',monthly:en?'months':'μήνες',yearly:en?'years':'έτη',custom:en?'days':'ημέρες'}[draft.frequency.kind]
 const multiText={searchPlaceholder:en?'Search…':'Αναζήτηση…',emptyLabel:en?'No match':'Καμία αντιστοιχία',selectAllLabel:en?'Select all':'Επιλογή όλων',clearAllLabel:en?'Clear all':'Αποεπιλογή όλων'}
 const selectText={emptyLabel:en?'No match':'Καμία αντιστοιχία',clearLabel:en?'Clear':'Καθαρισμός',customLabel:text=>en?`Use «${text}»`:`Χρήση «${text}»`}

 // «Head of Department» and «Shift manager» are always offered; the library's positions and any typed text follow.
 const positionOptions=useMemo(()=>{const base=[{value:en?'Head of Department':'Προϊστάμενος/η Τμήματος',label:en?'Head of Department':'Προϊστάμενος/η Τμήματος'},{value:en?'Shift manager':'Υπεύθυνος/η βάρδιας',label:en?'Shift manager':'Υπεύθυνος/η βάρδιας'}];const extra=libraryOptions(libraries.positions||[],language).filter(option=>!base.some(item=>item.label===option.label));return [...base,...extra]},[en,language,libraries.positions])
 return <Page fill className="control-editor-page">
  <EntityRecordShell className="control-create-shell workspace-fill" avatar={<ClipboardCheck size={19}/>} eyebrow={en?'CONTROLS':'ΕΛΕΓΧΟΙ'} title={draft.title.trim()||title} subtitle={draft.title.trim()?title:(en?'Define what is checked, how it is recorded, where and when it runs.':'Ορίστε τι ελέγχεται, πώς καταχωρείται, πού εφαρμόζεται και πότε εκτελείται.')} tabs={[{id:'details',label:en?'Details':'Στοιχεία',icon:LockKeyhole},{id:'departments',label:`${en?'Departments':'Τμήματα'} (${draft.departments.length})`,icon:Building2},{id:'instructions',label:en?'Instructions':'Οδηγίες',icon:FileText}]} activeTab={tab} onTabChange={setTab} onBack={onCancel}>
   <div className="record-section control-editor-body" ref={form.scopeRef}>
    {tab==='details'&&<>
    <section className="control-editor-card control-editor-wide">
     <header><strong>{en?'What is checked':'Τι ελέγχεται'}</strong><span>{en?'Name, type, where it applies and who is responsible':'Ονομασία, είδος, πού εφαρμόζεται και ποιος είναι υπεύθυνος'}</span></header>
     <div className="control-editor-grid identity">
      <Field label={en?'Control name':'Ονομασία ελέγχου'} {...form.field('title')}><input autoFocus value={draft.title} onChange={e=>set('title',e.target.value)} placeholder={en?'e.g. Medication refrigerator temperature':'π.χ. Θερμοκρασία ψυγείου φαρμάκων'}/></Field>
      <SearchableSelect label={en?'Control type':'Είδος ελέγχου'} {...form.field('category')} value={draft.category} options={typeOptions} onChange={changeCategory} allowCustom placeholder={en?'Choose or type':'Επιλέξτε ή γράψτε'} {...selectText}/>
      <SearchableSelect label={en?'Location':'Χώρος'} value={draft.location||''} options={[]} onChange={v=>set('location',v)} allowCustom placeholder={en?'Optional, e.g. Nurses station':'Προαιρετικό, π.χ. Σταθμός νοσηλευτών'} {...selectText}/>
      <SearchableSelect label={en?'Equipment / point':'Εξοπλισμός / σημείο'} value={draft.equipment||''} options={equipmentOptions} onChange={v=>set('equipment',v)} allowCustom placeholder={en?'Optional, e.g. Medication refrigerator':'Προαιρετικό, π.χ. Ψυγείο φαρμάκων'} {...selectText}/>
      <SearchableSelect label={en?'Responsible position':'Θέση ευθύνης'} {...form.field('owner')} required={false} value={draft.owner||''} options={positionOptions} onChange={v=>set('owner',v)} allowCustom placeholder={en?'e.g. Head of Department':'π.χ. Προϊστάμενος/η Τμήματος'} {...selectText}/>
      <SearchableSelect label={en?'Responsible person':'Υπεύθυνο πρόσωπο'} value={draft.ownerPerson?.employeeId||''} options={people.options} recentValues={people.near} recentLabel={en?'In the chosen departments':'Στα επιλεγμένα τμήματα'} onChange={id=>set('ownerPerson',personFromEmployee(employeeById(id)))} placeholder={en?'Search staff…':'Αναζήτηση προσωπικού…'} {...selectText}/>
     </div>
     {!hasOwner&&!ownerRequired&&<small className="control-editor-hint">{en?'No one is responsible yet: choose a position or a person when you know it.':'Δεν έχει οριστεί υπεύθυνος: επιλέξτε θέση ή πρόσωπο όταν είναι γνωστό.'}</small>}
     {similar.length>0&&<div className="control-editor-similar" role="status">
      <strong>{similar.some(item=>item.same)?(en?'A control with this name already exists.':'Υπάρχει ήδη έλεγχος με αυτή την ονομασία.'):(en?'A control with a very similar name exists.':'Υπάρχει έλεγχος με πολύ παρόμοια ονομασία.')}</strong>
      <span>{en?'If it is the same check, add your department to it instead of creating a new one: ':'Αν είναι ο ίδιος έλεγχος, προσθέστε το τμήμα σας σε αυτόν αντί να δημιουργήσετε νέο: '}{similar.map(({control},index)=><span key={control.id}>{index>0&&', '}<Link to={`/controls/${control.id}`}>{control.title}</Link></span>)}</span>
     </div>}
    </section>


    <section className="control-editor-card control-editor-wide">
     <header><strong>{en?'Schedule':'Προγραμματισμός'}</strong><span>{en?'Frequency and exact times':'Συχνότητα και ακριβείς ώρες'}</span></header>
     <div className="control-editor-grid schedule">
      <SearchableSelect label={en?'Frequency *':'Συχνότητα *'} value={draft.frequency.kind} options={FREQUENCIES.map(kind=>({value:kind,label:freqLabel[kind]}))} onChange={v=>v&&setF('kind',v)} {...selectText} clearLabel=""/>
      {draft.frequency.kind==='daily'
       ?<ControlTimesList times={times} language={language} onChange={next=>setDraft(d=>({...d,frequency:{...d.frequency,times:next,timesPerDay:next.length}}))}/>
       :<Field label={`${en?'Every':'Κάθε'} (${intervalUnit}) *`}><input type="number" min="1" value={draft.frequency.interval||1} onChange={e=>setF('interval',Math.max(1,Number(e.target.value)||1))}/></Field>}
     {draft.frequency.kind==='daily'&&<YesNoField label={en?'Working days only (Monday–Friday)':'Μόνο εργάσιμες (Δευτέρα–Παρασκευή)'} hint={en?'Saturday and Sunday are not due and do not count as missed.':'Σάββατο και Κυριακή δεν ζητείται και δεν μετρά ως «χάθηκε».'} value={draft.frequency.weekdaysOnly===true} onChange={value=>setF('weekdaysOnly',value?true:undefined)}/>}
     </div>
     {draft.frequency.kind==='daily'&&!showMargin&&draft.frequency.toleranceMinutes==null&&<button type="button" className="control-editor-link" onClick={()=>setShowMargin(true)}>{en?'Change the margin':'Αλλαγή περιθωρίου'}</button>}
     {draft.frequency.kind==='daily'&&(showMargin||draft.frequency.toleranceMinutes!=null)&&<div className="control-editor-grid two"><Field label={en?'Margin after the time (minutes)':'Περιθώριο μετά την ώρα (λεπτά)'}><input type="number" min="0" step="15" value={draft.frequency.toleranceMinutes??''} placeholder={String(slotMargin({...draft.frequency,toleranceMinutes:null})||'')} onChange={e=>setF('toleranceMinutes',e.target.value===''?null:Math.max(0,Number(e.target.value)||0))}/></Field><small className="control-editor-hint">{en?'Empty: 2 hours when once a day, 1 hour when more often.':'Χωρίς τιμή: 2 ώρες όταν γίνεται μία φορά την ημέρα, 1 ώρα όταν γίνεται συχνότερα.'}</small></div>}
    </section>

    <section className="control-editor-card control-editor-wide">
     <header><strong>{en?'How it is recorded':'Τρόπος καταχώρησης'}</strong><span>{en?'What the person recording fills in':'Τι συμπληρώνει όποιος καταχωρεί'}</span></header>
     <SearchableSelect className="control-editor-modes" label={en?'Result format':'Μορφή αποτελέσματος'} value={mode} onChange={next=>next&&(changeMode)(next)} options={[
      {value:'numeric',label:en?'Measurement':'Μέτρηση',icon:Hash},
      {value:'choice',label:en?'Status':'Κατάσταση',icon:ToggleLeft},
      {value:'checklist',label:en?'Checklist':'Λίστα ελέγχου',icon:ListTodo},
      {value:'list',label:en?'Items / findings list':'Λίστα υλικών / ευρημάτων',icon:ListChecks},
      {value:'text',label:en?'Free text':'Ελεύθερο κείμενο',icon:Type},
     ]}/>
     <div className="control-editor-grid">
      {mode!=='list'&&mode!=='checklist'&&<Field label={en?'Field label':'Ετικέτα πεδίου'}><input value={response.label||''} onChange={e=>setR('label',e.target.value)} placeholder={en?'e.g. Temperature':'π.χ. Θερμοκρασία'}/></Field>}
      {mode==='numeric'&&<>
       <SearchableSelect label={en?'Unit':'Μονάδα μέτρησης'} value={response.unit||''} options={libraryOptions(lib('measurementUnits'),language)} onChange={v=>setR('unit',v)} allowCustom placeholder="°C" {...selectText}/>
       <Field label={en?'Minimum acceptable':'Ελάχιστο αποδεκτό'}><input type="number" step="any" value={response.min??''} onChange={e=>setR('min',e.target.value===''?'':Number(e.target.value))}/></Field>
       <Field label={en?'Maximum acceptable':'Μέγιστο αποδεκτό'}><input type="number" step="any" value={response.max??''} onChange={e=>setR('max',e.target.value===''?'':Number(e.target.value))}/></Field>
      </>}
      {mode==='list'&&<div className="field control-editor-span"><span className="lo-field-label">{en?'List template':'Πρότυπο λίστας'}</span><ModeSwitch ariaLabel={en?'List template':'Πρότυπο λίστας'} value={response.template||'generic_findings'} onChange={v=>setR('template',v)} options={[{value:'medication_expiry',label:en?'Medicines / supplies — expiry':'Φάρμακα / υλικά — λήξεις'},{value:'generic_findings',label:en?'General findings':'Γενική λίστα ευρημάτων'}]}/></div>}
      {mode==='list'&&response.template==='medication_expiry'&&<>
       <Field label={en?'Alert days before expiry':'Ειδοποίηση πριν τη λήξη (ημέρες)'}><input type="number" min="0" value={response.expiryBeforeDays??DEFAULT_EXPIRY_BEFORE_DAYS} onChange={e=>setR('expiryBeforeDays',e.target.value===''?'':Math.max(0,Number(e.target.value)))}/></Field>
       <Field label={en?'Alert days after expiry':'Ειδοποίηση μετά τη λήξη (ημέρες)'}><input type="number" min="0" value={response.expiryAfterDays??DEFAULT_EXPIRY_AFTER_DAYS} onChange={e=>setR('expiryAfterDays',e.target.value===''?'':Math.max(0,Number(e.target.value)))}/></Field>
       <div className="field"><span className="lo-field-label">{en?'Medicines and supplies':'Λίστα φαρμάκων / υλικών'}</span><button type="button" className={`control-editor-list-button${expiryCatalogue(draft).length?' has-items':''}`} onClick={()=>setCatalogueOpen(true)}><span className="control-editor-list-icon"><ListChecks size={16}/></span><span className="control-editor-list-text"><strong>{expiryCatalogue(draft).length?(en?'Edit list':'Επεξεργασία λίστας'):(en?'Create list':'Δημιουργία λίστας')}</strong><small>{expiryCatalogue(draft).length?(en?`${expiryCatalogue(draft).length} items`:`${expiryCatalogue(draft).length} υλικά`):(en?'From the medicines & supplies library':'Από τη βιβλιοθήκη φαρμάκων & υλικών')}</small></span><Pencil size={14}/></button></div>
      </>}
     </div>
     {mode==='choice'&&<div className="control-editor-choices">
      <MultiSelect label={en?'Available choices *':'Διαθέσιμες επιλογές *'} options={[...libraryOptions(lib('controlAnswers'),language),...options.filter(x=>!findLibraryItem(lib('controlAnswers'),x.value)).map(x=>({value:x.value,label:x.value}))]} selected={options.map(x=>x.value)} onChange={setOptions} placeholder={en?'Choose from the library':'Επιλέξτε από τη βιβλιοθήκη'} {...multiText} countLabel={n=>en?`${n} choices`:`${n} επιλογές`}/>
      <SearchableSelect label={en?'Add another choice':'Προσθήκη άλλης επιλογής'} value={newAnswer} options={[]} onChange={addAnswer} allowCustom placeholder={en?'Type and press Enter':'Γράψτε και πατήστε Enter'} {...selectText}/>
      <ChoiceChips className="control-editor-span" label={en?'Counts as a finding':'Θεωρείται εύρημα'} options={options.map(x=>({value:x.value,label:answerLabel(x.value,language,lib('controlAnswers'))}))} selected={options.filter(x=>x.finding).map(x=>x.value)} onToggle={toggleFinding}/>
     </div>}
     {mode==='checklist'&&<div className="control-editor-checklist">
      <div className="control-editor-checklist-tools">
       <SearchableSelect label={en?'Start from a bundle template':'Εισαγωγή από πρότυπο δέσμης μέτρων'} value="" options={bundleTemplates.map(x=>({value:String(x.id),label:en?x.titleEn||x.name:x.titleEl||x.name,description:`${(x.elements||[]).length} ${en?'items':'σημεία'}`}))} onChange={importBundle} placeholder={en?'Optional':'Προαιρετικό'} {...selectText}/>
       <Button variant="secondary" onClick={()=>setChecklist([...checklist,{id:newItemId(),el:'',en:'',required:true}])}><Plus size={15}/> {en?'Add item':'Προσθήκη σημείου'}</Button>
      </div>
      {checklist.length===0&&<div className="inline-empty"><strong>{en?'No items yet':'Δεν υπάρχουν σημεία'}</strong><span>{en?'Add the items to check one by one, or start from a bundle template.':'Προσθέστε τα σημεία ελέγχου ένα-ένα ή ξεκινήστε από πρότυπο δέσμης μέτρων.'}</span></div>}
      <ol className="control-editor-checklist-items">{checklist.map((item,index)=><li key={item.id||index}>
       <span className="control-editor-checklist-number">{index+1}</span>
       <input aria-label={`${en?'Item':'Σημείο'} ${index+1}`} value={en?item.en||item.el:item.el} onChange={e=>setChecklist(checklist.map(x=>x===item?{...x,[en?'en':'el']:e.target.value,...(!en||!x.el?{el:x.el||e.target.value}:{})}:x))} placeholder={en?'e.g. Hand rub available at the point of care':'π.χ. Διαθέσιμο αντισηπτικό στο σημείο φροντίδας'}/>
       <ChoiceChips className="control-editor-required" options={[{value:'required',label:en?'Required':'Υποχρεωτικό'}]} selected={item.required!==false?['required']:[]} onToggle={()=>setChecklist(checklist.map(x=>x===item?{...x,required:x.required===false}:x))}/>
       <IconButton size="sm" tone="danger" label={en?'Remove item':'Αφαίρεση σημείου'} onClick={()=>setChecklist(checklist.filter(x=>x!==item))}><Trash2 size={14}/></IconButton>
      </li>)}</ol>
     </div>}
    </section>

    <section className="control-editor-card">
     <header><strong>{en?'Criticality':'Κρισιμότητα'}</strong><span>{en?'Priority and proof':'Προτεραιότητα και τεκμήριο'}</span></header>
     <div className="control-editor-grid two">
      <SearchableSelect label={en?'Criticality':'Κρισιμότητα'} value={controlCriticality(draft)} onChange={v=>v&&setR('criticality',v)} options={CRITICALITY_LEVELS.map(level=>({value:level,label:criticalityLabel(level,language)}))}/>
      <YesNoField label={en?'Evidence on every entry':'Τεκμήριο σε κάθε καταχώρηση'} value={requiresEvidence(draft)} onChange={value=>setR('requiresEvidence',value)}/>
     </div>
    </section>

    </>}
    {tab==='departments'&&<>
    <section className="control-editor-card control-editor-wide control-editor-departments">
     <header><strong>{en?'Departments of the control':'Τμήματα του ελέγχου'}</strong><span>{en?'Fill in only what a department does differently; the rest follows «Details».':'Συμπληρώνετε μόνο ό,τι κάνει διαφορετικά ένα τμήμα· τα υπόλοιπα ακολουθούν τα «Στοιχεία».'}</span></header>
     <MultiSelect className="control-departments-select" label={en?'Departments':'Τμήματα εφαρμογής'} {...form.field('departments')} options={departments.map(d=>({value:d,label:d}))} selected={draft.departments} onChange={next=>set('departments',next)} disabled={departmentOnly||departmentsLoading||Boolean(departmentsError)} placeholder={departmentsLoading?(en?'Loading departments…':'Φόρτωση τμημάτων…'):departmentsError||(departments.length?(en?'Select departments':'Επιλέξτε τμήματα'):(en?'No active departments':'Δεν υπάρχουν ενεργά τμήματα'))} {...multiText} searchPlaceholder={en?'Search department…':'Αναζήτηση τμήματος…'} emptyLabel={en?'No department matches':'Κανένα τμήμα δεν ταιριάζει'} countLabel={n=>en?`${n} departments`:`${n} τμήματα`}/>
     {draft.departments.length>0&&<table className="data-table control-editor-department-table">
      <thead><tr><th>{en?'Department':'Τμήμα'}</th><th>{en?'Responsible person':'Υπεύθυνος'}</th><th>{en?'Schedule':'Πρόγραμμα'}</th><th>{mode==='numeric'?(en?'Limits / actions':'Όρια / ενέργειες'):(en?'Actions on deviation':'Ενέργειες σε απόκλιση')}</th>{!departmentOnly&&<th aria-label={en?'Actions':'Ενέργειες'}/>}</tr></thead>
      <tbody>{draft.departments.map(dep=>{const {options:depOptions,near}=employeeOptions(employees,language,[dep]);const person=draft.assignees?.[dep];const setPerson=next=>set('assignees',{...(draft.assignees||{}),[dep]:next});const ownFields=Boolean(draft.departmentFrequencies?.[dep]||draft.departmentResponses?.[dep]);return <Fragment key={dep}><tr className={ownFields?'has-own-fields':''}>
       <td><strong>{dep}</strong></td>
       <td>{person?.employeeId||editingPerson===dep?<div className="control-department-cell is-own"><SearchableSelect hideLabel label={`${en?'Person for':'Υπεύθυνος για'} ${dep}`} value={person?.employeeId||''} options={depOptions} recentValues={near} recentLabel={dep} onChange={id=>{setPerson(personFromEmployee(employeeById(id)));setEditingPerson(null)}} placeholder={en?'Search staff…':'Αναζήτηση προσωπικού…'} {...selectText}/><button type="button" className="control-department-cell-action" onClick={()=>{setPerson(null);setEditingPerson(null)}}>{en?'Same for all':'Όπως όλα'}</button></div>
        :<div className="control-department-cell"><span>{en?'Same for all':'Όπως όλα'}</span><button type="button" className="control-department-cell-action" onClick={()=>setEditingPerson(dep)}>{en?'Change':'Αλλαγή'}</button></div>}</td>
       <td><ControlDepartmentSchedules compact departments={[dep]} base={draft.frequency} value={draft.departmentFrequencies||{}} onChange={next=>set('departmentFrequencies',next)} en={en} kindLabels={freqLabel} selectText={selectText}/></td>
       <td><ControlDepartmentResponses compact departments={[dep]} base={response} numeric={mode==='numeric'} value={draft.departmentResponses||{}} onChange={next=>set('departmentResponses',next)} en={en} selectText={selectText}/></td>
       {!departmentOnly&&<td className="control-editor-department-pause"><Button variant="quiet" onClick={()=>set('departments',draft.departments.filter(x=>x!==dep))}><PauseCircle size={15}/> {en?'Pause':'Παύση'}</Button></td>}
      </tr>
      {ownFields&&<tr className="control-editor-department-fields"><td colSpan={departmentOnly?4:5}>
       <ControlDepartmentSchedules compact part="fields" departments={[dep]} base={draft.frequency} value={draft.departmentFrequencies||{}} onChange={next=>set('departmentFrequencies',next)} en={en} kindLabels={freqLabel} selectText={selectText}/>
       <ControlDepartmentResponses compact part="fields" departments={[dep]} base={response} numeric={mode==='numeric'} value={draft.departmentResponses||{}} onChange={next=>set('departmentResponses',next)} en={en} selectText={selectText}/>
      </td></tr>}
      </Fragment>})}</tbody>
     </table>}
     {pausedDepartments.length>0&&<div className="control-editor-paused" role="status"><span>{en?'Paused (history kept):':'Σε παύση (το ιστορικό μένει):'}</span>{pausedDepartments.map(dep=><button key={dep} type="button" className="control-editor-paused-chip" onClick={()=>set('departments',[...draft.departments,dep])}>{dep} · {en?'Resume':'Επαναφορά'}</button>)}</div>}
    </section>
    </>}
    {tab==='instructions'&&<>
    <section className="control-editor-card control-editor-wide">
     <header><strong><FileText size={14}/> {en?'Goal & instructions':'Στόχος & οδηγίες'}</strong><span>{en?'Shown to whoever records':'Εμφανίζονται σε όποιον καταχωρεί'}</span></header>
     <Field label={en?'Actions on deviation':'Ενέργειες σε απόκλιση'}><textarea rows="3" value={response.deviationActions||''} onChange={e=>setR('deviationActions',e.target.value)} placeholder={en?'Shown to the person recording when the result deviates, e.g. move vaccines to the backup fridge, inform the pharmacy.':'Εμφανίζεται σε όποιον καταχωρεί όταν το αποτέλεσμα αποκλίνει, π.χ. μεταφορά εμβολίων στο εφεδρικό ψυγείο, ενημέρωση φαρμακείου.'}/></Field>
     <Field label={en?'Goal':'Στόχος'}><textarea rows="3" value={draft.goal||''} onChange={e=>set('goal',e.target.value)} placeholder={en?'What the control is for…':'Τι εξασφαλίζει ο έλεγχος…'}/></Field>
     <Field label={en?'Acceptance criteria':'Κριτήρια αποδοχής'}><textarea rows="3" value={draft.acceptanceCriteria||''} onChange={e=>set('acceptanceCriteria',e.target.value)} placeholder={en?'When the result is acceptable…':'Πότε το αποτέλεσμα είναι αποδεκτό…'}/></Field>
     <Field label={en?'Instructions':'Οδηγίες'}><textarea rows="4" value={draft.description||''} onChange={e=>set('description',e.target.value)} placeholder={en?'Optional instructions…':'Προαιρετικές οδηγίες…'}/></Field>
     <Field label={en?'Guidance notes':'Σημειώσεις καθοδήγησης'}><textarea rows="3" value={draft.guideNotes||''} onChange={e=>set('guideNotes',e.target.value)} placeholder={en?'Optional notes for whoever records…':'Προαιρετικές σημειώσεις για όποιον καταχωρεί…'}/></Field>
    </section>

    </>}

    <div className="inline-edit-footer control-editor-footer" onClickCapture={()=>{if(!form.valid)setTab(draft.departments.length?'details':'departments')}}><Button variant="secondary" onClick={onCancel}>{en?'Cancel':'Ακύρωση'}</Button><FormSubmit form={form} onSubmit={submit}>{en?'Save':'Αποθήκευση'}</FormSubmit></div>
   </div>
  </EntityRecordShell>
  {catalogueOpen&&<ControlExpiryCatalogueDialog items={expiryCatalogue(draft)} departments={departments} defaultDepartments={departmentOnly&&fixedDepartment?[fixedDepartment]:[]} window={expiryWindow(draft)} language={language} onClose={()=>setCatalogueOpen(false)} onSave={list=>setR('expiryCatalogue',list)}/>}
 </Page>
}
