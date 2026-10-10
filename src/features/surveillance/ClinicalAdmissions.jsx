import { DueDate,daysOverdue } from '../../design-system/DueDate'
import { useState } from 'react'
import { stayDays } from './patientRecordScope'
import { AlertTriangle,Plus,ArrowRightLeft,LogOut } from 'lucide-react'
import { Button } from '../../design-system/Button'
import { OverflowMenu } from '../../design-system/OverflowMenu'
import { ManualDateField } from '../../design-system/ManualDateField'
import { translate } from '../../core/i18n/LanguageContext'
import { useFeedback } from '../../core/feedback/FeedbackContext'
import { createAdmission,dischargeAdmission,transferAdmission } from '../patients/patientsService'
import { PatientSummaryActions } from '../patients/PatientSummaryActions'
import { SimpleDialog } from './ClinicalRecordDialogs'

// Admissions of the clinical record: patient admissions home, admission summary
// and lifecycle actions (admit, transfer, discharge).

export function PatientAdmissionsHome({patient,rows,episodes,tenantId,isDemo,departments,canEdit,t,language,fmtDate,onAdded,onChanged,onSelect,actions}){
  // Ages under a year read as "N days" (matching NHSN's ≤1-year pediatric
  // population) rather than the years figure that would round every
  // neonate down to "0" and hide clinically relevant age.
  const ageInDays=patient?.dateOfBirth?Math.max(0,Math.floor((Date.now()-new Date(`${patient.dateOfBirth}T12:00:00`).getTime())/86400000)):null
  const ageLabel=ageInDays==null?'—':ageInDays<366?`${ageInDays} ${translate('copy.clinicalRecordCopy.days',language==='el'?'el':'en')}`:`${Math.floor(ageInDays/365.25)} ${translate('copy.clinicalRecordCopy.years',language==='el'?'el':'en')}`
  // Infants without a birth weight drop out of the NHSN birth-weight-band
  // CLABSI indicators, so say so where the value can be corrected.
  const infantWithoutBirthWeight=ageInDays!=null&&ageInDays<=365&&!patient?.birthWeightGrams
  const profile=[
    [translate('copy.clinicalRecordCopy.patientCode',language==='el'?'el':'en'),patient?.id],
    [translate('copy.clinicalRecordCopy.hospitalRecordNumber',language==='el'?'el':'en'),patient?.hospitalRecordNumber],
    // Separate surname / first name (as in the patient form) instead of one
    // "full name" field whose order differed from the header.
    [translate('copy.clinicalRecordCopy.lastName',language==='el'?'el':'en'),(language==='en'&&patient?.lastNameEn)||patient?.lastName||(!patient?.firstName&&patient?.name)||'—'],
    [translate('copy.clinicalRecordCopy.firstName',language==='el'?'el':'en'),(language==='en'&&patient?.firstNameEn)||patient?.firstName||'—'],
    [translate('copy.clinicalRecordCopy.fatherName',language==='el'?'el':'en'),(language==='en'&&patient?.patronymicEn)||patient?.fatherName||patient?.patronymic],
    [translate('copy.clinicalRecordCopy.dateOfBirthAge',language==='el'?'el':'en'),patient?.dateOfBirth?`${fmtDate(patient.dateOfBirth)} · ${ageLabel}`:'—'],
    patient?.birthWeightGrams?[translate('copy.clinicalRecordCopy.birthWeight',language==='el'?'el':'en'),`${patient.birthWeightGrams} g`]:infantWithoutBirthWeight?[translate('copy.clinicalRecordCopy.birthWeight',language==='el'?'el':'en'),'—']:null,
    patient?.gestationalAgeWeeks?[translate('copy.clinicalRecordCopy.gestationalAge',language==='el'?'el':'en'),`${patient.gestationalAgeWeeks} ${translate('copy.clinicalRecordCopy.wk',language==='el'?'el':'en')}`]:null,
    [translate('copy.clinicalRecordCopy.sex',language==='el'?'el':'en'),patient?.sex?t(patient.sex):'—'],
    [translate('copy.clinicalRecordCopy.currentDepartment',language==='el'?'el':'en'),patient?.department||'—'],
  ].filter(Boolean)
  return <div className="patient-home-layout"><section className="patient-home-details patient-profile-card"><div className="record-section-header"><div><h3>{translate('copy.clinicalRecordCopy.patientDetails',language==='el'?'el':'en')}</h3><p>{translate('copy.clinicalRecordCopy.coreIdentityAndCurrentAdmissionInformation',language==='el'?'el':'en')}</p></div>{actions}</div><div className="patient-profile-grid">{profile.map(([label,value])=><div key={label} className="patient-profile-item"><span>{label}</span><strong>{value||'—'}</strong></div>)}</div>{infantWithoutBirthWeight&&<p className="field-hint neonatal-missing-weight" role="status">{translate('copy.neonatalCopy.missingBirthWeight',language==='el'?'el':'en')}</p>}{patient?.notes&&<div className="patient-profile-note"><span>{translate('copy.clinicalRecordCopy.notes',language==='el'?'el':'en')}</span><p>{patient.notes}</p></div>}</section><AdmissionsPanel rows={rows} episodes={episodes} patient={patient} tenantId={tenantId} isDemo={isDemo} departments={departments} canEdit={canEdit} t={t} language={language} fmtDate={fmtDate} onAdded={onAdded} onChanged={onChanged} onSelect={onSelect}/></div>
}
// Admission summary: one info sheet for the stay (no duplicate status — the
// header already shows it) and one for the current surveillance episode,
// in the same info-sheet style as the rest of the record instead of six
// differently tinted tiles. Emphasis uses status badges only.
// Both ids must be present to match: two missing record ids (every demo
// patient) used to compare equal, so the first patient in the roster was shown
// on every surveillance record.
export function CanonicalSummary({onOpenReassessment,patient,admission,record,tenantId,isDemo,departments,canEdit,showPatientActions,onDeleted,onChanged,t,language,fmtDate}){
 const en=language==='en'
 const latest=record?.samples?.find(x=>x.organism)||record?.samples?.[0]
 const admittedAt=admission?admission.admissionDate:(patient?.admissionDate||record?.admissionDate)
 const dischargedAt=admission?.dischargeDate||null
 const days=stayDays(admittedAt,dischargedAt)
 const daysLabel=days==null?'—':`${days} ${t(days===1?'clinicalRecords.stayDayOne':'clinicalRecords.stayDayMany')}${dischargedAt?` · ${t('clinicalRecords.dischargedOn')} ${fmtDate(dischargedAt)}`:''}`
 const details=admission
  ?[[t('admissionDate'),fmtDate(admission.admissionDate)],[t('department'),admission.department||'—'],[t('clinicalRecords.lengthOfStay'),daysLabel]]
  :[[t('patient'),en?(patient?.nameEn||record?.patientEn||patient?.name||record?.patient):(patient?.name||record?.patient)],[t('department'),en?(record?.departmentEn||patient?.departmentEn||record?.department||patient?.department):(record?.department||patient?.department)],[t('admissionDate'),fmtDate(admittedAt)]]
 const badge=(text,tone)=>text?<span className={`status-badge ${tone||''}`}>{text}</span>:'—'
 const hai=record?.haiClassification
 const haiValue=hai?<>{hai.type?t(hai.type):null}{hai.type?' ':null}{badge(t(hai.status),hai.status==='confirmed'?'danger':'temporary')}</>:'—'
 const findingValue=latest?<>{latest.organism||t(latest.result||'pending')}{(latest.resistance||record?.resistance)?<> {badge(latest.resistance||record?.resistance,'danger')}</>:null}</>:'—'
 const isolationValue=record?.isolation?(record.isolation.status==='active'?badge(t('clinicalRecords.isolationInPlace'),'temporary'):badge(t(record.isolation.status))):t('no')
 const actions=admission?<AdmissionLifecycleActions patient={patient} admission={admission} tenantId={tenantId} isDemo={isDemo} departments={departments} canEdit={canEdit} showPatientActions={showPatientActions} onDeleted={onDeleted} onChanged={onChanged} t={t} language={language}/>:showPatientActions?<PatientSummaryActions patient={patient} departments={departments} onReload={onChanged} onDeleted={onDeleted}/>:null
 const lateDays=record?.status==='active'?daysOverdue(record.reviewDue):0
 return <div className="patient-summary-layout clean-patient-summary">
  {lateDays>0&&<div className="summary-overdue-banner" role="alert"><AlertTriangle size={18} aria-hidden="true"/><span>{t('reassessmentOverdueBanner').replace('{days}',String(lateDays))}</span>{onOpenReassessment&&<Button variant="secondary" onClick={onOpenReassessment}>{t('openReassessment')}</Button>}</div>}
  <section className="clinical-panel patient-summary-card"><div className="record-section-header"><div><h3>{admission?t('clinicalRecords.admissionSummary'):t('clinicalRecords.patientDetails')}</h3></div>{actions}</div><div className="detail-grid patient-detail-grid">{details.map(([label,value])=><Detail key={label} label={label} value={value}/>)}</div></section>
  {record&&<section className="clinical-panel patient-summary-card"><div className="record-section-header"><div><h3>{t('clinicalRecords.currentSurveillance')}</h3></div></div><div className="detail-grid patient-detail-grid">
   <Detail label={t('surveillance')} value={badge(t(record.status),record.status==='active'?'active':'')}/>
   <Detail label={t('clinicalRecords.haiClassification')} value={haiValue}/>
   <Detail label={t('clinicalRecords.latestFinding')} value={findingValue}/>
   <Detail label={t('therapy')} value={record.therapy?.length?record.therapy.map(x=>x.antimicrobial).join(', '):t('clinicalRecords.none')}/>
   <Detail label={t('isolation')} value={isolationValue}/>
   <Detail label={t('nextReview')} value={record.status==='active'?<DueDate value={record.reviewDue} format={fmtDate}/>:fmtDate(record.reviewDue)}/>
  </div></section>}
 </div>
}
function AdmissionLifecycleActions({patient,admission,tenantId,isDemo,departments,canEdit,showPatientActions,onDeleted,onChanged,t,language}){const {notify}=useFeedback();const [kind,setKind]=useState(null),[busy,setBusy]=useState(false),[draft,setDraft]=useState({date:new Date().toISOString().slice(0,10),departmentId:'',reason:''});const open=next=>{setDraft({date:new Date().toISOString().slice(0,10),departmentId:'',reason:''});setKind(next)};async function save(){if(!draft.date)return;try{setBusy(true);if(kind==='discharge')await dischargeAdmission(tenantId,patient,admission,draft,{isDemo});else{const dept=departments.find(x=>x.id===draft.departmentId);await transferAdmission(tenantId,patient,admission,{...draft,department:dept?.name||''},{isDemo})}setKind(null);await onChanged?.();notify(t('saved'),'success')}catch(error){notify(error?.message||t('actionFailed'),'danger')}finally{setBusy(false)}}const lifecycleItems=canEdit&&admission.status==='active'?[{id:'transfer',label:translate('copy.clinicalRecordCopy.transferToAnotherDepartment',language==='el'?'el':'en'),icon:ArrowRightLeft,onClick:()=>open('transfer')},{id:'discharge',label:translate('copy.clinicalRecordCopy.discharge',language==='el'?'el':'en'),icon:LogOut,onClick:()=>open('discharge')}]:[];return <>{showPatientActions?<PatientSummaryActions patient={patient} departments={departments} onReload={onChanged} onDeleted={onDeleted} extraItems={lifecycleItems}/>:lifecycleItems.length?<OverflowMenu label={translate('copy.clinicalRecordCopy.admissionActions',language==='el'?'el':'en')} items={lifecycleItems}/>:null}{kind&&<SimpleDialog title={kind==='transfer'?(translate('copy.clinicalRecordCopy.transferPatient',language==='el'?'el':'en')):(translate('copy.clinicalRecordCopy.dischargePatient',language==='el'?'el':'en'))} t={t} onClose={()=>setKind(null)} onSave={save} disabled={busy||!draft.date||(kind==='transfer'&&!draft.departmentId)}><ManualDateField label={kind==='transfer'?(translate('copy.clinicalRecordCopy.transferDate',language==='el'?'el':'en')):(translate('copy.clinicalRecordCopy.dischargeDate',language==='el'?'el':'en'))} value={draft.date} onChange={v=>setDraft(d=>({...d,date:v}))}/>{kind==='transfer'&&<label><span>{translate('copy.clinicalRecordCopy.newDepartment',language==='el'?'el':'en')}</span><select value={draft.departmentId} onChange={e=>setDraft(d=>({...d,departmentId:e.target.value}))}><option value="">{t('select')}</option>{departments.filter(x=>x.id!==admission.departmentId).map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></label>}<label className="entry-span-2"><span>{t('reason')}</span><textarea rows={3} value={draft.reason} onChange={e=>setDraft(d=>({...d,reason:e.target.value}))}/></label></SimpleDialog>}</>}
export function Detail({label,value}){return <div className="detail-item"><span>{label}</span><strong>{value||'—'}</strong></div>}
function AdmissionsPanel({rows,episodes,patient,tenantId,isDemo,departments,canEdit,t,language,fmtDate,onAdded,onChanged,onSelect}){
  const {notify}=useFeedback();const [open,setOpen]=useState(false),[busy,setBusy]=useState(false);const [draft,setDraft]=useState({departmentId:'',department:'',admissionDate:'',dischargeDate:'',status:'active',notes:''});
  async function save(){if(!draft.admissionDate)return;try{setBusy(true);const dept=departments.find(x=>x.id===draft.departmentId);const row=await createAdmission(tenantId,patient,{...draft,department:dept?.name||draft.department},{isDemo});onAdded(row);setOpen(false);setDraft({departmentId:'',department:'',admissionDate:'',dischargeDate:'',status:'active',notes:''});notify(t('saved'),'success')}catch(error){notify(error?.message||t('actionFailed'),'danger')}finally{setBusy(false)}}
  const episodesFor=row=>episodes.filter(ep=>ep.admissionId?String(ep.admissionId)===String(row.id):(String(ep.startedAt||'').slice(0,10)>=String(row.admissionDate||'')&&(!row.dischargeDate||String(ep.startedAt||'').slice(0,10)<=String(row.dischargeDate))));
  // "1" alone was unclear: say how many surveillance episodes and how many are active.
  const surveillanceLabel=row=>{const list=episodesFor(row).filter(ep=>ep.status!=='cancelled'),n=list.length,active=list.filter(ep=>ep.status==='active').length;if(!n)return '—';return <>{`${n} ${t(n===1?'clinicalRecords.surveillanceCountOne':'clinicalRecords.surveillanceCountMany')}`}{active>0&&<> <span className="status-badge active">{`${active} ${t(active===1?'clinicalRecords.activeCountOne':'clinicalRecords.activeCountMany')}`}</span></>}</>};
  return <section className="record-section patient-admissions-section"><div className="record-section-header"><div><h3>{t('clinicalRecords.admissions')}</h3><p>{translate('copy.clinicalRecordCopy.selectAnAdmissionToOpenIts',language==='el'?'el':'en')}</p></div>{canEdit&&<Button onClick={()=>setOpen(true)}><Plus size={15}/>{t('clinicalRecords.newAdmission')}</Button>}</div>{rows.length?<div className="record-table-wrap patient-admissions-table-wrap"><table className="record-table patient-admissions-table"><thead><tr><th>{t('admissionDate')}</th><th>{t('department')}</th><th>{t('clinicalRecords.dischargeDate')}</th><th>{t('status')}</th><th>{t('clinicalRecords.surveillanceColumn')}</th><th aria-label={translate('copy.clinicalRecordCopy.actions',language==='el'?'el':'en')}/></tr></thead><tbody>{rows.map(row=><tr key={row.id} tabIndex={0} className="clickable-row" onClick={()=>onSelect?.(row)} onKeyDown={e=>{if((e.key==='Enter'||e.key===' ')&&onSelect){e.preventDefault();onSelect(row)}}}><td><strong>{fmtDate(row.admissionDate)}</strong></td><td>{row.department||'—'}</td><td>{fmtDate(row.dischargeDate)}</td><td><span className={`status-badge ${row.status==='active'?'active':''}`}>{t(row.status)}</span></td><td>{surveillanceLabel(row)}</td><td className="open-record-cell" onClick={e=>e.stopPropagation()} onKeyDown={e=>e.stopPropagation()}><AdmissionLifecycleActions patient={patient} admission={row} tenantId={tenantId} isDemo={isDemo} departments={departments} canEdit={canEdit} showPatientActions={false} onChanged={onChanged} t={t} language={language}/></td></tr>)}</tbody></table></div>:<div className="inline-empty">{t('clinicalRecords.noAdmissions')}</div>}{open&&<SimpleDialog title={t('clinicalRecords.newAdmission')} t={t} onClose={()=>setOpen(false)} onSave={save} disabled={busy||!draft.admissionDate}><label><span>{t('department')}</span>{departments.length?<select value={draft.departmentId} onChange={e=>setDraft(d=>({...d,departmentId:e.target.value}))}><option value="">{t('select')}</option>{departments.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select>:<input value={draft.department} onChange={e=>setDraft(d=>({...d,department:e.target.value}))}/>}</label><ManualDateField label={t('admissionDate')} value={draft.admissionDate} onChange={v=>setDraft(d=>({...d,admissionDate:v}))}/></SimpleDialog>}</section>
}
