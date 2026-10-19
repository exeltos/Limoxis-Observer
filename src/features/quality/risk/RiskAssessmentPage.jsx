import { useEffect,useLayoutEffect,useMemo,useRef,useState } from 'react'
import { useLocation,useNavigate,useParams,useSearchParams } from 'react-router-dom'
import { ArrowLeft,BarChart3,BookOpen,CheckCircle2,ClipboardList,GitCompareArrows,Lightbulb,RotateCcw,Send,ShieldAlert,Archive,Trash2,Info,Pencil,Printer,Download,Gauge } from 'lucide-react'
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
import { createRiskAssessment,deleteRiskAssessment,loadRiskAssessment,loadRiskAssessments,saveRisk,saveRiskAssessment } from './riskService'
import { levelLabel,scored,suggestPeriodLabel,summarizeRisks } from './riskModel'
import { RiskRegister } from './RiskRegister'
import { RiskAnalysis } from './RiskAnalysis'
import { RiskComparison } from './RiskComparison'
import { RiskOpportunities } from './RiskOpportunities'
import { RiskMethodology } from './RiskMethodology'
import { RiskReport } from './RiskReport'
import { AssessmentDetailsDialog } from './RiskAssessmentsPanel'
import { RiskAssessmentDetails } from './RiskAssessmentDetails'
import { rememberQualitySection } from '../qualityReturnSection'
import { LinkIndicatorsDialog } from './RiskIndicatorsUi'
import { loadIndicatorValues } from './riskIndicators'
import { AssessmentStatusBadge,L,fmtDate,rememberRow,statusLabel,txt,useReturnedRow } from './riskUi'
import './riskAssessment.css'

const EDITABLE=['draft','under_review']

// The pane that scrolls inside the tab card: the tab's own pane, else its table.
const scrollerOf=el=>el?.querySelector('.risk-tab-scroll')||el?.querySelector('.scroll-table')||null

