import { useEffect, useState } from 'react'
import { AlertTriangle, X } from 'lucide-react'
import { Button } from '../../design-system/Button'
import { ObserverDialog } from '../../design-system/ObserverDialog'
import { useLanguage } from '../../core/i18n/LanguageContext'
import { useFeedback } from '../../core/feedback/FeedbackContext'
import { useTenant } from '../../core/tenant/TenantContext'
import { demoLibrarySeed } from '../management/managementData'
import { createPatient } from '../patients/patientsService'
import { PatientSelector, StartStep } from './NewSurveillanceSteps'

const FLOW_RECOVERY_KEY = 'limoxis-new-surveillance-flow'

export function NewSurveillanceFlow({
  patient = null,
  patients = [],
  departments = [],
  onClose,
  onCreate,
  onCancelCreated,
  onRecordChange,
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
  const departmentPairs = departments.length
    ? departments.map(item => ({
        id: item.id || item.value || '',
        el: item.el || item.label || item.name || '',
        en: item.en || item.labelEn || item.nameEn || item.name || '',
      }))
    : demoLibrarySeed.departments.map(([el, en]) => ({ id: '', el, en }))
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
  const [record, setRecord] = useState(null)
  const [, setCompletedSteps] = useState(() => new Set())
  const [busy, setBusy] = useState(false)
  const [cancelOpen, setCancelOpen] = useState(false)
  const [cancelReason, setCancelReason] = useState('')
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
  const markComplete = step => setCompletedSteps(current => new Set([...current, step]))

  useEffect(() => {
    try {
      sessionStorage.removeItem(FLOW_RECOVERY_KEY)
    } catch {
      /* noop */
    }
  }, [])

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
    const pair = departmentPairs.find(item => item.id === value || item.el === value) || {
      id: '',
      el: value,
      en: value,
    }
    setPatientDraft(d => ({
      ...d,
      departmentId: pair.id,
      department: pair.el,
      departmentEn: pair.en,
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
      if (!record) {
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
        try {
          sessionStorage.setItem(
            FLOW_RECOVERY_KEY,
            JSON.stringify({ record: created, at: Date.now() }),
          )
        } catch {
          /* noop */
        }
        setRecord(created)
        markComplete('start')
        try {
          sessionStorage.removeItem(FLOW_RECOVERY_KEY)
        } catch {
          /* noop */
        }
        onClose()
      } else {
        const next = { ...record, ...startDraft }
        setRecord(next)
        markComplete('start')
        onRecordChange?.(next)
        try {
          sessionStorage.removeItem(FLOW_RECOVERY_KEY)
        } catch {
          /* noop */
        }
        onClose()
      }
    } catch (error) {
      notify(error?.message || t('actionFailed'), 'danger')
    } finally {
      setBusy(false)
    }
  }

  function closeFlow() {
    try {
      sessionStorage.removeItem(FLOW_RECOVERY_KEY)
    } catch {
      /* noop */
    }
    onClose()
  }
  function cancelFlow() {
    if (record) {
      setCancelReason('')
      setCancelOpen(true)
      return
    }
    closeFlow()
  }
  async function confirmCancel() {
    if (!record || !cancelReason.trim() || busy) return
    try {
      setBusy(true)
      await onCancelCreated?.(record, cancelReason.trim())
      setCancelOpen(false)
      closeFlow()
      notify(
        language === 'el'
          ? 'Η επιτήρηση ακυρώθηκε με καταγραφή αιτιολογίας.'
          : 'Surveillance was cancelled with an audit reason.',
        'success',
      )
    } catch (error) {
      notify(error?.message || t('actionFailed'), 'danger')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="episode-overlay new-surveillance-flow-overlay" role="dialog" aria-modal="true">
      <section className="episode-detail-card new-surveillance-flow-card new-surveillance-start-card">
        <header className="episode-detail-header">
          <div>
            <span className="eyebrow">{t('surveillance')}</span>
            <h2>{record ? record.id : t('newSurveillance')}</h2>
            <p>
              {selectedPatient
                ? `${language === 'el' ? selectedPatient.name : selectedPatient.nameEn || selectedPatient.name} · ${selectedPatient.id}`
                : t('clinicalRecords.selectPatient')}
            </p>
          </div>
          <div className="episode-detail-actions">
            {record && <span className="status-badge active">{t('active')}</span>}
            <button className="flow-close-button" title={t('close')} onClick={cancelFlow}>
              <X size={16} />
            </button>
          </div>
        </header>
        <div className="episode-detail-scroll progressive-surveillance-scroll">
          {!patient && !record && (
            <PatientSelector
              chooseExistingPatient={chooseExistingPatient}
              createdPatient={createdPatient}
              departmentPairs={departmentPairs}
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
          {selectedPatient && (
            <div className="flow-patient-context">
              <div>
                <strong>
                  {language === 'el'
                    ? selectedPatient.name
                    : selectedPatient.nameEn || selectedPatient.name}
                </strong>
                <small>{t('clinicalRecords.patientContextInherited')}</small>
              </div>
              <span>
                {selectedPatient.id} ·{' '}
                {language === 'el' ? selectedPatient.department : selectedPatient.departmentEn}
              </span>
            </div>
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

          {
            <StartStep
              busy={busy}
              cancelFlow={cancelFlow}
              contextDepartment={contextDepartment}
              language={language}
              patientMode={patientMode}
              saveStart={saveStart}
              selectedPatient={selectedPatient}
              setStart={setStart}
              startDraft={startDraft}
              t={t}
            />
          }
        </div>
        {cancelOpen && (
          <ObserverDialog
            title={language === 'el' ? 'Ακύρωση επιτήρησης' : 'Cancel surveillance'}
            width="medium"
            onClose={() => setCancelOpen(false)}
          >
            <p>
              {language === 'el'
                ? 'Η επιτήρηση έχει ήδη δημιουργηθεί. Η ακύρωση καταγράφεται στο ιστορικό και απαιτεί αιτιολογία.'
                : 'The surveillance has already been created. Cancellation is audited and requires a reason.'}
            </p>
            <label>
              <span>{language === 'el' ? 'Αιτιολογία' : 'Reason'}</span>
              <textarea
                rows={3}
                autoFocus
                value={cancelReason}
                onChange={e => setCancelReason(e.target.value)}
              />
            </label>
            <div className="dialog-actions">
              <Button variant="secondary" onClick={() => setCancelOpen(false)}>
                {language === 'el' ? 'Επιστροφή' : 'Back'}
              </Button>
              <Button disabled={busy || !cancelReason.trim()} onClick={confirmCancel}>
                {busy
                  ? language === 'el'
                    ? 'Ακύρωση…'
                    : 'Cancelling…'
                  : language === 'el'
                    ? 'Επιβεβαίωση ακύρωσης'
                    : 'Confirm cancellation'}
              </Button>
            </div>
          </ObserverDialog>
        )}
      </section>
    </div>
  )
}
