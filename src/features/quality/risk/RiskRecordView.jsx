import { useEffect,useMemo,useState } from 'react'
import { Activity,CheckSquare2,ClipboardList,History,Plus,ShieldAlert } from 'lucide-react'
import { EntityRecordShell } from '../../../design-system/EntityRecordShell'
import { DetailList } from '../../../design-system/DetailList'
import { Button } from '../../../design-system/Button'
import { StatusBadge } from '../../../design-system/StatusBadge'
import { formatDay } from '../../../core/i18n/formatDay'
import { useContextualNavigation } from '../../../core/navigation/useContextualNavigation'
import { useLanguage } from '../../../core/i18n/LanguageContext'
import { loadQualityRecords } from '../qualityService'
import { qualityStatusTone } from '../qualityVocabulary'
import { loadRiskAssessments } from './riskService'
import { consequenceLabel,jciLabel,levelLabel,likelihoodLabel,parseMeasures,riskEvidenceRows,riskLineage,riskWarnings,scored,sectionLabel,warningLabel } from './riskModel'
import { L,LevelChip,recordActions,txt } from './riskUi'
import { IndicatorBadge } from './RiskIndicatorsUi'

const STAGES=[['inherent','Εγγενής','Inherent'],['residual','Υπολειπόμενος','Residual'],['target','Στόχος','Target']]

