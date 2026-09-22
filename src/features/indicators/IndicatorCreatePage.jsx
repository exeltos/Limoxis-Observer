import { useEffect,useState } from 'react'
import { Gauge } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Page } from '../../design-system/Page'
import { EntityRecordShell } from '../../design-system/EntityRecordShell'
import { Button } from '../../design-system/Button'
import { SaveButton } from '../../design-system/SaveButton'
import { useLanguage } from '../../core/i18n/LanguageContext'
import { useTenant } from '../../core/tenant/TenantContext'
import { useFeedback } from '../../core/feedback/FeedbackContext'
import { loadDepartments } from '../management/departmentsService'
import { demoLibrarySeed } from '../management/managementData'
import { IndicatorDefinitionForm,createEmptyIndicatorDefinition,indicatorDefinitionIsValid } from './IndicatorDefinitionForm'
import { saveIndicatorDefinition } from './indicatorDefinitionService'

export function IndicatorCreatePage(){
 const navigate=useNavigate();const {language}=useLanguage();const el=language==='el';const {tenant,isDemo}=useTenant();const {notify}=useFeedback()
 const [saving,setSaving]=useState(false),[v,setV]=useState(()=>({...createEmptyIndicatorDefinition(),category:'quality',calculationType:'manual',status:'active'})),[departments,setDepartments]=useState([])
 // loadDepartments is a plain cloud call with no demo awareness — calling it
 // with tenant.id='demo-hospital' (not a real UUID) fails with a Postgres 400.
 useEffect(()=>{let active=true;if(isDemo){setDepartments(demoLibrarySeed.departments.map(([elName,enName])=>({id:elName,name:elName,nameEn:enName})));return()=>{active=false}}if(!tenant?.id)return;loadDepartments(tenant.id).then(rows=>{if(active)setDepartments((rows||[]).filter(x=>x.is_active!==false))}).catch(()=>{if(active)setDepartments([])});return()=>{active=false}},[isDemo,tenant?.id])
 const valid=indicatorDefinitionIsValid(v)
 async function save(){if(!valid||saving)return;setSaving(true);try{await saveIndicatorDefinition(tenant.id,v);notify(el?'Ο νέος δείκτης δημιουργήθηκε.':'Indicator created.','success');navigate('/indicators',{replace:true})}catch(error){notify(error?.message||(el?'Δεν ήταν δυνατή η δημιουργία του δείκτη.':'Could not create indicator.'),'error')}finally{setSaving(false)}}
 return <Page fill><EntityRecordShell className="indicator-create-shell workspace-fill" avatar={<Gauge size={19}/>} eyebrow={el?'Δείκτες':'Indicators'} title={el?'Νέος δείκτης':'New indicator'} subtitle={el?'Δημιουργία οργανωτικού δείκτη':'Create organization indicator'} tabs={[]} activeTab="" onTabChange={()=>{}} onBack={()=>navigate('/indicators')}>
  <div className="record-section indicator-create-form">
   <IndicatorDefinitionForm value={v} onChange={setV} language={language} departments={departments}/>
   <div className="inline-edit-footer"><Button variant="secondary" onClick={()=>navigate('/indicators')}>{el?'Ακύρωση':'Cancel'}</Button><SaveButton loading={saving} disabled={!valid||saving} onClick={save}>{el?'Αποθήκευση':'Save'}</SaveButton></div>
  </div>
 </EntityRecordShell></Page>
}
