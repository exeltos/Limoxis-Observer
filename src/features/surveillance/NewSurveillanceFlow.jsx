import { useEffect, useMemo, useState } from 'react'
import { Activity, AlertTriangle, BedDouble, CheckCircle2, FlaskConical, Microscope, Plus, ShieldCheck, X } from 'lucide-react'
import { Button } from '../../design-system/Button'
import { SaveButton } from '../../design-system/SaveButton'
import { ManualDateField } from '../../design-system/ManualDateField'
import { useLanguage } from '../../core/i18n/LanguageContext'
import { useFeedback } from '../../core/feedback/FeedbackContext'
import { useAuth } from '../../core/auth/AuthContext'
import { useTenant } from '../../core/tenant/TenantContext'
import { auditActorFromAuth } from '../../core/audit/actor'
import { demoLibrarySeed } from '../management/managementData'
import { createManagementLibraryItem,loadManagementLibraries } from '../management/managementCloudService'
import { createDemoLabSample, laboratorySamples } from '../laboratory/laboratoryDemoData'
import { createPatient } from '../patients/patientsService'

const FLOW_RECOVERY_KEY='limoxis-new-surveillance-flow'

const stepDefs=[
  {id:'start',label:'surveillanceStart',icon:Activity},
  {id:'assessment',label:'clinicalAssessment',icon:ShieldCheck},
  {id:'microbiology',label:'sampleAndLaboratory',icon:Microscope},
  {id:'isolation',label:'isolation',icon:BedDouble},
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

const fallbackSymptoms=[
  ['Πυρετός','Fever',{code:'FEVER'}],['Ρίγος','Chills',{code:'CHILLS'}],['Υπόταση','Hypotension',{code:'HYPOTENSION'}],
  ['Βήχας','Cough',{code:'COUGH'}],['Δύσπνοια','Dyspnea',{code:'DYSPNEA'}],['Απόχρεμψη','Sputum production',{code:'SPUTUM'}],
  ['Δυσουρία','Dysuria',{code:'DYSURIA'}],['Συχνουρία','Urinary frequency',{code:'URINARY_FREQUENCY'}],['Κοιλιακό άλγος','Abdominal pain',{code:'ABDOMINAL_PAIN'}],
  ['Ερύθημα τραύματος','Wound erythema',{code:'WOUND_ERYTHEMA'}],['Πυώδης έκκριση','Purulent drainage',{code:'PURULENT_DRAINAGE'}],['Διάρροια','Diarrhea',{code:'DIARRHEA'}],
]
const fallbackRisks=[
  ['Ουροκαθετήρας','Urinary catheter',{code:'URINARY_CATHETER'}],['Κεντρικός φλεβικός καθετήρας','Central venous catheter',{code:'CVC'}],['Μηχανικός αερισμός','Mechanical ventilation',{code:'MECHANICAL_VENTILATION'}],
  ['Πρόσφατη χειρουργική επέμβαση','Recent surgery',{code:'RECENT_SURGERY'}],['Πρόσφατη λήψη αντιβιοτικών','Recent antibiotics',{code:'RECENT_ANTIBIOTICS'}],['Ανοσοκαταστολή','Immunosuppression',{code:'IMMUNOSUPPRESSION'}],
  ['Νοσηλεία σε ΜΕΘ','ICU stay',{code:'ICU_STAY'}],['Παρατεταμένη νοσηλεία','Prolonged hospitalization',{code:'PROLONGED_STAY'}],['Σακχαρώδης διαβήτης','Diabetes',{code:'DIABETES'}],
]

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

function libraryValue(row){return String(row?.[2]?.code||row?.[2]?.id||row?.[0]||'')}
function normalizeLibrary(rows=[]){
  const seen=new Set()
  return rows.filter(row=>{const key=libraryValue(row);if(!key||seen.has(key))return false;seen.add(key);return true})
}

export function NewSurveillanceFlow({patient=null,patients=[],departments=[],initialSample=null,onClose,onCreate,onSaveAssessment,onRequestSample,onSaveIsolation,onRecordChange,onPatientsChange}){
  const {t,language}=useLanguage()
  const {notify}=useFeedback()
  const {profile,user}=useAuth()
  const {tenant,isDemo}=useTenant()
  const actor=auditActorFromAuth({profile,user})
  const [patientMode,setPatientMode]=useState(patient?'fixed':'existing')
  const [selectedPatientId,setSelectedPatientId]=useState(patient?.id||'')
  const [createdPatient,setCreatedPatient]=useState(null)
  const selectedPatient=patient||createdPatient||patients.find(x=>x.id===selectedPatientId)||null
  const departmentPairs=departments.length?departments.map(item=>({id:item.id||item.value||'',el:item.el||item.label||item.name||'',en:item.en||item.labelEn||item.nameEn||item.name||''})):demoLibrarySeed.departments.map(([el,en])=>({id:'',el,en}))
  const firstDepartment=[selectedPatient?.department,selectedPatient?.departmentEn]
  const today=new Date().toISOString().slice(0,10)
  const [patientDraft,setPatientDraft]=useState({patientCode:'',firstName:'',lastName:'',patronymic:'',firstNameEn:'',lastNameEn:'',patronymicEn:'',departmentId:'',department:'',departmentEn:'',admissionDate:today,dateOfBirth:''})
  const [record,setRecord]=useState(null)
  const [activeStep,setActiveStep]=useState('start')
  const [completedSteps,setCompletedSteps]=useState(()=>new Set())
  const [savedDraft,setSavedDraft]=useState(false)
  const [busy,setBusy]=useState(false)
  const [startDraft,setStartDraft]=useState({startedAt:today,reviewDue:'',room:'',reason:'',reasonEn:'',suspectedSource:'',departmentId:selectedPatient?.departmentId||'',department:firstDepartment[0]||'',departmentEn:firstDepartment[1]||''})
  const [assessmentDraft,setAssessmentDraft]=useState({date:today,summary:'',summaryEn:'',screening:Object.fromEntries(screeningQuestions.map(q=>[q.id,'unknown'])),symptoms:[],risks:[],notes:'',notesEn:''})
  const [sampleDraft,setSampleDraft]=useState({type:'bloodCulture',source:'peripheral',sourceEn:'peripheral',anatomicalSite:'',collectedAt:today,priority:'routine',notes:''})
  const [isolationNeeded,setIsolationNeeded]=useState(null)
  const [isolationDraft,setIsolationDraft]=useState({startedAt:today,precautionType:'contact',reason:'',reasonEn:'',provisional:true})
  const [clinicalLibraries,setClinicalLibraries]=useState({clinicalSymptoms:fallbackSymptoms,clinicalRiskFactors:fallbackRisks})
  const [newSymptom,setNewSymptom]=useState('')
  const [newRisk,setNewRisk]=useState('')

  const symptomRows=useMemo(()=>normalizeLibrary(clinicalLibraries.clinicalSymptoms?.length?clinicalLibraries.clinicalSymptoms:fallbackSymptoms),[clinicalLibraries])
  const riskRows=useMemo(()=>normalizeLibrary(clinicalLibraries.clinicalRiskFactors?.length?clinicalLibraries.clinicalRiskFactors:fallbackRisks),[clinicalLibraries])
  const setStart=(k,v)=>setStartDraft(d=>({...d,[k]:v}))
  const setAssessment=(k,v)=>setAssessmentDraft(d=>({...d,[k]:v}))
  const setSample=(k,v)=>setSampleDraft(d=>({...d,[k]:v}))
  const setIsolation=(k,v)=>setIsolationDraft(d=>({...d,[k]:v}))
  const setPatientField=(k,v)=>setPatientDraft(d=>({...d,[k]:v}))
  const markComplete=step=>setCompletedSteps(current=>new Set([...current,step]))

  useEffect(()=>{
    if(isDemo||!tenant?.id)return
    let mounted=true
    loadManagementLibraries(tenant.id).then(rows=>{if(mounted)setClinicalLibraries(current=>({...current,clinicalSymptoms:rows.clinicalSymptoms||fallbackSymptoms,clinicalRiskFactors:rows.clinicalRiskFactors||fallbackRisks}))}).catch(()=>{})
    return()=>{mounted=false}
  },[isDemo,tenant?.id])

  useEffect(()=>{
    try{sessionStorage.removeItem(FLOW_RECOVERY_KEY)}catch{/* noop */}
  },[])

  function chooseExistingPatient(id){
    setSelectedPatientId(id);setCreatedPatient(null)
    const next=patients.find(x=>x.id===id)
    if(next)setStartDraft(d=>({...d,departmentId:next.departmentId||'',department:next.department||'',departmentEn:next.departmentEn||''}))
  }
  function setPatientDepartment(value){
    const pair=departmentPairs.find(item=>item.id===value||item.el===value)||{id:'',el:value,en:value}
    setPatientDraft(d=>({...d,departmentId:pair.id,department:pair.el,departmentEn:pair.en}))
  }
  async function buildInlinePatient(){
    if((!isDemo&&!patientDraft.patientCode.trim())||!(patientDraft.firstName||patientDraft.firstNameEn)||!(patientDraft.lastName||patientDraft.lastNameEn)||!patientDraft.department||!patientDraft.admissionDate)return null
    const firstName=patientDraft.firstName||patientDraft.firstNameEn,lastName=patientDraft.lastName||patientDraft.lastNameEn
    const firstNameEn=patientDraft.firstNameEn||patientDraft.firstName,lastNameEn=patientDraft.lastNameEn||patientDraft.lastName
    const {record:created,list}=await createPatient(tenant?.id,patients,{patientCode:patientDraft.patientCode.trim()||undefined,firstName,lastName,patronymic:patientDraft.patronymic||'',firstNameEn,lastNameEn,patronymicEn:patientDraft.patronymicEn||patientDraft.patronymic||'',name:`${firstName} ${lastName}`.trim(),nameEn:`${firstNameEn} ${lastNameEn}`.trim(),departmentId:patientDraft.departmentId||null,department:patientDraft.department,departmentEn:patientDraft.departmentEn||patientDraft.department,admissionDate:patientDraft.admissionDate,dateOfBirth:patientDraft.dateOfBirth||null},{isDemo})
    onPatientsChange?.(list);setCreatedPatient(created);setSelectedPatientId(created.id)
    setStartDraft(d=>({...d,departmentId:created.departmentId||'',department:created.department,departmentEn:created.departmentEn}))
    notify(t('clinicalRecords.patientCreatedForSurveillance'),'success')
    return created
  }

  const linkedLabSamples=useMemo(()=>record?(onRequestSample?(record.samples||[]):laboratorySamples.filter(x=>x.surveillanceCase===record.id)):[],[record,savedDraft,activeStep,onRequestSample])
  const surveillanceStartedFromSample=Boolean(initialSample)
  const alreadyHasSample=linkedLabSamples.length>0||surveillanceStartedFromSample
  const completed=useMemo(()=>{const c=new Set(completedSteps);if(record)c.add('start');if(record?.assessment)c.add('assessment');if(linkedLabSamples.length)c.add('microbiology');if(record?.isolation||record?.isolationDecision?.required===false)c.add('isolation');return c},[completedSteps,record,linkedLabSamples])
  function allowed(step){if(step==='start')return true;if(step==='assessment')return completed.has('start')||Boolean(record);if(step==='microbiology'||step==='isolation')return completed.has('assessment')||Boolean(record?.assessment);return false}
  const toggle=(field,value)=>setAssessmentDraft(d=>({...d,[field]:d[field].includes(value)?d[field].filter(x=>x!==value):[...d[field],value]}))
  const setScreening=(id,value)=>setAssessmentDraft(d=>({...d,screening:{...d.screening,[id]:value}}))

  async function addLibraryEntry(key,text,setter,field){
    const clean=text.trim();if(!clean)return
    try{
      let row=[clean,clean,{id:`local-${Date.now()}`,source:'Hospital',version:'local'}]
      if(!isDemo&&tenant?.id)row=await createManagementLibraryItem(tenant.id,key,{nameEl:clean,nameEn:clean})
      setClinicalLibraries(current=>({...current,[key]:normalizeLibrary([...(current[key]||[]),row])}))
      const value=libraryValue(row)
      setAssessmentDraft(d=>({...d,[field]:d[field].includes(value)?d[field]:[...d[field],value]}))
      setter('')
      notify(language==='el'?'Προστέθηκε στη βιβλιοθήκη και επιλέχθηκε.':'Added to the library and selected.','success')
    }catch(error){notify(error?.message||t('saveFailed'),'danger')}
  }

  async function saveStart(){
    if(busy)return;setBusy(true)
    try{
      let targetPatient=selectedPatient
      if(!targetPatient&&patientMode==='new')targetPatient=await buildInlinePatient()
      if(!targetPatient||!startDraft.startedAt||!(startDraft.reason||startDraft.reasonEn)){notify(language==='el'?'Συμπληρώστε τα υποχρεωτικά πεδία της έναρξης.':'Complete the required start fields.','warning');return}
      if(!record){
        const created=await onCreate({...startDraft,departmentId:startDraft.departmentId||targetPatient.departmentId||null},targetPatient)
        if(!created)throw new Error(language==='el'?'Δεν δημιουργήθηκε το επεισόδιο επιτήρησης.':'The surveillance episode was not created.')
        try{sessionStorage.setItem(FLOW_RECOVERY_KEY,JSON.stringify({record:created,at:Date.now()}))}catch{/* noop */}
        setRecord(created);markComplete('start');setSavedDraft(true);setActiveStep('assessment')
      }else{const next={...record,...startDraft};setRecord(next);markComplete('start');onRecordChange?.(next);setSavedDraft(true);setActiveStep('assessment')}
    }catch(error){notify(error?.message||t('actionFailed'),'danger')}finally{setBusy(false)}
  }

  async function saveAssessment(){
    if(busy||!record||!assessmentDraft.date)return;setBusy(true)
    try{
      const payload={date:assessmentDraft.date||today,assessedBy:actor.name,summary:assessmentDraft.summary||assessmentDraft.summaryEn||'',summaryEn:assessmentDraft.summaryEn||assessmentDraft.summary||'',screening:{...assessmentDraft.screening},symptoms:[...assessmentDraft.symptoms],symptomsEn:[...assessmentDraft.symptoms],riskFactors:[...assessmentDraft.risks],riskFactorsEn:[...assessmentDraft.risks],notes:assessmentDraft.notes,notesEn:assessmentDraft.notesEn,assessmentType:'suspected',classification:'undetermined',signsSymptoms:[...assessmentDraft.symptoms]}
      const persisted=onSaveAssessment?await onSaveAssessment(record,payload):payload
      const savedAssessment=persisted?.assessment||((persisted?.classification||persisted?.assessmentType||persisted?.date)?persisted:null)||payload
      const next={...record,assessment:savedAssessment,timeline:[{at:new Date().toISOString(),type:'clinicalAssessment',actor:actor.name,detail:'completed'},...(record.timeline||[])]}
      setRecord(next);markComplete('assessment');onRecordChange?.(next);setActiveStep('microbiology')
    }catch(error){notify(error?.message||t('actionFailed'),'danger')}finally{setBusy(false)}
  }

  async function requestSample(){
    if(busy||!record||!sampleDraft.type)return;setBusy(true)
    try{
      const id=`LAB-${new Date().toISOString().slice(2,10).replaceAll('-','')}-${String(laboratorySamples.length+1).padStart(3,'0')}`
      const sourceNames=sampleSourceNames[sampleDraft.source]||{el:sampleDraft.source,en:sampleDraft.source}
      const labPatient=selectedPatient||createdPatient||patient
      if(!labPatient)throw new Error(language==='el'?'Δεν βρέθηκε ο ασθενής του επεισοδίου.':'Episode patient was not found.')
      const lab={id,patient:labPatient.name,patientEn:labPatient.nameEn||labPatient.name,patientId:labPatient.id,department:startDraft.department||labPatient.department,departmentEn:startDraft.departmentEn||labPatient.departmentEn,type:sampleDraft.type,source:sourceNames.el,sourceEn:sourceNames.en,sourceCode:sampleDraft.source,anatomicalSite:sampleDraft.anatomicalSite,collectedAt:sampleDraft.collectedAt?`${sampleDraft.collectedAt}T12:00:00`:new Date().toISOString(),receivedAt:null,status:'requested',priority:sampleDraft.priority,organism:null,result:null,resultStatus:'draft',resultedAt:null,validatedAt:null,validatedBy:null,resistance:null,critical:false,surveillanceCase:record.id,ast:[],communications:[],attachments:[],timeline:[{at:new Date().toISOString(),type:'sampleRequested',actor:actor.name}],notes:sampleDraft.notes}
      const createdSample=onRequestSample?await onRequestSample(record,{...sampleDraft,source:sourceNames.el}):(createDemoLabSample(lab),lab)
      const sample=createdSample||{id,status:'requested',type:sampleDraft.type,collectedAt:lab.collectedAt,result:'pending',organism:null,resistance:null}
      const next={...record,samples:[...(record.samples||[]),sample],timeline:[{at:new Date().toISOString(),type:'sampleRequested',actor:actor.name,detail:sample.id||id},...(record.timeline||[])]}
      setRecord(next);markComplete('microbiology');setSavedDraft(v=>!v);onRecordChange?.(next);setIsolationNeeded(next.isolation?true:(next.isolationDecision?.required===false?false:null));setActiveStep('isolation');notify(t('clinicalRecords.sampleRequestSavedContinueIsolation'),'success')
    }catch(error){notify(error?.message||t('actionFailed'),'danger')}finally{setBusy(false)}
  }
  function continueWithoutSample(){markComplete('microbiology');setIsolationNeeded(record?.isolation?true:(record?.isolationDecision?.required===false?false:null));setActiveStep('isolation')}

  async function saveIsolation(){
    if(busy||!record||isolationNeeded===null)return;setBusy(true)
    try{
      const now=new Date().toISOString()
      if(isolationNeeded===false){if(onSaveIsolation)await onSaveIsolation(record,{required:false,decidedAt:now});const next={...record,isolation:null,isolationDecision:{required:false,decidedAt:now,by:actor.name},timeline:[{at:now,type:'isolationNotRequired',actor:actor.name,detail:'no'},...(record.timeline||[])]};setRecord(next);markComplete('isolation');onRecordChange?.(next);notify(t('clinicalRecords.isolationDecisionSaved'),'success');sessionStorage.removeItem(FLOW_RECOVERY_KEY);onClose();return}
      if(!isolationDraft.startedAt)return
      const draft={required:true,precautions:[isolationDraft.precautionType],room:startDraft.room||'',reason:isolationDraft.reason||isolationDraft.reasonEn||'',startedAt:isolationDraft.startedAt,reviewDue:startDraft.reviewDue||null}
      const persisted=onSaveIsolation?await onSaveIsolation(record,draft):null
      const savedIsolation=persisted?.isolation||((persisted?.status||persisted?.precautions||persisted?.startedAt)?persisted:null)||{id:record.isolation?.id||`ISO-${Date.now()}`,status:'active',startedAt:isolationDraft.startedAt,type:isolationDraft.precautionType,precautions:[isolationDraft.precautionType],room:startDraft.room||'',reason:isolationDraft.reason||isolationDraft.reasonEn||'',by:actor.name}
      const next={...record,isolationDecision:{required:true,decidedAt:now,by:actor.name},isolation:savedIsolation,timeline:[{at:now,type:'isolationStarted',actor:actor.name,detail:isolationDraft.precautionType},...(record.timeline||[])]}
      setRecord(next);markComplete('isolation');onRecordChange?.(next);notify(t('isolationSaved'),'success');sessionStorage.removeItem(FLOW_RECOVERY_KEY);onClose()
    }catch(error){notify(error?.message||t('actionFailed'),'danger')}finally{setBusy(false)}
  }

  function closeFlow(){try{sessionStorage.removeItem(FLOW_RECOVERY_KEY)}catch{/* noop */}onClose()}

  return <div className="episode-overlay new-surveillance-flow-overlay" role="dialog" aria-modal="true">
    <section className="episode-detail-card new-surveillance-flow-card">
      <header className="episode-detail-header"><div><span className="eyebrow">{t('surveillance')}</span><h2>{record?record.id:t('newSurveillance')}</h2><p>{selectedPatient?`${language==='el'?selectedPatient.name:selectedPatient.nameEn||selectedPatient.name} · ${selectedPatient.id}`:t('clinicalRecords.selectPatient')}</p></div><div className="episode-detail-actions">{record&&<span className="status-badge active">{t('active')}</span>}<button title={t('close')} onClick={closeFlow}><X size={16}/></button></div></header>
      <div className="episode-detail-scroll progressive-surveillance-scroll">
        {!patient&&!record&&<div className="flow-patient-selector surveillance-patient-entry"><div className="entry-mode-switch"><button type="button" className={patientMode==='existing'?'active':''} onClick={()=>{setPatientMode('existing');setCreatedPatient(null);setSelectedPatientId('')}}>{t('existingPatient')}</button><button type="button" className={patientMode==='new'?'active':''} onClick={()=>{setPatientMode('new');setCreatedPatient(null);setSelectedPatientId('')}}>{t('newPatient')}</button></div>{patientMode==='existing'&&<label><span>{t('patient')}</span><select value={selectedPatientId} onChange={e=>chooseExistingPatient(e.target.value)}><option value="">{t('clinicalRecords.selectPatient')}</option>{patients.filter(x=>x.status==='active').map(item=><option key={item.id} value={item.id}>{language==='el'?item.name:item.nameEn||item.name} · {item.id}</option>)}</select></label>}{patientMode==='new'&&!createdPatient&&<div className="entry-grid inline-patient-create">{!isDemo&&<label><span>{t('patientId')}</span><input value={patientDraft.patientCode} onChange={e=>setPatientField('patientCode',e.target.value)}/></label>}<label><span>{t('firstName')}</span><input value={language==='el'?patientDraft.firstName:patientDraft.firstNameEn} onChange={e=>setPatientField(language==='el'?'firstName':'firstNameEn',e.target.value)}/></label><label><span>{t('lastName')}</span><input value={language==='el'?patientDraft.lastName:patientDraft.lastNameEn} onChange={e=>setPatientField(language==='el'?'lastName':'lastNameEn',e.target.value)}/></label><label><span>{t('department')}</span><select value={patientDraft.departmentId||patientDraft.department} onChange={e=>setPatientDepartment(e.target.value)}><option value="">{t('select')}</option>{departmentPairs.map(item=><option key={item.id||item.el} value={item.id||item.el}>{language==='el'?item.el:item.en}</option>)}</select></label><ManualDateField label={t('admissionDate')} value={patientDraft.admissionDate} onChange={v=>setPatientField('admissionDate',v)}/></div>}</div>}
        {selectedPatient&&<div className="flow-patient-context"><div><strong>{language==='el'?selectedPatient.name:selectedPatient.nameEn||selectedPatient.name}</strong><small>{t('clinicalRecords.patientContextInherited')}</small></div><span>{selectedPatient.id} · {language==='el'?selectedPatient.department:selectedPatient.departmentEn}</span></div>}

        <div className="progressive-journey-header"><span className="eyebrow">{t('surveillanceJourney')}</span><h3>{t('clinicalRecords.surveillanceFlowTitle')}</h3><p>{t('clinicalRecords.strictFlowHelp')}</p></div>
        <div className="progressive-journey-rail">{stepDefs.map((step,index)=>{const Icon=step.icon,canOpen=allowed(step),complete=completed.has(step.id),current=activeStep===step.id;return <button key={step.id} disabled={!canOpen} className={`progressive-step ${complete?'complete':''} ${current?'current':''} ${!canOpen?'locked':''}`} onClick={()=>canOpen&&setActiveStep(step.id)}><span className="progressive-step-icon">{complete?<CheckCircle2 size={16}/>:<Icon size={16}/>}</span><span><b>{String(index+1).padStart(2,'0')}</b><strong>{t(step.label)}</strong></span>{index<stepDefs.length-1&&<i>→</i>}</button>})}</div>
        <div className="progressive-guidance"><AlertTriangle size={16}/><div><strong>{t('clinicalRecords.guidanceForCurrentStep')}</strong><span>{t(`flowAdvice_${activeStep}`)}</span></div></div>

        {activeStep==='start'&&<section className="flow-step-panel"><div className="flow-step-heading"><div><span>01</span><h3>{t('surveillanceStart')}</h3></div><p>{t('clinicalRecords.surveillanceStartStepHelp')}</p></div><div className="entry-grid"><ManualDateField label={t('surveillanceStartDate')} value={startDraft.startedAt} onChange={v=>setStart('startedAt',v)}/><ManualDateField label={t('nextReview')} optional value={startDraft.reviewDue} onChange={v=>setStart('reviewDue',v)}/><label><span>{t('department')}</span><select value={startDraft.departmentId||startDraft.department} onChange={e=>{const pair=departmentPairs.find(item=>item.id===e.target.value||item.el===e.target.value)||{id:'',el:e.target.value,en:e.target.value};setStartDraft(d=>({...d,departmentId:pair.id,department:pair.el,departmentEn:pair.en}))}}>{departmentPairs.map(item=><option key={item.id||item.el} value={item.id||item.el}>{language==='el'?item.el:item.en}</option>)}</select></label><label><span>{t('room')}</span><input value={startDraft.room} onChange={e=>setStart('room',e.target.value)}/></label><label><span>{t('clinicalRecords.suspectedSource')}</span><select value={startDraft.suspectedSource} onChange={e=>setStart('suspectedSource',e.target.value)}><option value="">{t('underAssessment')}</option><option value="bloodstream">{t('clinicalRecords.bloodstream')}</option><option value="urinary">{t('clinicalRecords.urinary')}</option><option value="respiratory">{t('clinicalRecords.respiratory')}</option><option value="surgicalSite">{t('clinicalRecords.surgicalSite')}</option><option value="other">{t('other')}</option></select></label><label className="entry-span-2"><span>{t('surveillanceReason')}</span><textarea rows={3} value={language==='el'?startDraft.reason:startDraft.reasonEn} onChange={e=>setStart(language==='el'?'reason':'reasonEn',e.target.value)}/></label></div><div className="flow-step-actions"><Button variant="secondary" onClick={closeFlow}>{t('close')}</Button><Button disabled={busy||!startDraft.startedAt||!(startDraft.reason||startDraft.reasonEn)||(patientMode==='existing'&&!selectedPatient)} onClick={saveStart}>{busy?(language==='el'?'Αποθήκευση…':'Saving…'):t('clinicalRecords.continueToAssessment')}</Button></div></section>}

        {activeStep==='assessment'&&<section className="flow-step-panel"><div className="flow-step-heading"><div><span>02</span><h3>{t('clinicalAssessment')}</h3></div><p>{language==='el'?'Τα σημεία/συμπτώματα και οι παράγοντες κινδύνου προέρχονται από τη Βιβλιοθήκη του νοσοκομείου.':'Signs/symptoms and risk factors are loaded from the hospital Library.'}</p></div><ManualDateField label={t('assessmentDate')} value={assessmentDraft.date} onChange={v=>setAssessment('date',v)}/><div className="clinical-check-grid library-clinical-grid"><LibraryChecklist title={t('signsSymptoms')} rows={symptomRows} selected={assessmentDraft.symptoms} onToggle={value=>toggle('symptoms',value)} language={language}/><LibraryChecklist title={t('riskFactors')} rows={riskRows} selected={assessmentDraft.risks} onToggle={value=>toggle('risks',value)} language={language}/></div><div className="custom-clinical-add library-add-row"><label><span>{language==='el'?'Προσθήκη σημείου / συμπτώματος στη Βιβλιοθήκη':'Add sign / symptom to Library'}</span><div><input value={newSymptom} onChange={e=>setNewSymptom(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();void addLibraryEntry('clinicalSymptoms',newSymptom,setNewSymptom,'symptoms')}}}/><button type="button" onClick={()=>void addLibraryEntry('clinicalSymptoms',newSymptom,setNewSymptom,'symptoms')}><Plus size={14}/></button></div></label><label><span>{language==='el'?'Προσθήκη παράγοντα κινδύνου στη Βιβλιοθήκη':'Add risk factor to Library'}</span><div><input value={newRisk} onChange={e=>setNewRisk(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();void addLibraryEntry('clinicalRiskFactors',newRisk,setNewRisk,'risks')}}}/><button type="button" onClick={()=>void addLibraryEntry('clinicalRiskFactors',newRisk,setNewRisk,'risks')}><Plus size={14}/></button></div></label></div><details className="secondary-risk-screen"><summary>{language==='el'?'Επιπλέον έλεγχος παραγόντων κινδύνου':'Additional risk screening'}</summary><section className="screening-questionnaire"><div className="questionnaire-grid">{screeningQuestions.map(q=><div key={q.id} className="questionnaire-item"><span>{t(q.label)}</span><select value={assessmentDraft.screening[q.id]} onChange={e=>setScreening(q.id,e.target.value)}><option value="unknown">{t('unknown')}</option><option value="yes">{t('yes')}</option><option value="no">{t('no')}</option></select></div>)}</div></section></details><label className="assessment-summary"><span>{t('clinicalSummary')} <em>{t('optional')}</em></span><textarea rows={3} value={language==='el'?assessmentDraft.summary:assessmentDraft.summaryEn} onChange={e=>setAssessment(language==='el'?'summary':'summaryEn',e.target.value)}/></label><label className="assessment-summary"><span>{t('notes')}</span><textarea rows={2} value={language==='el'?assessmentDraft.notes:assessmentDraft.notesEn} onChange={e=>setAssessment(language==='el'?'notes':'notesEn',e.target.value)}/></label><div className="flow-step-actions"><Button variant="secondary" onClick={()=>setActiveStep('start')}>{t('clinicalRecords.previous')}</Button><Button disabled={busy||!assessmentDraft.date} onClick={saveAssessment}>{busy?(language==='el'?'Αποθήκευση…':'Saving…'):t('saveAndContinue')}</Button></div></section>}

        {activeStep==='microbiology'&&<section className="flow-step-panel"><div className="flow-step-heading"><div><span>03</span><h3>{t('sampleAndLaboratory')}</h3></div><p>{alreadyHasSample?(language==='el'?'Η επιτήρηση έχει ήδη συνδεδεμένο δείγμα. Δεν απαιτείται νέα καταχώρηση· συνεχίστε στο επόμενο βήμα.':'This surveillance already has a linked sample. No duplicate entry is required; continue to the next step.'):(language==='el'?'Μπορείτε να προσθέσετε νέο δείγμα ή να συνεχίσετε χωρίς νέο δείγμα.':'Add a new sample or continue without a new sample.')}</p></div><div className="sample-request-card">{!alreadyHasSample&&<div className="entry-grid"><label><span>{t('sampleType')}</span><select value={sampleDraft.type} onChange={e=>{const type=e.target.value,first=(sampleSourceOptions[type]||[])[0]?.[0]||'';setSampleDraft(d=>({...d,type,source:first,sourceEn:first,anatomicalSite:''}))}}><option value="bloodCulture">{t('bloodCulture')}</option><option value="urineCulture">{t('urineCulture')}</option><option value="respiratorySample">{t('respiratorySample')}</option><option value="woundCulture">{t('woundCulture')}</option></select></label><label><span>{t('collectionSource')}</span><select value={sampleDraft.source} onChange={e=>setSample('source',e.target.value)}>{(sampleSourceOptions[sampleDraft.type]||[]).map(([value,label])=><option key={value} value={value}>{t(label)}</option>)}</select></label><label><span>{t('anatomicalSite')}</span><input value={sampleDraft.anatomicalSite} onChange={e=>setSample('anatomicalSite',e.target.value)}/></label><ManualDateField label={t('clinicalRecords.sampleDate')} value={sampleDraft.collectedAt} onChange={v=>setSample('collectedAt',v)}/><label><span>{t('priority')}</span><select value={sampleDraft.priority} onChange={e=>setSample('priority',e.target.value)}><option value="routine">{t('routine')}</option><option value="urgent">{t('urgent')}</option><option value="critical">{t('critical')}</option></select></label></div>}<div className="flow-step-actions"><Button variant="secondary" onClick={()=>setActiveStep('assessment')}>{t('clinicalRecords.previous')}</Button><Button variant="ghost" disabled={busy} onClick={continueWithoutSample}>{alreadyHasSample?(language==='el'?'Συνέχεια':'Continue'):(language==='el'?'Συνέχεια χωρίς νέο δείγμα':'Continue without new sample')}</Button>{!alreadyHasSample&&<Button disabled={busy||!sampleDraft.type||!sampleDraft.source} onClick={requestSample}><FlaskConical size={15}/>{busy?(language==='el'?'Αποθήκευση…':'Saving…'):t('clinicalRecords.saveAndNotifyLaboratory')}</Button>}</div></div><div className="linked-lab-list">{linkedLabSamples.length?linkedLabSamples.map(x=><div key={x.id} className={`linked-lab-row ${x.organism?'validated':''}`}><div><strong>{x.id}</strong><span>{t(x.type)} · {t(x.status)}</span></div><div>{x.organism?<b>{x.organism}</b>:<span>{t('waitingForLaboratory')}</span>}</div></div>):<div className="workflow-empty-step"><strong>{t('clinicalRecords.noSampleRequested')}</strong><span>{language==='el'?'Δεν απαιτείται υποχρεωτικά νέο δείγμα.':'A new sample is not mandatory.'}</span></div>}</div></section>}

        {activeStep==='isolation'&&<section className="flow-step-panel isolation-decision-step"><div className="flow-step-heading"><div><span>04</span><h3>{t('isolation')}</h3></div><p>{t('clinicalRecords.preventiveIsolationHelp')}</p></div><div className={`isolation-question ${isolationNeeded===null?'required-decision':''}`}><strong>{t('isIsolationRequired')}</strong><span>{isolationNeeded===null?t('isolationDecisionRequired'):t('isIsolationRequiredHelp')}</span><div><button type="button" className={isolationNeeded===true?'selected yes':''} onClick={()=>setIsolationNeeded(true)}>{t('yes')}</button><button type="button" className={isolationNeeded===false?'selected no':''} onClick={()=>setIsolationNeeded(false)}>{t('no')}</button></div></div>{isolationNeeded===true&&<div className="entry-grid isolation-fields"><ManualDateField label={t('isolationStart')} value={isolationDraft.startedAt} onChange={v=>setIsolation('startedAt',v)}/><label><span>{t('precautionType')}</span><select value={isolationDraft.precautionType} onChange={e=>setIsolation('precautionType',e.target.value)}><option value="contact">{t('contactPrecautions')}</option><option value="droplet">{t('dropletPrecautions')}</option><option value="airborne">{t('airbornePrecautions')}</option><option value="protective">{t('protectiveIsolation')}</option><option value="other">{t('other')}</option></select></label><label className="entry-span-2"><span>{t('isolationReason')}</span><textarea rows={3} value={language==='el'?isolationDraft.reason:isolationDraft.reasonEn} onChange={e=>setIsolation(language==='el'?'reason':'reasonEn',e.target.value)}/></label></div>}{isolationNeeded===false&&<div className="no-isolation-note"><CheckCircle2 size={16}/><span>{t('noIsolationDecisionHint')}</span></div>}<div className="flow-step-actions"><Button variant="secondary" onClick={()=>setActiveStep('microbiology')}>{t('clinicalRecords.previous')}</Button><SaveButton disabled={busy||isolationNeeded===null||(isolationNeeded===true&&!isolationDraft.startedAt)} onClick={saveIsolation}>{busy?(language==='el'?'Αποθήκευση…':'Saving…'):t('save')}</SaveButton></div></section>}
      </div>
    </section>
  </div>
}


