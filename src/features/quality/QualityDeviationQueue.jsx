import { useEffect,useMemo,useState } from 'react'
import { ClipboardCheck,ExternalLink,Plus,ShieldCheck } from 'lucide-react'
import { ActionButton } from '../../design-system/ActionButton'
import { IconButton } from '../../design-system/IconButton'
import { useContextualNavigation } from '../../core/navigation/useContextualNavigation'
import { loadControlProgramme } from '../controls/controlCloudService'
import { loadBundleAssessments } from '../prevention/bundleCloudService'
import { loadQualityRecords } from './qualityService'
import { capaPrefill,deviationQueue } from './qualityDeviations'

const PERIODS=[30,90,365]

export function useDeviationQueue(organizationId,enabled=true){
 const [sources,setSources]=useState({controls:[],bundles:[],capas:[]})
 const [loading,setLoading]=useState(enabled)
 useEffect(()=>{
  if(!enabled){setLoading(false);return}
  let active=true
  setLoading(true)
  const safe=promise=>promise.catch(()=>[])
  Promise.all([safe(loadControlProgramme(organizationId)),safe(loadBundleAssessments(organizationId)),safe(loadQualityRecords('capas',organizationId))])
   .then(([controls,bundles,capas])=>{if(active)setSources({controls,bundles,capas})})
   .finally(()=>{if(active)setLoading(false)})
  return()=>{active=false}
 },[organizationId,enabled])
 return {sources,loading}
}

export function QualityDeviationQueue({sources,loading,language,locale,t,onCreateCapa}){
 const en=language==='en'
 const {goTo}=useContextualNavigation('/quality')
 const [days,setDays]=useState(90)
 const items=useMemo(()=>deviationQueue({...sources,days}),[sources,days])
 const fmt=v=>v?new Intl.DateTimeFormat(locale,{dateStyle:'short',timeStyle:String(v).length>10?'short':undefined,hour12:false}).format(new Date(v)):'—'
 return <div className="quality-deviation-queue">
  <div className="quality-deviation-toolbar">
   <p>{en?'Control entries with a finding and bundle assessments with failed criteria that no CAPA points to yet. Create the CAPA here; the source, department, priority and steps are filled in.':'Καταχωρήσεις ελέγχων με εύρημα και αξιολογήσεις bundle με κριτήρια που δεν τηρήθηκαν, χωρίς διορθωτική ενέργεια ακόμη. Δημιουργήστε τη CAPA από εδώ· πηγή, τμήμα, προτεραιότητα και βήματα συμπληρώνονται αυτόματα.'}</p>
   <label><span>{en?'Period':'Περίοδος'}</span><select value={days} onChange={e=>setDays(Number(e.target.value))}>{PERIODS.map(value=><option key={value} value={value}>{en?`Last ${value} days`:`Τελευταίες ${value} ημέρες`}</option>)}</select></label>
  </div>
  <div className="scroll-table">
   <table className="data-table sticky-table quality-deviation-table">
    <thead><tr><th>{en?'Date':'Ημερομηνία'}</th><th>{en?'Source':'Πηγή'}</th><th>{en?'Deviation':'Απόκλιση'}</th><th>{t('department')}</th><th>{en?'Result':'Αποτέλεσμα'}</th><th>{t('priority')}</th><th className="quality-deviation-actions-col"></th></tr></thead>
    <tbody>{items.map(item=>{const Icon=item.kind==='control'?ClipboardCheck:ShieldCheck;return <tr key={item.key}>
     <td className="nowrap-cell">{fmt(item.at)}</td>
     <td><span className="quality-deviation-kind"><Icon size={14} aria-hidden="true"/>{item.kind==='control'?(en?'Control':'Έλεγχος'):'Bundle'}</span></td>
     <td><strong>{en?item.titleEn:item.title}</strong>{item.notes&&<small>{item.notes}</small>}</td>
     <td>{item.department||'—'}</td>
     <td>{item.kind==='bundle'?(en?`${item.detail} criteria not met`:`${item.detail} κριτήρια δεν τηρήθηκαν`):(item.detail||(en?'Non-compliant':'Μη συμμόρφωση'))}</td>
     <td><span className={`status-badge ${item.priority==='high'?'danger':''}`}>{t(item.priority)}</span></td>
     <td className="quality-deviation-actions-col"><div className="row-actions">
      <IconButton size="sm" label={en?'Open source record':'Άνοιγμα εγγραφής προέλευσης'} onClick={()=>goTo(item.path,{returnTo:'/quality'})}><ExternalLink size={15}/></IconButton>
      <ActionButton tone="primary" label={en?'Create CAPA':'Δημιουργία CAPA'} onClick={()=>onCreateCapa(capaPrefill(item,language))}><Plus size={15}/><span>{en?'Create CAPA':'Δημιουργία CAPA'}</span></ActionButton>
     </div></td>
    </tr>})}</tbody>
   </table>
   {loading&&<div className="registry-empty-state"><strong>{en?'Loading deviations…':'Φόρτωση αποκλίσεων…'}</strong></div>}
   {!loading&&!items.length&&<div className="registry-empty-state"><strong>{en?'No deviations without a CAPA':'Δεν υπάρχουν αποκλίσεις χωρίς CAPA'}</strong><span>{en?'Every control finding and failed bundle in this period already has a corrective action.':'Κάθε εύρημα ελέγχου και κάθε bundle με αστοχία της περιόδου έχει ήδη διορθωτική ενέργεια.'}</span></div>}
  </div>
 </div>
}
