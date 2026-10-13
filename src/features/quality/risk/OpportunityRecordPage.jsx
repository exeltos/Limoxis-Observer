import { useEffect,useState } from 'react'
import { useNavigate,useParams } from 'react-router-dom'
import { Page } from '../../../design-system/Page'
import { useLanguage } from '../../../core/i18n/LanguageContext'
import { useTenant } from '../../../core/tenant/TenantContext'
import { useFeedback } from '../../../core/feedback/FeedbackContext'
import { can,CAPABILITIES,ROLES } from '../../../core/permissions/roles'
import { loadRiskAssessment,saveOpportunity } from './riskService'
import { opportunityCode } from './riskModel'
import { OpportunityEditor } from './OpportunityEditor'
import { L } from './riskUi'
import './riskAssessment.css'

const EDITABLE=['draft','under_review']

// /quality/risks/:assessmentCode/opportunities/:opportunityId — one opportunity on its own page; "new" adds one.
export function OpportunityRecordPage(){
 const {assessmentCode,opportunityId}=useParams()
 const navigate=useNavigate()
 const {language}=useLanguage();const en=language==='en'
 const {role,membership,tenant,actualRole,isRolePreview}=useTenant()
 const {notify}=useFeedback()
 const organizationId=tenant?.id
 const addOns=membership?.capabilities??[];const custom=membership?.customCapabilities??[]
 const canManage=(!isRolePreview&&actualRole===ROLES.PLATFORM_OWNER)||can(role,CAPABILITIES.MANAGE_QUALITY,addOns,custom)
 const [assessment,setAssessment]=useState(null)
 const [loading,setLoading]=useState(true)
 const [saving,setSaving]=useState(false)
 useEffect(()=>{let active=true;setLoading(true);loadRiskAssessment(organizationId,assessmentCode).then(a=>{if(active)setAssessment(a)}).catch(()=>{if(active)setAssessment(null)}).finally(()=>{if(active)setLoading(false)});return()=>{active=false}},[organizationId,assessmentCode])
 const list=assessment?.opportunities||[]
 const isNew=opportunityId==='new'
 const index=list.findIndex(o=>o.id===opportunityId)
 const item=isNew?{}:list[index]
 const back=()=>navigate(`/quality/risks/${assessmentCode}`,{replace:true,state:{riskTab:'opportunities'}})

 if(loading)return <Page title={L(en,'Ευκαιρία','Opportunity')}><div className="inline-empty">{L(en,'Φόρτωση…','Loading…')}</div></Page>
 if(!assessment||!item)return <Page title={L(en,'Ευκαιρία','Opportunity')}><div className="inline-empty">{L(en,'Η ευκαιρία δεν βρέθηκε.','The opportunity was not found.')}</div></Page>
 const canEdit=canManage&&EDITABLE.includes(assessment.status)

 async function save(draft){
  setSaving(true)
  try{
   await saveOpportunity(organizationId,assessment.id,{...draft,position:draft.position??list.length})
   notify(L(en,'Η ευκαιρία αποθηκεύτηκε.','The opportunity was saved.'),'success');back()
  }catch{notify(L(en,'Δεν ήταν δυνατή η αποθήκευση της ευκαιρίας.','Could not save the opportunity.'),'error')}finally{setSaving(false)}
 }
 return <Page fill><OpportunityEditor key={opportunityId} item={item} code={isNew?'':opportunityCode(index)} en={en} readOnly={!canEdit} saving={saving} assessmentLabel={assessment.periodLabel} onClose={back} onSave={save}/></Page>
}