// One risk as a record: a summary line and its values (no form), what happened
// in practice, the corrective actions opened from it and its course over the
// periods. Editing opens the form from the record's «⋯».
export function RiskRecordView({risk,assessment,organizationId,en,canEdit,indicatorValues=null,onBack,onEdit,onDelete,onCreateCapa,onMove=null}){
 const language=en?'en':'el'
 const {t}=useLanguage()
 const {goTo}=useContextualNavigation('/quality')
 const [tab,setTab]=useState('details')
 const [practice,setPractice]=useState({incidents:[],findings:[],capas:[]})
 const [assessments,setAssessments]=useState([])
 useEffect(()=>{let active=true
  Promise.all(['incidents','findings','capas'].map(section=>loadQualityRecords(section,organizationId).catch(()=>[]))).then(([incidents,findings,capas])=>{if(active)setPractice({incidents,findings,capas})})
  loadRiskAssessments(organizationId).then(list=>{if(active)setAssessments(list)}).catch(()=>{if(active)setAssessments([])})
  return()=>{active=false}},[organizationId])
 const s=useMemo(()=>scored(risk),[risk])
 const evidence=useMemo(()=>riskEvidenceRows(risk,practice),[risk,practice])
 const source=`RISK:${assessment.code}:${risk.lineageKey}`
 const capas=useMemo(()=>practice.capas.filter(row=>row.sourceId===source&&row.lifecycleStatus!=='voided'),[practice.capas,source])
 const lineage=useMemo(()=>riskLineage(assessments.length?assessments:[{...assessment}],risk.lineageKey),[assessments,assessment,risk.lineageKey])
 const warnings=riskWarnings(risk).filter(w=>w.tone!=='info')
 const indicators=risk.indicatorKeys||[]
 const path=STAGES.map(([kind])=>s[kind].score).filter(Boolean).join(' → ')
 // ‹ › through the assessment's risks, in the register's order.
 const keys=useMemo(()=>[...(assessment.risks||[])].sort((a,b)=>(a.position??0)-(b.position??0)).map(item=>item.lineageKey),[assessment.risks])
 const index=keys.indexOf(risk.lineageKey)
 const recordNavigation=onMove&&index>=0&&keys.length>1?{position:index+1,total:keys.length,hasPrevious:index>0,hasNext:index<keys.length-1,previous:()=>index>0&&onMove(keys[index-1]),next:()=>index<keys.length-1&&onMove(keys[index+1])}:null
 const measures=value=>{const list=parseMeasures(value);return list.length?<ol className="risk-view-measures">{list.map((item,index)=><li key={index}>{item}</li>)}</ol>:''}
 const axes=kind=>s[kind].score?`${s[kind].l} × ${s[kind].c} · ${likelihoodLabel(s[kind].l,en)} / ${consequenceLabel(s[kind].c,en)}`:''
 const open=(type,row)=>goTo(`/quality/${type}/${row.id}`,{returnTo:`/quality/risks/${assessment.code}/${risk.lineageKey}`})
 const tabs=[
  {id:'details',label:L(en,'Στοιχεία','Details'),icon:ShieldAlert},
  {id:'practice',label:L(en,`Στην πράξη (${evidence.incidents.length+evidence.findings.length})`,`In practice (${evidence.incidents.length+evidence.findings.length})`),icon:Activity},
  {id:'actions',label:L(en,`Διορθωτικές ενέργειες (${capas.length})`,`Corrective actions (${capas.length})`),icon:CheckSquare2},
  {id:'history',label:L(en,'Ιστορικό','History'),icon:History},
 ]
 const line=<p className="quality-summary-line quality-record-line">
  <span className={['high','very_high'].includes(s.residual.level)?'is-late':undefined}>{L(en,'Εγγενής','Inherent')} {s.inherent.score??'—'} → {L(en,'Υπολειπόμενος','Residual')} {s.residual.score??'—'}{s.target.score?` → ${L(en,'Στόχος','Target')} ${s.target.score}`:''}{s.residual.level?` · ${levelLabel(s.residual.level,en).toLowerCase()}`:''}</span>
  {(evidence.incidents.length+evidence.findings.length)>0&&<span>{L(en,'12μ','12m')}: {[evidence.incidents.length&&L(en,`${evidence.incidents.length} συμβάντα`,`${evidence.incidents.length} incidents`),evidence.findings.length&&L(en,`${evidence.findings.length} ευρήματα`,`${evidence.findings.length} findings`)].filter(Boolean).join(' · ')}</span>}
  <span>{indicators.length?L(en,`δείκτες: ${indicators.length}`,`indicators: ${indicators.length}`):L(en,'χωρίς δείκτη','no indicator')}</span>
  {capas.length>0&&<span>{L(en,`${capas.length} διορθωτικές ενέργειες`,`${capas.length} corrective actions`)}</span>}
  {warnings.map(w=><span key={w.id} className="is-late">{warningLabel(w.id,en)}</span>)}
 </p>
 const details=<div className="record-section risk-view">
  <div className="record-section-header"><h3>{L(en,'Στοιχεία','Details')}</h3></div>
  {line}
  <DetailList sections={[
   {title:L(en,'Κίνδυνος','Risk'),items:[
    {label:L(en,'Ενότητα','Section'),value:sectionLabel(risk.section||'clinical',en)},
    {label:L(en,'Διεργασία','Process'),value:txt(risk,'process',en)},
    {label:L(en,'Τμήμα / αφορά','Department / applies to'),value:txt(risk,'scope',en)},
    {label:'JCI',value:risk.jci?`${risk.jci} · ${jciLabel(risk.jci,en)}${risk.jciReference?` (${risk.jciReference})`:''}`:''},
    {label:L(en,'Πιθανό ρίσκο / κίνδυνος','Potential risk / hazard'),value:txt(risk,'hazard',en),wide:true},
   ].filter(item=>item.value)},
   {title:L(en,'Βαθμολογία','Scoring'),items:STAGES.map(([kind,el,english])=>({label:en?english:el,value:s[kind].score?<span className="risk-view-score"><LevelChip score={s[kind].score} level={s[kind].level} en={en}/><small>{axes(kind)}</small></span>:''})).filter(item=>item.value)},
   {title:L(en,'Μέτρα και παρακολούθηση','Measures and monitoring'),items:[
    {label:L(en,'Μέτρα που ήδη λαμβάνονται','Controls in place'),value:measures(txt(risk,'existingControls',en)),wide:true},
    {label:L(en,'Σχέδιο δράσης (πρόσθετα μέτρα)','Action plan (additional measures)'),value:measures(txt(risk,'additionalMeasures',en)),wide:true},
    {label:L(en,'Υπεύθυνος υλοποίησης','Owner'),value:txt(risk,'owner',en)},
    {label:L(en,'Προθεσμία','Due date'),value:risk.dueDate?formatDay(risk.dueDate,language):''},
    {label:L(en,'Συχνότητα ελέγχου','Review frequency'),value:txt(risk,'reviewFrequency',en)},
    {label:L(en,'Δείκτες','Indicators'),value:indicators.length?<IndicatorBadge keys={indicators} values={indicatorValues} en={en}/>:''},
    {label:L(en,'Προληπτική ανάλυση (FMEA)','Proactive analysis (FMEA)'),value:risk.prioritized?L(en,'Ναι','Yes'):''},
    {label:L(en,'Σημειώσεις','Notes'),value:txt(risk,'notes',en),wide:true},
   ].filter(item=>item.value)},
  ]}/>
 </div>
 const list=(rows,type,empty)=>rows.length?<ul className="risk-view-list">{rows.map(row=><li key={row.id}><button type="button" onClick={()=>open(type,row)}>
  <span><strong>{row.displayId||row.id}</strong> · {(en?row.titleEn:row.title)||row.title}</span>
  <small>{[formatDay(row.date,language),(en?row.departmentEn:row.department)||row.department].filter(Boolean).join(' · ')}</small>
 </button></li>)}</ul>:<p className="inline-empty">{empty}</p>
 const practiceTab=<div className="record-section risk-view">
  <div className="record-section-header"><h3>{L(en,'Στην πράξη · 12 μήνες','In practice · 12 months')}</h3></div>
  <h4 className="risk-view-heading">{L(en,`Συμβάντα του τμήματος (${evidence.incidents.length})`,`Incidents of the department (${evidence.incidents.length})`)}</h4>
  {list(evidence.incidents,'incidents',L(en,'Κανένα συμβάν στα τμήματα του κινδύνου.','No incident in the risk\'s departments.'))}
  <h4 className="risk-view-heading">{L(en,`Ευρήματα επιθεωρήσεων JCI ${String(risk.jci||'').split('.')[0]} (${evidence.findings.length})`,`JCI ${String(risk.jci||'').split('.')[0]} audit findings (${evidence.findings.length})`)}</h4>
  {list(evidence.findings,'findings',risk.jci?L(en,'Κανένα εύρημα στο κεφάλαιο.','No finding in the chapter.'):L(en,'Ο κίνδυνος δεν έχει κεφάλαιο JCI.','The risk has no JCI chapter.'))}
  {indicators.length>0&&<><h4 className="risk-view-heading">{L(en,'Δείκτες','Indicators')}</h4><div><IndicatorBadge keys={indicators} values={indicatorValues} en={en}/></div></>}
 </div>
 const actionsTab=<div className="record-section risk-view">
  <div className="record-section-header"><h3>{L(en,'Διορθωτικές ενέργειες','Corrective actions')}</h3>{onCreateCapa&&<Button variant="secondary" onClick={()=>onCreateCapa(risk)}><Plus size={15}/>{L(en,'Νέα διορθωτική ενέργεια','New corrective action')}</Button>}</div>
  {capas.length?<ul className="risk-view-list">{capas.map(row=><li key={row.id}><button type="button" onClick={()=>open('capas',row)}>
   <span><strong>{row.displayId||row.id}</strong> · {(en?row.titleEn:row.title)||row.title}</span>
   <small>{row.dueDate?`${L(en,'Προθεσμία','Due')} ${formatDay(row.dueDate,language)}`:''}</small>
   <StatusBadge tone={qualityStatusTone(row.status)}>{t(row.status)}</StatusBadge>
  </button></li>)}</ul>:<p className="inline-empty">{L(en,'Δεν έχει ανοίξει διορθωτική ενέργεια από αυτόν τον κίνδυνο.','No corrective action has been opened from this risk.')}</p>}
 </div>
 const historyTab=<div className="record-section risk-view">
  <div className="record-section-header"><h3>{L(en,'Ιστορικό ανά περίοδο','History by period')}</h3></div>
  {lineage.length?<table className="quality-programme-table risk-view-history"><thead><tr><th scope="col">{L(en,'Περίοδος','Period')}</th>{STAGES.map(([kind,el,english])=><th key={kind} scope="col">{en?english:el}</th>)}</tr></thead>
   <tbody>{lineage.map(row=><tr key={row.code} className={row.code===assessment.code?'is-current':undefined}><th scope="row">{row.period}<small>{formatDay(row.assessedOn,language)}</small></th>{STAGES.map(([kind])=><td key={kind}><LevelChip score={row[kind].score} level={row[kind].level} en={en} compact/></td>)}</tr>)}</tbody></table>
   :<p className="inline-empty">{L(en,'Ο κίνδυνος υπάρχει μόνο σε αυτή την περίοδο.','The risk exists in this period only.')}</p>}
 </div>
 const content={details,practice:practiceTab,actions:actionsTab,history:historyTab}
 return <EntityRecordShell className="quality-record-shell risk-editor-shell workspace-fill" avatar={<ClipboardList size={19}/>}
  eyebrow={[risk.lineageKey,sectionLabel(risk.section||'clinical',en),assessment.periodLabel].filter(Boolean).join(' · ')}
  title={txt(risk,'hazard',en)} subtitle={[txt(risk,'process',en),txt(risk,'scope',en)].filter(Boolean).join(' · ')||undefined}
  status={<span className="risk-editor-path" title={L(en,'Εγγενής → υπολειπόμενος → στόχος','Inherent → residual → target')}>{path}</span>}
  headerActions={recordActions({en,canEdit,editing:false,isNew:false,onEdit,onDelete})}
  recordNavigation={recordNavigation}
  tabs={tabs} activeTab={tab} onTabChange={setTab} renderTab={id=>content[id]}
  onBack={onBack} backLabel={L(en,'Πίσω στην εκτίμηση','Back to the assessment')}>
  {content[tab]}
 </EntityRecordShell>
}
