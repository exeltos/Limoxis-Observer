import { useMemo,useState } from 'react'
import { AlertTriangle,CheckCircle2,ClipboardCheck,Clock3,FileDown,PlayCircle,Plus,Printer } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Page } from '../../design-system/Page'
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

export function ControlsPage(){
 const {role,membership,canAccessRecord}=useTenant()
 const {profile,user}=useAuth()
 const actor=controlActorFromAuth({profile,user})
 const {t,language,locale}=useLanguage()
 const {notify}=useFeedback()
 const navigate=useNavigate(),registry=useRegistryMemory('controls')
 const [query,setQuery]=useState(''),[department,setDepartment]=useState('all'),[status,setStatus]=useState('all'),[frequency,setFrequency]=useState('all')
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
 const rows=useMemo(()=>scopedRows.filter(({item})=>`${item.id} ${item.title} ${item.category} ${item.owner}`.toLowerCase().includes(query.toLowerCase())).filter(x=>department==='all'||x.department===department).filter(({item,department:dep})=>status==='all'||(status==='temporary'?hasControlDraft(item.id,dep):assignmentStatus(item,dep)===status)).filter(({item})=>frequency==='all'||item.frequency.kind===frequency),[scopedRows,query,department,status,frequency,version])
 const fmt=v=>v?new Intl.DateTimeFormat(locale,{dateStyle:'short',timeStyle:'short',hour12:false}).format(new Date(v)):'—'
 const overdue=scopedRows.filter(({item,department:dep})=>assignmentStatus(item,dep)==='overdue').length
 const dueSoon=scopedRows.filter(({item,department:dep})=>assignmentStatus(item,dep)==='dueSoon').length
 function saveNew(draft){
   const saved=upsertControl({...draft,createdByRole:role,createdByScope:isPlatformOwner?'platform':isHospitalAdmin?'hospital_admin':canCreateCentral?'infection_control':'department',createdForDepartment:canCreateDepartment?ownDepartment:null},{actor})
   setVersion(v=>v+1);setEditorOpen(false);notify('Ο έλεγχος δημιουργήθηκε.','success')
   const dep=canCreateDepartment?ownDepartment:saved.departments[0]
   registry.openRecord(navigate,`/controls/${saved.id}?department=${encodeURIComponent(dep)}`,`${saved.id}:${dep}`)
 }
 function execute(row,e){e?.stopPropagation();const draft=hasControlDraft(row.item.id,row.department);const allowed=draft||isFullControlsAdmin||(canExecuteRole&&isControlDue(row.item,row.department));if(!allowed)return;setExecuteRow(row)}
 function pageAction(action){
   if(action===UI_ACTIONS.CREATE){setEditorOpen(true);return}
   if(action===UI_ACTIONS.PRINT){window.print();notify('Η προβολή είναι έτοιμη για εκτύπωση.','success');return}
   if(action===UI_ACTIONS.EXPORT){
     downloadCsv('limoxis-controls.csv',
       ['Έλεγχος','Τμήμα','Συχνότητα','Τελευταίος','Επόμενος','Κατάσταση'],
       rows.map(({item,department:dep,assignment})=>[item.title,dep,frequencyLabel(item.frequency),fmt(assignment?.lastCompletedAt),fmt(assignment?.nextDueAt),hasControlDraft(item.id,dep)?'Προσωρινή':assignmentStatus(item,dep)])
     )
     notify('Η λίστα Ελέγχων εξήχθη.','success')
   }
 }
 return <Page fill title={t('controls')} subtitle={canCreateCentral?'Κεντρικός προγραμματισμός και παρακολούθηση ελέγχων ανά τμήμα.':'Οι προγραμματισμένοι έλεγχοι που αφορούν το τμήμα σας.'} actions={<div className="record-actions">
   {canCreate&&<button type="button" className="action-button" onClick={()=>pageAction(UI_ACTIONS.CREATE)}><Plus size={15}/><span>{t('create')}</span></button>}
   <button type="button" className="action-button" onClick={()=>pageAction(UI_ACTIONS.PRINT)}><Printer size={15}/><span>{t('print')}</span></button>
   <button type="button" className="action-button" onClick={()=>pageAction(UI_ACTIONS.EXPORT)}><FileDown size={15}/><span>{t('export')}</span></button>
  </div>}>
  <div className="workspace-summary"><div className="kpi-grid clinical-kpis"><Kpi icon={ClipboardCheck} label="Ενεργές αναθέσεις" value={scopedRows.length}/><Kpi icon={Clock3} label="Πλησιάζουν" value={dueSoon}/><Kpi icon={AlertTriangle} label="Εκπρόθεσμοι" value={overdue}/><Kpi icon={CheckCircle2} label="Καταχωρήσεις σήμερα" value={scopedRows.reduce((n,x)=>n+(x.assignment?.history||[]).filter(h=>h.at?.slice(0,10)===new Date().toISOString().slice(0,10)).length,0)}/></div></div>
  <section className="surface controls-surface workspace-fill workspace-column">
   <div className="section-toolbar"><div><h2>{canCreateCentral?'Πρόγραμμα ελέγχων':'Έλεγχοι τμήματος'}</h2><p>Κλικ στην εγγραφή για κλειδωμένη προβολή. Το εικονίδιο δεξιά ενεργοποιείται μόνο όταν ο έλεγχος είναι απαιτητός.</p></div></div>
   <FilterBar query={query} onQueryChange={setQuery} placeholder="Αναζήτηση ελέγχων" activeAdvancedCount={(department!=='all')+(status!=='all')+(frequency!=='all')} onClear={()=>{setQuery('');setDepartment('all');setStatus('all');setFrequency('all')}}>
    <FilterSelect label="Τμήμα" value={department} onChange={setDepartment}><option value="all">Όλα τα τμήματα</option>{departments.map(x=><option key={x}>{x}</option>)}</FilterSelect>
    <FilterSelect label="Κατάσταση" value={status} onChange={setStatus}><option value="all">Όλες</option><option value="temporary">Προσωρινή</option><option value="scheduled">Εντός προγράμματος</option><option value="dueSoon">Πλησιάζει</option><option value="overdue">Εκπρόθεσμος</option></FilterSelect>
    <FilterSelect label="Συχνότητα" value={frequency} onChange={setFrequency}><option value="all">Όλες</option><option value="daily">Ημερήσια</option><option value="weekly">Εβδομαδιαία</option><option value="monthly">Μηνιαία / ανά μήνες</option><option value="yearly">Ετήσια</option></FilterSelect>
   </FilterBar>
   <div className="scroll-table" ref={registry.scrollRef}><table className="data-table sticky-table controls-table"><thead><tr><th>Έλεγχος</th><th>Τμήμα</th><th>Συχνότητα</th><th>Τελευταίος</th><th>Επόμενος</th><th>Κατάσταση</th><th className="control-action-col"></th></tr></thead><tbody>{rows.map(row=>{const {item,department:dep,assignment}=row,due=isControlDue(item,dep),state=assignmentStatus(item,dep),hasDraft=hasControlDraft(item.id,dep),canQuick=hasDraft||isFullControlsAdmin||(due&&canExecuteRole);return <tr key={`${item.id}:${dep}`} {...registry.rowProps(`${item.id}:${dep}`)} onClick={()=>registry.openRecord(navigate,`/controls/${item.id}?department=${encodeURIComponent(dep)}`,`${item.id}:${dep}`)}><td><strong>{language==='el'?item.title:item.titleEn}</strong><small>{item.category}</small></td><td>{dep}</td><td>{frequencyLabel(item.frequency)}</td><td>{fmt(assignment?.lastCompletedAt)}</td><td>{fmt(assignment?.nextDueAt)}</td><td><div className="control-status-stack">{hasDraft&&<span className="status-badge temporary">Προσωρινή</span>}<span className={`status-badge ${state==='overdue'?'danger':state==='dueSoon'?'warning':'active'}`}>{state==='overdue'?'Εκπρόθεσμος':state==='dueSoon'?'Πλησιάζει':'Εντός'}</span></div></td><td className="control-action-col"><button type="button" className={`control-quick-execute ${canQuick?'ready':''}`} disabled={!canQuick} title={hasDraft?'Συνέχιση προσωρινής καταχώρησης':canQuick?'Καταχώρηση ελέγχου':`Διαθέσιμο από ${fmt(assignment?.nextDueAt)}`} aria-label="Καταχώρηση ελέγχου" onClick={e=>execute(row,e)}><PlayCircle size={17}/></button></td></tr>})}</tbody></table></div>
  </section>
  {editorOpen&&<ControlEditor departmentOnly={canCreateDepartment} fixedDepartment={canCreateDepartment?ownDepartment:''} onCancel={()=>setEditorOpen(false)} onSave={saveNew}/>}
  {executeRow&&<ControlExecutionModal record={executeRow.item} department={executeRow.department} onClose={()=>setExecuteRow(null)} onDraftSaved={()=>{setVersion(v=>v+1);setExecuteRow(null);notify('Η καταχώρηση αποθηκεύτηκε προσωρινά. Μπορείτε να τη συνεχίσετε από τη λίστα.','success')}} onSave={payload=>{completeControl(executeRow.item.id,executeRow.department,payload);setVersion(v=>v+1);setExecuteRow(null);notify('Ο έλεγχος αποθηκεύτηκε επιτυχώς.','success')}}/>}
 </Page>
}
function Kpi({icon:Icon,label,value}){return <div className="employee-kpi"><Icon size={18}/><div><strong>{value}</strong><span>{label}</span></div></div>}
