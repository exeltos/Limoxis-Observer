import { useMemo,useState } from 'react'
import { AlertTriangle,CheckCircle2,ClipboardCheck,Clock3,PlayCircle } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Page } from '../../design-system/Page'
import { RecordActions } from '../../design-system/RecordActions'
import { FilterBar,FilterSelect } from '../../design-system/FilterBar'
import { useTenant } from '../../core/tenant/TenantContext'
import { useAuth } from '../../core/auth/AuthContext'
import { ROLES } from '../../core/permissions/roles'
import { UI_ACTIONS } from '../../core/actions/actionPolicy'
import { useLanguage } from '../../core/i18n/LanguageContext'
import { useRegistryMemory } from '../../core/navigation/useRegistryMemory'
import { useFeedback } from '../../core/feedback/FeedbackContext'
import { controlDefinitions,assignmentStatus,frequencyLabel,isControlDue,getAssignment,completeControl,upsertControl } from './controlsDemoData'
import { ControlEditor } from './ControlEditor'
import { ControlExecutionModal } from './ControlExecutionModal'
import { controlActorFromAuth } from './controlActor'
import { hasControlDraft } from './controlDrafts'
import { downloadCsv } from '../../core/export/csvExport'


const controlsText={
 el:{created:'Ο έλεγχος δημιουργήθηκε.',printReady:'Η προβολή είναι έτοιμη για εκτύπωση.',exported:'Η λίστα Ελέγχων εξήχθη.',centralSubtitle:'Κεντρικός προγραμματισμός και παρακολούθηση ελέγχων ανά τμήμα.',departmentSubtitle:'Οι προγραμματισμένοι έλεγχοι που αφορούν το τμήμα σας.',active:'Ενεργές αναθέσεις',dueSoon:'Πλησιάζουν',overdue:'Εκπρόθεσμοι',today:'Καταχωρήσεις σήμερα',programme:'Πρόγραμμα ελέγχων',departmentControls:'Έλεγχοι τμήματος',hint:'Κλικ στην εγγραφή για κλειδωμένη προβολή. Το εικονίδιο δεξιά ενεργοποιείται μόνο όταν ο έλεγχος είναι απαιτητός.',search:'Αναζήτηση ελέγχων',department:'Τμήμα',allDepartments:'Όλα τα τμήματα',status:'Κατάσταση',all:'Όλες',temporary:'Προσωρινή',scheduled:'Εντός προγράμματος',frequency:'Συχνότητα',daily:'Ημερήσια',weekly:'Εβδομαδιαία',monthly:'Μηνιαία / ανά μήνες',yearly:'Ετήσια',control:'Έλεγχος',last:'Τελευταίος',next:'Επόμενος',within:'Εντός',continueDraft:'Συνέχιση προσωρινής καταχώρησης',execute:'Καταχώρηση ελέγχου',availableFrom:'Διαθέσιμο από',draftSaved:'Η καταχώρηση αποθηκεύτηκε προσωρινά. Μπορείτε να τη συνεχίσετε από τη λίστα.',saved:'Ο έλεγχος αποθηκεύτηκε επιτυχώς.'},
 en:{created:'Control created.',printReady:'The view is ready to print.',exported:'Controls list exported.',centralSubtitle:'Central scheduling and monitoring of controls by department.',departmentSubtitle:'Scheduled controls assigned to your department.',active:'Active assignments',dueSoon:'Due soon',overdue:'Overdue',today:'Entries today',programme:'Control programme',departmentControls:'Department controls',hint:'Select a row to open the locked record view. The action icon is enabled only when the control is due.',search:'Search controls',department:'Department',allDepartments:'All departments',status:'Status',all:'All',temporary:'Draft',scheduled:'On schedule',frequency:'Frequency',daily:'Daily',weekly:'Weekly',monthly:'Monthly / every N months',yearly:'Yearly',control:'Control',last:'Last',next:'Next',within:'On schedule',continueDraft:'Continue draft entry',execute:'Record control',availableFrom:'Available from',draftSaved:'The entry was saved as a draft. You can continue it from the list.',saved:'Control saved successfully.'}
}

