import { useEffect,useMemo,useRef,useState } from 'react'
import { useParams,useSearchParams } from 'react-router-dom'
import { BarChart3,BookOpen,CheckCircle2,ClipboardList,GitCompareArrows,Lightbulb,RotateCcw,Send,ShieldAlert,Archive,Trash2,Info,Pencil,Printer,Download,Gauge } from 'lucide-react'
import { Page } from '../../../design-system/Page'
import { EntityRecordShell } from '../../../design-system/EntityRecordShell'
import { OverflowMenu } from '../../../design-system/OverflowMenu'
import { ObserverDialog,DialogActions } from '../../../design-system/ObserverDialog'
import { ManualDateField } from '../../../design-system/ManualDateField'
import { printElement } from '../../../design-system/printElement'
import { useLanguage } from '../../../core/i18n/LanguageContext'
import { useTenant } from '../../../core/tenant/TenantContext'
import { useAuth } from '../../../core/auth/AuthContext'
import { useFeedback } from '../../../core/feedback/FeedbackContext'
import { can,CAPABILITIES,ROLES } from '../../../core/permissions/roles'
import { useContextualNavigation } from '../../../core/navigation/useContextualNavigation'
import { auditActorFromAuth,auditEvent } from '../../../core/audit/actor'
import { exportRegistry } from '../../../core/export/registryExports'
import { deleteOpportunity,deleteRisk,deleteRiskAssessment,loadRiskAssessment,loadRiskAssessments,nextLineageKey,saveOpportunity,saveRisk,saveRiskAssessment } from './riskService'
import { levelLabel,scored,summarizeRisks,suggestJci } from './riskModel'
import { RiskRegister } from './RiskRegister'
import { RiskEditorDialog } from './RiskEditorDialog'
import { RiskAnalysis } from './RiskAnalysis'
import { RiskComparison } from './RiskComparison'
import { RiskOpportunities } from './RiskOpportunities'
import { RiskMethodology } from './RiskMethodology'
import { RiskReport } from './RiskReport'
import { AssessmentDetailsDialog } from './RiskAssessmentsPanel'
import { LinkIndicatorsDialog } from './RiskIndicatorsUi'
import { loadIndicatorValues } from './riskIndicators'
import { L,PERIOD_KINDS,fmtDate,statusLabel,statusTone,txt } from './riskUi'
import './riskAssessment.css'

const EDITABLE=['draft','under_review']

