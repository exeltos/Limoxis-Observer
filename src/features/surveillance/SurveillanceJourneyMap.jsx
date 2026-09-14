import { Activity,AlertTriangle,BedDouble,CheckCircle2,ChevronRight,Microscope,RefreshCcw,ShieldCheck,Syringe } from 'lucide-react'

const icons={assessment:ShieldCheck,samples:Microscope,isolation:BedDouble,therapy:Syringe,hai:AlertTriangle,reassessment:RefreshCcw,outcome:Activity}

export function buildSurveillanceJourneyStages(record,t,fmtDate){
  const samples=record?.samples||[],validatedSamples=samples.filter(sample=>Boolean(sample.organism))
  const reassessments=record?.reassessments||[],therapy=record?.therapy||[]
  const isolationDecided=Boolean(record?.isolation)||(record?.isolationDecision?.required===false)
  const assessed=Boolean(record?.assessment)
  const unlocked={
    assessment:true,
    samples:assessed,
    isolation:assessed,
    therapy:assessed,
    hai:validatedSamples.length>0,
    reassessment:assessed,
    outcome:reassessments.length>0,
  }
  return [
    {id:'assessment',label:t('clinicalAssessment'),status:record?.assessment?'complete':'pending',meta:record?.assessment?fmtDate(record.assessment.date||record.startedAt):t('pending')},
    {id:'samples',label:t('sampleAndLaboratory'),status:samples.length?(validatedSamples.length?'complete':'waiting'):'pending',meta:samples.length?(validatedSamples.length?`${samples.length} · ${validatedSamples.length} ${t('clinicalRecords.validated').toLowerCase()}`:`${samples.length} · ${t('waitingForLaboratory')}`):t('clinicalRecords.notStarted')},
    {id:'isolation',label:t('isolation'),status:isolationDecided?'complete':'pending',meta:record?.isolation?t(record.isolation.status):(isolationDecided?t('notRequired'):t('clinicalRecords.notStarted'))},
    {id:'therapy',label:t('therapy'),status:therapy.length?'complete':'pending',meta:therapy[0]?.antimicrobial||t('clinicalRecords.notStarted')},
    {id:'hai',label:t('haiAmr'),status:record?.haiClassification?'complete':(validatedSamples.length?'pending':'waiting'),meta:record?.resistance||t(record?.haiClassification?.status||'pending')},
    {id:'reassessment',label:t('reassessment'),status:reassessments.length?'complete':'due',meta:reassessments[0]?fmtDate(reassessments[0].date):(record?.reviewDue?fmtDate(record.reviewDue):t('notScheduled'))},
    {id:'outcome',label:t('outcome'),status:record?.outcome?'complete':'pending',meta:record?.outcome?t(record.outcome.status):t('pending')},
  ].map(stage=>({...stage,locked:!unlocked[stage.id]}))
}

export function SurveillanceJourneyMap({record,t,fmtDate,activeStage,onSelect}){
  const stages=buildSurveillanceJourneyStages(record,t,fmtDate)
  return <div className="journey-map strict-journey-map" aria-label={t('surveillanceJourney')}>
    <button type="button" className="journey-start journey-start-button" disabled><CheckCircle2 size={16}/><span>{t('surveillanceStarted')}</span><strong>{fmtDate(record.startedAt)}</strong></button>
    <div className="journey-connector vertical"/>
    <div className="journey-nodes strict-nodes">{stages.slice(0,5).map(stage=><Stage key={stage.id} stage={stage} active={activeStage===stage.id} onSelect={onSelect}/>)}</div>
    <div className="journey-connector vertical"/>
    <div className="journey-final-row">{stages.slice(5).map(stage=><Stage key={stage.id} stage={stage} active={activeStage===stage.id} onSelect={onSelect}/>)}</div>
  </div>
}

export function SurveillanceJourneyGuidance({record,t,canAssess,canLab,canIsolation,canTherapy,canReassess,onSelect}){
  const cues=[],samples=record?.samples||[],pendingSamples=samples.filter(sample=>!sample.organism)
  if(canAssess&&!record?.assessment)cues.push({id:'assessment',tone:'warning',title:t('clinicalRecords.initialAssessmentRequired'),text:t('clinicalRecords.initialAssessmentRequiredHint')})
  if(canLab&&pendingSamples.length)cues.push({id:'samples',tone:'info',title:t('clinicalRecords.pendingLaboratoryResult'),text:t('clinicalRecords.pendingLaboratoryResultHint')})
  if(canIsolation&&record?.assessment&&!record?.isolation&&!record?.isolationDecision)cues.push({id:'isolation',tone:'neutral',title:t('isolation'),text:t('clinicalRecords.reviewIsolationNeedHint')})
  if(canTherapy&&record?.assessment&&!record?.therapy?.length)cues.push({id:'therapy',tone:'neutral',title:t('therapy'),text:t('clinicalRecords.reviewAntimicrobialTherapyHint')})
  if(canAssess&&record?.haiClassification&&!record.haiClassification.criteriaMet)cues.push({id:'hai',tone:'warning',title:t('clinicalRecords.haiCriteriaNeedReview'),text:t('clinicalRecords.haiCriteriaNeedReviewHint')})
  if(canReassess&&!record?.reassessments?.length)cues.push({id:'reassessment',tone:'due',title:t('clinicalRecords.reassessmentRequired'),text:t('clinicalRecords.reassessmentRequiredHint')})
  if(canReassess&&record?.reviewDue)cues.push({id:'reassessment',tone:'neutral',title:t('nextReview'),text:`${t('clinicalRecords.reassessmentPlanned')}: ${record.reviewDue}`})
  if(!cues.length)return <div className="journey-guidance clear"><CheckCircle2 size={16}/><span>{t('clinicalRecords.noImmediateIntervention')}</span></div>
  return <div className="journey-guidance compact-guidance"><div className="journey-guidance-title"><AlertTriangle size={15}/><strong>{t('clinicalRecords.attentionNeeded')}</strong><span>{cues.length}</span></div><div className="journey-guidance-items">{cues.map((cue,index)=><button type="button" key={`${cue.id}-${index}`} className={`guidance-cue ${cue.tone}`} onClick={()=>onSelect?.(cue.id)}><strong>{cue.title}</strong><small>{cue.text}</small><ChevronRight size={14}/></button>)}</div></div>
}

function Stage({stage,active,onSelect}){
  const Icon=icons[stage.id]||Activity
  return <button type="button" className={`journey-node ${stage.status} ${active?'active':''} ${stage.locked?'locked':''}`.trim()} disabled={stage.locked} aria-current={active?'step':undefined} onClick={()=>onSelect?.(stage.id)}><span className="journey-node-icon"><Icon size={17}/></span><span className="journey-node-copy"><strong>{stage.label}</strong><small>{stage.meta}</small></span></button>
}
