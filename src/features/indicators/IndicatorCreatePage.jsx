import { useState } from 'react'
import { Gauge } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Page } from '../../design-system/Page'
import { EntityRecordShell } from '../../design-system/EntityRecordShell'
import { Button } from '../../design-system/Button'
import { SaveButton } from '../../design-system/SaveButton'
import { useLanguage } from '../../core/i18n/LanguageContext'
import { useTenant } from '../../core/tenant/TenantContext'
import { useFeedback } from '../../core/feedback/FeedbackContext'
import { IndicatorDefinitionForm,createEmptyIndicatorDefinition,indicatorDefinitionIsValid } from './IndicatorDefinitionForm'
import { saveIndicatorDefinition } from './indicatorDefinitionService'

export function IndicatorCreatePage(){
 const navigate=useNavigate();const {language}=useLanguage();const el=language==='el';const {tenant}=useTenant();const {notify}=useFeedback()
 const [saving,setSaving]=useState(false),[v,setV]=useState(()=>({...createEmptyIndicatorDefinition(),category:'quality',calculationType:'manual',status:'active'}))
 const valid=indicatorDefinitionIsValid(v)
 async function save(){if(!valid||saving)return;setSaving(true);try{await saveIndicatorDefinition(tenant.id,v);notify(el?'Ο νέος δείκτης δημιουργήθηκε.':'Indicator created.','success');navigate('/indicators',{replace:true})}catch(error){notify(error?.message||(el?'Δεν ήταν δυνατή η δημιουργία του δείκτη.':'Could not create indicator.'),'error')}finally{setSaving(false)}}
 return <Page fill><EntityRecordShell className="indicator-create-shell workspace-fill" avatar={<Gauge size={19}/>} eyebrow={el?'Δείκτες':'Indicators'} title={el?'Νέος δείκτης':'New indicator'} subtitle={el?'Δημιουργία οργανωτικού δείκτη':'Create organization indicator'} tabs={[]} activeTab="" onTabChange={()=>{}} onBack={()=>navigate('/indicators')}>
  <div className="record-section indicator-create-form">
   <IndicatorDefinitionForm value={v} onChange={setV} language={language}/>
   <div className="inline-edit-footer"><Button variant="secondary" onClick={()=>navigate('/indicators')}>{el?'Ακύρωση':'Cancel'}</Button><SaveButton loading={saving} disabled={!valid||saving} onClick={save}>{el?'Αποθήκευση':'Save'}</SaveButton></div>
  </div>
 </EntityRecordShell></Page>
}
