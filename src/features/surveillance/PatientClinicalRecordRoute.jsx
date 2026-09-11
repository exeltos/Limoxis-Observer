import { useEffect, useMemo } from 'react'
import { useParams } from 'react-router-dom'
import { useTenant } from '../../core/tenant/TenantContext'
import { PatientClinicalRecordPage } from './PatientClinicalRecordPage'
import { PatientClinicalCloudRecordPage } from './PatientClinicalCloudRecordPage'
import { clinicalCases } from './clinicalDemoData'

const demoClinicalSeed=JSON.parse(JSON.stringify(clinicalCases))

function normalizeClinicalCase(row={}){
  const samples=Array.isArray(row.samples)?row.samples:[]
  const therapy=Array.isArray(row.therapy)?row.therapy:[]
  const reassessments=Array.isArray(row.reassessments)?row.reassessments:[]
  const timeline=Array.isArray(row.timeline)?row.timeline:[]
  const devices=Array.isArray(row.devices)?row.devices:[]
  const latestResult=samples.flatMap(sample=>(Array.isArray(sample?.microbiologyResults)?sample.microbiologyResults:[]).map(result=>({sample,result}))).find(item=>item.result)||null
  const assessment=row.assessment?{
    ...row.assessment,
    type:row.assessment.assessmentType||row.assessment.type||'other',
    symptoms:Array.isArray(row.assessment.signsSymptoms)?row.assessment.signsSymptoms:Array.isArray(row.assessment.symptoms)?row.assessment.symptoms:[],
    symptomsEn:Array.isArray(row.assessment.symptomsEn)?row.assessment.symptomsEn:Array.isArray(row.assessment.signsSymptoms)?row.assessment.signsSymptoms:[],
    riskFactors:Array.isArray(row.assessment.riskFactors)?row.assessment.riskFactors:[],
    riskFactorsEn:Array.isArray(row.assessment.riskFactorsEn)?row.assessment.riskFactorsEn:Array.isArray(row.assessment.riskFactors)?row.assessment.riskFactors:[],
    assessedBy:row.assessment.byId||row.assessment.assessedBy||'',
    screening:row.assessment.screening&&typeof row.assessment.screening==='object'?row.assessment.screening:{},
    summary:row.assessment.summary||'',
    summaryEn:row.assessment.summaryEn||row.assessment.summary||'',
    notes:row.assessment.notes||'',
    notesEn:row.assessment.notesEn||row.assessment.notes||'',
  }:null
  return {
    ...row,
    source:samples[0]?.source||'',
    sourceEn:samples[0]?.sourceEn||samples[0]?.source||'',
    organism:latestResult?.result?.organism||samples[0]?.organism||row.organism||'',
    resistance:latestResult?.result?.amr?.classification||latestResult?.result?.resistanceClass||samples[0]?.resistance||row.resistance||null,
    assessment,
    samples:samples.map(sample=>{
      const microbiologyResults=Array.isArray(sample?.microbiologyResults)?sample.microbiologyResults:[]
      const result=microbiologyResults.find(item=>item.validationStatus==='validated')||microbiologyResults[0]||null
      const communications=Array.isArray(result?.communications)?result.communications:[]
      const communication=communications[0]||null
      return {
        ...sample,
        id:sample?.id||sample?.recordId||'',
        type:sample?.type||sample?.sampleType||'other',
        collectedAt:sample?.collectedAt||null,
        resultedAt:sample?.resultedAt||result?.resultedAt||null,
        result:sample?.result||result?.status||'pending',
        organism:sample?.organism||result?.organism||null,
        resistance:sample?.resistance||result?.amr?.classification||result?.resistanceClass||null,
        susceptibility:sample?.susceptibility||result?.susceptibilitySummary||'',
        critical:Boolean(sample?.critical||result?.critical),
        communicatedAt:sample?.communicatedAt||communication?.at||null,
        microbiologyResults,
      }
    }),
    therapy:therapy.map(item=>({
      ...item,
      plannedEnd:item?.plannedEnd||item?.plannedEndAt||null,
      approved:item?.approved??item?.approvalStatus==='approved',
    })),
    isolation:row.isolation?{
      ...row.isolation,
      status:row.isolation.status||'active',
      nextReview:row.isolation.nextReview||row.isolation.reviewDue||null,
    }:null,
    reassessments:reassessments.map(item=>({...item,by:item?.by||item?.byId||''})),
    timeline:timeline.map(item=>({...item,actor:item?.actor||item?.actorId||'',detail:item?.detail||''})),
    devices:devices.map(item=>({...item,status:item?.status||'active'})),
  }
}

function replaceClinicalStore(rows){
  for(const key of Object.keys(clinicalCases))delete clinicalCases[key]
  for(const row of rows)clinicalCases[row.id]=row
}

export function PatientClinicalRecordRoute({patientMode=false}){
  const {isDemo}=useTenant()
  const {patientId}=useParams()
  const demoRows=useMemo(()=>Object.values(demoClinicalSeed),[])

  useEffect(()=>{
    if(!isDemo)return
    const rows=patientMode&&patientId?demoRows.filter(row=>String(row.patientId)===String(patientId)):demoRows
    replaceClinicalStore(rows.map(row=>normalizeClinicalCase(JSON.parse(JSON.stringify(row)))))
  },[isDemo,demoRows,patientMode,patientId])

  return isDemo?<PatientClinicalRecordPage patientMode={patientMode}/>:<PatientClinicalCloudRecordPage patientMode={patientMode}/>
}
