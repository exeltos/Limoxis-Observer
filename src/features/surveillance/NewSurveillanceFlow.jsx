import { useMemo, useState } from 'react'
import { Activity, AlertTriangle, BedDouble, CheckCircle2, CircleCheckBig, FlaskConical, Microscope, Pill, Plus, RefreshCcw, ShieldCheck, X } from 'lucide-react'
import { Button } from '../../design-system/Button'
import { SaveButton } from '../../design-system/SaveButton'
import { ManualDateField } from '../../design-system/ManualDateField'
import { useLanguage } from '../../core/i18n/LanguageContext'
import { useFeedback } from '../../core/feedback/FeedbackContext'
import { useAuth } from '../../core/auth/AuthContext'
import { auditActorFromAuth } from '../../core/audit/actor'
import { demoLibrarySeed } from '../management/managementData'
import { createDemoLabSample, laboratorySamples } from '../laboratory/laboratoryDemoData'
import { createDemoPatient } from '../patients/patientDemoData'

const stepDefs=[
  {id:'start',label:'surveillanceStart',icon:Activity},
  {id:'assessment',label:'clinicalAssessment',icon:ShieldCheck},
  {id:'microbiology',label:'sampleAndLaboratory',icon:Microscope},
  {id:'hai',label:'haiAmr',icon:AlertTriangle},
  {id:'isolation',label:'isolation',icon:BedDouble},
  {id:'therapy',label:'therapy',icon:Pill},
  {id:'reassessment',label:'reassessment',icon:RefreshCcw},
  {id:'outcome',label:'outcome',icon:CircleCheckBig},
]

const screeningQuestions=[
  {id:'recentSurgery',label:'qRecentSurgery'},
  {id:'currentAntibiotics',label:'qCurrentAntibiotics'},
  {id:'recentHospitalization',label:'qRecentHospitalization'},
  {id:'transferFromFacility',label:'qTransferFromFacility'},
  {id:'invasiveDevice',label:'qInvasiveDevice'},
  {id:'knownMdro',label:'qKnownMdro'},
  {id:'immunosuppression',label:'qImmunosuppression'},
  {id:'recentProcedure',label:'qRecentProcedure'},
]
const allSymptoms=['fever','chills','hypotension','localSigns','cough','dyspnea','secretions','dysuria','urgency','suprapubicPain','woundDrainage','erythema','pain','diarrhea']
const allRisks=['device','recentSurgery','recentAntibiotics','immunosuppression','ventilation','aspiration','urinaryCatheter','urologicProcedure','centralLine','peripheralLine','recentHospitalization','transferFromFacility','knownMdro']
const sampleSourceNames={
  peripheral:{el:'Περιφερική αιμοληψία',en:'Peripheral draw'},centralLine:{el:'Κεντρική φλεβική γραμμή',en:'Central line'},arterialLine:{el:'Αρτηριακή γραμμή',en:'Arterial line'},
  midstream:{el:'Μέσο ρεύμα ούρων',en:'Midstream urine'},urinaryCatheter:{el:'Ουροκαθετήρας',en:'Urinary catheter'},nephrostomy:{el:'Νεφροστομία',en:'Nephrostomy'},suprapubicCatheter:{el:'Υπερηβικός καθετήρας',en:'Suprapubic catheter'},
  sputum:{el:'Πτύελα',en:'Sputum'},trachealAspirate:{el:'Τραχειακό αναρρόφημα',en:'Tracheal aspirate'},bal:{el:'BAL',en:'BAL'},
  woundSwab:{el:'Επίχρισμα τραύματος',en:'Wound swab'},deepTissue:{el:'Βαθύς ιστός',en:'Deep tissue'},drainage:{el:'Παροχέτευση / έκκριμα',en:'Drainage'},other:{el:'Άλλο',en:'Other'},
}
const sampleSourceOptions={
  bloodCulture:[['peripheral','peripheralBlood'],['centralLine','centralLine'],['arterialLine','arterialLine'],['other','other']],
  urineCulture:[['midstream','midstreamUrine'],['urinaryCatheter','urinaryCatheter'],['nephrostomy','nephrostomy'],['suprapubicCatheter','suprapubicCatheter'],['other','other']],
  respiratorySample:[['sputum','sputum'],['trachealAspirate','trachealAspirate'],['bal','bal'],['other','other']],
  woundCulture:[['woundSwab','woundSwab'],['deepTissue','deepTissue'],['drainage','drainage'],['other','other']],
}


