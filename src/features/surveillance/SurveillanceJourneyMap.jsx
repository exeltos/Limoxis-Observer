import { Activity,AlertTriangle,BedDouble,CheckCircle2,Microscope,RefreshCcw,ShieldCheck,Syringe } from 'lucide-react'
import { useLanguage } from '../../core/i18n/LanguageContext'

const icons={assessment:ShieldCheck,samples:Microscope,isolation:BedDouble,therapy:Syringe,hai:AlertTriangle,reassessment:RefreshCcw,outcome:Activity}

export function buildSurveillanceJourneyStages(record,t,fmtDate){
  const samples=record?.samples||[],validatedSamples=samples.filter(sample=>Boolean(sample.organism))
  const reassessments=record?.reassessments||[],therapy=record?.therapy||[]
  const isolationDecided=Boolean(record?.isolation)||(record?.isolationDecision?.required===false)
  const assessed=Boolean(record?.assessment)
  const unlocked={assessment:true,samples:assessed,isolation:assessed,therapy:assessed,hai:assessed,reassessment:assessed,outcome:reassessments.length>0}
  return [
    {id:'assessment',label:t('clinicalAssessment'),status:record?.assessment?'complete':'pending',meta:record?.assessment?fmtDate(record.assessment.date||record.startedAt):t('pending')},
    {id:'samples',label:t('sampleAndLaboratory'),status:samples.length?(validatedSamples.length?'complete':'waiting'):'pending',meta:samples.length?(validatedSamples.length?`${samples.length} · ${validatedSamples.length} ${t('clinicalRecords.validated').toLowerCase()}`:`${samples.length} · ${t('waitingForLaboratory')}`):t('clinicalRecords.notStarted')},
    {id:'hai',label:t('haiAmr'),status:record?.haiClassification?'complete':(assessed?'pending':'waiting'),meta:record?.resistance||t(record?.haiClassification?.status||'pending')},
    {id:'isolation',label:t('isolation'),status:isolationDecided?'complete':'pending',meta:record?.isolation?t(record.isolation.status):(isolationDecided?t('notRequired'):t('clinicalRecords.notStarted'))},
    {id:'therapy',label:t('therapy'),status:therapy.length?'complete':'pending',meta:therapy[0]?.antimicrobial||t('clinicalRecords.notStarted')},
    {id:'reassessment',label:t('reassessment'),status:reassessments.length?'complete':(assessed?'due':'pending'),meta:reassessments[0]?fmtDate(reassessments[0].date):(record?.reviewDue?fmtDate(record.reviewDue):t('notScheduled'))},
    {id:'outcome',label:t('outcome'),status:record?.outcome?'complete':'pending',meta:record?.outcome?t(record.outcome.status):t('pending')},
  ].map(stage=>({...stage,locked:!unlocked[stage.id]}))
}

export function SurveillanceJourneyMap({record,t,fmtDate,activeStage,onSelect}){
  const {language}=useLanguage()
  const stages=buildSurveillanceJourneyStages(record,t,fmtDate)
  const samples=record?.samples||[]
  const validatedSamples=samples.filter(sample=>Boolean(sample.organism))
  const assessed=Boolean(record?.assessment)
  const criteriaMet=Boolean(record?.haiClassification?.criteriaMet)
  const reviewTone=criteriaMet?'complete':(!assessed?'warning':validatedSamples.length?'warning':'info')
  const reviewTitle=criteriaMet
    ?(language==='el'?'Κριτήρια τεκμηριωμένα':'Criteria documented')
    :(!assessed
      ?(language==='el'?'Αναμένεται αρχική αξιολόγηση':'Initial assessment pending')
      :(validatedSamples.length
        ?(language==='el'?'Έλεγχος κριτηρίων HAI':'HAI criteria review')
        :(language==='el'?'Αναμονή μικροβιολογίας':'Awaiting microbiology')))
  const reviewText=criteriaMet
    ?(language==='el'?'Η τελική κατάταξη βασίζεται στα καταγεγραμμένα κλινικά και εργαστηριακά δεδομένα.':'Final classification is supported by the recorded clinical and laboratory evidence.')
    :(!assessed
      ?(language==='el'?'Καταγράψτε πρώτα κλινικά σημεία, συμπτώματα και σχετικούς παράγοντες/συσκευές.':'Record clinical signs, symptoms and relevant factors/devices first.')
      :(validatedSamples.length
        ?(language==='el'?'Υπάρχει μικροβιολογικό εύρημα. Αξιολογήστε αν πληρούνται τα κριτήρια επιτήρησης πριν από την τελική κατάταξη.':'Microbiology evidence is available. Review surveillance criteria before final classification.')
        :(language==='el'?'Η διερεύνηση μπορεί να συνεχιστεί. Θετικό αποτέλεσμα δεν απαιτείται για κάθε ορισμό λοίμωξης.':'Investigation can continue. A positive laboratory result is not required for every infection definition.')))

  return <div className="journey-map strict-journey-map episode-workspace-map" aria-label={t('surveillanceJourney')}>
    <div className="episode-workspace-topline">
      <div className="episode-progress-copy">
        <span className="eyebrow">{language==='el'?'Επεισόδιο επιτήρησης':'Surveillance episode'}</span>
        <strong>{language==='el'?'Κλινική διερεύνηση και τελική κατάταξη':'Clinical investigation and final classification'}</strong>
        <span>{language==='el'?'Τα δεδομένα ενημερώνονται σταδιακά χωρίς υποχρεωτική σειρά.':'Information can be added progressively without a mandatory sequence.'}</span>
      </div>
      <div className={`ecdc-review-card ${reviewTone}`}>
        <span>{language==='el'?'Αξιολόγηση ECDC':'ECDC assessment'}</span>
        <strong>{reviewTitle}</strong>
        <small>{reviewText}</small>
      </div>
    </div>
    <nav className="episode-section-tabs" aria-label={language==='el'?'Ενότητες επεισοδίου':'Episode sections'}>
      {stages.map(stage=><EpisodeTab key={stage.id} stage={stage} active={activeStage===stage.id} onSelect={onSelect}/>) }
    </nav>
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

function EpisodeTab({stage,active,onSelect}){
  const Icon=icons[stage.id]||Activity
  return <button type="button" className={`episode-section-tab ${active?'active':''} ${stage.status==='complete'?'complete':''} ${stage.locked?'locked':''}`.trim()} disabled={stage.locked} aria-current={active?'page':undefined} onClick={()=>onSelect?.(stage.id)}>
    <Icon size={16}/>
    <span><strong>{stage.label}</strong><small>{stage.meta}</small></span>
    {stage.status==='complete'&&<CheckCircle2 className="episode-tab-check" size={14}/>} 
  </button>
}
