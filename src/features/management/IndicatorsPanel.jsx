import { useEffect,useMemo,useState } from 'react'
import { LockKeyhole,Pencil,Plus,Trash2 } from 'lucide-react'
import { Button } from '../../design-system/Button'
import { OverflowMenu } from '../../design-system/OverflowMenu'
import { RegistryTable } from '../../design-system/RegistryTable'
import { ObserverDialog,DialogActions } from '../../design-system/ObserverDialog'
import { useLanguage } from '../../core/i18n/LanguageContext'
import { useTenant } from '../../core/tenant/TenantContext'
import { useFeedback } from '../../core/feedback/FeedbackContext'
import { CAPABILITIES,ROLES,can } from '../../core/permissions/roles'
import { IndicatorDefinitionForm,createEmptyIndicatorDefinition,indicatorDefinitionIsValid } from '../indicators/IndicatorDefinitionForm'
import { loadIndicatorDefinitions,retireIndicatorDefinition,saveIndicatorDefinition } from '../indicators/indicatorDefinitionService'
export function IndicatorsPanel(){
 const {language}=useLanguage();const {tenant,role,isDemo,membership}=useTenant();const {notify,confirm}=useFeedback();const el=language==='el';const isOwner=role===ROLES.PLATFORM_OWNER;const canManage=can(role,CAPABILITIES.MANAGE_INDICATORS,membership?.capabilities||[],membership?.customCapabilities||[])
 const [rows,setRows]=useState([]),[loading,setLoading]=useState(false),[editor,setEditor]=useState(null)
 useEffect(()=>{if(isDemo||!tenant?.id){setRows([]);return}let active=true;setLoading(true);loadIndicatorDefinitions(tenant.id).then(data=>active&&setRows(data)).catch(error=>active&&notify(error?.message||(el?'Αποτυχία φόρτωσης δεικτών.':'Failed to load indicators.'),'error')).finally(()=>active&&setLoading(false));return()=>{active=false}},[isDemo,tenant?.id,notify,el])
 const visible=useMemo(()=>rows.filter(x=>x.status!=='retired'),[rows])
 function open(item){setEditor({...item,readOnly:Boolean(!canManage||(item.system&&!isOwner))})}
 async function save(){if(!indicatorDefinitionIsValid(editor)){notify(el?'Συμπληρώστε τα υποχρεωτικά πεδία.':'Complete required fields.','error');return}try{const saved=await saveIndicatorDefinition(tenant.id,editor);setRows(current=>current.some(x=>x.id===saved.id)?current.map(x=>x.id===saved.id?saved:x):[...current,saved]);setEditor(null);notify(el?'Ο ορισμός δείκτη αποθηκεύτηκε.':'Indicator definition saved.','success')}catch(error){notify(error?.message||(el?'Αποτυχία αποθήκευσης.':'Save failed.'),'error')}}
 async function retire(item){if(item.system&&!isOwner)return;const ok=await confirm({title:el?'Απόσυρση δείκτη':'Retire indicator',message:`${el?'Να αποσυρθεί':'Retire'} «${item.titleEl}»;`,confirmLabel:el?'Απόσυρση':'Retire',danger:true});if(!ok)return;try{await retireIndicatorDefinition(tenant.id,item);setRows(current=>current.map(x=>x.id===item.id?{...x,status:'retired'}:x));notify(el?'Ο δείκτης αποσύρθηκε.':'Indicator retired.','success')}catch(error){notify(error?.message||(el?'Αποτυχία απόσυρσης.':'Retire failed.'),'error')}}
 if(isDemo)return <section className="management-section"><div className="inline-empty">{el?'Οι ορισμοί δεικτών διαχειρίζονται μόνο σε πραγματικό οργανισμό.':'Indicator definitions are managed in live organizations only.'}</div></section>
 return <section className="management-section management-scroll-section"><div className="section-toolbar"><div><h2>{el?'Ορισμοί δεικτών':'Indicator definitions'}</h2><p>{el?'Versioned system και hospital definitions που τροφοδοτούν απευθείας την operational οθόνη Δεικτών.':'Versioned system and hospital definitions that directly drive the operational Indicators screen.'}</p></div>{canManage&&<Button onClick={()=>setEditor(createEmptyIndicatorDefinition())}><Plus size={15}/>{el?'Νέος δείκτης':'New indicator'}</Button>}</div>{loading&&<div className="inline-empty">{el?'Φόρτωση…':'Loading…'}</div>}<RegistryTable
  wrapperClassName="table-wrap scroll-table"
  columns={[{key:'indicator',label:el?'Δείκτης':'Indicator'},{key:'type',label:el?'Τύπος':'Type'},{key:'version',label:el?'Έκδοση':'Version'},{key:'target',label:el?'Στόχος':'Target'},{key:'source',label:el?'Πηγή':'Source'},{key:'status',label:el?'Κατάσταση':'Status'},{key:'actions',label:''}]}
  rows={visible}
  rowKey={item=>item.id}
  renderRow={item=>{const systemLocked=item.system&&!isOwner;return <><td><strong>{item.titleEl}</strong><small>{item.key} · {item.system?'System':'Hospital'}</small></td><td>{item.calculationType}</td><td>{item.version}</td><td>{item.targetValue===''?'—':`${item.direction==='higher'?'≥':item.direction==='lower'?'≤':''} ${item.targetValue}`}</td><td>{item.sourceAuthority||'—'}</td><td><span className={`status-badge ${item.status==='active'?'active':'temporary'}`}>{item.status}</span></td><td><OverflowMenu items={[
    {id:'edit',label:systemLocked?(el?'Προβολή κλειδωμένου δείκτη':'View locked indicator'):(el?'Επεξεργασία':'Edit'),icon:systemLocked?LockKeyhole:Pencil,onClick:()=>open(item)},
    {id:'retire',label:el?'Απόσυρση':'Retire',icon:Trash2,tone:'danger',separatorBefore:true,onClick:()=>retire(item),hidden:!(canManage&&(!item.system||isOwner))},
  ]}/></td></>}}
/>{!loading&&!visible.length&&<div className="inline-empty">{el?'Δεν υπάρχουν ακόμη ορισμοί δεικτών.':'No indicator definitions yet.'}</div>}{editor&&<ObserverDialog title={editor.id?(el?'Ορισμός δείκτη':'Indicator definition'):(el?'Νέος δείκτης':'New indicator')} onClose={()=>setEditor(null)} width="wide"><IndicatorDefinitionForm value={editor} onChange={setEditor} language={language} readOnly={editor.readOnly} showSystem={isOwner&&!editor.id} lockKey={Boolean(editor.id)}/>{!editor.readOnly&&<DialogActions><Button onClick={save}>{el?'Αποθήκευση':'Save'}</Button></DialogActions>}</ObserverDialog>}</section>
}