function LibraryChecklist({title,rows,selected,onToggle,language}){
  const [open,setOpen]=useState(false)
  const [query,setQuery]=useState('')
  const selectedRows=rows.filter(row=>selected.includes(libraryValue(row)))
  const normalizedQuery=query.trim().toLocaleLowerCase()
  const filtered=rows.filter(row=>{
    const label=language==='el'?(row[0]||row[1]):(row[1]||row[0])
    return !normalizedQuery||String(label||'').toLocaleLowerCase().includes(normalizedQuery)
  })
  const summary=selectedRows.length
    ? `${selectedRows.length} ${language==='el'?'επιλεγμένα':'selected'}`
    : (language==='el'?'Επιλέξτε από τη λίστα':'Select from list')
  return <section className="clinical-checklist library-checklist clinical-library-multiselect">
    <h4>{title}</h4>
    <button type="button" className="clinical-library-trigger" aria-expanded={open} onClick={()=>setOpen(value=>!value)}>
      <span>{summary}</span><span className={open?'open':''} aria-hidden="true">⌄</span>
    </button>
    {open&&<div className="clinical-library-menu">
      <input className="clinical-library-search" value={query} onChange={event=>setQuery(event.target.value)} placeholder={language==='el'?'Αναζήτηση...':'Search...'} autoFocus/>
      <div className="clinical-library-options">
        {filtered.map(row=>{const value=libraryValue(row);const label=language==='el'?(row[0]||row[1]):(row[1]||row[0]);return <label key={value} className={selected.includes(value)?'selected':''}><input type="checkbox" checked={selected.includes(value)} onChange={()=>onToggle(value)}/><span>{label}</span></label>})}
        {!filtered.length&&<div className="clinical-library-empty">{language==='el'?'Δεν βρέθηκαν επιλογές':'No options found'}</div>}
      </div>
    </div>}
    {selectedRows.length>0&&<div className="clinical-library-selected">
      {selectedRows.map(row=>{const value=libraryValue(row);const label=language==='el'?(row[0]||row[1]):(row[1]||row[0]);return <button type="button" key={value} onClick={()=>onToggle(value)} title={language==='el'?'Αφαίρεση':'Remove'}>{label}<span aria-hidden="true">×</span></button>})}
    </div>}
  </section>
}
