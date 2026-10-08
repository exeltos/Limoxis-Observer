import { useEffect,useMemo,useState } from 'react'
import { AlertTriangle,CheckCircle2,Download,FileSpreadsheet,Upload } from 'lucide-react'
import { ObserverDialog,DialogActions } from '../../design-system/ObserverDialog'
import { Button } from '../../design-system/Button'
import { downloadCsv } from '../../core/export/csvExport'
import { readSpreadsheet } from '../../core/import/spreadsheetImport'
import { useTenant } from '../../core/tenant/TenantContext'
import { loadDepartments } from '../management/departmentsService'
import { loadManagementLibraries } from '../management/managementCloudService'
import { demoLibrarySeed } from '../management/managementData'
import { createEmployeeAsync,updateEmployeeAsync } from './employeeService'
import { planEmployeeImport,templateRows } from './employeeImport'
import './employeeImport.css'

const ACTION_TEXT={create:['Νέος','New'],update:['Ενημέρωση','Update'],skip:['Υπάρχει ήδη','Already exists'],error:['Σφάλμα','Error']}

// An update keeps what the file leaves empty, so a sheet with only codes and
// positions does not wipe e-mails or dates.
const mergeUpdate=(current,value)=>{const next={...current};for(const [key,v] of Object.entries(value))if(v!==''&&v!=null)next[key]=v;return next}

