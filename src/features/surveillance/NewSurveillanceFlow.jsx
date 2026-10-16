import { useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import { Button } from '../../design-system/Button'
import { ObserverDialog } from '../../design-system/ObserverDialog'
import { useLanguage } from '../../core/i18n/LanguageContext'
import { useFeedback } from '../../core/feedback/FeedbackContext'
import { useTenant } from '../../core/tenant/TenantContext'
import { useDepartments } from '../management/useLibraries'
import { createPatient } from '../patients/patientsService'
import { PatientSelector, StartStep } from './NewSurveillanceSteps'
import './surveillanceEntryCard.css'

export function NewSurveillanceFlow({
  patient = null,
  patients = [],
  onClose,
  onCreate,
  onPatientsChange,
}) {
  const { t, language } = useLanguage()
  const { notify } = useFeedback()
  const { tenant, isDemo } = useTenant()
  const [patientMode, setPatientMode] = useState(patient ? 'fixed' : 'existing')
  const [selectedPatientId, setSelectedPatientId] = useState(patient?.id || '')
  const [createdPatient, setCreatedPatient] = useState(null)
  const selectedPatient =
    patient || createdPatient || patients.find(x => x.id === selectedPatientId) || null
  // The organization's departments (Management > Libraries); the inline patient
  // keeps the department's id and its Greek / English names, as before.
  const { departments } = useDepartments()
  const firstDepartment = [selectedPatient?.department, selectedPatient?.departmentEn]
  const today = new Date().toISOString().slice(0, 10)
  const [patientDraft, setPatientDraft] = useState({
    patientCode: '',
    firstName: '',
    lastName: '',
    patronymic: '',
    firstNameEn: '',
    lastNameEn: '',
    patronymicEn: '',
    departmentId: '',
    department: '',
    departmentEn: '',
    admissionDate: today,
    dateOfBirth: '',
  })
  const [busy, setBusy] = useState(false)
  const [startDraft, setStartDraft] = useState({
    startedAt: today,
    reviewDue: '',
    room: '',
    reason: '',
    reasonEn: '',
    suspectedSource: '',
    departmentId: selectedPatient?.departmentId || '',
    department: firstDepartment[0] || '',
    departmentEn: firstDepartment[1] || '',
  })
  const setStart = (k, v) => setStartDraft(d => ({ ...d, [k]: v }))
  const setPatientField = (k, v) => setPatientDraft(d => ({ ...d, [k]: v }))

  function chooseExistingPatient(id) {
    setSelectedPatientId(id)
    setCreatedPatient(null)
    const next = patients.find(x => x.id === id)
    if (next)
      setStartDraft(d => ({
        ...d,
        departmentId: next.departmentId || '',
        department: next.department || '',
        departmentEn: next.departmentEn || '',
      }))
  }
  function setPatientDepartment(value) {
    const department = departments.find(item => item.id === value)
    setPatientDraft(d => ({
      ...d,
      departmentId: department?.id || '',
      department: department?.name || '',
      departmentEn: department?.nameEn || department?.name || '',
    }))
  }
  async function buildInlinePatient() {
    if (
      (!isDemo && !patientDraft.patientCode.trim()) ||
      !(patientDraft.firstName || patientDraft.firstNameEn) ||
      !(patientDraft.lastName || patientDraft.lastNameEn) ||
      !patientDraft.department ||
      !patientDraft.admissionDate
    )
      return null
    const firstName = patientDraft.firstName || patientDraft.firstNameEn,
      lastName = patientDraft.lastName || patientDraft.lastNameEn
    const firstNameEn = patientDraft.firstNameEn || patientDraft.firstName,
      lastNameEn = patientDraft.lastNameEn || patientDraft.lastName
    const { record: created, list } = await createPatient(
      tenant?.id,
      patients,
      {
        patientCode: patientDraft.patientCode.trim() || undefined,
        firstName,
        lastName,
        patronymic: patientDraft.patronymic || '',
        firstNameEn,
        lastNameEn,
        patronymicEn: patientDraft.patronymicEn || patientDraft.patronymic || '',
        name: `${firstName} ${lastName}`.trim(),
        nameEn: `${firstNameEn} ${lastNameEn}`.trim(),
        departmentId: patientDraft.departmentId || null,
        department: patientDraft.department,
        departmentEn: patientDraft.departmentEn || patientDraft.department,
        admissionDate: patientDraft.admissionDate,
        dateOfBirth: patientDraft.dateOfBirth || null,
      },
      { isDemo },
    )
    onPatientsChange?.(list)
    setCreatedPatient(created)
    setSelectedPatientId(created.id)
    setStartDraft(d => ({
      ...d,
      departmentId: created.departmentId || '',
      department: created.department,
      departmentEn: created.departmentEn,
    }))
    notify(t('clinicalRecords.patientCreatedForSurveillance'), 'success')
    return created
  }

  const contextDepartment = patient?.department || startDraft.department || ''
  async function saveStart() {
    if (busy) return
    setBusy(true)
    try {
      let targetPatient = selectedPatient
      if (!targetPatient && patientMode === 'new') targetPatient = await buildInlinePatient()
      if (!targetPatient || !startDraft.startedAt || !(startDraft.reason || startDraft.reasonEn)) {
        notify(
          language === 'el'
            ? 'Συμπληρώστε τα υποχρεωτικά πεδία της έναρξης.'
            : 'Complete the required start fields.',
          'warning',
        )
        return
      }
      const created = await onCreate(
        {
          ...startDraft,
          departmentId: startDraft.departmentId || targetPatient.departmentId || null,
        },
        targetPatient,
      )
      if (!created)
        throw new Error(
          language === 'el'
            ? 'Δεν δημιουργήθηκε το επεισόδιο επιτήρησης.'
            : 'The surveillance episode was not created.',
        )
      onClose()
    } catch (error) {
      notify(error?.message || t('actionFailed'), 'danger')
    } finally {
      setBusy(false)
    }
  }

  const canStart =
    !busy &&
    Boolean(startDraft.startedAt) &&
    Boolean(startDraft.reason || startDraft.reasonEn) &&
    (patientMode === 'new' || Boolean(selectedPatient))
  return (
    <ObserverDialog
      width="standard"
      fixedHeight
      className="surveillance-entry patient-surveillance-entry"
      eyebrow={t('newSurveillance')}
      title={t('svPatientSurveillance')}
      subtitle={
        selectedPatient
          ? `${language === 'el' ? selectedPatient.name : selectedPatient.nameEn || selectedPatient.name} · ${selectedPatient.id}`
          : t('clinicalRecords.selectPatient')
      }
      onClose={onClose}
      footer={
        <Button disabled={!canStart} onClick={saveStart}>
          {busy
            ? language === 'el'
              ? 'Αποθήκευση…'
              : 'Saving…'
            : language === 'el'
              ? 'Έναρξη επιτήρησης'
              : 'Start surveillance'}
        </Button>
      }
    >
      {!patient && (
        <PatientSelector
          chooseExistingPatient={chooseExistingPatient}
          createdPatient={createdPatient}
          departments={departments}
          isDemo={isDemo}
          language={language}
          patientDraft={patientDraft}
          patientMode={patientMode}
          patients={patients}
          selectedPatientId={selectedPatientId}
          setCreatedPatient={setCreatedPatient}
          setPatientDepartment={setPatientDepartment}
          setPatientField={setPatientField}
          setPatientMode={setPatientMode}
          setSelectedPatientId={setSelectedPatientId}
          t={t}
        />
      )}
      <div className="progressive-guidance">
        <AlertTriangle size={16} />
        <div>
          <strong>{language === 'el' ? 'Κλινική αρχή' : 'Clinical principle'}</strong>
          <span>
            {language === 'el'
              ? 'Η δημιουργία επιτήρησης δεν απαιτεί νέο δείγμα ούτε απόφαση απομόνωσης. Αυτά μπορούν να καταγραφούν οποτεδήποτε χρειαστεί.'
              : 'Starting surveillance does not require a new sample or an isolation decision. These can be recorded whenever clinically needed.'}
          </span>
        </div>
      </div>
      <StartStep
        contextDepartment={contextDepartment}
        language={language}
        setStart={setStart}
        startDraft={startDraft}
        t={t}
      />
    </ObserverDialog>
  )
}
