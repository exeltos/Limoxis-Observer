import { Activity,AlertTriangle,BedDouble,CheckCircle2,Microscope,RefreshCcw,ShieldCheck,Syringe } from 'lucide-react'

const icons={assessment:ShieldCheck,samples:Microscope,hai:AlertTriangle,isolation:BedDouble,therapy:Syringe,reassessment:RefreshCcw,outcome:Activity}

export function buildSurveillanceJourneyStages(record,t,fmtDate){
  const samples=record?.samples||[],validatedSamples=samples.filter(sample=>Boolean(sample.organism))
  const reassessments=record?.reassessments||[],therapy=record?.therapy||[]
  const isolationDecided=Boolean(record?.isolation)||(record?.isolationDecision?.required===false)
  const unlocked={assessment:true,samples:Boolean(record?.assessment),hai:validatedSamples.length>0,isolation:Boolean(record?.assessment),therapy:validatedSamples.length>0,reassessment:Boolean(record?.assessment)&&(isolationDecided||Boolean(record?.haiClassification)||validatedSamples.length>0),outcome:reassessments.length>0}
  return [
    {id:'assessment',label:t('clinicalAssessment'),status:record?.assessment?'complete':'pending',meta:record?.assessment?fmtDate(record.assessment.date||record.startedAt):t('pending')},
    {id:'samples',label:t('sampleAndLaboratory'),status:samples.length?'complete':'pending',meta:samples.length?(validatedSamples.length?`${samples.length} · ${validatedSamples.length} ${t('clinicalRecords.validated').toLowerCase()}`:`${samples.length} · ${t('waitingForLaboratory')}`):t('clinicalRecords.notStarted')},
    {id:'hai',label:t('haiAmr'),status:record?.haiClassification?'complete':'pending',meta:record?.resistance||t(record?.haiClassification?.status||'pending')},
    {id:'isolation',label:t('isolation'),status:isolationDecided?'complete':'pending',meta:record?.isolation?t(record.isolation.status):(isolationDecided?t('notRequired'):t('clinicalRecords.notStarted'))},
    {id:'therapy',label:t('therapy'),status:therapy.length?'complete':'pending',meta:therapy[0]?.antimicrobial||t('clinicalRecords.notStarted')},
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

function Stage({stage,active,onSelect}){
  const Icon=icons[stage.id]||Activity
  return <button type="button" className={`journey-node ${stage.status} ${active?'active':''} ${stage.locked?'locked':''}`.trim()} disabled={stage.locked} aria-current={active?'step':undefined} onClick={()=>onSelect?.(stage.id)}><span className="journey-node-icon"><Icon size={17}/></span><span className="journey-node-copy"><strong>{stage.label}</strong><small>{stage.meta}</small></span></button>
}
