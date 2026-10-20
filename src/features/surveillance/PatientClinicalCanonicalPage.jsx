import { useEffect, useMemo, useState } from 'react'
import {
  admissionWindowEnd,
  episodeBelongsToPatient,
  episodesForAdmission,
  episodesOutsideAdmissions,
  hospitalDay,
  samplesForAdmission,
  samplesForEpisode,
  samplesOutsideAdmissions,
} from './patientRecordScope'
import { FileClock, FolderOpen, ListTree, UserRound, Stethoscope } from 'lucide-react'
import { useLocation, useParams } from 'react-router-dom'
import { RouteLoading } from '../../design-system/RouteLoading'
import { Page } from '../../design-system/Page'
import { EntityRecordShell } from '../../design-system/EntityRecordShell'
import { ExportMenu } from '../../design-system/ExportMenu'
import { Button } from '../../design-system/Button'
import { ObserverDialog } from '../../design-system/ObserverDialog'
import { EmptyState } from '../../design-system/EmptyState'
import { DocumentsWorkspace } from '../../design-system/DocumentsWorkspace'
import { StatusBadge } from '../../design-system/StatusBadge'
import { formatDateTime, formatDay } from '../../core/i18n/formatDay'
import { useLanguage, translate } from '../../core/i18n/LanguageContext'
import { useFeedback } from '../../core/feedback/FeedbackContext'
import { useTenant } from '../../core/tenant/TenantContext'
import { useAuditActor } from '../../core/audit/useAuditActor'
import { useContextualNavigation } from '../../core/navigation/useContextualNavigation'
import { useRecordSequenceNavigation } from '../../core/navigation/useRecordSequenceNavigation'
import { downloadRecordJson } from '../../core/export/recordExport'
import { can, CAPABILITIES, isProfileDisabled } from '../../core/permissions/roles'
import { loadAdmissions, loadPatients, loadPatientsByKeys } from '../patients/patientsService'
import { useDepartments } from '../management/useLibraries'
import {
  loadManagementLibraries,
  createManagementLibraryItem,
} from '../management/managementCloudService'
import { demoLibrarySeed } from '../management/managementData'
import { useLaboratoryRegistry } from '../laboratory/hooks/useLaboratoryRegistry'
import { linkLaboratorySampleToSurveillance } from '../laboratory/laboratoryLinkService'
import { NewSurveillanceFlow } from './NewSurveillanceFlow'
import { createClinicalRepository } from './clinicalRepository'
import { PatientClinicalScalesPanel } from '../clinical-scales/PatientClinicalScalesPanel'
import { ClinicalRiskFlags, scaleShortName } from '../clinical-scales/ClinicalRiskFlags'
import { loadLatestPatientRiskFlags } from '../clinical-scales/patientRiskFlagsService'
import {
  AdmissionPicker,
  CanonicalSummary,
  NewAdmissionDialog,
  PatientDetailsSection,
} from './ClinicalAdmissions'
import { SurveillanceWorkspace } from './ClinicalSurveillanceWorkspace'
import { Timeline } from './ClinicalRecordViews'
import { statusTone } from './surveillanceOptions'
import { buildSurveillanceReport } from './surveillanceReport'
import { sampleTypeLabel } from '../laboratory/laboratoryCloudService'
import './surveillanceEpisode.css'
export {
  timelineLabel,
  withCriteriaKeys,
  orderCriteriaForAge,
  criteriaAgeWarning,
  SURVEILLANCE_OUTCOMES,
} from './clinicalRecordLabels'