export function RiskAssessmentPage(){
 const {assessmentCode}=useParams()
 const [search,setSearch]=useSearchParams()
 const {language,locale}=useLanguage();const en=language==='en'
 const {role,membership,tenant,actualRole,isRolePreview}=useTenant()
 const {profile,user}=useAuth()
 const {notify}=useFeedback()
 const {goTo,goBack}=useContextualNavigation('/quality')
 const actor=useMemo(()=>auditActorFromAuth({profile,user}),[profile,user])
 const organizationId=tenant?.id
 const addOns=membership?.capabilities??[];const custom=membership?.customCapabilities??[]
 const canManage=(!isRolePreview&&actualRole===ROLES.PLATFORM_OWNER)||can(role,CAPABILITIES.MANAGE_QUALITY,addOns,custom)
 const [assessment,setAssessment]=useState(null)
 const [all,setAll]=useState([])
 const [loading,setLoading]=useState(true)
 const [tab,setTab]=useState('register')
 const [editing,setEditing]=useState(null)
 const [cell,setCell]=useState(null)
 const [confirm,setConfirm]=useState(null)
 const [approving,setApproving]=useState(false)
 const [detailsOpen,setDetailsOpen]=useState(false)
 const [saving,setSaving]=useState(false)
 const [indicatorValues,setIndicatorValues]=useState(null)
 const [linking,setLinking]=useState(false)
 const reportRef=useRef(null)

 useEffect(()=>{let active=true;setLoading(true)
  Promise.all([loadRiskAssessment(organizationId,assessmentCode),loadRiskAssessments(organizationId).catch(()=>[])])
   .then(([one,list])=>{if(active){setAssessment(one);setAll(list)}}).catch(()=>{if(active)setAssessment(null)}).finally(()=>{if(active)setLoading(false)})
  return()=>{active=false}},[organizationId,assessmentCode])
 // The indicators of the Indicators module, with their 90-day values; the page works without them.
 useEffect(()=>{let active=true;loadIndicatorValues(organizationId).then(v=>{if(active)setIndicatorValues(v)}).catch(()=>{if(active)setIndicatorValues(new Map())});return()=>{active=false}},[organizationId])
 // A CAPA links back here with ?risk=R001: open that risk.
 useEffect(()=>{const key=search.get('risk');if(!key||!assessment)return;const found=(assessment.risks||[]).find(r=>r.lineageKey===key);if(found)setEditing(found);setSearch(p=>{p.delete('risk');return p},{replace:true})},[assessment,search,setSearch])

 const risks=useMemo(()=>assessment?.risks||[],[assessment])
 const summary=useMemo(()=>summarizeRisks(risks),[risks])
 const processes=useMemo(()=>[...new Set(risks.map(r=>r.process).filter(Boolean))].sort(),[risks])
 const comparable=useMemo(()=>all.map(a=>a.id===assessment?.id?{...a,risks}:a),[all,assessment?.id,risks])
 const previous=useMemo(()=>{if(!assessment)return null;const others=comparable.filter(a=>a.id!==assessment.id);return others.find(a=>a.id===assessment.sourceAssessmentId)||others.filter(a=>String(a.assessedOn)<String(assessment.assessedOn)).sort((a,b)=>String(b.assessedOn).localeCompare(String(a.assessedOn)))[0]||null},[comparable,assessment])

 if(loading)return <Page title={L(en,'Εκτίμηση κινδύνου','Risk assessment')}><div className="inline-empty">{L(en,'Φόρτωση…','Loading…')}</div></Page>
 if(!assessment)return <Page title={L(en,'Εκτίμηση κινδύνου','Risk assessment')}><div className="inline-empty">{L(en,'Η εκτίμηση δεν βρέθηκε.','The assessment was not found.')}</div></Page>
 const canEdit=canManage&&EDITABLE.includes(assessment.status)

 async function persistAssessment(change,action){
  setSaving(true)
  try{const next={...assessment,...change,history:[...(assessment.history||[]),auditEvent(action,{actor})]};const saved=await saveRiskAssessment(organizationId,next);setAssessment(current=>({...current,...saved,risks:current.risks,opportunities:current.opportunities}));notify(L(en,'Η εκτίμηση ενημερώθηκε.','The assessment was updated.'),'success');return true}
  catch{notify(L(en,'Δεν ήταν δυνατή η αποθήκευση.','Could not save.'),'error');return false}finally{setSaving(false)}
 }
 async function saveOneRisk(draft){
  setSaving(true)
  try{const risk={...draft,lineageKey:draft.lineageKey||nextLineageKey(risks),jci:draft.jci||suggestJci(draft.hazard,draft.process)};const saved=await saveRisk(organizationId,assessment.id,risk);setAssessment(current=>{const list=[...(current.risks||[])];const i=list.findIndex(r=>r.id===saved.id);if(i<0)list.push(saved);else list[i]=saved;return {...current,risks:list}});setEditing(null);notify(L(en,'Ο κίνδυνος αποθηκεύτηκε.','The risk was saved.'),'success')}
  catch{notify(L(en,'Δεν ήταν δυνατή η αποθήκευση του κινδύνου.','Could not save the risk.'),'error')}finally{setSaving(false)}
 }
 // Bulk linking: adds the confirmed indicators to each risk, keeping the ones it had.
 async function linkIndicators(changes){
  setSaving(true)
  try{
   const saved=[]
   for(const {risk,keys} of changes)saved.push(await saveRisk(organizationId,assessment.id,{...risk,indicatorKeys:[...new Set([...(risk.indicatorKeys||[]),...keys])]}))
   setAssessment(current=>({...current,risks:current.risks.map(r=>saved.find(s=>s.id===r.id)||r)}))
   setLinking(false);notify(L(en,`Συνδέθηκαν δείκτες σε ${saved.length} κινδύνους.`,`Indicators linked to ${saved.length} risks.`),'success')
  }catch{notify(L(en,'Δεν ήταν δυνατή η σύνδεση των δεικτών.','Could not link the indicators.'),'error')}finally{setSaving(false)}
 }
 async function removeRisk(risk){try{await deleteRisk(organizationId,assessment.id,risk.id);setAssessment(current=>({...current,risks:current.risks.filter(r=>r.id!==risk.id)}));notify(L(en,'Ο κίνδυνος διαγράφηκε.','The risk was deleted.'),'success')}catch{notify(L(en,'Δεν ήταν δυνατή η διαγραφή.','Could not delete.'),'error')}}
 async function saveOneOpportunity(item){try{const saved=await saveOpportunity(organizationId,assessment.id,item);setAssessment(current=>{const list=[...(current.opportunities||[])];const i=list.findIndex(o=>o.id===saved.id);if(i<0)list.push(saved);else list[i]=saved;return {...current,opportunities:list}})}catch{notify(L(en,'Δεν ήταν δυνατή η αποθήκευση.','Could not save.'),'error')}}
 async function removeOpportunity(item){try{await deleteOpportunity(organizationId,assessment.id,item.id);setAssessment(current=>({...current,opportunities:current.opportunities.filter(o=>o.id!==item.id)}))}catch{notify(L(en,'Δεν ήταν δυνατή η διαγραφή.','Could not delete.'),'error')}}
 async function removeAssessment(){try{await deleteRiskAssessment(organizationId,assessment);goBack()}catch{notify(L(en,'Δεν ήταν δυνατή η διαγραφή.','Could not delete.'),'error')}}
 function createCapa(risk){
  const s=scored(risk)
  goTo('/quality/capas/new',{registry:'quality.capas',state:{qualitySource:{source:'other',sourceId:`RISK:${assessment.code}:${risk.lineageKey}`,title:L(en,`Μείωση κινδύνου: ${txt(risk,'hazard',en)}`,`Risk reduction: ${txt(risk,'hazard',en)}`),description:[`${assessment.periodLabel} · ${risk.lineageKey} · ${txt(risk,'process',en)}`,`${L(en,'Υπολειπόμενος κίνδυνος','Residual risk')}: ${s.residual.score??'—'} (${levelLabel(s.residual.level,en)})`,txt(risk,'additionalMeasures',en)].filter(Boolean).join('\n'),priority:s.residual.level==='very_high'?'critical':s.residual.level==='high'?'high':'medium',dueDate:risk.dueDate||undefined}}})
 }
 function exportCsv(){
  const headers=en?['Code','Section','Process','Applies to','Risk','Inherent L','Inherent C','Inherent score','Inherent level','Existing controls','Residual L','Residual C','Residual score','Residual level','Additional measures','Owner','Due date','Review frequency','Indicator','Target L','Target C','Target score','Target level','JCI','JCI reference','FMEA']:['Κωδικός','Ενότητα','Διεργασία','Τμήμα / αφορά','Κίνδυνος','Εγγενής L','Εγγενής C','Εγγενής βαθμός','Εγγενής κατηγορία','Προληπτικά μέτρα','Υπολειπόμενος L','Υπολειπόμενος C','Υπολειπόμενος βαθμός','Υπολειπόμενη κατηγορία','Πρόσθετα μέτρα','Υπεύθυνος','Προθεσμία','Συχνότητα ελέγχου','Δείκτης','Στόχος L','Στόχος C','Βαθμός στόχου','Κατηγορία στόχου','JCI','Αναφορά JCI','FMEA']
  exportRegistry({name:`${en?'risk-assessment':'ektimisi-kindynou'}_${assessment.periodLabel}`,headers,rows:risks.map(r=>{const s=scored(r);return [r.lineageKey,r.section,txt(r,'process',en),txt(r,'scope',en),txt(r,'hazard',en),s.inherent.l,s.inherent.c,s.inherent.score,levelLabel(s.inherent.level,en),txt(r,'existingControls',en),s.residual.l,s.residual.c,s.residual.score,levelLabel(s.residual.level,en),txt(r,'additionalMeasures',en),txt(r,'owner',en),r.dueDate||'',txt(r,'reviewFrequency',en),r.indicator,s.target.l,s.target.c,s.target.score,levelLabel(s.target.level,en),r.jci,r.jciReference,r.prioritized?'✓':'']})})
 }
 const print=()=>{if(!printElement(reportRef.current,{title:`${assessment.formCode||''} ${assessment.periodLabel}`.trim()}))notify(L(en,'Επιτρέψτε τα αναδυόμενα παράθυρα για την εκτύπωση.','Allow pop-ups to print.'),'error')}

 const statusItems=canManage?[
  canEdit&&{id:'indicators',label:L(en,'Αντιστοίχιση δεικτών','Link indicators'),icon:Gauge,onClick:()=>setLinking(true)},
  canEdit&&{id:'details',label:L(en,'Στοιχεία εκτίμησης','Assessment details'),icon:Pencil,onClick:()=>setDetailsOpen(true)},
  assessment.status==='draft'&&{id:'review',label:L(en,'Υποβολή για έλεγχο','Submit for review'),icon:Send,onClick:()=>persistAssessment({status:'under_review'},'riskAssessmentSubmitted')},
  EDITABLE.includes(assessment.status)&&{id:'approve',label:L(en,'Έγκριση','Approve'),icon:CheckCircle2,onClick:()=>setApproving(true)},
  assessment.status!=='draft'&&{id:'reopen',label:L(en,'Επαναφορά σε πρόχειρο','Back to draft'),icon:RotateCcw,onClick:()=>persistAssessment({status:'draft',approvedByLabel:'',approvedOn:null},'riskAssessmentReopened')},
  assessment.status==='approved'&&{id:'archive',label:L(en,'Αρχειοθέτηση','Archive'),icon:Archive,onClick:()=>persistAssessment({status:'archived'},'riskAssessmentArchived')},
  assessment.status==='draft'&&{id:'delete',label:L(en,'Διαγραφή εκτίμησης','Delete assessment'),icon:Trash2,tone:'danger',separatorBefore:true,onClick:()=>setConfirm({kind:'assessment'})},
 ].filter(Boolean):[]
 // Print, export and the status flow share one "…" menu.
 const menuItems=[
  {id:'print',label:L(en,'Εκτύπωση αναφοράς','Print the report'),icon:Printer,onClick:print},
  {id:'export',label:L(en,'Λήψη μητρώου (Excel)','Download the register (Excel)'),icon:Download,onClick:exportCsv},
  ...statusItems.map((item,i)=>i===0?{...item,separatorBefore:true}:item),
 ]
 const menu=<OverflowMenu label={L(en,'Ενέργειες εκτίμησης','Assessment actions')} items={menuItems}/>

 const tabs=[
  {id:'register',label:L(en,`Μητρώο (${risks.length})`,`Register (${risks.length})`),icon:ClipboardList},
  {id:'analysis',label:L(en,'Ανάλυση','Analysis'),icon:BarChart3},
  {id:'comparison',label:L(en,'Σύγκριση περιόδων','Period comparison'),icon:GitCompareArrows},
  {id:'opportunities',label:L(en,'Ευκαιρίες','Opportunities'),icon:Lightbulb},
  {id:'methodology',label:L(en,'Μεθοδολογία','Method'),icon:BookOpen},
  {id:'details',label:L(en,'Στοιχεία','Details'),icon:Info},
 ]
 return <Page fill><EntityRecordShell
  className="quality-record-shell risk-assessment-shell workspace-fill"
  avatar={<ShieldAlert size={19}/>}
  eyebrow={assessment.code}
  title={txt(assessment,'title',en)}
  subtitle={[assessment.formCode,assessment.periodLabel,fmtDate(assessment.assessedOn,locale)].filter(Boolean).join(' · ')}
  status={<span className={`status-badge ${statusTone(assessment.status)}`}>{statusLabel(assessment.status,en)}</span>}
  tabs={tabs} activeTab={tab} onTabChange={setTab} onBack={goBack} backLabel={L(en,'Πίσω στο Κέντρο Ποιότητας','Back to the Quality Center')}>
  <div className="risk-assessment-body">
   {/* The record shell keeps only edit/delete from headerActions, so the "…" menu sits here: in the register's toolbar, or on its own line in the other tabs. */}
   {!canEdit&&canManage&&<p className="risk-locked">{L(en,`Η εκτίμηση είναι «${statusLabel(assessment.status,en)}» και δεν αλλάζει. Για αλλαγές: «Επαναφορά σε πρόχειρο».`,`The assessment is “${statusLabel(assessment.status,en)}” and locked. To change it: “Back to draft”.`)}</p>}
   {tab!=='register'&&<div className="risk-page-bar">{menu}</div>}
   {tab==='register'&&<RiskRegister risks={risks} en={en} canEdit={canEdit} cell={cell} onClearCell={()=>setCell(null)} onOpen={setEditing} onCreate={()=>setEditing({section:'clinical'})} onDelete={risk=>setConfirm({kind:'risk',risk})} onCreateCapa={createCapa} actions={menu} indicatorValues={indicatorValues}/>}
   {tab==='analysis'&&<RiskAnalysis summary={summary} risks={risks} indicatorValues={indicatorValues} en={en} onOpen={setEditing} onCell={c=>{setCell(c);setTab('register')}}/>}
   {tab==='comparison'&&<RiskComparison assessment={{...assessment,risks}} assessments={comparable} en={en} locale={locale} onOpen={setEditing}/>}
   {tab==='opportunities'&&<RiskOpportunities items={assessment.opportunities||[]} en={en} canEdit={canEdit} onSave={saveOneOpportunity} onDelete={removeOpportunity}/>}
   {tab==='methodology'&&<RiskMethodology en={en}/>}
   {tab==='details'&&<AssessmentDetails assessment={assessment} en={en} locale={locale}/>}
  </div>
  <div className="risk-print-host" aria-hidden="true"><RiskReport ref={reportRef} assessment={{...assessment,risks}} summary={summary} previous={previous} organizationName={tenant?.name||''} en={en} locale={locale}/></div>
  {linking&&<LinkIndicatorsDialog risks={risks} values={indicatorValues||new Map()} en={en} saving={saving} onClose={()=>setLinking(false)} onSave={linkIndicators}/>}
  {editing&&<RiskEditorDialog indicatorValues={indicatorValues} risk={editing} processes={processes} en={en} readOnly={!canEdit} saving={saving} onClose={()=>setEditing(null)} onSave={saveOneRisk}/>}
  {detailsOpen&&<AssessmentDetailsDialog initial={assessment} en={en} onClose={()=>setDetailsOpen(false)} onSave={async draft=>{if(await persistAssessment(draft,'riskAssessmentUpdated'))setDetailsOpen(false)}}/>}
  {approving&&<ApproveDialog en={en} onClose={()=>setApproving(false)} onSave={async ({by,on})=>{if(await persistAssessment({status:'approved',approvedByLabel:by,approvedOn:on},'riskAssessmentApproved'))setApproving(false)}}/>}
  {confirm&&<ObserverDialog width="compact" title={confirm.kind==='assessment'?L(en,'Διαγραφή εκτίμησης','Delete assessment'):L(en,'Διαγραφή κινδύνου','Delete risk')} onClose={()=>setConfirm(null)} footer={<DialogActions onCancel={()=>setConfirm(null)} showCancel onSave={async()=>{const c=confirm;setConfirm(null);if(c.kind==='assessment')await removeAssessment();else await removeRisk(c.risk)}} saveLabel={L(en,'Διαγραφή','Delete')}/>}>
   <p>{confirm.kind==='assessment'?L(en,`Θα διαγραφεί η εκτίμηση ${assessment.periodLabel} με ${risks.length} κινδύνους.`,`The ${assessment.periodLabel} assessment with ${risks.length} risks will be deleted.`):`${confirm.risk.lineageKey} · ${txt(confirm.risk,'hazard',en)}`}</p>
  </ObserverDialog>}
 </EntityRecordShell></Page>
}

