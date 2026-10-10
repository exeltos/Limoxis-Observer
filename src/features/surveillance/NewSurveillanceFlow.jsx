import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, X } from 'lucide-react'
import { Button } from '../../design-system/Button'
import { ObserverDialog } from '../../design-system/ObserverDialog'
import { useLanguage } from '../../core/i18n/LanguageContext'
import { useFeedback } from '../../core/feedback/FeedbackContext'
import { useAuth } from '../../core/auth/AuthContext'
import { useTenant } from '../../core/tenant/TenantContext'
import { auditActorFromAuth } from '../../core/audit/actor'
import { demoLibrarySeed } from '../management/managementData'
import {
  createManagementLibraryItem,
  loadManagementLibraries,
} from '../management/managementCloudService'
import { createDemoLabSample, laboratorySamples } from '../laboratory/laboratoryDemoData'
import { createPatient } from '../patients/patientsService'
import {
  AssessmentStep,
  IsolationStep,
  MicrobiologyStep,
  PatientSelector,
  StartStep,
} from './NewSurveillanceSteps'
import {
  fallbackRisks,
  fallbackSymptoms,
  libraryValue,
  normalizeLibrary,
  sampleSourceNames,
  screeningQuestions,
} from './newSurveillanceOptions'

const FLOW_RECOVERY_KEY = 'limoxis-new-surveillance-flow'

