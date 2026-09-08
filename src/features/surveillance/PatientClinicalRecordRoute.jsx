import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Page } from '../../design-system/Page'
import { EmptyState } from '../../design-system/EmptyState'
import { useLanguage } from '../../core/i18n/LanguageContext'
import { useTenant } from '../../core/tenant/TenantContext'
import { PatientClinicalRecordPage } from './PatientClinicalRecordPage'
import { clinicalCases } from './clinicalDemoData'
import { loadClinicalCases, loadClinicalCasesForPatient } from './clinicalCloudService'
import { loadPatients } from '../patients/patientsService'

const demoClinicalSeed=JSON.parse(JSON.stringify(clinicalCases))

function normalizeClinicalCase(row={}){
  const samples=Array.isArray(row.samples)?row.samples:[]
  const therapy=Array.isArray(row.therapy)?row.therapy:[]
  const reassessments=Array.isArray(row.reassessments)?row.reassessments:[]
  const timeline=Array.isArray(row.timeline)?row.timeline:[]
  const devices=Array.isArray(row.devices)?row.devices:[]
  const latestResult=samples.flatMap(sample=>(sample.microbiologyResults||[]).map(result=>({sample,result}))).find(item=>item.result)||null
  const assessment=row.assessment?{
    ...row.assessment,
    type:row.assessment.assessmentType||row.assessment.type,
    symptoms:Array.isArray(row.assessment.signsSymptoms)?row.assessment.signsSymptoms:Array.isArray(row.assessment.symptoms)?row.assessment.symptoms:[],
    symptomsEn:Array.isArray(row.assessment.symptomsEn)?row.assessment.symptomsEn:Array.isArray(row.assessment.signsSymptoms)?row.assessment.signsSymptoms:[],
    riskFactors:Array.isArray(row.assessment.riskFactors)?row.assessment.riskFactors:[],
    riskFactorsEn:Array.isArray(row.assessment.riskFactorsEn)?row.assessment.riskFactorsEn:Array.isArray(row.assessment.riskFactors)?row.assessment.riskFactors:[],
    assessedBy:row.assessment.byId||row.assessment.assessedBy||'',
  }:null
  return {
    ...row,
    source:samples[0]?.source||'',
    sourceEn:samples[0]?.sourceEn||samples[0]?.source||'',
    organism:latestResult?.result?.organism||samples[0]?.organism||row.organism||'',
    resistance:latestResult?.result?.amr?.classification||latestResult?.result?.resistanceClass||samples[0]?.resistance||row.resistance||null,
    assessment,
    samples:samples.map(sample=>{
      const result=(sample.microbiologyResults||[]).find(item=>item.validationStatus==='validated')||(sample.microbiologyResults||[])[0]||null
      const communication=result?.communications?.[0]||null
      return {
        ...sample,
        collectedAt:sample.collectedAt||null,
        resultedAt:sample.resultedAt||result?.resultedAt||null,
        result:sample.result||result?.status||null,
        organism:sample.organism||result?.organism||null,
        resistance:sample.resistance||result?.amr?.classification||result?.resistanceClass||null,
        susceptibility:sample.susceptibility||result?.susceptibilitySummary||'',
        critical:Boolean(sample.critical||result?.critical),
        communicatedAt:sample.communicatedAt||communication?.at||null,
      }
    }),
    therapy:therapy.map(item=>({
      ...item,
      plannedEnd:item.plannedEnd||item.plannedEndAt||null,
      approved:item.approved??item.approvalStatus==='approved',
    })),
    isolation:row.isolation?{
      ...row.isolation,
      nextReview:row.isolation.nextReview||row.isolation.reviewDue||null,
    }:null,
    reassessments:reassessments.map(item=>({...item,by:item.by||item.byId||''})),
    timeline:timeline.map(item=>({...item,actor:item.actor||item.actorId||''})),
    devices,
  }
}

function replaceClinicalStore(rows){
  for(const key of Object.keys(clinicalCases))delete clinicalCases[key]
  for(const row of rows)clinicalCases[row.id]=row
}

export function PatientClinicalRecordRoute({patientMode=false}){
  const {isDemo,tenant}=useTenant()
  const {t}=useLanguage()
  const {patientId}=useParams()
  const [loading,setLoading]=useState(!isDemo)
  const [error,setError]=useState('')
  const tenantId=tenant?.id

  const demoRows=useMemo(()=>Object.values(demoClinicalSeed),[])

  useEffect(()=>{
    let alive=true
    if(isDemo){
      const rows=patientMode&&patientId?demoRows.filter(row=>String(row.patientId)===String(patientId)):demoRows
      replaceClinicalStore(rows.map(row=>normalizeClinicalCase(JSON.parse(JSON.stringify(row)))))
      setLoading(false)
      setError('')
      return ()=>{alive=false}
    }
    if(!tenantId){
      setLoading(false)
      setError(t('actionFailed'))
      return ()=>{alive=false}
    }

    setLoading(true)
    setError('')

    const request=patientMode&&patientId
      ? loadPatients(tenantId,{isDemo:false}).then(patientRows=>{
          const patient=patientRows.find(row=>String(row.id)===String(patientId))
          if(!patient?.recordId)return []
          return loadClinicalCasesForPatient(tenantId,patient.recordId)
        })
      : loadClinicalCases(tenantId)

    request
      .then(rows=>{
        if(!alive)return
        replaceClinicalStore((rows||[]).map(normalizeClinicalCase))
      })
      .catch(err=>{if(alive)setError(err?.message||t('actionFailed'))})
      .finally(()=>{if(alive)setLoading(false)})

    return ()=>{alive=false}
  },[isDemo,tenantId,demoRows,t,patientMode,patientId])

  if(loading)return <Page title={t('clinicalRecords.patientRecord')}><div className="surface clinical-surface"><p>{t('loading')}</p></div></Page>
  if(error)return <Page title={t('clinicalRecords.patientRecord')}><EmptyState title={t('actionFailed')} description={error}/></Page>
  return <PatientClinicalRecordPage patientMode={patientMode}/>
}
