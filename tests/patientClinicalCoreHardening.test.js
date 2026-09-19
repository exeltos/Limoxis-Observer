import fs from 'node:fs'
import { describe,expect,it } from 'vitest'

const patients=fs.readFileSync('src/features/patients/patientsService.js','utf8')
const patientForm=fs.readFileSync('src/features/patients/PatientsPage.jsx','utf8')
const record=fs.readFileSync('src/features/surveillance/PatientClinicalCanonicalPage.jsx','utf8')
const repository=fs.readFileSync('src/features/surveillance/clinicalRepository.js','utf8')
const cloud=fs.readFileSync('src/features/surveillance/clinicalCloudService.js','utf8')
const labRecord=fs.readFileSync('src/features/laboratory/LaboratorySampleRecordFunctionalView.jsx','utf8')
const labCloud=fs.readFileSync('src/features/laboratory/laboratoryCloudService.js','utf8')
const archive=fs.readFileSync('supabase/migrations/20260918103000_patient_governed_archival.sql','utf8')
const admissions=fs.readFileSync('supabase/migrations/20260918104000_patient_admission_lifecycle.sql','utf8')

describe('patient clinical core hardening',()=>{
  it('archives instead of deleting the clinical record',()=>{
    expect(patients).toContain("supabase.rpc('archive_patient'")
    expect(patients).toContain(".is('archived_at',null)")
    expect(archive).toContain("'patient.archived'")
    expect(archive).toContain('current_user_can_patient_capability')
  })

  it('keeps admission lifecycle out of generic identity updates',()=>{
    expect(patientForm).toContain("{!editing&&<><label><span>{t('department')}")
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
    expect(record).not.toContain('function AmrDialog')
    expect(record).not.toContain("setDialog('amr')")
    expect(repository).not.toContain('saveAmr(')
    expect(cloud).not.toContain('saveAmrClassification')
    expect(record).toContain('Derived from validated microbiology/AST evidence.')
    expect(labRecord).not.toContain('<option value="MDR">MDR</option>')
    expect(labCloud).not.toContain('resistance_class:draft.resistance')
  })

  it('uses canonical date and time fields for sample collection',()=>{
    expect(record).not.toContain('type="datetime-local"')
    expect(record).toContain('<ManualDateField label={t(\'collectedLabel\')}')
    expect(record).toContain('<TimeField label={language===\'el\'?\'Ώρα λήψης\':\'Collection time\'}')
  })
})