export function NewSurveillanceFlow({
  patient = null,
  patients = [],
  departments = [],
  initialSample = null,
  onClose,
  onCreate,
  onCancelCreated,
  onSaveAssessment,
  onRequestSample,
  onSaveIsolation,
  onRecordChange,
  onPatientsChange,
}) {
  const { t, language } = useLanguage()
  const { notify } = useFeedback()
  const { profile, user } = useAuth()
  const { tenant, isDemo } = useTenant()
  const actor = auditActorFromAuth({ profile, user })
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
  const [activeStep, setActiveStep] = useState('start')
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
  const [assessmentDraft, setAssessmentDraft] = useState({
    date: today,
    summary: '',
    summaryEn: '',
    screening: Object.fromEntries(screeningQuestions.map(q => [q.id, 'unknown'])),
    symptoms: [],
    risks: [],
    notes: '',
    notesEn: '',
  })
  const [sampleDraft, setSampleDraft] = useState({
    type: 'bloodCulture',
    source: 'peripheral',
    sourceEn: 'peripheral',
    anatomicalSite: '',
    collectedAt: today,
    priority: 'routine',
    notes: '',
  })
  const [isolationNeeded, setIsolationNeeded] = useState(null)
  const [isolationDraft, setIsolationDraft] = useState({
    startedAt: today,
    precautionType: 'contact',
    reason: '',
    reasonEn: '',
    provisional: true,
  })
  const [clinicalLibraries, setClinicalLibraries] = useState({
    clinicalSymptoms: fallbackSymptoms,
    clinicalRiskFactors: fallbackRisks,
  })
  const [newSymptom, setNewSymptom] = useState('')
  const [newRisk, setNewRisk] = useState('')

  const symptomRows = useMemo(
    () =>
      normalizeLibrary(
        clinicalLibraries.clinicalSymptoms?.length
          ? clinicalLibraries.clinicalSymptoms
          : fallbackSymptoms,
      ),
    [clinicalLibraries],
  )
  const riskRows = useMemo(
    () =>
      normalizeLibrary(
        clinicalLibraries.clinicalRiskFactors?.length
          ? clinicalLibraries.clinicalRiskFactors
          : fallbackRisks,
      ),
    [clinicalLibraries],
  )
  const setStart = (k, v) => setStartDraft(d => ({ ...d, [k]: v }))
  const setAssessment = (k, v) => setAssessmentDraft(d => ({ ...d, [k]: v }))
  const setSample = (k, v) => setSampleDraft(d => ({ ...d, [k]: v }))
  const setIsolation = (k, v) => setIsolationDraft(d => ({ ...d, [k]: v }))
  const setPatientField = (k, v) => setPatientDraft(d => ({ ...d, [k]: v }))
  const markComplete = step => setCompletedSteps(current => new Set([...current, step]))

  useEffect(() => {
    if (isDemo || !tenant?.id) return
    let mounted = true
    loadManagementLibraries(tenant.id)
      .then(rows => {
        if (mounted)
          setClinicalLibraries(current => ({
            ...current,
            clinicalSymptoms: rows.clinicalSymptoms || fallbackSymptoms,
            clinicalRiskFactors: rows.clinicalRiskFactors || fallbackRisks,
          }))
      })
      .catch(() => {})
    return () => {
      mounted = false
    }
  }, [isDemo, tenant?.id])

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

  const linkedLabSamples = useMemo(
    () =>
      record
        ? onRequestSample
          ? record.samples || []
          : laboratorySamples.filter(x => x.surveillanceCase === record.id)
        : [],
    [record, onRequestSample],
  )
  const surveillanceStartedFromSample = Boolean(initialSample)
  const alreadyHasSample = linkedLabSamples.length > 0 || surveillanceStartedFromSample
  const contextDepartment = patient?.department || startDraft.department || ''
  const toggle = (field, value) =>
    setAssessmentDraft(d => ({
      ...d,
      [field]: d[field].includes(value) ? d[field].filter(x => x !== value) : [...d[field], value],
    }))
  const setScreening = (id, value) =>
    setAssessmentDraft(d => ({ ...d, screening: { ...d.screening, [id]: value } }))

  async function addLibraryEntry(key, text, setter, field) {
    const clean = text.trim()
    if (!clean) return
    try {
      let row = [clean, clean, { id: `local-${Date.now()}`, source: 'Hospital', version: 'local' }]
      if (!isDemo && tenant?.id)
        row = await createManagementLibraryItem(tenant.id, key, { nameEl: clean, nameEn: clean })
      setClinicalLibraries(current => ({
        ...current,
        [key]: normalizeLibrary([...(current[key] || []), row]),
      }))
      const value = libraryValue(row)
      setAssessmentDraft(d => ({
        ...d,
        [field]: d[field].includes(value) ? d[field] : [...d[field], value],
      }))
      setter('')
      notify(
        language === 'el'
          ? 'Προστέθηκε στη βιβλιοθήκη και επιλέχθηκε.'
          : 'Added to the library and selected.',
        'success',
      )
    } catch (error) {
      notify(error?.message || t('saveFailed'), 'danger')
    }
  }

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

  async function saveAssessment() {
    if (busy || !record || !assessmentDraft.date) return
    setBusy(true)
    try {
      const payload = {
        date: assessmentDraft.date || today,
        assessedBy: actor.name,
        summary: assessmentDraft.summary || assessmentDraft.summaryEn || '',
        summaryEn: assessmentDraft.summaryEn || assessmentDraft.summary || '',
        screening: { ...assessmentDraft.screening },
        symptoms: [...assessmentDraft.symptoms],
        symptomsEn: [...assessmentDraft.symptoms],
        riskFactors: [...assessmentDraft.risks],
        riskFactorsEn: [...assessmentDraft.risks],
        notes: assessmentDraft.notes,
        notesEn: assessmentDraft.notesEn,
        assessmentType: 'suspected',
        classification: 'undetermined',
        signsSymptoms: [...assessmentDraft.symptoms],
      }
      const persisted = onSaveAssessment ? await onSaveAssessment(record, payload) : payload
      const savedAssessment =
        persisted?.assessment ||
        (persisted?.classification || persisted?.assessmentType || persisted?.date
          ? persisted
          : null) ||
        payload
      const next = {
        ...record,
        assessment: savedAssessment,
        timeline: [
          {
            at: new Date().toISOString(),
            type: 'clinicalAssessment',
            actor: actor.name,
            detail: 'completed',
          },
          ...(record.timeline || []),
        ],
      }
      setRecord(next)
      markComplete('assessment')
      onRecordChange?.(next)
      setActiveStep('microbiology')
    } catch (error) {
      notify(error?.message || t('actionFailed'), 'danger')
    } finally {
      setBusy(false)
    }
  }

  async function requestSample() {
    if (busy || !record || !sampleDraft.type) return
    setBusy(true)
    try {
      const id = `LAB-${new Date().toISOString().slice(2, 10).replaceAll('-', '')}-${String(laboratorySamples.length + 1).padStart(3, '0')}`
      const sourceNames = sampleSourceNames[sampleDraft.source] || {
        el: sampleDraft.source,
        en: sampleDraft.source,
      }
      const labPatient = selectedPatient || createdPatient || patient
      if (!labPatient)
        throw new Error(
          language === 'el'
            ? 'Δεν βρέθηκε ο ασθενής του επεισοδίου.'
            : 'Episode patient was not found.',
        )
      const lab = {
        id,
        patient: labPatient.name,
        patientEn: labPatient.nameEn || labPatient.name,
        patientId: labPatient.id,
        department: startDraft.department || labPatient.department,
        departmentEn: startDraft.departmentEn || labPatient.departmentEn,
        type: sampleDraft.type,
        source: sourceNames.el,
        sourceEn: sourceNames.en,
        sourceCode: sampleDraft.source,
        anatomicalSite: sampleDraft.anatomicalSite,
        collectedAt: sampleDraft.collectedAt
          ? `${sampleDraft.collectedAt}T12:00:00`
          : new Date().toISOString(),
        receivedAt: null,
        status: 'requested',
        priority: sampleDraft.priority,
        organism: null,
        result: null,
        resultStatus: 'draft',
        resultedAt: null,
        validatedAt: null,
        validatedBy: null,
        resistance: null,
        critical: false,
        surveillanceCase: record.id,
        ast: [],
        communications: [],
        attachments: [],
        timeline: [{ at: new Date().toISOString(), type: 'sampleRequested', actor: actor.name }],
        notes: sampleDraft.notes,
      }
      const createdSample = onRequestSample
        ? await onRequestSample(record, { ...sampleDraft, source: sourceNames.el })
        : (createDemoLabSample(lab), lab)
      const sample = createdSample || {
        id,
        status: 'requested',
        type: sampleDraft.type,
        collectedAt: lab.collectedAt,
        result: 'pending',
        organism: null,
        resistance: null,
      }
      const next = {
        ...record,
        samples: [...(record.samples || []), sample],
        timeline: [
          {
            at: new Date().toISOString(),
            type: 'sampleRequested',
            actor: actor.name,
            detail: sample.id || id,
          },
          ...(record.timeline || []),
        ],
      }
      setRecord(next)
      markComplete('microbiology')
      onRecordChange?.(next)
      setIsolationNeeded(
        next.isolation ? true : next.isolationDecision?.required === false ? false : null,
      )
      setActiveStep('isolation')
      notify(t('clinicalRecords.sampleRequestSavedContinueIsolation'), 'success')
    } catch (error) {
      notify(error?.message || t('actionFailed'), 'danger')
    } finally {
      setBusy(false)
    }
  }
  function continueWithoutSample() {
    markComplete('microbiology')
    setIsolationNeeded(
      record?.isolation ? true : record?.isolationDecision?.required === false ? false : null,
    )
    setActiveStep('isolation')
  }

  async function saveIsolation() {
    if (busy || !record || isolationNeeded === null) return
    setBusy(true)
    try {
      const now = new Date().toISOString()
      if (isolationNeeded === false) {
        if (onSaveIsolation) await onSaveIsolation(record, { required: false, decidedAt: now })
        const next = {
          ...record,
          isolation: null,
          isolationDecision: { required: false, decidedAt: now, by: actor.name },
          timeline: [
            { at: now, type: 'isolationNotRequired', actor: actor.name, detail: 'no' },
            ...(record.timeline || []),
          ],
        }
        setRecord(next)
        markComplete('isolation')
        onRecordChange?.(next)
        notify(t('clinicalRecords.isolationDecisionSaved'), 'success')
        sessionStorage.removeItem(FLOW_RECOVERY_KEY)
        onClose()
        return
      }
      if (!isolationDraft.startedAt) return
      const draft = {
        required: true,
        precautions: [isolationDraft.precautionType],
        room: startDraft.room || '',
        reason: isolationDraft.reason || isolationDraft.reasonEn || '',
        startedAt: isolationDraft.startedAt,
        reviewDue: startDraft.reviewDue || null,
      }
      const persisted = onSaveIsolation ? await onSaveIsolation(record, draft) : null
      const savedIsolation = persisted?.isolation ||
        (persisted?.status || persisted?.precautions || persisted?.startedAt
          ? persisted
          : null) || {
          id: record.isolation?.id || `ISO-${Date.now()}`,
          status: 'active',
          startedAt: isolationDraft.startedAt,
          type: isolationDraft.precautionType,
          precautions: [isolationDraft.precautionType],
          room: startDraft.room || '',
          reason: isolationDraft.reason || isolationDraft.reasonEn || '',
          by: actor.name,
        }
      const next = {
        ...record,
        isolationDecision: { required: true, decidedAt: now, by: actor.name },
        isolation: savedIsolation,
        timeline: [
          {
            at: now,
            type: 'isolationStarted',
            actor: actor.name,
            detail: isolationDraft.precautionType,
          },
          ...(record.timeline || []),
        ],
      }
      setRecord(next)
      markComplete('isolation')
      onRecordChange?.(next)
      notify(t('isolationSaved'), 'success')
      sessionStorage.removeItem(FLOW_RECOVERY_KEY)
      onClose()
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

          {activeStep === 'start' && (
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
          )}

          {activeStep === 'assessment' && (
            <AssessmentStep
              addLibraryEntry={addLibraryEntry}
              assessmentDraft={assessmentDraft}
              busy={busy}
              language={language}
              newRisk={newRisk}
              newSymptom={newSymptom}
              riskRows={riskRows}
              saveAssessment={saveAssessment}
              setActiveStep={setActiveStep}
              setAssessment={setAssessment}
              setNewRisk={setNewRisk}
              setNewSymptom={setNewSymptom}
              setScreening={setScreening}
              symptomRows={symptomRows}
              t={t}
              toggle={toggle}
            />
          )}

          {activeStep === 'microbiology' && (
            <MicrobiologyStep
              alreadyHasSample={alreadyHasSample}
              busy={busy}
              continueWithoutSample={continueWithoutSample}
              language={language}
              linkedLabSamples={linkedLabSamples}
              requestSample={requestSample}
              sampleDraft={sampleDraft}
              setActiveStep={setActiveStep}
              setSample={setSample}
              setSampleDraft={setSampleDraft}
              t={t}
            />
          )}

          {activeStep === 'isolation' && (
            <IsolationStep
              busy={busy}
              isolationDraft={isolationDraft}
              isolationNeeded={isolationNeeded}
              language={language}
              saveIsolation={saveIsolation}
              setActiveStep={setActiveStep}
              setIsolation={setIsolation}
              setIsolationNeeded={setIsolationNeeded}
              t={t}
            />
          )}
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