function ApproveDialog({en,onClose,onSave}){
 const [by,setBy]=useState('')
 const [on,setOn]=useState(new Date().toISOString().slice(0,10))
 return <ObserverDialog width="compact" title={L(en,'Έγκριση εκτίμησης','Approve assessment')} subtitle={L(en,'Μετά την έγκριση η εκτίμηση κλειδώνει.','After approval the assessment is locked.')} onClose={onClose} footer={<DialogActions onCancel={onClose} showCancel onSave={()=>onSave({by,on})} disabled={!by.trim()||!on} saveLabel={L(en,'Έγκριση','Approve')}/>}>
  <div className="risk-editor-grid risk-editor-grid-single"><label className="risk-field"><span>{L(en,'Εγκρίθηκε από','Approved by')}</span><input value={by} onChange={e=>setBy(e.target.value)} placeholder={L(en,'π.χ. Επιτροπή Ποιότητας','e.g. Quality Committee')}/></label><ManualDateField label={L(en,'Ημερομηνία έγκρισης','Approval date')} value={on} onChange={setOn}/></div>
 </ObserverDialog>
}

function AssessmentDetails({assessment,en,locale}){
 const rows=[[L(en,'Κωδικός εντύπου','Form code'),assessment.formCode],[L(en,'Περίοδος','Period'),`${assessment.periodLabel} · ${PERIOD_KINDS[assessment.periodKind]?.[en?1:0]||''}`],[L(en,'Ημερομηνία αξιολόγησης','Assessment date'),fmtDate(assessment.assessedOn,locale)],[L(en,'Επόμενη αξιολόγηση','Next assessment'),fmtDate(assessment.nextReviewOn,locale)],[L(en,'Υπεύθυνος αξιολόγησης','Assessed by'),assessment.assessorLabel],[L(en,'Έγκριση','Approval'),assessment.approvedByLabel?`${assessment.approvedByLabel} · ${fmtDate(assessment.approvedOn,locale)}`:''],[L(en,'Πεδίο εφαρμογής / σημειώσεις','Scope / notes'),assessment.scopeNote]]
 return <div className="risk-details">
  <dl className="risk-details-grid">{rows.map(([k,v])=><div key={k}><dt>{k}</dt><dd>{v||'—'}</dd></div>)}</dl>
  <section className="risk-panel"><header><h3>{L(en,'Ιστορικό','History')}</h3></header>{(assessment.history||[]).length?<ol className="risk-history">{[...assessment.history].reverse().map(h=><li key={h.id}><strong>{HISTORY[h.action]?.[en?1:0]||h.action}</strong><span>{h.actor} · {new Date(h.at).toLocaleString(locale)}</span></li>)}</ol>:<p className="risk-empty-note">{L(en,'Δεν υπάρχουν καταγραφές.','No entries.')}</p>}</section>
 </div>
}
const HISTORY={riskAssessmentCreated:['Δημιουργία εκτίμησης','Assessment created'],riskAssessmentImported:['Εισαγωγή από Excel','Imported from Excel'],riskAssessmentSubmitted:['Υποβολή για έλεγχο','Submitted for review'],riskAssessmentApproved:['Έγκριση','Approved'],riskAssessmentReopened:['Επαναφορά σε πρόχειρο','Back to draft'],riskAssessmentArchived:['Αρχειοθέτηση','Archived'],riskAssessmentUpdated:['Αλλαγή στοιχείων','Details changed']}