export function PatientClinicalCanonicalPage({ patientMode = false }) {
  const actor = useAuditActor()
  const { caseId, patientId } = useParams()
  const location = useLocation()
  const { t, language } = useLanguage()
  const { notify } = useFeedback()
  const { tenant, isDemo, role, membership, canAccessRecord } = useTenant()
  const { goBack, restored } = useContextualNavigation(patientMode ? '/surveillance?tab=registry' : '/surveillance')
  const repository = useMemo(
    () => createClinicalRepository({ isDemo, organizationId: tenant?.id, actor }),
    [isDemo, tenant?.id, actor],
  )
  // The organization's active departments, one shape for every dialog of the record.
  const { departments } = useDepartments()
  const [patients, setPatients] = useState([]),
    [episodes, setEpisodes] = useState([]),
    [admissions, setAdmissions] = useState([]),
    [clinicalLibraries, setClinicalLibraries] = useState(demoLibrarySeed)
  // Demo has no cloud attachment store; keep documents per episode in memory.
  const [demoDocuments, setDemoDocuments] = useState({})
  const [riskFlagRows, setRiskFlagRows] = useState({})
  const [selectedAdmissionId, setSelectedAdmissionId] = useState(() =>
    patientMode ? location.state?.admissionId || '' : '',
  )
  const [selectedEpisodeId, setSelectedEpisodeId] = useState(caseId || ''),
    [loading, setLoading] = useState(true),
    // The record the episodes and admissions on hand belong to (see `stale` below).
    [loadedFor, setLoadedFor] = useState(''),
    [error, setError] = useState(''),
    [createOpen, setCreateOpen] = useState(false)
  const [sampleToLink, setSampleToLink] = useState(null)
  const [clearTestOpen, setClearTestOpen] = useState(false)
  const [newAdmissionOpen, setNewAdmissionOpen] = useState(false)
  // The header's NEWS2 / Braden / GCS chips open the clinical scales with their history.
  const [scalesOpen, setScalesOpen] = useState(false)
  const creatingAdmissionSampleRef = useMemo(() => ({ current: false }), [])
  const [tab, setTab] = useState(() => location.state?.openTab || restored?.tab || 'summary')
  // Stage the surveillance tab opens on, e.g. when the summary sends the user to an overdue reassessment.
  const [journeyStage, setJourneyStage] = useState(null)
  const has = cap =>
    can(role, cap, membership?.capabilities ?? [], membership?.customCapabilities ?? [])
  const patient = useMemo(
    () =>
      patientMode
        ? patients.find(row => String(row.id) === String(patientId)) || null
        : patients.find(row => episodes.some(ep => episodeBelongsToPatient(ep, row))) || null,
    [patients, patientMode, patientId, episodes],
  )
  // Production reads the samples of this patient and of its episodes only,
  // once they are known; the demo keeps its whole in-memory list.
  const labScopeKey =
    isDemo || !tenant?.id
      ? ''
      : [patient?.recordId || '', ...episodes.map(row => row.recordId || row.id)].join(',')
  const labScope = useMemo(() => {
    if (!labScopeKey.replaceAll(',', '')) return null
    const [patientRecordId, ...caseIds] = labScopeKey.split(',')
    return { patientRecordId: patientRecordId || null, caseIds }
  }, [labScopeKey])
  const laboratory = useLaboratoryRegistry({ enabled: isDemo || !tenant?.id || Boolean(labScope), scope: labScope })
  // The patient record opens straight on an admission: the chosen one, else the
  // active one, else the latest. Older admissions are picked in the header.
  const orderedAdmissions = useMemo(
    () =>
      [...admissions].sort(
        (a, b) =>
          (b.status === 'active') - (a.status === 'active') ||
          String(b.admissionDate || '').localeCompare(String(a.admissionDate || '')),
      ),
    [admissions],
  )
  const selectedAdmission = patientMode
    ? admissions.find(row => String(row.id) === String(selectedAdmissionId)) ||
      orderedAdmissions[0] ||
      null
    : null
  const admissionEpisodes = useMemo(
    () => episodesForAdmission(episodes, selectedAdmission, { admissions }),
    [episodes, selectedAdmission, admissions],
  )
  const admissionSamples = useMemo(
    () => samplesForAdmission(laboratory.rows || [], patient, selectedAdmission, { admissions, episodes }),
    [laboratory.rows, selectedAdmission, patient, admissions, episodes],
  )
  // Samples and episodes of the patient that belong to none of their admissions
  // (e.g. dated before an imported admission): shown apart, never hidden.
  const outsideSamples = useMemo(
    () => (patientMode ? samplesOutsideAdmissions(laboratory.rows || [], patient, admissions, { episodes }) : []),
    [patientMode, laboratory.rows, patient, admissions, episodes],
  )
  const outsideEpisodes = useMemo(
    () => (patientMode ? episodesOutsideAdmissions(episodes, admissions) : []),
    [patientMode, episodes, admissions],
  )
  const outsideTimeline = useMemo(() => {
    const rows = []
    for (const episode of outsideEpisodes)
      rows.push({ type: 'clinicalRecords.outsideEpisode', at: episode.startedAt, detail: [episode.reason, episode.department].filter(Boolean).join(' · ') })
    for (const sample of outsideSamples)
      rows.push({
        type: 'clinicalRecords.outsideSample',
        at: sample.collectedAt || sample.requestedAt,
        detail: [sample.typeLabel || sample.type, sample.source, sample.department, sample.organism].filter(Boolean).join(' · '),
      })
    return rows.filter(row => row.at)
  }, [outsideSamples, outsideEpisodes])
  // History of an admission without surveillance: admission, clinical scales,
  // samples and discharge, so the tab is never empty for a hospitalised patient.
  const admissionTimeline = useMemo(() => {
    if (!selectedAdmission) return []
    const from = hospitalDay(selectedAdmission.admissionDate)
    const to = admissionWindowEnd(selectedAdmission, admissions) || '9999-12-31'
    const within = value => {
      const day = hospitalDay(value)
      return day && (!from || day >= from) && day <= to
    }
    const rows = [
      { type: 'clinicalRecords.timelineAdmission', at: selectedAdmission.admissionDate, detail: selectedAdmission.department },
    ]
    const scales = patient ? riskFlagRows[patient.recordId] || riskFlagRows[patient.id] || [] : []
    for (const row of scales)
      if (within(row.assessed_at))
        rows.push({ type: 'clinicalRecords.timelineScale', at: row.assessed_at, detail: `${scaleShortName(row.scale_key)} ${row.score ?? '—'}` })
    for (const sample of admissionSamples) {
      const what = [sample.typeLabel || sample.type, sample.source].filter(Boolean).join(' · ')
      if (sample.collectedAt) rows.push({ type: 'sample_collected', at: sample.collectedAt, detail: what })
      if (sample.resultedAt)
        rows.push({ type: 'sample_result', at: sample.resultedAt, detail: [sample.organism, sample.resistance].filter(Boolean).join(' · ') || what })
    }
    if (selectedAdmission.dischargeDate)
      rows.push({ type: 'clinicalRecords.timelineDischarge', at: selectedAdmission.dischargeDate, detail: selectedAdmission.department })
    return rows.filter(row => row.at)
  }, [selectedAdmission, admissions, patient, riskFlagRows, admissionSamples])
  const record = patientMode
    ? selectedAdmission
      ? admissionEpisodes.find(row => String(row.id) === String(selectedEpisodeId)) ||
        admissionEpisodes[0] ||
        null
      : null
    : episodes.find(row => String(row.id) === String(selectedEpisodeId)) || episodes[0] || null
  // Episode route (/surveillance/:id): the episode's own samples plus any laboratory
  // rows recorded for it afterwards (e.g. a follow-up sample), so new entries show up.
  const recordSamples = useMemo(
    () => (patientMode ? [] : samplesForEpisode(record, laboratory.rows || [])),
    [patientMode, record, laboratory.rows],
  )
  const sequenceId = patientMode ? patientId : caseId
  const recordNavigation = useRecordSequenceNavigation({
    registry: patientMode
      ? 'patients'
      : typeof location.state?.limoxisFrom?.registry === 'string'
        ? location.state.limoxisFrom.registry
        : 'surveillance-patients',
    currentId: sequenceId,
    pathForId: id => (patientMode ? `/patients/${id}` : `/surveillance/${id}`),
  })

  // Moving to another record (sequence, link) keeps this page mounted: until its
  // own read ends, the previous patient's episodes and admissions are never shown.
  const recordKey = `${patientMode ? 'patient' : 'case'}:${patientMode ? patientId : caseId}`
  const stale = loadedFor !== recordKey
  async function load(preferred = '') {
    setLoading(true)
    setError('')
    try {
      // A production record reads its own patient, not the whole roster.
      const cloud = !isDemo && Boolean(tenant?.id)
      let roster = !cloud
        ? await loadPatients(tenant?.id, { isDemo })
        : patientMode
          ? await loadPatientsByKeys(tenant.id, { codes: [patientId] })
          : []
      const selectedPatient = patientMode
        ? roster.find(row => String(row.id) === String(patientId))
        : null
      let rows = []
      if (patientMode && selectedPatient) rows = await repository.loadForPatient(selectedPatient)
      else if (caseId) {
        const one = await repository.loadCase(caseId)
        rows = one ? [one] : []
      }
      if (cloud && !patientMode)
        roster = await loadPatientsByKeys(tenant.id, { recordIds: rows.map(row => row.patientRecordId) })
      setPatients(roster)
      // Surveillance switched off by the operating profile: its episodes are hidden, not deleted.
      if (isProfileDisabled(CAPABILITIES.VIEW_SURVEILLANCE)) rows = []
      setEpisodes(rows)
      const current = preferred || selectedEpisodeId || caseId || rows[0]?.id || ''
      if (!patientMode)
        setSelectedEpisodeId(
          rows.some(row => String(row.id) === String(current)) ? current : rows[0]?.id || '',
        )
      const patientForAdmissions =
        selectedPatient || roster.find(row => rows.some(ep => episodeBelongsToPatient(ep, row)))
      // The admissions and the libraries are read together.
      const [admissionRows, libraries] = await Promise.all([
        isDemo
          ? patientForAdmissions
            ? loadAdmissions(patientForAdmissions, { isDemo: true })
            : []
          : patientForAdmissions?.recordId
            ? loadAdmissions(patientForAdmissions.recordId).catch(() => [])
            : [],
        !isDemo && tenant?.id
          ? // The record still opens; the dialogs fall back to their built-in lists.
            loadManagementLibraries(tenant.id).catch(() => null)
          : demoLibrarySeed,
      ])
      setAdmissions(admissionRows)
      if (libraries) setClinicalLibraries(libraries)
    } catch (err) {
      setError(err?.message || t('actionFailed'))
    } finally {
      setLoadedFor(recordKey)
      setLoading(false)
    }
  }
  // `load` reads `selectedEpisodeId`/`repository` to decide what to reselect after fetching,
  // and calling it updates that same state — depending on `load` here would refire it on
  // every completed load, an infinite loop. Re-run only when the identity being viewed changes.
  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenant?.id, isDemo, patientMode, patientId, caseId])

  // Clinical-scale risk flags in the header; reloaded on tab change so a new assessment appears at once.
  useEffect(() => {
    let alive = true
    if (!patient) return
    loadLatestPatientRiskFlags(tenant?.id, { isDemo })
      .then(value => {
        if (alive) setRiskFlagRows(value)
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [tenant?.id, isDemo, patient, tab, scalesOpen])
  // The record's first read: the page placeholder, not a generic «patient record» page.
  if (loading || stale) return <RouteLoading />
  if (error)
    return (
      <Page title={t('clinicalRecords.patientRecord')}>
        <EmptyState title={t('actionFailed')} description={error} />
      </Page>
    )
  if (!patient && !record)
    return (
      <Page title={t('clinicalRecords.patientRecord')}>
        <EmptyState title={t('noData')} description={t('clinicalRecords.noClinicalData')} />
      </Page>
    )
  const subject = record || patient
  if (subject && !canAccessRecord(subject))
    return (
      <Page title={t('clinicalRecords.patientRecord')}>
        <EmptyState
          title={t('scopeAccessDeniedTitle')}
          description={t('scopeAccessDeniedDescription')}
        />
      </Page>
    )

  const name =
    language === 'el'
      ? patient?.name || record?.patient
      : patient?.nameEn || record?.patientEn || patient?.name || record?.patient
  const code = patient?.id || record?.patientId
  const department =
    selectedAdmission?.department ||
    (language === 'el'
      ? record?.department || patient?.department
      : record?.departmentEn || patient?.departmentEn || record?.department || patient?.department)
  const fmtDate = value => formatDay(value, language)
  const fmtDateTime = value => formatDateTime(value, language)
  const canSurveillance = has(CAPABILITIES.VIEW_SURVEILLANCE)
  const canLab = has(CAPABILITIES.VIEW_LAB) || canSurveillance
  const canCreateLabSample = has(CAPABILITIES.MANAGE_LAB_SAMPLES)
  const canTherapy = has(CAPABILITIES.MANAGE_ANTIMICROBIAL_THERAPY)
  const tabs =
    patientMode && !selectedAdmission
      ? []
      : [
          { id: 'summary', label: t('summary'), icon: UserRound },
          {
            id: 'surveillanceJourney',
            label: translate(
              'copy.clinicalRecordCopy.surveillanceSamples',
              language === 'el' ? 'el' : 'en',
            ),
            icon: ListTree,
          },
          ...(patientMode && selectedAdmission
            ? [
                {
                  id: 'clinicalScales',
                  label: t('clinicalRecords.clinicalAssessments'),
                  icon: Stethoscope,
                },
              ]
            : []),
          { id: 'documents', label: t('documents'), icon: FolderOpen },
          { id: 'history', label: t('history'), icon: FileClock },
        ]
  const activeTab = tabs.some(item => item.id === tab) ? tab : 'summary'
  // A header scale chip: the patient record has the scales as a tab; the
  // surveillance episode opens the same scales panel (history included) over the page.
  function openClinicalScales() {
    if (tabs.some(item => item.id === 'clinicalScales')) setTab('clinicalScales')
    else setScalesOpen(true)
  }
  const episodeAdmission =
    admissions.find(row => record?.admissionId && String(row.id) === String(record.admissionId)) ||
    null

  function openAdmission(id) {
    const scoped = episodes.filter(ep => String(ep.admissionId || '') === String(id))
    setSelectedAdmissionId(id)
    setSelectedEpisodeId(scoped[0]?.id || '')
    setTab('summary')
  }

  async function createEpisode(draft, targetPatient) {
    const scopedDraft = selectedAdmission
      ? {
          ...draft,
          admissionId: selectedAdmission.id,
          admissionDate: selectedAdmission.admissionDate,
          departmentId: selectedAdmission.departmentId || draft.departmentId,
          department: selectedAdmission.department || draft.department,
          departmentEn: selectedAdmission.department || draft.departmentEn,
        }
      : draft
    const created = await repository.createCase(targetPatient || patient, scopedDraft)
    if (sampleToLink) {
      try {
        if (isDemo)
          await laboratory.repository.update(sampleToLink.id, { surveillanceCase: created.id })
        else await linkLaboratorySampleToSurveillance(tenant?.id, sampleToLink.recordId, created.id)
        await laboratory.reload()
      } catch (linkError) {
        notify(
          linkError?.message ||
            translate(
              'copy.clinicalRecordCopy.surveillanceWasCreatedButTheSample',
              language === 'el' ? 'el' : 'en',
            ),
          'error',
        )
      }
    }
    setEpisodes(current => [
      ...current.filter(row => String(row.id) !== String(created.id)),
      created,
    ])
    setSelectedEpisodeId(created.id)
    notify(t('surveillanceCreated'), 'success')
    return created
  }

  async function clearOwnerClinicalTestData() {
    if (role !== 'platform_owner' || !patient || !selectedAdmission) return
    try {
      for (const sample of admissionSamples)
        await laboratory.repository.remove?.(sample.id || sample.recordId)
      for (const ep of admissionEpisodes)
        await repository.voidCase(ep, 'Platform Owner test data reset')
      setSelectedEpisodeId('')
      setSampleToLink(null)
      await laboratory.reload()
      await load()
      setClearTestOpen(false)
      notify(
        translate(
          'copy.clinicalRecordCopy.clinicalTestSurveillanceAndSamplesCleared',
          language === 'el' ? 'el' : 'en',
        ),
        'success',
      )
    } catch (err) {
      notify(err?.message || t('actionFailed'), 'error')
    }
  }

  async function createAdmissionSample(draft) {
    if (!patient || creatingAdmissionSampleRef.current) return null
    // Outside the patient route (/surveillance/:id) there is no selected admission:
    // the episode's own department is used instead, so follow-up samples still save.
    const admission = selectedAdmission || {
      departmentId: record?.departmentId || null,
      department: record?.department || '',
    }
    creatingAdmissionSampleRef.current = true
    try {
      const created = await laboratory.createSample({
        patientRecordId: patient.recordId || null,
        draft: {
          ...draft,
          patient: patient.name,
          patientEn: patient.nameEn || patient.name,
          patientId: patient.id,
          departmentId: admission.departmentId || null,
          department: admission.department || patient.department || '',
          departmentEn: admission.department || patient.departmentEn || patient.department || '',
          subjectType: 'patient',
          subjectName: patient.name,
          subjectNameEn: patient.nameEn || patient.name,
          subjectCode: patient.id,
        },
      })
      notify(
        translate('copy.clinicalRecordCopy.sampleRecorded', language === 'el' ? 'el' : 'en'),
        'success',
      )
      if (!patientMode) await load()
      return created
    } finally {
      creatingAdmissionSampleRef.current = false
    }
  }

  // "Outside admissions": the patient's samples and episodes of no admission, with
  // their date and department, under the samples tab and the history.
  const outsideSection = outsideTimeline.length ? (
    <Timeline
      record={{ timeline: outsideTimeline }}
      title={t('clinicalRecords.outsideAdmissions')}
      subtitle={t('clinicalRecords.outsideAdmissionsHint')}
      t={t}
      language={language}
      fmtDateTime={value =>
        /^\d{4}-\d{2}-\d{2}$/.test(String(value || '')) ? fmtDate(value) : fmtDateTime(value)
      }
    />
  ) : null
  const shellSubtitle = selectedAdmission
    ? `${selectedAdmission.department || '—'} · ${t('clinicalRecords.admission')}: ${fmtDate(selectedAdmission.admissionDate)}`
    : patientMode
      ? patient?.hospitalRecordNumber || t('clinicalRecords.patientRecord')
      : `${department || '—'} · ${t('clinicalRecords.admission')}: ${fmtDate(record?.admissionDate || patient?.admissionDate)}`
  const documentsScope = record
    ? isDemo || record.recordId
      ? { key: record.id, entityType: 'clinical_case', entityId: record.recordId }
      : null
    : patientMode && selectedAdmission && (isDemo || selectedAdmission.id)
      ? {
          key: `admission:${selectedAdmission.id}`,
          entityType: 'patient_admission',
          entityId: selectedAdmission.id,
        }
      : null
  const shellStatus = selectedAdmission?.status || record?.status || patient?.status || 'active'
  // One tab of the record: on screen the active one; when the record is printed
  // (EntityRecordShell renderTab) every tab, one after the other.
  const renderTab = tabId => (
    <>
      {(!patientMode || selectedAdmission) && tabId === 'summary' && (
        <CanonicalSummary
          samples={patientMode ? admissionSamples : recordSamples}
          scaleRows={patient ? riskFlagRows[patient.recordId] || riskFlagRows[patient.id] || [] : []}
          onOpenStage={stage => {
            setJourneyStage(stage)
            setTab('surveillanceJourney')
          }}
          patient={patient}
          admission={selectedAdmission}
          record={record}
          tenantId={tenant?.id}
          isDemo={isDemo}
          departments={departments}
          canEdit={patientMode && has(CAPABILITIES.EDIT_PATIENT)}
          canDelete={patientMode && has(CAPABILITIES.DELETE_PATIENT) && admissions.length > 1}
          showPatientActions={patientMode}
          onDeleted={goBack}
          onChanged={() => load()}
          onAdmissionDeleted={() => {
            setSelectedAdmissionId('')
            return load()
          }}
          t={t}
          language={language}
          fmtDate={fmtDate}
        />
      )}
      {(!patientMode || selectedAdmission) && tabId === 'surveillanceJourney' && (
        <SurveillanceWorkspace
          initialStage={journeyStage}
          samples={patientMode ? admissionSamples : recordSamples}
          episodes={admissionEpisodes}
          selectedId={record?.id}
          onSelect={setSelectedEpisodeId}
          onCreate={() => {
            setSampleToLink(null)
            setCreateOpen(true)
          }}
          onCreateFromSample={sample => {
            setSampleToLink(sample)
            setCreateOpen(true)
          }}
          onCreateSample={patient ? createAdmissionSample : null}
          onClearTestData={
            patientMode && role === 'platform_owner' ? () => setClearTestOpen(true) : null
          }
          canCreate={has(CAPABILITIES.CREATE_SURVEILLANCE)}
          canCreateSample={canCreateLabSample}
          repository={repository}
          onReload={preferred => load(preferred || record?.id)}
          t={t}
          language={language}
          fmtDate={fmtDate}
          fmtDateTime={fmtDateTime}
          libraries={clinicalLibraries}
          organizationId={tenant?.id}
          isDemo={isDemo}
          onLibraryAdded={async (key, item) => {
            if (isDemo) {
              setClinicalLibraries(current => ({
                ...current,
                [key]: [...(current[key] || []), item],
              }))
              return item
            }
            const created = await createManagementLibraryItem(tenant.id, key, {
              nameEl: item[0],
              nameEn: item[1] || item[0],
            })
            setClinicalLibraries(current => ({
              ...current,
              [key]: [...(current[key] || []), created],
            }))
            return created
          }}
          permissions={{
            canAssess: has(CAPABILITIES.RECORD_CLINICAL_ASSESSMENT),
            canLab,
            canClassifyResistance: has(CAPABILITIES.CLASSIFY_RESISTANCE),
            canIsolation: has(CAPABILITIES.MANAGE_ISOLATION),
            canTherapy,
            canReassess: has(CAPABILITIES.REASSESS_SURVEILLANCE),
            canOutcome:
              has(CAPABILITIES.RECORD_SURVEILLANCE_OUTCOME) ||
              has(CAPABILITIES.CLOSE_SURVEILLANCE),
            canEdit: has(CAPABILITIES.EDIT_SURVEILLANCE),
            canDelete: has(CAPABILITIES.DELETE_SURVEILLANCE),
            canReopen: has(CAPABILITIES.REOPEN_SURVEILLANCE),
          }}
        />
      )}
      {tabId === 'surveillanceJourney' && selectedAdmission && outsideSection}
      {tabId === 'clinicalScales' && patient && selectedAdmission && (
        <PatientClinicalScalesPanel
          organizationId={tenant?.id}
          patient={patient}
          admission={selectedAdmission}
          isDemo={isDemo}
          language={language}
          canRecord={has(CAPABILITIES.RECORD_CLINICAL_ASSESSMENT)}
        />
      )}
      {/* Documents belong to the surveillance when there is one, else to the
          admission itself, so they can be added before any surveillance. */}
      {tabId === 'documents' && documentsScope && (
        <DocumentsWorkspace
          title={translate('copy.clinicalRecordCopy.documents', language === 'en' ? 'en' : 'el')}
          disabled={!has(CAPABILITIES.RECORD_CLINICAL_ASSESSMENT)}
          {...(isDemo
            ? {
                value: demoDocuments[documentsScope.key] || [],
                onChange: files =>
                  setDemoDocuments(current => ({ ...current, [documentsScope.key]: files })),
              }
            : {
                organizationId: tenant?.id,
                entityType: documentsScope.entityType,
                entityId: documentsScope.entityId,
              })}
        />
      )}
      {tabId === 'documents' && !documentsScope && (
        <EmptyState
          title={translate(
            'copy.clinicalRecordCopy.noDocumentsYet',
            language === 'el' ? 'el' : 'en',
          )}
          description={translate(
            'copy.clinicalRecordCopy.surveillanceDocumentsWillAppearHereAfter',
            language === 'el' ? 'el' : 'en',
          )}
        />
      )}
      {tabId === 'history' && record && (
        <Timeline
          record={record}
          t={t}
          language={language}
          fmtDateTime={value =>
            /^\d{4}-\d{2}-\d{2}$/.test(String(value || '')) ? fmtDate(value) : fmtDateTime(value)
          }
        />
      )}
      {tabId === 'history' && !record && selectedAdmission && (
        <Timeline
          record={{ timeline: admissionTimeline }}
          title={t('clinicalRecords.admissionHistory')}
          subtitle={t('clinicalRecords.admissionHistoryHint')}
          t={t}
          language={language}
          fmtDateTime={value =>
            /^\d{4}-\d{2}-\d{2}$/.test(String(value || '')) ? fmtDate(value) : fmtDateTime(value)
          }
        />
      )}
      {tabId === 'history' && !record && !selectedAdmission && (
        <EmptyState
          title={translate(
            'copy.clinicalRecordCopy.noSurveillanceHistoryYet',
            language === 'el' ? 'el' : 'en',
          )}
          description={translate(
            'copy.clinicalRecordCopy.theActivityHistoryWillAppearHere',
            language === 'el' ? 'el' : 'en',
          )}
        />
      )}
      {tabId === 'history' && selectedAdmission && outsideSection}
    </>
  )
  // The printed report (EntityRecordShell printReport): a document built from what this user can see.
  const printReport = () =>
    buildSurveillanceReport({
      language,
      t,
      fmtDate,
      fmtDateTime,
      record,
      patient,
      admission: selectedAdmission,
      patientMode,
      admissionEpisodes,
      samples: patientMode ? admissionSamples : recordSamples,
      scaleRows: patient ? riskFlagRows[patient.recordId] || riskFlagRows[patient.id] || [] : [],
      admissionTimeline,
      outsideTimeline,
      libraries: clinicalLibraries,
      documents: documentsScope
        ? isDemo
          ? { value: demoDocuments[documentsScope.key] || [] }
          : { organizationId: tenant?.id, entityType: documentsScope.entityType, entityId: documentsScope.entityId }
        : null,
      department,
      status: shellStatus,
      sampleLabel: sample => sample.typeLabel || sampleTypeLabel(sample.type, t),
      can: { surveillance: canSurveillance, lab: canLab },
    })
  return (
    <Page fill title={name} subtitle={code}>
      <EntityRecordShell
        printReport={printReport}
        className={`patient-record-shell workspace-fill${activeTab === 'clinicalScales' ? ' record-secondary-tab-active' : ''}`}
        avatar={name
          ?.split(' ')
          .map(x => x?.[0])
          .slice(0, 2)
          .join('')}
        eyebrow={code}
        title={name}
        subtitle={patientMode && patient ? null : shellSubtitle}
        context={
          patientMode && patient ? (
            <AdmissionPicker
              admissions={orderedAdmissions}
              selected={selectedAdmission}
              onSelect={openAdmission}
              onNew={has(CAPABILITIES.EDIT_PATIENT) ? () => setNewAdmissionOpen(true) : null}
              t={t}
              fmtDate={fmtDate}
            />
          ) : null
        }
        status={
          <>
            <StatusBadge tone={statusTone(shellStatus)}>{t(shellStatus)}</StatusBadge>
            {record?.resistance && <StatusBadge tone="danger">{record.resistance}</StatusBadge>}
            {patient && (
              <ClinicalRiskFlags
                rows={riskFlagRows[patient.recordId] || riskFlagRows[patient.id] || []}
                language={language}
                compact
                named
                onSelect={openClinicalScales}
              />
            )}
          </>
        }
        recordNavigation={recordNavigation}
        headerActions={
          selectedAdmission || !patientMode ? (
            <>
            <ExportMenu onPrint={()=>window.print()} items={[{id:'json',kind:'data',label:'JSON',onClick:() =>
                downloadRecordJson(
                  {
                    patient,
                    admission: selectedAdmission,
                    record,
                    episodes: admissionEpisodes,
                    admissions,
                  },
                  { filename: record?.id || code },
                )}]} />
            </>
          ) : null
        }
        tabs={tabs}
        activeTab={activeTab}
        renderTab={renderTab}
        onTabChange={setTab}
        onBack={goBack}
        backLabel={
          patientMode ? t('clinicalRecords.backToPatients') : t('clinicalRecords.backToSurveillance')
        }
      >
        {patientMode && !selectedAdmission && patient && (
          <PatientDetailsSection
            patient={patient}
            tenantId={tenant?.id}
            isDemo={isDemo}
            departments={departments}
            t={t}
            language={language}
            fmtDate={fmtDate}
            onChanged={() => load()}
            onDeleted={goBack}
          />
        )}
        {patientMode && !selectedAdmission && patient && outsideSection}
        {renderTab(activeTab)}
        {clearTestOpen && (
          <ObserverDialog
            title={translate(
              'copy.clinicalRecordCopy.clearClinicalTestData',
              language === 'el' ? 'el' : 'en',
            )}
            width="compact"
            onClose={() => setClearTestOpen(false)}
            footer={
              <Button onClick={clearOwnerClinicalTestData}>
                {translate('copy.clinicalRecordCopy.confirmClear', language === 'el' ? 'el' : 'en')}
              </Button>
            }
          >
            <p>
              {translate(
                'copy.clinicalRecordCopy.surveillanceEpisodesAndSamplesShownFor',
                language === 'el' ? 'el' : 'en',
              )}
            </p>
          </ObserverDialog>
        )}
        {scalesOpen && patient && (
          <ObserverDialog
            width="wide"
            className="clinical-scales-dialog"
            title={name}
            subtitle={code}
            onClose={() => setScalesOpen(false)}
          >
            <PatientClinicalScalesPanel
              organizationId={tenant?.id}
              patient={patient}
              admission={episodeAdmission}
              isDemo={isDemo}
              language={language}
              canRecord={has(CAPABILITIES.RECORD_CLINICAL_ASSESSMENT)}
            />
          </ObserverDialog>
        )}
        {createOpen && (
          <NewSurveillanceFlow
            patient={patient}
            patients={patients}
            onPatientsChange={setPatients}
            onClose={() => {
              setCreateOpen(false)
              setSampleToLink(null)
              void load(selectedEpisodeId)
            }}
            onCreate={createEpisode}
          />
        )}
      </EntityRecordShell>
      {newAdmissionOpen && patient && (
        <NewAdmissionDialog
          patient={patient}
          activeAdmission={admissions.find(row => row.status === 'active') || null}
          tenantId={tenant?.id}
          isDemo={isDemo}
          departments={departments}
          t={t}
          onClose={() => setNewAdmissionOpen(false)}
          onAdmitted={async (row, discharged) => {
            setNewAdmissionOpen(false)
            if (isDemo)
              setAdmissions(list => [
                row,
                ...list.map(item => (discharged && item.id === discharged.id ? discharged : item)),
              ])
            else await load()
            openAdmission(row.id)
          }}
        />
      )}
    </Page>
  )
}
