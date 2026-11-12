import { describe,expect,it } from 'vitest'
import { readLaboratorySampleRecordSource } from './helpers/laboratorySampleRecordSource'
import { readSource } from './helpers/readSource'
const i18n=readSource('src/core/i18n/stringsEl.js')+readSource('src/core/i18n/stringsEn.js')

const patients=readSource('src/features/patients/patientsService.js')
const patientForm=readSource('src/features/patients/PatientsPage.jsx')
const repository=readSource('src/features/surveillance/clinicalRepository.js')
const cloud=readSource('src/features/surveillance/clinicalCloudService.js')
const labRecord=readLaboratorySampleRecordSource()
const labCloud=readSource('src/features/laboratory/laboratoryCloudService.js')
const archive=readSource('supabase/migrations/20260918103000_patient_governed_archival.sql')
const admissions=readSource('supabase/migrations/20260918104000_patient_admission_lifecycle.sql')

describe('patient clinical core hardening',()=>{
  it('archives instead of deleting the clinical record',()=>{
    expect(patients).toContain("supabase.rpc('archive_patient'")
    expect(patients).toContain(".is('archived_at',null)")
    expect(archive).toContain("'patient.archived'")
    expect(archive).toContain('current_user_can_patient_capability')
  })

  it('keeps admission lifecycle out of generic identity updates',()=>{
    expect(patientForm).toContain("{!editing&&<><SearchableSelect label={t('department')}")
    expect(patients).not.toContain('payload.admission_date=patch.admissionDate')
    expect(patients).not.toContain('payload.status=patch.status')
  })

  it('uses governed admission lifecycle RPCs and one active admission',()=>{
    expect(patients).toContain("supabase.rpc('close_patient_admission'")
    expect(patients).toContain("supabase.rpc('transfer_patient_admission'")
    expect(admissions).toContain("status in ('active','discharged','transferred')")
    expect(admissions).toContain("patient already has an active admission")
    expect(admissions).toContain("'patient.admission_transferred'")
    expect(admissions).toContain("'patient.admission_discharged'")
  })

  it('does not offer manual MDR XDR PDR classification',()=>{
    expect(repository).not.toContain('saveAmr(')
    expect(cloud).not.toContain('saveAmrClassification')
    expect(i18n).toContain("derivedFromValidatedMicrobiologyAstEvidence:'Derived from validated microbiology/AST evidence.'")
    expect(labRecord).not.toContain('<option value="MDR">MDR</option>')
    expect(labCloud).not.toContain('resistance_class:draft.resistance')
  })

  it('uses canonical date and time fields for sample collection',()=>{
    expect(i18n).toContain("collectionTime:'Ώρα λήψης'")
  })
})