export function EmployeeImportDialog({existing=[],language,onClose,onImported}){
 const en=language==='en'
 const {tenant,isDemo}=useTenant()
 const [reference,setReference]=useState({departments:[],professions:[],positions:[]})
 const [rows,setRows]=useState(null)
 const [fileName,setFileName]=useState('')
 const [readError,setReadError]=useState('')
 const [updateExisting,setUpdateExisting]=useState(false)
 const [running,setRunning]=useState(null)
 const [result,setResult]=useState(null)

 useEffect(()=>{
  let active=true
  if(isDemo){setReference({departments:demoLibrarySeed.departments.map(([name,nameEn])=>({id:name,name,nameEn})),professions:demoLibrarySeed.professionalCategories||[],positions:demoLibrarySeed.positions||[]});return()=>{active=false}}
  if(!tenant?.id)return()=>{active=false}
  Promise.all([loadDepartments(tenant.id),loadManagementLibraries(tenant.id)]).then(([departments,libraries])=>{
   if(active)setReference({departments:(departments||[]).filter(row=>row.is_active!==false).map(row=>({id:row.id,name:row.name,nameEn:row.name_en||row.nameEn||row.name})),professions:libraries?.professionalCategories||[],positions:libraries?.positions||[]})
  }).catch(()=>{})
  return()=>{active=false}
 },[isDemo,tenant?.id])

 const plan=useMemo(()=>rows?planEmployeeImport(rows,{existing,...reference,updateExisting,en}):null,[rows,existing,reference,updateExisting,en])
 const toSave=plan?plan.items.filter(item=>item.action==='create'||item.action==='update'):[]

 async function pick(event){
  const file=event.target.files?.[0]
  event.target.value=''
  if(!file)return
  setReadError('');setResult(null);setFileName(file.name)
  try{setRows(await readSpreadsheet(file))}
  catch(error){setRows(null);setReadError(error?.message==='SPREADSHEET_UNSUPPORTED_TYPE'?(en?'Choose an .xlsx or .csv file.':'Επιλέξτε αρχείο .xlsx ή .csv.'):(en?'The file could not be read.':'Δεν ήταν δυνατή η ανάγνωση του αρχείου.'))}
 }

 function downloadTemplate(){
  const {headers,example}=templateRows(en)
  downloadCsv(en?'staff-import-template.csv':'protypo-eisagogis-prosopikou.csv',headers,[example])
 }

 async function run(){
  const failed=[]
  let done=0
  setRunning({done:0,total:toSave.length})
  for(const item of toSave){
   try{
    if(item.action==='create')await createEmployeeAsync(tenant?.id??null,item.value)
    else await updateEmployeeAsync(tenant?.id??null,item.current.dbId,mergeUpdate(item.current,item.value),item.current.id)
   }catch(error){failed.push({...item,errors:[error?.message==='DUPLICATE_EMPLOYEE_CODE'?(en?'Code already exists':'Ο κωδικός υπάρχει ήδη'):(error?.message||String(error))]})}
   done+=1
   setRunning({done,total:toSave.length})
  }
  setRunning(null)
  setResult({saved:toSave.length-failed.length,failed})
 }

 // The list reloads on close: reloading while open would remount the page and
 // this dialog with it, losing the result.
 function close(){
  if(result?.saved)onImported?.()
  onClose()
 }

 const footer=result
  ?<DialogActions onSave={close} saveLabel={en?'Close':'Κλείσιμο'}/>
  :<DialogActions showCancel onCancel={close} onSave={()=>void run()} disabled={!toSave.length||Boolean(running)} saveLabel={running?(en?`Saving ${running.done}/${running.total}…`:`Αποθήκευση ${running.done}/${running.total}…`):(en?`Import ${toSave.length}`:`Εισαγωγή ${toSave.length}`)}/>

 return <ObserverDialog width="wide" eyebrow={en?'Staff':'Προσωπικό'} title={en?'Import staff from Excel':'Εισαγωγή προσωπικού από Excel'} subtitle={en?'One row per employee. Departments, categories and positions must exist in Management.':'Μία γραμμή ανά εργαζόμενο. Τμήματα, κατηγορίες και θέσεις πρέπει να υπάρχουν στο Κέντρο Διαχείρισης.'} onClose={running?undefined:close} footer={footer}>
  <div className="employee-import">
   <div className="employee-import-file">
    <label className="employee-import-pick"><Upload size={16}/><span>{fileName||(en?'Choose file (.xlsx or .csv)':'Επιλογή αρχείου (.xlsx ή .csv)')}</span><input type="file" accept=".xlsx,.csv" onChange={event=>void pick(event)} disabled={Boolean(running)}/></label>
    <Button variant="secondary" onClick={downloadTemplate}><Download size={15}/>{en?' Template':' Πρότυπο'}</Button>
   </div>
   {readError&&<p className="employee-import-error" role="alert"><AlertTriangle size={15}/>{readError}</p>}
   {!plan&&!readError&&<div className="employee-import-help"><FileSpreadsheet size={20}/><div><strong>{en?'Columns':'Στήλες'}</strong><span>{en?'Code, Last name, First name, Department and Professional category are required. Father name, Job position, Status, Email, Phone, Hire date and Birth date are optional. Download the template to start.':'Υποχρεωτικές: Κωδικός, Επώνυμο, Όνομα, Τμήμα, Επαγγελματική κατηγορία. Προαιρετικές: Πατρώνυμο, Θέση εργασίας, Κατάσταση, Email, Τηλέφωνο, Ημερομηνία πρόσληψης, Ημερομηνία γέννησης. Κατεβάστε το πρότυπο για να ξεκινήσετε.'}</span></div></div>}
   {plan?.missingColumns.length>0&&<p className="employee-import-error" role="alert"><AlertTriangle size={15}/>{en?`Missing columns: ${plan.missingColumns.join(', ')}`:`Λείπουν στήλες: ${plan.missingColumns.join(', ')}`}</p>}
   {result&&<p className={`employee-import-result ${result.failed.length?'partial':''}`} role="status">{result.failed.length?<AlertTriangle size={16}/>:<CheckCircle2 size={16}/>}{en?`${result.saved} saved${result.failed.length?`, ${result.failed.length} failed`:''}.`:`Αποθηκεύτηκαν ${result.saved}${result.failed.length?`, απέτυχαν ${result.failed.length}`:''}.`}</p>}
   {plan&&!plan.missingColumns.length&&<>
    <div className="employee-import-summary">
     <span className="create"><strong>{plan.counts.create}</strong>{en?'new':'νέοι'}</span>
     <span className="update"><strong>{plan.counts.update}</strong>{en?'updates':'ενημερώσεις'}</span>
     {plan.counts.skip>0&&<span><strong>{plan.counts.skip}</strong>{en?'already exist':'υπάρχουν ήδη'}</span>}
     <span className="error"><strong>{plan.counts.error}</strong>{en?'with errors (not imported)':'με σφάλματα (δεν εισάγονται)'}</span>
     <div className="employee-import-update"><input id="employee-import-update" type="checkbox" checked={updateExisting} onChange={event=>setUpdateExisting(event.target.checked)} disabled={Boolean(running||result)}/><label htmlFor="employee-import-update">{en?'Update existing employees (empty cells keep the current value)':'Ενημέρωση υπαρχόντων εργαζομένων (τα κενά κελιά κρατούν την τρέχουσα τιμή)'}</label></div>
    </div>
    {!(result&&!result.failed.length)&&<div className="scroll-table employee-import-table"><table className="data-table sticky-table">
     <thead><tr><th>{en?'Row':'Γραμμή'}</th><th>{en?'Code':'Κωδικός'}</th><th>{en?'Name':'Ονοματεπώνυμο'}</th><th>{en?'Department · Position':'Τμήμα · Θέση'}</th><th>{en?'Result':'Αποτέλεσμα'}</th></tr></thead>
     <tbody>{(result?result.failed:plan.items).map(item=><tr key={item.line} className={`employee-import-row ${result?'error':item.action}`}>
      <td>{item.line}</td><td>{item.code||'—'}</td><td>{item.name||'—'}</td>
      <td>{[item.value.department,item.value.position].filter(Boolean).join(' · ')||'—'}</td>
      <td><span className={`employee-import-badge ${result?'error':item.action}`}>{ACTION_TEXT[result?'error':item.action][en?1:0]}</span>{[...item.errors,...item.warnings].map(message=><small key={message}>{message}</small>)}</td>
     </tr>)}</tbody>
    </table></div>}
   </>}
  </div>
 </ObserverDialog>
}
