import { Activity,AlertTriangle,BedDouble,CheckCircle2,Microscope,RefreshCcw,ShieldCheck,Syringe } from 'lucide-react'
import { useLanguage } from '../../core/i18n/LanguageContext'

const icons={assessment:ShieldCheck,samples:Microscope,isolation:BedDouble,therapy:Syringe,hai:AlertTriangle,reassessment:RefreshCcw,outcome:Activity}

export function buildSurveillanceJourneyStages(record,t,fmtDate){
  const samples=record?.samples||[],validatedSamples=samples.filter(sample=>Boolean(sample.organism))
  const reassessments=record?.reassessments||[],therapy=record?.therapy||[]
  const isolationDecided=Boolean(record?.isolation)||(record?.isolationDecision?.required===false)
  const assessed=Boolean(record?.assessment)
  const unlocked={assessment:true,samples:assessed,isolation:assessed,therapy:assessed,hai:validatedSamples.length>0,reassessment:assessed,outcome:reassessments.length>0}
  return [
    {id:'assessment',label:t('clinicalAssessment'),status:record?.assessment?'complete':'pending',meta:record?.assessment?fmtDate(record.assessment.date||record.startedAt):t('pending')},
    {id:'samples',label:t('sampleAndLaboratory'),status:samples.length?(validatedSamples.length?'complete':'waiting'):'pending',meta:samples.length?(validatedSamples.length?`${samples.length} · ${validatedSamples.length} ${t('clinicalRecords.validated').toLowerCase()}`:`${samples.length} · ${t('waitingForLaboratory')}`):t('clinicalRecords.notStarted')},
    {id:'isolation',label:t('isolation'),status:isolationDecided?'complete':'pending',meta:record?.isolation?t(record.isolation.status):(isolationDecided?t('notRequired'):t('clinicalRecords.notStarted'))},
    {id:'therapy',label:t('therapy'),status:therapy.length?'complete':'pending',meta:therapy[0]?.antimicrobial||t('clinicalRecords.notStarted')},
    {id:'hai',label:t('haiAmr'),status:record?.haiClassification?'complete':(validatedSamples.length?'pending':'waiting'),meta:record?.resistance||t(record?.haiClassification?.status||'pending')},
    {id:'reassessment',label:t('reassessment'),status:reassessments.length?'complete':(assessed?'due':'pending'),meta:reassessments[0]?fmtDate(reassessments[0].date):(record?.reviewDue?fmtDate(record.reviewDue):t('notScheduled'))},
    {id:'outcome',label:t('outcome'),status:record?.outcome?'complete':'pending',meta:record?.outcome?t(record.outcome.status):t('pending')},
  ].map(stage=>({...stage,locked:!unlocked[stage.id]}))
}

export function SurveillanceJourneyMap({record,t,fmtDate,activeStage,onSelect}){
  const {language}=useLanguage()
  const stages=buildSurveillanceJourneyStages(record,t,fmtDate)
  const byId=Object.fromEntries(stages.map(stage=>[stage.id,stage]))
  const primary=['assessment','samples','reassessment','outcome'].map(id=>byId[id])
  const clinicalActions=['isolation','therapy','hai'].map(id=>byId[id])
  return <div className="journey-map strict-journey-map" aria-label={t('surveillanceJourney')}>
    <div className="progressive-journey-header"><div><span className="eyebrow">{language==='el'?'Πορεία επεισοδίου':'Episode progress'}</span><p>{language==='el'?'Δουλέψτε το επόμενο απαραίτητο βήμα. Οι κλινικές ενέργειες μπορούν να γίνουν παράλληλα όταν χρειάζεται.':'Work on the next required step. Clinical actions can be recorded in parallel when needed.'}</p></div><span className="journey-start"><CheckCircle2 size={15}/>{fmtDate(record.startedAt)}</span></div>
    <div className="progressive-journey-rail">{primary.map((stage,index)=><ProgressStage key={stage.id} stage={stage} number={index+1} active={activeStage===stage.id} onSelect={onSelect}/>)}</div>
    <div className="parallel-actions-strip"><span>{language==='el'?'Κλινικές ενέργειες':'Clinical actions'}</span><div className="button-row">{clinicalActions.map(stage=><ActionStage key={stage.id} stage={stage} active={activeStage===stage.id} onSelect={onSelect}/>)}</div></div>
  </div>
}

export function SurveillanceJourneyGuidance({record,t,canAssess,canLab,canIsolation,canTherapy,canReassess,onSelect}){
  const cues=[],samples=record?.samples||[],pendingSamples=samples.filter(sample=>!sample.organism)
  if(canAssess&&!record?.assessment)cues.push({id:'assessment',tone:'warning',title:t('clinicalRecords.initialAssessmentRequired')})
  if(canLab&&pendingSamples.length)cues.push({id:'samples',tone:'info',title:t('clinicalRecords.pendingLaboratoryResult')})
  if(canIsolation&&record?.assessment&&!record?.isolation&&!record?.isolationDecision)cues.push({id:'isolation',tone:'neutral',title:t('isolation')})
  if(canTherapy&&record?.assessment&&!record?.therapy?.length)cues.push({id:'therapy',tone:'neutral',title:t('therapy')})
  if(canAssess&&record?.haiClassification&&!record.haiClassification.criteriaMet)cues.push({id:'hai',tone:'warning',title:t('clinicalRecords.haiCriteriaNeedReview')})
  if(canReassess&&!record?.reassessments?.length)cues.push({id:'reassessment',tone:'due',title:t('clinicalRecords.reassessmentRequired')})
  if(canReassess&&record?.reviewDue)cues.push({id:'reassessment',tone:'neutral',title:t('nextReview')})
  if(!cues.length)return <div className="journey-guidance clear"><CheckCircle2 size={16}/><span>{t('clinicalRecords.noImmediateIntervention')}</span></div>
  return <div className="journey-guidance compact-guidance"><div className="journey-guidance-title"><AlertTriangle size={15}/><strong>{t('clinicalRecords.attentionNeeded')}</strong><span>{cues.length}</span></div><div className="journey-guidance-items">{cues.map((cue,index)=><button type="button" key={`${cue.id}-${index}`} className={`guidance-cue ${cue.tone}`} onClick={()=>onSelect?.(cue.id)}><strong>{cue.title}</strong></button>)}</div></div>
}

function ProgressStage({stage,number,active,onSelect}){
  const Icon=icons[stage.id]||Activity
  return <button type="button" className={`progressive-step ${active?'current':''} ${stage.status==='complete'?'complete':''} ${stage.locked?'locked':''}`.trim()} disabled={stage.locked} aria-current={active?'step':undefined} onClick={()=>onSelect?.(stage.id)}><i>{number}</i><span className="journey-node-icon"><Icon size={16}/></span><span className="journey-node-copy"><strong>{stage.label}</strong><small>{stage.meta}</small></span></button>
}

function ActionStage({stage,active,onSelect}){
  const Icon=icons[stage.id]||Activity
  return <button type="button" className={`btn btn-secondary ${active?'active':''}`.trim()} disabled={stage.locked} onClick={()=>onSelect?.(stage.id)}><Icon size={15}/><span>{stage.label}</span></button>
}
