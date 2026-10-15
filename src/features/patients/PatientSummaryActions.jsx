import { Archive, Pencil } from 'lucide-react'
import { OverflowMenu } from '../../design-system/OverflowMenu'
import { GovernedReasonDialog } from '../../design-system/GovernedReasonDialog'
import { useLanguage } from '../../core/i18n/LanguageContext'
import { useFeedback } from '../../core/feedback/FeedbackContext'
import { useTenant } from '../../core/tenant/TenantContext'
import { can, CAPABILITIES } from '../../core/permissions/roles'
import { archivePatient } from './patientsService'
import { useState } from 'react'

// Edit opens the patient details in place (onEdit, given by the patient record);
// without onEdit the item is not offered.
export function PatientSummaryActions({patient,onEdit,onDeleted,extraItems=[]}){
  const {t,language}=useLanguage()
  const {notify}=useFeedback()
  const {tenant,isDemo,role,membership}=useTenant()
  const [deleting,setDeleting]=useState(false)
  const has=cap=>can(role,cap,membership?.capabilities??[],membership?.customCapabilities??[])
  if(!patient)return null

  const items=[
    onEdit&&has(CAPABILITIES.EDIT_PATIENT)?{id:'edit',label:language==='el'?'Επεξεργασία ασθενούς':'Edit patient',icon:Pencil,onClick:onEdit}:null,
    ...extraItems,
    has(CAPABILITIES.DELETE_PATIENT)?{id:'archive',label:language==='el'?'Διαγραφή ασθενούς':'Delete patient',icon:Archive,tone:'danger',separatorBefore:true,onClick:()=>setDeleting(true)}:null,
  ].filter(Boolean)
  if(!items.length)return null

  async function remove(reason){
    try{
      await archivePatient(tenant?.id,patient,reason,{isDemo})
      setDeleting(false)
      notify(t('archived'),'success')
      onDeleted?.()
    }catch(error){notify(error?.message||t('actionFailed'),'danger')}
  }

  return <>
    <OverflowMenu label={language==='el'?'Ενέργειες ασθενούς':'Patient actions'} items={items}/>
    <GovernedReasonDialog open={deleting} title={language==='el'?'Διαγραφή ασθενούς':'Delete patient'} description={language==='el'?'Ο ασθενής αφαιρείται από τη λίστα ασθενών· το κλινικό ιστορικό και η αιτιολογία κρατούνται για έλεγχο.':'The patient is removed from the patient list; the clinical history and the reason are kept for audit.'} confirmLabel={language==='el'?'Διαγραφή':'Delete'} danger onCancel={()=>setDeleting(false)} onConfirm={remove}/>
  </>
}