export function NewSurveillanceFlow({patient=null,patients=[],onClose,onCreate,onRecordChange}){
  const {t,language}=useLanguage()
  const {notify}=useFeedback()
  const {profile,user}=useAuth()
  const actor=auditActorFromAuth({profile,user})
  const [patientMode,setPatientMode]=useState(patient?'fixed':'existing')
  const [selectedPatientId,setSelectedPatientId]=useState(patient?.id||'')
  const [createdPatient,setCreatedPatient]=useState(null)
  const selectedPatient=patient||createdPatient||patients.find(x=>x.id===selectedPatientId)||null
  const firstDepartment=[selectedPatient?.department,selectedPatient?.departmentEn]
  const [patientDraft,setPatientDraft]=useState({firstName:'',lastName:'',patronymic:'',firstNameEn:'',lastNameEn:'',patronymicEn:'',department:'',departmentEn:'',admissionDate:new Date().toISOString().slice(0,10),dateOfBirth:''})
  const today=new Date().toISOString().slice(0,10)
  const [record,setRecord]=useState(null)
  const [activeStep,setActiveStep]=useState('start')
  const [savedDraft,setSavedDraft]=useState(false)
  const [startDraft,setStartDraft]=useState({startedAt:today,reviewDue:'',room:'',reason:'',reasonEn:'',suspectedSource:'',department:firstDepartment[0]||'',departmentEn:firstDepartment[1]||''})
  const [assessmentDraft,setAssessmentDraft]=useState({date:today,summary:'',summaryEn:'',screening:Object.fromEntries(screeningQuestions.map(q=>[q.id,'unknown'])),symptoms:[],risks:[],customSymptoms:[],customRisks:[],notes:'',notesEn:''})
  const [sampleDraft,setSampleDraft]=useState({type:'bloodCulture',source:'peripheral',sourceEn:'peripheral',anatomicalSite:'',collectedAt:today,priority:'routine',notes:''})
  const [isolationNeeded,setIsolationNeeded]=useState(null)
  const [isolationDraft,setIsolationDraft]=useState({startedAt:today,precautionType:'contact',reason:'',reasonEn:'',provisional:true})
  const [customSymptom,setCustomSymptom]=useState('')
  const [customRisk,setCustomRisk]=useState('')
  const setStart=(k,v)=>setStartDraft(d=>({...d,[k]:v}))
  const setAssessment=(k,v)=>setAssessmentDraft(d=>({...d,[k]:v}))
  const setSample=(k,v)=>setSampleDraft(d=>({...d,[k]:v}))
  const setIsolation=(k,v)=>setIsolationDraft(d=>({...d,[k]:v}))
  const setPatientField=(k,v)=>setPatientDraft(d=>({...d,[k]:v}))
  function chooseExistingPatient(id){
    setSelectedPatientId(id)
    setCreatedPatient(null)
    const next=patients.find(x=>x.id===id)
    if(next)setStartDraft(d=>({...d,department:next.department||'',departmentEn:next.departmentEn||''}))
  }
  function setPatientDepartment(el){
    const pair=demoLibrarySeed.departments.find(([value])=>value===el)||[el,el]
    setPatientDraft(d=>({...d,department:pair[0],departmentEn:pair[1]}))
  }
  function buildInlinePatient(){
    if(!(patientDraft.firstName||patientDraft.firstNameEn)||!(patientDraft.lastName||patientDraft.lastNameEn)||!patientDraft.department||!patientDraft.admissionDate)return null
    const firstName=patientDraft.firstName||patientDraft.firstNameEn
    const lastName=patientDraft.lastName||patientDraft.lastNameEn
    const firstNameEn=patientDraft.firstNameEn||patientDraft.firstName
    const lastNameEn=patientDraft.lastNameEn||patientDraft.lastName
    const created=createDemoPatient({
      firstName,
      lastName,
      patronymic:patientDraft.patronymic||'',
      firstNameEn,
      lastNameEn,
      patronymicEn:patientDraft.patronymicEn||patientDraft.patronymic||'',
      name:`${firstName} ${lastName}`.trim(),
      nameEn:`${firstNameEn} ${lastNameEn}`.trim(),
      department:patientDraft.department,
      departmentEn:patientDraft.departmentEn||patientDraft.department,
      admissionDate:patientDraft.admissionDate,
      dateOfBirth:patientDraft.dateOfBirth||null,
    })
    setCreatedPatient(created)
    setSelectedPatientId(created.id)
    setStartDraft(d=>({...d,department:created.department,departmentEn:created.departmentEn}))
    notify(t('clinicalRecords.patientCreatedForSurveillance'),'success')
    return created
  }

  const linkedLabSamples=useMemo(()=>record?laboratorySamples.filter(x=>x.surveillanceCase===record.id):[],
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 'savedDraft'/'activeStep' force recompute after requestSample() mutates laboratorySamples in place (no new array reference otherwise).
    [record,savedDraft,activeStep])
  const validatedMicrobiology=linkedLabSamples.find(x=>x.resultStatus==='validated'&&x.organism)

  const completed=useMemo(()=>{
    const c=new Set()
    if(record)c.add('start')
    if(record?.assessment)c.add('assessment')
    if(linkedLabSamples.length)c.add('microbiology')
    if(record?.haiClassification)c.add('hai')
    if(record?.isolation||record?.isolationDecision?.required===false)c.add('isolation')
    if(record?.therapy?.length)c.add('therapy')
    if(record?.reassessments?.length)c.add('reassessment')
    if(record?.outcome)c.add('outcome')
    return c
  },[record,linkedLabSamples])

  function allowed(step){
    if(step==='start')return true
    if(step==='assessment')return Boolean(record)
    if(step==='microbiology')return Boolean(record?.assessment)
    if(step==='hai')return Boolean(validatedMicrobiology)
    if(step==='isolation')return Boolean(record?.assessment)
    if(step==='therapy')return Boolean(validatedMicrobiology)
    if(step==='reassessment')return Boolean(record?.assessment)&&(Boolean(record?.isolation)||Boolean(validatedMicrobiology)||Boolean(record?.haiClassification))
    if(step==='outcome')return Boolean(record?.reassessments?.length)
    return false
  }

  function saveStart(){
    let targetPatient=selectedPatient
    if(!targetPatient&&patientMode==='new')targetPatient=buildInlinePatient()
    if(!targetPatient||!startDraft.startedAt||!(startDraft.reason||startDraft.reasonEn))return
    if(!record){
      const created=onCreate(startDraft,targetPatient)
      if(!created)return
      setRecord(created)
      setSavedDraft(true)
      setActiveStep('assessment')
    }else{
      Object.assign(record,startDraft)
      setRecord({...record})
      onRecordChange?.(record)
      setSavedDraft(true)
      setActiveStep('assessment')
    }
  }
  function saveAssessment(){
    if(!record||!assessmentDraft.date)return
    const assessment={date:assessmentDraft.date||today,assessedBy:actor.name,summary:assessmentDraft.summary||assessmentDraft.summaryEn||'',summaryEn:assessmentDraft.summaryEn||assessmentDraft.summary||'',screening:{...assessmentDraft.screening},symptoms:[...assessmentDraft.symptoms,...assessmentDraft.customSymptoms],symptomsEn:[...assessmentDraft.symptoms,...assessmentDraft.customSymptoms],riskFactors:[...assessmentDraft.risks,...assessmentDraft.customRisks],riskFactorsEn:[...assessmentDraft.risks,...assessmentDraft.customRisks],notes:assessmentDraft.notes,notesEn:assessmentDraft.notesEn}
    record.assessment=assessment
    record.timeline=[{at:new Date().toISOString(),type:'clinicalAssessment',actor:actor.name,detail:'completed'},...(record.timeline||[])]
    setRecord({...record});onRecordChange?.(record)
    setActiveStep('microbiology')
  }
  function requestSample(){
    if(!record||!sampleDraft.type)return
    const id=`LAB-${new Date().toISOString().slice(2,10).replaceAll('-','')}-${String(laboratorySamples.length+1).padStart(3,'0')}`
    const sourceNames=sampleSourceNames[sampleDraft.source]||{el:sampleDraft.source,en:sampleDraft.source}
    const labPatient=selectedPatient||createdPatient
    if(!labPatient)return
    const lab={id,patient:labPatient.name,patientEn:labPatient.nameEn||labPatient.name,patientId:labPatient.id,department:startDraft.department||labPatient.department,departmentEn:startDraft.departmentEn||labPatient.departmentEn,type:sampleDraft.type,source:sourceNames.el,sourceEn:sourceNames.en,sourceCode:sampleDraft.source,anatomicalSite:sampleDraft.anatomicalSite,collectedAt:sampleDraft.collectedAt?`${sampleDraft.collectedAt}T12:00:00`:new Date().toISOString(),receivedAt:null,status:'requested',priority:sampleDraft.priority,organism:null,result:null,resultStatus:'draft',resultedAt:null,validatedAt:null,validatedBy:null,resistance:null,critical:false,surveillanceCase:record.id,ast:[],communications:[],attachments:[],timeline:[{at:new Date().toISOString(),type:'sampleRequested',actor:actor.name}],notes:sampleDraft.notes}
    createDemoLabSample(lab)
    record.samples=[...(record.samples||[]),{id,status:'requested',type:sampleDraft.type,collectedAt:lab.collectedAt,result:'pending',organism:null,resistance:null}]
    record.timeline=[{at:new Date().toISOString(),type:'sampleRequested',actor:actor.name,detail:id},...(record.timeline||[])]
    setRecord({...record})
    setSavedDraft(v=>!v)
    onRecordChange?.(record)
    notify(t('clinicalRecords.sampleRequestSavedContinueIsolation'),'success')
    setIsolationNeeded(record.isolation?true:(record.isolationDecision?.required===false?false:null))
    setActiveStep('isolation')
  }
  function saveIsolation(){
    if(!record||isolationNeeded===null)return
    const now=new Date().toISOString()
    if(isolationNeeded===false){
      record.isolation=null
      record.isolationDecision={required:false,decidedAt:now,by:actor.name}
      record.timeline=[{at:now,type:'isolationNotRequired',actor:actor.name,detail:'no'},...(record.timeline||[])]
      setRecord({...record});onRecordChange?.(record);notify(t('clinicalRecords.isolationDecisionSaved'),'success');onClose();return
    }
    if(!isolationDraft.startedAt)return
    record.isolationDecision={required:true,decidedAt:now,by:actor.name}
    record.isolation={id:record.isolation?.id||`ISO-${Date.now()}`,status:'active',startedAt:isolationDraft.startedAt,endedAt:null,type:isolationDraft.precautionType,precautions:[isolationDraft.precautionType],room:startDraft.room||'',nextReview:startDraft.reviewDue||null,reason:isolationDraft.reason||isolationDraft.reasonEn||'',reasonEn:isolationDraft.reasonEn||isolationDraft.reason||'',provisional:Boolean(isolationDraft.provisional),by:actor.name}
    record.timeline=[{at:now,type:record.isolation?.id?'isolationUpdated':'isolationStarted',actor:actor.name,detail:isolationDraft.precautionType},...(record.timeline||[])]
    setRecord({...record});onRecordChange?.(record);notify(t('isolationSaved'),'success');onClose()
  }
  function addCustom(field,value,setter){
    const clean=value.trim();if(!clean)return
    setAssessmentDraft(d=>({...d,[field]:d[field].includes(clean)?d[field]:[...d[field],clean]}));setter('')
  }
  function setScreening(id,value){setAssessmentDraft(d=>({...d,screening:{...d.screening,[id]:value}}))}
  const toggle=(field,item)=>setAssessmentDraft(d=>({...d,[field]:d[field].includes(item)?d[field].filter(x=>x!==item):[...d[field],item]}))

  return <div className="episode-overlay new-surveillance-flow-overlay" role="dialog" aria-modal="true">
    <section className="episode-detail-card new-surveillance-flow-card">
      <header className="episode-detail-header"><div><span className="eyebrow">{t('surveillance')}</span><h2>{record?record.id:t('newSurveillance')}</h2><p>{selectedPatient?`${language==='el'?selectedPatient.name:selectedPatient.nameEn||selectedPatient.name} · ${selectedPatient.id}`:t('clinicalRecords.selectPatient')}</p></div><div className="episode-detail-actions">{record&&<span className="status-badge active">{t('active')}</span>}<button title={t('close')} onClick={onClose}><X size={16}/></button></div></header>
      <div className="episode-detail-scroll progressive-surveillance-scroll">
        {!patient&&!record&&<div className="flow-patient-selector surveillance-patient-entry">
          <div className="entry-mode-switch">
            <button type="button" className={patientMode==='existing'?'active':''} onClick={()=>{setPatientMode('existing');setCreatedPatient(null);setSelectedPatientId('')}}>{t('existingPatient')}</button>
            <button type="button" className={patientMode==='new'?'active':''} onClick={()=>{setPatientMode('new');setCreatedPatient(null);setSelectedPatientId('')}}>{t('newPatient')}</button>
          </div>
          {patientMode==='existing'&&<label><span>{t('patient')}</span><select value={selectedPatientId} onChange={e=>chooseExistingPatient(e.target.value)}><option value="">{t('clinicalRecords.selectPatient')}</option>{patients.filter(x=>x.status==='active').map(item=><option key={item.id} value={item.id}>{language==='el'?item.name:item.nameEn||item.name} · {item.id}</option>)}</select></label>}
          {patientMode==='new'&&!createdPatient&&<div className="entry-grid inline-patient-create">
            <label><span>{t('firstName')}</span><input value={language==='el'?patientDraft.firstName:patientDraft.firstNameEn} onChange={e=>setPatientField(language==='el'?'firstName':'firstNameEn',e.target.value)}/></label>
            <label><span>{t('lastName')}</span><input value={language==='el'?patientDraft.lastName:patientDraft.lastNameEn} onChange={e=>setPatientField(language==='el'?'lastName':'lastNameEn',e.target.value)}/></label>
            <label><span>{t('clinicalRecords.patronymic')}</span><input value={language==='el'?patientDraft.patronymic:patientDraft.patronymicEn} onChange={e=>setPatientField(language==='el'?'patronymic':'patronymicEn',e.target.value)}/></label>
            <label><span>{t('department')}</span><select value={patientDraft.department} onChange={e=>setPatientDepartment(e.target.value)}><option value="">{t('select')}</option>{demoLibrarySeed.departments.map(([el,en])=><option key={el} value={el}>{language==='el'?el:en}</option>)}</select></label>
            <ManualDateField label={t('admissionDate')} value={patientDraft.admissionDate} onChange={v=>setPatientField('admissionDate',v)}/>
            <ManualDateField label={t('dateOfBirth')} optional value={patientDraft.dateOfBirth} onChange={v=>setPatientField('dateOfBirth',v)}/>
            <div className="entry-span-2 inline-create-note">{t('clinicalRecords.patientWillSaveWithSurveillance')}</div>
          </div>}
        </div>}
        {selectedPatient&&<div className="flow-patient-context"><div><strong>{language==='el'?selectedPatient.name:selectedPatient.nameEn||selectedPatient.name}</strong><small>{t('clinicalRecords.patientContextInherited')}</small></div><span>{selectedPatient.id} · {language==='el'?selectedPatient.department:selectedPatient.departmentEn}</span></div>}

        <div className="progressive-journey-header"><span className="eyebrow">{t('surveillanceJourney')}</span><h3>{t('clinicalRecords.surveillanceFlowTitle')}</h3><p>{t('clinicalRecords.strictFlowHelp')}</p></div>
        <div className="progressive-journey-rail">{stepDefs.map((step,index)=>{const Icon=step.icon;const canOpen=allowed(step);const complete=completed.has(step.id);const current=activeStep===step.id;return <button key={step.id} disabled={!canOpen} className={`progressive-step ${complete?'complete':''} ${current?'current':''} ${!canOpen?'locked':''}`} onClick={()=>canOpen&&setActiveStep(step.id)}><span className="progressive-step-icon">{complete?<CheckCircle2 size={16}/>:<Icon size={16}/>}</span><span><b>{String(index+1).padStart(2,'0')}</b><strong>{t(step.label)}</strong></span>{index<stepDefs.length-1&&<i>→</i>}</button>})}</div>
        <div className="progressive-guidance"><AlertTriangle size={16}/><div><strong>{t('clinicalRecords.guidanceForCurrentStep')}</strong><span>{t(`flowAdvice_${activeStep}`)}</span></div></div>

        {activeStep==='start'&&<section className="flow-step-panel"><div className="flow-step-heading"><div><span>01</span><h3>{t('surveillanceStart')}</h3></div><p>{t('clinicalRecords.surveillanceStartStepHelp')}</p></div><div className="entry-grid">
          <ManualDateField label={t('surveillanceStartDate')} value={startDraft.startedAt} onChange={v=>setStart('startedAt',v)}/>
          <ManualDateField label={t('nextReview')} optional value={startDraft.reviewDue} onChange={v=>setStart('reviewDue',v)}/>
          <label><span>{t('department')}</span><select value={startDraft.department} onChange={e=>{const pair=demoLibrarySeed.departments.find(([el])=>el===e.target.value)||[e.target.value,e.target.value];setStartDraft(d=>({...d,department:pair[0],departmentEn:pair[1]}))}}>{demoLibrarySeed.departments.map(([el,en])=><option key={el} value={el}>{language==='el'?el:en}</option>)}</select></label>
          <label><span>{t('room')}</span><input value={startDraft.room} onChange={e=>setStart('room',e.target.value)}/></label>
          <label><span>{t('clinicalRecords.suspectedSource')}</span><select value={startDraft.suspectedSource} onChange={e=>setStart('suspectedSource',e.target.value)}><option value="">{t('underAssessment')}</option><option value="bloodstream">{t('clinicalRecords.bloodstream')}</option><option value="urinary">{t('clinicalRecords.urinary')}</option><option value="respiratory">{t('clinicalRecords.respiratory')}</option><option value="surgicalSite">{t('clinicalRecords.surgicalSite')}</option><option value="other">{t('other')}</option></select></label>
          <label className="entry-span-2"><span>{t('surveillanceReason')}</span><textarea rows={3} value={language==='el'?startDraft.reason:startDraft.reasonEn} onChange={e=>setStart(language==='el'?'reason':'reasonEn',e.target.value)} placeholder={t('clinicalRecords.surveillanceReasonPlaceholder')}/></label>
        </div><div className="flow-step-actions"><Button variant="secondary" onClick={onClose}>{t('close')}</Button><Button disabled={!startDraft.startedAt||!(startDraft.reason||startDraft.reasonEn)||(patientMode==='existing'&&!selectedPatient)||(patientMode==='new'&&!createdPatient&&(!(patientDraft.firstName||patientDraft.firstNameEn)||!(patientDraft.lastName||patientDraft.lastNameEn)||!patientDraft.department||!patientDraft.admissionDate))} onClick={saveStart}>{t('clinicalRecords.continueToAssessment')}</Button></div></section>}

        {activeStep==='assessment'&&<section className="flow-step-panel"><div className="flow-step-heading"><div><span>02</span><h3>{t('clinicalAssessment')}</h3></div><p>{t('clinicalRecords.assessmentSimplifiedHelp')}</p></div>
          <ManualDateField label={t('assessmentDate')} value={assessmentDraft.date} onChange={v=>setAssessment('date',v)}/>
          <section className="screening-questionnaire"><div className="questionnaire-title"><div><strong>{t('riskScreeningQuestionnaire')}</strong><span>{t('clinicalRecords.riskScreeningQuestionnaireHelp')}</span></div></div><div className="questionnaire-grid">{screeningQuestions.map(q=><div key={q.id} className="questionnaire-item"><span>{t(q.label)}</span><select value={assessmentDraft.screening[q.id]} onChange={e=>setScreening(q.id,e.target.value)}><option value="unknown">{t('unknown')}</option><option value="yes">{t('yes')}</option><option value="no">{t('no')}</option></select></div>)}</div></section>
          <div className="clinical-check-grid"><ClinicalChecklist title={t('signsSymptoms')} items={allSymptoms} selected={assessmentDraft.symptoms} customItems={assessmentDraft.customSymptoms} onToggle={item=>toggle('symptoms',item)} onRemoveCustom={item=>setAssessmentDraft(d=>({...d,customSymptoms:d.customSymptoms.filter(x=>x!==item)}))} t={t}/><ClinicalChecklist title={t('riskFactors')} items={allRisks} selected={assessmentDraft.risks} customItems={assessmentDraft.customRisks} onToggle={item=>toggle('risks',item)} onRemoveCustom={item=>setAssessmentDraft(d=>({...d,customRisks:d.customRisks.filter(x=>x!==item)}))} t={t}/></div>
          <div className="custom-clinical-add"><label><span>{t('clinicalRecords.addSymptom')}</span><div><input value={customSymptom} onChange={e=>setCustomSymptom(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();addCustom('customSymptoms',customSymptom,setCustomSymptom)}}}/><button type="button" onClick={()=>addCustom('customSymptoms',customSymptom,setCustomSymptom)}><Plus size={14}/></button></div></label><label><span>{t('clinicalRecords.addRiskFactor')}</span><div><input value={customRisk} onChange={e=>setCustomRisk(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();addCustom('customRisks',customRisk,setCustomRisk)}}}/><button type="button" onClick={()=>addCustom('customRisks',customRisk,setCustomRisk)}><Plus size={14}/></button></div></label></div>
          <label className="assessment-summary"><span>{t('clinicalSummary')} <em>{t('optional')}</em></span><textarea rows={3} value={language==='el'?assessmentDraft.summary:assessmentDraft.summaryEn} onChange={e=>setAssessment(language==='el'?'summary':'summaryEn',e.target.value)}/></label>
          <label className="assessment-summary"><span>{t('notes')}</span><textarea rows={2} value={language==='el'?assessmentDraft.notes:assessmentDraft.notesEn} onChange={e=>setAssessment(language==='el'?'notes':'notesEn',e.target.value)}/></label>
          <div className="flow-step-actions"><Button variant="secondary" onClick={()=>setActiveStep('start')}>{t('clinicalRecords.previous')}</Button><Button disabled={!assessmentDraft.date} onClick={saveAssessment}>{t('saveAndContinue')}</Button></div>
        </section>}

        {activeStep==='microbiology'&&<section className="flow-step-panel"><div className="flow-step-heading"><div><span>03</span><h3>{t('sampleAndLaboratory')}</h3></div><p>{t('clinicalRecords.sampleWorkflowHelp')}</p></div>
          <div className="sample-request-card"><div className="entry-grid"><label><span>{t('sampleType')}</span><select value={sampleDraft.type} onChange={e=>{const type=e.target.value;const first=(sampleSourceOptions[type]||[])[0]?.[0]||'';setSampleDraft(d=>({...d,type,source:first,sourceEn:first,anatomicalSite:''}))}}><option value="bloodCulture">{t('bloodCulture')}</option><option value="urineCulture">{t('urineCulture')}</option><option value="respiratorySample">{t('respiratorySample')}</option><option value="woundCulture">{t('woundCulture')}</option></select></label><label><span>{t('collectionSource')}</span><select value={sampleDraft.source} onChange={e=>setSample('source',e.target.value)}>{(sampleSourceOptions[sampleDraft.type]||[]).map(([value,label])=><option key={value} value={value}>{t(label)}</option>)}</select></label><label><span>{t('anatomicalSite')}</span><input value={sampleDraft.anatomicalSite} onChange={e=>setSample('anatomicalSite',e.target.value)} placeholder={t(`siteHint_${sampleDraft.type}`)}/></label><ManualDateField label={t('clinicalRecords.sampleDate')} value={sampleDraft.collectedAt} onChange={v=>setSample('collectedAt',v)}/><label><span>{t('priority')}</span><select value={sampleDraft.priority} onChange={e=>setSample('priority',e.target.value)}><option value="routine">{t('routine')}</option><option value="urgent">{t('urgent')}</option><option value="critical">{t('critical')}</option></select></label><label className="entry-span-2"><span>{t('notes')}</span><textarea rows={2} value={sampleDraft.notes} onChange={e=>setSample('notes',e.target.value)}/></label></div><div className="flow-step-actions"><Button variant="secondary" onClick={()=>setActiveStep('assessment')}>{t('clinicalRecords.previous')}</Button><Button disabled={!sampleDraft.type||!sampleDraft.source} onClick={requestSample}><FlaskConical size={15}/>{t('clinicalRecords.saveAndNotifyLaboratory')}</Button></div></div>
          <div className="linked-lab-list">{linkedLabSamples.length?linkedLabSamples.map(x=><div key={x.id} className={`linked-lab-row ${x.organism?'validated':''}`}><div><strong>{x.id}</strong><span>{t(x.type)} · {t(x.status)}</span></div><div>{x.organism?<><b>{x.organism}</b>{x.resistance&&<em>{x.resistance}</em>}</>:<span>{t('waitingForLaboratory')}</span>}</div></div>):<div className="workflow-empty-step"><strong>{t('clinicalRecords.noSampleRequested')}</strong><span>{t('clinicalRecords.noSampleRequestedHint')}</span></div>}</div>
          {!validatedMicrobiology&&linkedLabSamples.length>0&&<div className="progressive-lock-note"><Microscope size={16}/><span>{t('clinicalRecords.microbiologyUnlockHint')}</span></div>}
        </section>}

        {activeStep==='hai'&&<LockedDetail title={t('haiAmr')} text={t('clinicalRecords.haiStepReady')} />}
        {activeStep==='isolation'&&<section className="flow-step-panel isolation-decision-step"><div className="flow-step-heading"><div><span>05</span><h3>{t('isolation')}</h3></div><p>{t('clinicalRecords.preventiveIsolationHelp')}</p></div>
          <div className={`isolation-question ${isolationNeeded===null?'required-decision':''}`}><strong>{t('isIsolationRequired')}</strong><span>{isolationNeeded===null?t('isolationDecisionRequired'):t('isIsolationRequiredHelp')}</span><div><button type="button" className={isolationNeeded===true?'selected yes':''} onClick={()=>setIsolationNeeded(true)}>{t('yes')}</button><button type="button" className={isolationNeeded===false?'selected no':''} onClick={()=>setIsolationNeeded(false)}>{t('no')}</button></div></div>
          {isolationNeeded===true&&<div className="entry-grid isolation-fields"><ManualDateField label={t('isolationStart')} value={isolationDraft.startedAt} onChange={v=>setIsolation('startedAt',v)}/><label><span>{t('precautionType')}</span><select value={isolationDraft.precautionType} onChange={e=>setIsolation('precautionType',e.target.value)}><option value="contact">{t('contactPrecautions')}</option><option value="droplet">{t('dropletPrecautions')}</option><option value="airborne">{t('airbornePrecautions')}</option><option value="protective">{t('protectiveIsolation')}</option><option value="other">{t('other')}</option></select></label><label className="entry-span-2"><span>{t('isolationReason')}</span><textarea rows={3} value={language==='el'?isolationDraft.reason:isolationDraft.reasonEn} onChange={e=>setIsolation(language==='el'?'reason':'reasonEn',e.target.value)}/></label><label className="inline-check entry-span-2"><input type="checkbox" checked={isolationDraft.provisional} onChange={e=>setIsolation('provisional',e.target.checked)}/><span>{t('provisionalIsolation')}</span></label></div>}
          {isolationNeeded===false&&<div className="no-isolation-note"><CheckCircle2 size={16}/><span>{t('noIsolationDecisionHint')}</span></div>}
          <div className="flow-step-actions"><Button variant="secondary" onClick={()=>setActiveStep('microbiology')}>{t('clinicalRecords.previous')}</Button><SaveButton disabled={isolationNeeded===null||(isolationNeeded===true&&!isolationDraft.startedAt)} onClick={saveIsolation}>{t('save')}</SaveButton></div></section>}
        {activeStep==='therapy'&&<LockedDetail title={t('therapy')} text={t('clinicalRecords.therapyStepReady')} />}
        {activeStep==='reassessment'&&<LockedDetail title={t('reassessment')} text={t('clinicalRecords.reassessmentStepReady')} />}
        {activeStep==='outcome'&&<LockedDetail title={t('outcome')} text={t('clinicalRecords.outcomeStepReady')} />}
      </div>
    </section>
  </div>
}

function ClinicalChecklist({title,items,selected,customItems=[],onToggle,onRemoveCustom,t}){return <section className="clinical-checklist"><h4>{title}</h4><div>{items.map(item=><label key={item} className={selected.includes(item)?'selected':''}><input type="checkbox" checked={selected.includes(item)} onChange={()=>onToggle(item)}/><span>{t(item)}</span></label>)}{customItems.map(item=><label key={`custom-${item}`} className="selected custom-clinical-item"><input type="checkbox" checked readOnly/><span>{item}</span><button type="button" onClick={e=>{e.preventDefault();onRemoveCustom?.(item)}}>×</button></label>)}</div></section>}
function LockedDetail({title,text}){return <section className="flow-step-panel"><div className="flow-step-heading"><div><h3>{title}</h3></div><p>{text}</p></div></section>}
