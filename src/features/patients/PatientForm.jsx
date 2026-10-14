import { useState } from 'react'
import { ObserverDialog, DialogActions } from '../../design-system/ObserverDialog'
import { ManualDateField } from '../../design-system/ManualDateField'
import { translate } from '../../core/i18n/LanguageContext'

// The patient fields, their validation and the saved payload: shared by the
// New patient page and the Edit patient dialog.
export function usePatientForm({t,language,departments,patient=null,existingPatients=[]}){
  const editing=Boolean(patient)
  const [draft,setDraft]=useState(()=>({
    patientCode:patient?.id||'',firstName:patient?.firstName||'',lastName:patient?.lastName||'',fatherName:patient?.fatherName||'',hospitalRecordNumber:patient?.hospitalRecordNumber||'',
    dateOfBirth:patient?.dateOfBirth||'',birthWeightGrams:patient?.birthWeightGrams||'',gestationalAgeWeeks:patient?.gestationalAgeWeeks||'',sex:patient?.sex||'',departmentId:patient?.departmentId||'',department:patient?.department||'',departmentEn:patient?.departmentEn||patient?.department||'',
    admissionDate:patient?.admissionDate||'',status:patient?.status||'active',notes:patient?.notes||''
  }))
  const set=(key,value)=>setDraft(d=>({...d,[key]:value}))
  function setDepartment(id){
    const item=departments.find(value=>value.id===id)
    setDraft(d=>({...d,departmentId:id,department:item?.name||'',departmentEn:item?.nameEn||item?.name||''}))
  }
  const today=new Date();today.setHours(23,59,59,999)
  const birthDate=draft.dateOfBirth?new Date(`${draft.dateOfBirth}T12:00:00`):null
  const birthInvalid=Boolean(birthDate&&(Number.isNaN(birthDate.getTime())||birthDate>today||birthDate.getFullYear()<1900))
  const birthWeightInvalid=Boolean(draft.birthWeightGrams&&(Number(draft.birthWeightGrams)<300||Number(draft.birthWeightGrams)>7000))
  const gestationInvalid=Boolean(draft.gestationalAgeWeeks&&(Number(draft.gestationalAgeWeeks)<20||Number(draft.gestationalAgeWeeks)>45))
  const ageDays=birthDate&&!birthInvalid?Math.max(0,Math.floor((Date.now()-birthDate.getTime())/86400000)):null
  const ageYears=ageDays==null?null:Math.floor(ageDays/365.2425)
  // Neonatal fields only for a baby under 1 year, or when they already hold a value.
  const showNeonatal=(ageYears!=null&&ageYears<1)||Boolean(draft.birthWeightGrams||draft.gestationalAgeWeeks)
  // Warn while typing when the code is already taken, instead of failing on save.
  const codeKey=draft.patientCode.trim().toLowerCase()
  const duplicate=!editing&&codeKey?existingPatients.find(item=>String(item.id||item.patientCode||'').trim().toLowerCase()===codeKey):null
  const disabled=Boolean(duplicate)||!draft.patientCode.trim()||!draft.firstName.trim()||!draft.lastName.trim()||(!editing&&!draft.admissionDate)||birthInvalid||birthWeightInvalid||gestationInvalid
  const fields=(
    <div className="entry-grid patient-entry-grid">
      <label><span>{t('patientId')} *</span><input autoFocus={!editing} disabled={editing} value={draft.patientCode} onChange={e=>set('patientCode',e.target.value)} aria-invalid={Boolean(duplicate)}/>{duplicate&&<small className="field-error">{t('patientCodeDuplicate')}{duplicate.name?` (${duplicate.name})`:''}</small>}</label>
      <label><span>{t('firstName')} *</span><input autoFocus={editing} value={draft.firstName} onChange={e=>set('firstName',e.target.value)}/></label>
      <label><span>{t('lastName')} *</span><input value={draft.lastName} onChange={e=>set('lastName',e.target.value)}/></label>
      <label><span>{t('fatherName')}</span><input value={draft.fatherName} onChange={e=>set('fatherName',e.target.value)}/></label>
      <label><span>{t('hospitalRecordNumber')}</span><input value={draft.hospitalRecordNumber} onChange={e=>set('hospitalRecordNumber',e.target.value)}/></label>
      <div><ManualDateField label={t('dateOfBirth')} value={draft.dateOfBirth} onChange={v=>set('dateOfBirth',v)}/>{birthInvalid&&<small className="field-error">{t('invalidDateOfBirth')}</small>}{ageYears!=null&&!birthInvalid&&<small className="entry-detail-note">{ageDays<28?t('calculatedAgeDays').replace('{age}',String(ageDays)):ageDays<730?t('calculatedAgeMonthsDays').replace('{months}',String(Math.floor(ageDays/30.4375))).replace('{days}',String(Math.floor(ageDays%30.4375))):t('calculatedAge').replace('{age}',String(ageYears))}</small>}</div>
      <label><span>{t('sex')}</span><select value={draft.sex} onChange={e=>set('sex',e.target.value)}><option value="">{t('select')}</option><option value="female">{t('female')}</option><option value="male">{t('male')}</option><option value="other">{t('other')}</option></select></label>
      {showNeonatal&&<>
      <label><span>{translate('copy.patientsCopy.birthWeightG',language==='el'?'el':'en')}</span><input type="number" min="1" value={draft.birthWeightGrams} onChange={e=>set('birthWeightGrams',e.target.value)} placeholder={translate('copy.patientsCopy.optionalForNeonates',language==='el'?'el':'en')}/>{birthWeightInvalid&&<small className="field-error">{t('invalidBirthWeight')}</small>}</label>
      <label><span>{translate('copy.patientsCopy.gestationalAgeWeeks',language==='el'?'el':'en')}</span><input type="number" min="20" max="45" value={draft.gestationalAgeWeeks} onChange={e=>set('gestationalAgeWeeks',e.target.value)} placeholder={translate('copy.patientsCopy.optionalForNeonates',language==='el'?'el':'en')}/>{gestationInvalid&&<small className="field-error">{t('invalidGestationalAge')}</small>}</label>
      </>}
      {!editing&&<><label><span>{t('department')}</span><select value={draft.departmentId} onChange={e=>setDepartment(e.target.value)}><option value="">{t('select')}</option>{departments.map(item=><option key={item.id} value={item.id}>{language==='el'?item.name:(item.nameEn||item.name)}</option>)}</select></label>
      <ManualDateField label={`${t('admissionDate')} *`} value={draft.admissionDate} onChange={v=>set('admissionDate',v)}/></>}
      <label className="entry-span-2"><span>{t('notes')}</span><textarea rows={3} value={draft.notes} onChange={e=>set('notes',e.target.value)}/></label>
    </div>
  )
  const payload=()=>{
    if(disabled)return null
    const first=draft.firstName.trim(),last=draft.lastName.trim()
    return {...draft,patientCode:draft.patientCode.trim(),name:`${first} ${last}`.trim(),nameEn:`${first} ${last}`.trim(),birthWeightGrams:draft.birthWeightGrams?Number(draft.birthWeightGrams):null,gestationalAgeWeeks:draft.gestationalAgeWeeks?Number(draft.gestationalAgeWeeks):null}
  }
  return {fields,disabled,payload}
}

export function PatientFormDialog({t,language,departments,onClose,onSave,patient}){
  const form=usePatientForm({t,language,departments,patient})
  return <ObserverDialog width="wide" eyebrow={language==='el'?patient?.name:(patient?.nameEn||patient?.name)} title={language==='el'?'Επεξεργασία ασθενούς':'Edit patient'} onClose={onClose} footer={<DialogActions onSave={()=>{const draft=form.payload();if(draft)onSave(draft)}} disabled={form.disabled}/>}>
    {form.fields}
  </ObserverDialog>
}
