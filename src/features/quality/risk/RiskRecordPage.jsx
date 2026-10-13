import { useEffect,useMemo,useState } from 'react'
import { useLocation,useNavigate,useParams } from 'react-router-dom'
import { Page } from '../../../design-system/Page'
import { useLanguage } from '../../../core/i18n/LanguageContext'
import { useTenant } from '../../../core/tenant/TenantContext'
import { useFeedback } from '../../../core/feedback/FeedbackContext'
import { can,CAPABILITIES,ROLES } from '../../../core/permissions/roles'
import { loadRiskAssessment,nextLineageKey,saveRisk } from './riskService'
import { suggestJci } from './riskModel'
import { loadIndicatorValues } from './riskIndicators'
import { RiskEditor } from './RiskEditor'
import { L } from './riskUi'
import './riskAssessment.css'

const EDITABLE=['draft','under_review']

// /quality/risks/:assessmentCode/:riskKey — one risk on its own page; "new" adds one.
export function RiskRecordPage(){
 const {assessmentCode,riskKey}=useParams()
 const navigate=useNavigate()
 const location=useLocation()
 const {language}=useLanguage();const en=language==='en'
 const {role,membership,tenant,actualRole,isRolePreview}=useTenant()
 const {notify}=useFeedback()
 const organizationId=tenant?.id
 const addOns=membership?.capabilities??[];const custom=membership?.customCapabilities??[]
 const canManage=(!isRolePreview&&actualRole===ROLES.PLATFORM_OWNER)||can(role,CAPABILITIES.MANAGE_QUALITY,addOns,custom)
 const [assessment,setAssessment]=useState(null)
 const [loading,setLoading]=useState(true)
 const [saving,setSaving]=useState(false)
 const [indicatorValues,setIndicatorValues]=useState(null)
 useEffect(()=>{let active=true;setLoading(true);loadRiskAssessment(organizationId,assessmentCode).then(a=>{if(active)setAssessment(a)}).catch(()=>{if(active)setAssessment(null)}).finally(()=>{if(active)setLoading(false)});return()=>{active=false}},[organizationId,assessmentCode])
 useEffect(()=>{let active=true;loadIndicatorValues(organizationId).then(v=>{if(active)setIndicatorValues(v)}).catch(()=>{if(active)setIndicatorValues(new Map())});return()=>{active=false}},[organizationId])
 const risks=useMemo(()=>assessment?.risks||[],[assessment])
 const processes=useMemo(()=>[...new Set(risks.map(r=>r.process).filter(Boolean))].sort(),[risks])
 const isNew=riskKey==='new'
 const risk=isNew?{section:'clinical'}:risks.find(r=>r.lineageKey===riskKey)
 // Back to the assessment, on the tab the risk was opened from.
 const back=()=>navigate(`/quality/risks/${assessmentCode}`,{replace:true,state:location.state?.returnState||{riskTab:location.state?.riskTab||'register'}})

 if(loading)return <Page title={L(en,'Κίνδυνος','Risk')}><div className="inline-empty">{L(en,'Φόρτωση…','Loading…')}</div></Page>
 if(!assessment||!risk)return <Page title={L(en,'Κίνδυνος','Risk')}><div className="inline-empty">{L(en,'Ο κίνδυνος δεν βρέθηκε.','The risk was not found.')}</div></Page>
 const canEdit=canManage&&EDITABLE.includes(assessment.status)

 async function save(draft){
  setSaving(true)
  try{
   await saveRisk(organizationId,assessment.id,{...draft,lineageKey:draft.lineageKey||nextLineageKey(risks),position:draft.position??risks.length,jci:draft.jci||suggestJci(draft.hazard,draft.process)})
   notify(L(en,'Ο κίνδυνος αποθηκεύτηκε.','The risk was saved.'),'success');back()
  }catch{notify(L(en,'Δεν ήταν δυνατή η αποθήκευση του κινδύνου.','Could not save the risk.'),'error')}finally{setSaving(false)}
 }
 return <Page fill><RiskEditor key={riskKey} risk={risk} processes={processes} en={en} readOnly={!canEdit} saving={saving} indicatorValues={indicatorValues} assessmentLabel={assessment.periodLabel} onClose={back} onSave={save}/></Page>
}