export function RiskAssessmentPage(){
 const {assessmentCode}=useParams()
 const [search,setSearch]=useSearchParams()
 const {language,locale}=useLanguage();const en=language==='en'
 const {role,membership,tenant,actualRole,isRolePreview}=useTenant()
 const {profile,user}=useAuth()
 const {notify}=useFeedback()
 const {goBack:goBackTo}=useContextualNavigation('/quality')
 // Back to where the user came from; when that is the Quality Center (or unknown), its risk tab.
 const goBack=()=>{if(view.riskOrigin){returnToOrigin();return};const from=location.state?.limoxisFrom?.pathname;if(!from||from==='/quality')rememberQualitySection('risks');goBackTo()}
 const actor=useMemo(()=>auditActorFromAuth({profile,user}),[profile,user])
 const organizationId=tenant?.id
 const addOns=membership?.capabilities??[];const custom=membership?.customCapabilities??[]
 const canManage=(!isRolePreview&&actualRole===ROLES.PLATFORM_OWNER)||can(role,CAPABILITIES.MANAGE_QUALITY,addOns,custom)
 const [assessment,setAssessment]=useState(null)
 const [all,setAll]=useState([])
 const [loading,setLoading]=useState(true)
 const location=useLocation()
 const navigate=useNavigate()
 // Back from a risk returns to the tab it was opened from.
 // The tab, a filter the register was opened with, and where a link came
 // from live in the history state: «Πίσω» and the browser's back button return
 // to the tab, the spot and the item the user started from.
 const view=location.state||{}
 const tab=view.riskTab||'register'
 const preset=view.riskPreset||null
 const cell=preset?.cell||null
 const origin=view.riskOrigin||null
 const setView=(next,push=false)=>navigate(`${location.pathname}${location.search}`,{replace:!push,state:{...view,riskPreset:null,riskOrigin:null,riskScroll:null,...next}})
 const setTab=t=>setView({riskTab:t})
 // The spot is also kept on the entry being left, for the browser's back button.
 const jump=(t,riskPreset,mark)=>{const scroll=scrollerOf(bodyRef.current)?.scrollTop||0;navigate(`${location.pathname}${location.search}`,{replace:true,state:{...view,riskScroll:scroll}});setView({riskTab:t,riskPreset,riskOrigin:{tab,mark,scroll}},true)}
 const pendingScroll=useRef(null)
 const returnToOrigin=()=>{pendingScroll.current=origin.scroll;setView({riskTab:origin.tab,riskMark:origin.mark||null})}
 // Back at the origin, once it has rendered: the same spot on the page.
 useLayoutEffect(()=>{const top=pendingScroll.current??view.riskScroll;if(top==null)return;const scroller=scrollerOf(bodyRef.current);if(scroller)scroller.scrollTop=top;pendingScroll.current=null},[tab,location.key,view.riskScroll])
 const [confirm,setConfirm]=useState(null)
 const [approving,setApproving]=useState(false)
 const [detailsOpen,setDetailsOpen]=useState(false)
 const [creatingNext,setCreatingNext]=useState(false)
 const [saving,setSaving]=useState(false)
 const [indicatorValues,setIndicatorValues]=useState(null)
 const [linking,setLinking]=useState(false)
 const reportRef=useRef(null)
 const bodyRef=useRef(null)
 // The risk and the opportunity last opened stay highlighted on the way back.
 const riskRow=useReturnedRow(`limoxis.quality.risk.returned.${assessmentCode}`)
 const opportunityRow=useReturnedRow(`limoxis.quality.opportunity.returned.${assessmentCode}`)
 useEffect(()=>{if(!loading)bodyRef.current?.querySelector('.registry-row-returned')?.scrollIntoView?.({block:'nearest'})},[loading])

 useEffect(()=>{let active=true;setLoading(true)
  Promise.all([loadRiskAssessment(organizationId,assessmentCode),loadRiskAssessments(organizationId).catch(()=>[])])
   .then(([one,list])=>{if(active){setAssessment(one);setAll(list)}}).catch(()=>{if(active)setAssessment(null)}).finally(()=>{if(active)setLoading(false)})
  return()=>{active=false}},[organizationId,assessmentCode])
 // The indicators of the Indicators module, with their 90-day values; the page works without them.
 useEffect(()=>{let active=true;loadIndicatorValues(organizationId).then(v=>{if(active)setIndicatorValues(v)}).catch(()=>{if(active)setIndicatorValues(new Map())});return()=>{active=false}},[organizationId])
 // A CAPA links back here with ?risk=R001: open that risk.
 useEffect(()=>{const key=search.get('risk');if(!key||!assessment)return;if((assessment.risks||[]).some(r=>r.lineageKey===key))navigate(`/quality/risks/${assessment.code}/${key}`,{replace:true});else setSearch(p=>{p.delete('risk');return p},{replace:true})},[assessment,search,setSearch,navigate])

 const risks=useMemo(()=>assessment?.risks||[],[assessment])
 const summary=useMemo(()=>summarizeRisks(risks),[risks])
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
 const openRisk=risk=>{if((risks||[]).some(r=>r.lineageKey===risk.lineageKey)){riskRow.remember(risk.lineageKey);navigate(`/quality/risks/${assessment.code}/${risk.lineageKey}`,{state:{riskTab:tab,returnState:view}})}}
 // The next period, with this assessment's risks carried over to be reassessed.
 async function createNext(draft,carryFrom){
  try{const created=await createRiskAssessment(organizationId,{...draft,history:[auditEvent('riskAssessmentCreated',{actor})]},{carryFrom});setCreatingNext(false);navigate(`/quality/risks/${created.code}`)}
  catch{notify(L(en,'Δεν ήταν δυνατή η δημιουργία της εκτίμησης.','Could not create the assessment.'),'error')}
 }
 async function removeAssessment(){try{await deleteRiskAssessment(organizationId,assessment);goBack()}catch{notify(L(en,'Δεν ήταν δυνατή η διαγραφή.','Could not delete.'),'error')}}
 function exportCsv(){
  const headers=en?['Code','Section','Process','Applies to','Risk','Inherent L','Inherent C','Inherent score','Inherent level','Existing controls','Residual L','Residual C','Residual score','Residual level','Additional measures','Owner','Due date','Review frequency','Indicator','Target L','Target C','Target score','Target level','JCI','JCI reference','FMEA']:['Κωδικός','Ενότητα','Διεργασία','Τμήμα / αφορά','Κίνδυνος','Εγγενής L','Εγγενής C','Εγγενής βαθμός','Εγγενής κατηγορία','Προληπτικά μέτρα','Υπολειπόμενος L','Υπολειπόμενος C','Υπολειπόμενος βαθμός','Υπολειπόμενη κατηγορία','Πρόσθετα μέτρα','Υπεύθυνος','Προθεσμία','Συχνότητα ελέγχου','Δείκτης','Στόχος L','Στόχος C','Βαθμός στόχου','Κατηγορία στόχου','JCI','Αναφορά JCI','FMEA']
  exportRegistry({name:`${en?'risk-assessment':'ektimisi-kindynou'}_${assessment.periodLabel}`,headers,rows:risks.map(r=>{const s=scored(r);return [r.lineageKey,r.section,txt(r,'process',en),txt(r,'scope',en),txt(r,'hazard',en),s.inherent.l,s.inherent.c,s.inherent.score,levelLabel(s.inherent.level,en),txt(r,'existingControls',en),s.residual.l,s.residual.c,s.residual.score,levelLabel(s.residual.level,en),txt(r,'additionalMeasures',en),txt(r,'owner',en),r.dueDate||'',txt(r,'reviewFrequency',en),r.indicator,s.target.l,s.target.c,s.target.score,levelLabel(s.target.level,en),r.jci,r.jciReference,r.prioritized?'✓':'']})})
 }
 const print=()=>{if(!printElement(reportRef.current,{title:`${assessment.formCode||''} ${assessment.periodLabel}`.trim()}))notify(L(en,'Επιτρέψτε τα αναδυόμενα παράθυρα για την εκτύπωση.','Allow pop-ups to print.'),'error')}

 const statusItems=canManage?[
  canEdit&&{id:'indicators',label:L(en,'Αντιστοίχιση δεικτών','Link indicators'),icon:Gauge,onClick:()=>setLinking(true)},
  canEdit&&{id:'details',label:L(en,'Επεξεργασία στοιχείων','Edit details'),icon:Pencil,onClick:()=>setDetailsOpen(true)},
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
 // The next step of the approval cycle, offered on the «Στοιχεία» tab.
 const nextStep=statusItems.find(item=>item.id===(assessment.status==='draft'?'review':assessment.status==='under_review'?'approve':assessment.status==='approved'?'archive':''))||null
 const menu=<OverflowMenu label={L(en,'Ενέργειες εκτίμησης','Assessment actions')} items={menuItems}/>

 const tabs=[
  {id:'register',label:L(en,`Μητρώο (${risks.length})`,`Register (${risks.length})`),icon:ClipboardList},
  {id:'analysis',label:L(en,'Ανάλυση','Analysis'),icon:BarChart3},
  {id:'comparison',label:L(en,'Σύγκριση περιόδων','Period comparison'),icon:GitCompareArrows},
  {id:'opportunities',label:L(en,'Ευκαιρίες','Opportunities'),icon:Lightbulb},
  {id:'methodology',label:L(en,'Μεθοδολογία','Method'),icon:BookOpen},
  {id:'details',label:L(en,'Στοιχεία','Details'),icon:Info},
 ]
 // The layout of the Quality Center: each tab's KPIs above one card that holds
 // the tabs, the tab's toolbar and its table (or its own scrolling pane).
 const tabNav=<nav className="entity-record-tabs surface risk-tabs" role="tablist" aria-label={L(en,'Εκτίμηση κινδύνου','Risk assessment')}>{tabs.map(({id,label,icon:Icon})=><button key={id} type="button" role="tab" aria-selected={tab===id} className={tab===id?'active':''} onClick={()=>setTab(id)}>{Icon&&<Icon size={16}/>}<span>{label}</span></button>)}</nav>
 const notices=<>
  {!canEdit&&canManage&&<p className="risk-locked">{L(en,`Η εκτίμηση είναι «${statusLabel(assessment.status,en)}» και δεν αλλάζει. Για αλλαγές: «Επαναφορά σε πρόχειρο».`,`The assessment is “${statusLabel(assessment.status,en)}” and locked. To change it: “Back to draft”.`)}</p>}
  {origin&&<button type="button" className="risk-origin-back" onClick={returnToOrigin}><ArrowLeft size={14}/>{L(en,`Πίσω σε «${tabs.find(t=>t.id===origin.tab)?.label||''}»`,`Back to “${tabs.find(t=>t.id===origin.tab)?.label||''}”`)}</button>}
 </>
 const frame=(kpis,content,{registry=false,name=''}={})=><>
  {kpis&&<div className="risk-kpi-row">{kpis}</div>}
  <div className={`surface risk-workspace${registry?' is-registry':''}${name?` ${name}`:''}`} ref={bodyRef}>{tabNav}{registry?<>{(origin||(!canEdit&&canManage))&&<div className="risk-notices">{notices}</div>}{content}</>:<div className="risk-tab-scroll">{notices}{content}</div>}</div>
 </>
 return <Page fill className="risk-assessment-page"><EntityRecordShell
  className="quality-record-shell risk-assessment-shell workspace-fill"
  avatar={<ShieldAlert size={19}/>}
  eyebrow={assessment.code}
  title={txt(assessment,'title',en)}
  subtitle={[assessment.formCode,assessment.periodLabel,fmtDate(assessment.assessedOn,locale)].filter(Boolean).join(' · ')}
  status={<AssessmentStatusBadge status={assessment.status} en={en}/>}
  onBack={goBack} backLabel={origin?L(en,`Πίσω σε «${tabs.find(t=>t.id===origin.tab)?.label||''}»`,`Back to “${tabs.find(t=>t.id===origin.tab)?.label||''}”`):L(en,'Πίσω στο Κέντρο Ποιότητας','Back to the Quality Center')}>
   {tab==='register'&&<RiskRegister frame={frame} key={JSON.stringify(preset)} preset={preset} risks={risks} en={en} canEdit={canEdit} cell={cell} onClearCell={()=>setView({riskTab:'register',riskOrigin:origin})} onOpen={openRisk} onCreate={()=>navigate(`/quality/risks/${assessment.code}/new`,{state:{riskTab:tab}})} actions={menu} indicatorValues={indicatorValues} returned={riskRow.returned}/>}
   {tab==='analysis'&&<RiskAnalysis frame={frame} mark={view.riskMark||''} returned={riskRow.returned} actions={menu} summary={summary} risks={risks} indicatorValues={indicatorValues} en={en} onOpen={openRisk} onCell={c=>jump('register',{cell:c},`${c.kind}:${c.l}:${c.c}`)}/>}
   {tab==='comparison'&&<RiskComparison frame={frame} returned={riskRow.returned} actions={menu} assessment={{...assessment,risks}} assessments={comparable} en={en} locale={locale} onOpen={(risk,from)=>{if(from&&from.id!==assessment.id){rememberRow(`limoxis.quality.risk.returned.${from.code}`,risk.lineageKey);navigate(`/quality/risks/${from.code}/${risk.lineageKey}`,{state:{riskTab:'comparison'}})}else openRisk(risk)}}/>}
   {tab==='opportunities'&&<RiskOpportunities frame={frame} returned={opportunityRow.returned} actions={menu} items={assessment.opportunities||[]} en={en} canEdit={canEdit} onOpen={item=>{opportunityRow.remember(item.id);navigate(`/quality/risks/${assessment.code}/opportunities/${item.id}`,{state:{returnState:view}})}} onCreate={()=>navigate(`/quality/risks/${assessment.code}/opportunities/new`)}/>}
   {tab==='methodology'&&<RiskMethodology frame={frame} en={en} risks={risks} actions={menu} returned={view.riskMark||''} onJci={jci=>jump('register',{jci},`jci:${jci}`)} onPickFmea={()=>jump('register',{quick:'highOrAbove'},'fmea')}/>}
   {tab==='details'&&<RiskAssessmentDetails frame={frame} assessment={assessment} assessments={all} en={en} locale={locale} actions={menu} nextStep={nextStep} onOpenAssessment={code=>navigate(`/quality/risks/${code}`)} onCreateNext={canManage?()=>setCreatingNext(true):null}/>}
  <div className="risk-print-host" aria-hidden="true"><RiskReport ref={reportRef} assessment={{...assessment,risks}} summary={summary} previous={previous} organizationName={tenant?.name||''} en={en} locale={locale}/></div>
  {linking&&<LinkIndicatorsDialog risks={risks} values={indicatorValues||new Map()} en={en} saving={saving} onClose={()=>setLinking(false)} onSave={linkIndicators}/>}
  {creatingNext&&<AssessmentDetailsDialog en={en} assessments={[{...assessment,risks}]} initial={{title:assessment.title,formCode:assessment.formCode,periodKind:assessment.periodKind,assessorLabel:assessment.assessorLabel,scopeNote:assessment.scopeNote,periodLabel:suggestPeriodLabel(assessment.periodKind,new Date().toISOString().slice(0,10),en)}} onClose={()=>setCreatingNext(false)} onSave={createNext}/>}
  {detailsOpen&&<AssessmentDetailsDialog initial={assessment} en={en} onClose={()=>setDetailsOpen(false)} onSave={async draft=>{if(await persistAssessment(draft,'riskAssessmentUpdated'))setDetailsOpen(false)}}/>}
  {approving&&<ApproveDialog en={en} onClose={()=>setApproving(false)} onSave={async ({by,on})=>{if(await persistAssessment({status:'approved',approvedByLabel:by,approvedOn:on},'riskAssessmentApproved'))setApproving(false)}}/>}
  {confirm&&<ObserverDialog width="compact" title={L(en,'Διαγραφή εκτίμησης','Delete assessment')} onClose={()=>setConfirm(null)} footer={<DialogActions onCancel={()=>setConfirm(null)} onSave={async()=>{setConfirm(null);await removeAssessment()}} saveLabel={L(en,'Διαγραφή','Delete')}/>}>
   <p>{L(en,`Θα διαγραφεί η εκτίμηση ${assessment.periodLabel} με ${risks.length} κινδύνους.`,`The ${assessment.periodLabel} assessment with ${risks.length} risks will be deleted.`)}</p>
  </ObserverDialog>}
 </EntityRecordShell></Page>
}

function ApproveDialog({en,onClose,onSave}){
 const [by,setBy]=useState('')
 const [on,setOn]=useState(new Date().toISOString().slice(0,10))
 return <ObserverDialog width="compact" title={L(en,'Έγκριση εκτίμησης','Approve assessment')} subtitle={L(en,'Μετά την έγκριση η εκτίμηση κλειδώνει.','After approval the assessment is locked.')} onClose={onClose} footer={<DialogActions onCancel={onClose} onSave={()=>onSave({by,on})} disabled={!by.trim()||!on} saveLabel={L(en,'Έγκριση','Approve')}/>}>
  <div className="risk-editor-grid risk-editor-grid-single"><label className="risk-field"><span>{L(en,'Εγκρίθηκε από','Approved by')}</span><input value={by} onChange={e=>setBy(e.target.value)} placeholder={L(en,'π.χ. Επιτροπή Ποιότητας','e.g. Quality Committee')}/></label><ManualDateField label={L(en,'Ημερομηνία έγκρισης','Approval date')} value={on} onChange={setOn}/></div>
 </ObserverDialog>
}