export function ControlsPage(){
 const {role,membership,canAccessRecord}=useTenant()
 const {profile,user}=useAuth()
 const actor=controlActorFromAuth({profile,user})
 const {t,language,locale}=useLanguage(); const tx=controlsText[language==='en'?'en':'el']
 const {notify}=useFeedback()
 const navigate=useNavigate(),registry=useRegistryMemory('controls')
 const savedView=registry.loadViewState({query:'',department:'all',status:'all',frequency:'all'})
 const [query,setQuery]=useState(savedView.query),[department,setDepartment]=useState(savedView.department),[status,setStatus]=useState(savedView.status),[frequency,setFrequency]=useState(savedView.frequency)
 const [editorOpen,setEditorOpen]=useState(false),[executeRow,setExecuteRow]=useState(null),[version,setVersion]=useState(0)
 const ownDepartment=membership?.previewDepartment||membership?.departmentName||membership?.department||''
 const isPlatformOwner=role===ROLES.PLATFORM_OWNER
 const isHospitalAdmin=role===ROLES.HOSPITAL_ADMIN
 const isFullControlsAdmin=isPlatformOwner||isHospitalAdmin
 const canCreateCentral=isFullControlsAdmin||role===ROLES.INFECTION_CONTROL_LEAD
 const canCreateDepartment=role===ROLES.DEPARTMENT_MANAGER&&Boolean(ownDepartment)
 const canCreate=canCreateCentral||canCreateDepartment
 const canExecuteRole=isFullControlsAdmin||[ROLES.DEPARTMENT_MANAGER,ROLES.DEPARTMENT_USER].includes(role)
 const scopedRows=useMemo(()=>controlDefinitions.flatMap(item=>item.departments.filter(dep=>canAccessRecord({department:dep})).map(dep=>({item,department:dep,assignment:getAssignment(item,dep)}))),[canAccessRecord])
 const departments=[...new Set(scopedRows.map(x=>x.department))]
 const rows=useMemo(()=>scopedRows.filter(({item})=>`${item.id} ${item.title} ${item.category} ${item.owner}`.toLowerCase().includes(query.toLowerCase())).filter(x=>department==='all'||x.department===department).filter(({item,department:dep})=>status==='all'||(status==='temporary'?hasControlDraft(item.id,dep):assignmentStatus(item,dep)===status)).filter(({item})=>frequency==='all'||item.frequency.kind===frequency),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 'version' is a deliberate cache-bust counter bumped after mutations; not read directly but must stay in deps to force recompute.
    [scopedRows,query,department,status,frequency,version])
 const fmt=v=>v?new Intl.DateTimeFormat(locale,{dateStyle:'short',timeStyle:'short',hour12:false}).format(new Date(v)):'—'
 const overdue=scopedRows.filter(({item,department:dep})=>assignmentStatus(item,dep)==='overdue').length
 const dueSoon=scopedRows.filter(({item,department:dep})=>assignmentStatus(item,dep)==='dueSoon').length
 function saveNew(draft){
   const saved=upsertControl({...draft,createdByRole:role,createdByScope:isPlatformOwner?'platform':isHospitalAdmin?'hospital_admin':canCreateCentral?'infection_control':'department',createdForDepartment:canCreateDepartment?ownDepartment:null},{actor})
   setVersion(v=>v+1);setEditorOpen(false);notify(tx.created,'success')
   const dep=canCreateDepartment?ownDepartment:saved.departments[0]
   registry.openRecord(navigate,`/controls/${saved.id}?department=${encodeURIComponent(dep)}`,`${saved.id}:${dep}`)
 }
 function execute(row,e){e?.stopPropagation();const draft=hasControlDraft(row.item.id,row.department);const allowed=draft||isFullControlsAdmin||(canExecuteRole&&isControlDue(row.item,row.department));if(!allowed)return;setExecuteRow(row)}
 function pageAction(action){
   if(action===UI_ACTIONS.CREATE){setEditorOpen(true);return}
   if(action===UI_ACTIONS.PRINT){window.print();notify(tx.printReady,'success');return}
   if(action===UI_ACTIONS.EXPORT){
     downloadCsv('limoxis-controls.csv',
       ['Έλεγχος','Τμήμα','Συχνότητα','Τελευταίος','Επόμενος','Κατάσταση'],
       rows.map(({item,department:dep,assignment})=>[item.title,dep,frequencyLabel(item.frequency,language),fmt(assignment?.lastCompletedAt),fmt(assignment?.nextDueAt),hasControlDraft(item.id,dep)?'Προσωρινή':assignmentStatus(item,dep)])
     )
     notify(tx.exported,'success')
   }
 }
 return <Page fill title={t('controls')} subtitle={canCreateCentral?tx.centralSubtitle:tx.departmentSubtitle} actions={<RecordActions actions={[...(canCreate?[UI_ACTIONS.CREATE]:[]),UI_ACTIONS.PRINT,UI_ACTIONS.EXPORT]} onAction={pageAction}/>}>
  <div className="workspace-summary"><div className="kpi-grid clinical-kpis"><Kpi icon={ClipboardCheck} label={tx.active} value={scopedRows.length}/><Kpi icon={Clock3} label={tx.dueSoon} value={dueSoon}/><Kpi icon={AlertTriangle} label={tx.overdue} value={overdue}/><Kpi icon={CheckCircle2} label={tx.today} value={scopedRows.reduce((n,x)=>n+(x.assignment?.history||[]).filter(h=>h.at?.slice(0,10)===new Date().toISOString().slice(0,10)).length,0)}/></div></div>
  <section className="surface controls-surface workspace-fill workspace-column">
   <div className="section-toolbar"><div><h2>{canCreateCentral?tx.programme:tx.departmentControls}</h2><p>{tx.hint}</p></div></div>
   <FilterBar query={query} onQueryChange={setQuery} placeholder={tx.search} activeAdvancedCount={(department!=='all')+(status!=='all')+(frequency!=='all')} onClear={()=>{setQuery('');setDepartment('all');setStatus('all');setFrequency('all')}}>
    <FilterSelect label={tx.department} value={department} onChange={setDepartment}><option value="all">{tx.allDepartments}</option>{departments.map(x=><option key={x}>{x}</option>)}</FilterSelect>
    <FilterSelect label={tx.status} value={status} onChange={setStatus}><option value="all">{tx.all}</option><option value="temporary">{tx.temporary}</option><option value="scheduled">{tx.scheduled}</option><option value="dueSoon">{tx.dueSoon}</option><option value="overdue">{tx.overdue}</option></FilterSelect>
    <FilterSelect label={tx.frequency} value={frequency} onChange={setFrequency}><option value="all">{tx.all}</option><option value="daily">{tx.daily}</option><option value="weekly">{tx.weekly}</option><option value="monthly">{tx.monthly}</option><option value="yearly">{tx.yearly}</option></FilterSelect>
   </FilterBar>
   <div className="scroll-table" ref={registry.scrollRef}><table className="data-table sticky-table controls-table"><thead><tr><th>{tx.control}</th><th>{tx.department}</th><th>{tx.frequency}</th><th>{tx.last}</th><th>{tx.next}</th><th>{tx.status}</th><th className="control-action-col"></th></tr></thead><tbody>{rows.map(row=>{const {item,department:dep,assignment}=row,due=isControlDue(item,dep),state=assignmentStatus(item,dep),hasDraft=hasControlDraft(item.id,dep),canQuick=hasDraft||isFullControlsAdmin||(due&&canExecuteRole);return <tr key={`${item.id}:${dep}`} {...registry.rowProps(`${item.id}:${dep}`)} onClick={()=>{registry.saveViewState({query,department,status,frequency});registry.openRecord(navigate,`/controls/${item.id}?department=${encodeURIComponent(dep)}`,`${item.id}:${dep}`,rows.map(x=>`${x.item.id}:${x.department}`))}}><td><strong>{language==='el'?item.title:item.titleEn}</strong><small>{item.category}</small></td><td>{dep}</td><td>{frequencyLabel(item.frequency,language)}</td><td>{fmt(assignment?.lastCompletedAt)}</td><td>{fmt(assignment?.nextDueAt)}</td><td><div className="control-status-stack">{hasDraft&&<span className="status-badge temporary">{tx.temporary}</span>}<span className={`status-badge ${state==='overdue'?'danger':state==='dueSoon'?'warning':'active'}`}>{state==='overdue'?tx.overdue:state==='dueSoon'?tx.dueSoon:tx.within}</span></div></td><td className="control-action-col"><button type="button" className={`control-quick-execute ${canQuick?'ready':''}`} disabled={!canQuick} title={hasDraft?tx.continueDraft:canQuick?tx.execute:`${tx.availableFrom} ${fmt(assignment?.nextDueAt)}`} aria-label={tx.execute} onClick={e=>execute(row,e)}><PlayCircle size={17}/></button></td></tr>})}</tbody></table></div>
  </section>
  {editorOpen&&<ControlEditor departmentOnly={canCreateDepartment} fixedDepartment={canCreateDepartment?ownDepartment:''} onCancel={()=>setEditorOpen(false)} onSave={saveNew}/>}
  {executeRow&&<ControlExecutionModal record={executeRow.item} department={executeRow.department} onClose={()=>setExecuteRow(null)} onDraftSaved={()=>{setVersion(v=>v+1);setExecuteRow(null);notify(tx.draftSaved,'success')}} onSave={payload=>{completeControl(executeRow.item.id,executeRow.department,payload);setVersion(v=>v+1);setExecuteRow(null);notify(tx.saved,'success')}}/>}
 </Page>
}
function Kpi({icon:Icon,label,value}){return <div className="employee-kpi"><Icon size={18}/><div><strong>{value}</strong><span>{label}</span></div></div>}
