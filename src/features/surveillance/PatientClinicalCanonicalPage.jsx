import { useEffect, useMemo, useState } from 'react'
import {
  episodeBelongsToPatient,
  episodesForAdmission,
  samplesForAdmission,
  samplesForEpisode,
} from './patientRecordScope'
import { Activity, FileClock, FolderOpen, ListTree, UserRound, Stethoscope } from 'lucide-react'
import { useLocation, useParams } from 'react-router-dom'
import { Page } from '../../design-system/Page'
import { EntityRecordShell } from '../../design-system/EntityRecordShell'
import { PrintExportActions } from '../../design-system/PrintExportActions'
import { Button } from '../../design-system/Button'
import { ObserverDialog } from '../../design-system/ObserverDialog'
import { EmptyState } from '../../design-system/EmptyState'
import { DocumentsWorkspace } from '../../design-system/DocumentsWorkspace'
import { useLanguage, translate } from '../../core/i18n/LanguageContext'
import { useFeedback } from '../../core/feedback/FeedbackContext'
import { useTenant } from '../../core/tenant/TenantContext'
import { useAuditActor } from '../../core/audit/useAuditActor'
import { useContextualNavigation } from '../../core/navigation/useContextualNavigation'
import { useRecordSequenceNavigation } from '../../core/navigation/useRecordSequenceNavigation'
import { downloadRecordJson } from '../../core/export/recordExport'
import { can, CAPABILITIES, isProfileDisabled } from '../../core/permissions/roles'
import { loadAdmissions, loadPatients } from '../patients/patientsService'
import { PatientSummaryActions } from '../patients/PatientSummaryActions'
import { loadDepartments } from '../management/departmentsService'
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
import { ClinicalRiskFlags } from '../clinical-scales/ClinicalRiskFlags'
import { loadLatestPatientRiskFlags } from '../clinical-scales/patientRiskFlagsService'
import { PatientAdmissionsHome, CanonicalSummary } from './ClinicalAdmissions'
import { SurveillanceWorkspace } from './ClinicalSurveillanceWorkspace'
import { ClinicalSnapshot, Timeline } from './ClinicalRecordViews'
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
  const { t, language, locale } = useLanguage()
  const { notify } = useFeedback()
  const { tenant, isDemo, role, membership, canAccessRecord } = useTenant()
  const { goBack, restored } = useContextualNavigation(patientMode ? '/patients' : '/surveillance')
  const repository = useMemo(
    () => createClinicalRepository({ isDemo, organizationId: tenant?.id, actor }),
    [isDemo, tenant?.id, actor],
  )
  const laboratory = useLaboratoryRegistry()
  const [patients, setPatients] = useState([]),
    [episodes, setEpisodes] = useState([]),
    [admissions, setAdmissions] = useState([]),
    [departments, setDepartments] = useState([]),
    [clinicalLibraries, setClinicalLibraries] = useState(demoLibrarySeed)
  // Demo has no cloud attachment store; keep documents per episode in memory.
  const [demoDocuments, setDemoDocuments] = useState({})
  const [riskFlagRows, setRiskFlagRows] = useState({})
  const [selectedAdmissionId, setSelectedAdmissionId] = useState(() =>
    patientMode ? location.state?.admissionId || '' : '',
  )
  const [selectedEpisodeId, setSelectedEpisodeId] = useState(caseId || ''),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(''),
    [createOpen, setCreateOpen] = useState(false)
  const [sampleToLink, setSampleToLink] = useState(null)
  const [clearTestOpen, setClearTestOpen] = useState(false)
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
  const selectedAdmission = patientMode
    ? admissions.find(row => String(row.id) === String(selectedAdmissionId)) || null
    : null
  const admissionEpisodes = useMemo(
    () => episodesForAdmission(episodes, selectedAdmission),
    [episodes, selectedAdmission],
  )
  const admissionSamples = useMemo(
    () => samplesForAdmission(laboratory.rows || [], patient, selectedAdmission),
    [laboratory.rows, selectedAdmission, patient],
  )
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

  async function load(preferred = '') {
    setLoading(true)
    setError('')
    try {
      const roster = await loadPatients(tenant?.id, { isDemo })
      setPatients(roster)
      const selectedPatient = patientMode
        ? roster.find(row => String(row.id) === String(patientId))
        : null
      let rows = []
      if (patientMode && selectedPatient) rows = await repository.loadForPatient(selectedPatient)
      else if (caseId) {
        const one = await repository.loadCase(caseId)
        rows = one ? [one] : []
      }
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
      if (isDemo)
        setAdmissions(
          patientForAdmissions ? await loadAdmissions(patientForAdmissions, { isDemo: true }) : [],
        )
      else if (patientForAdmissions?.recordId)
        try {
          setAdmissions(await loadAdmissions(patientForAdmissions.recordId))
        } catch {
          setAdmissions([])
        }
      else setAdmissions([])
      if (!isDemo && tenant?.id)
        try {
          setDepartments((await loadDepartments(tenant.id)).filter(row => row.is_active !== false))
          setClinicalLibraries(await loadManagementLibraries(tenant.id))
        } catch {
          setDepartments([])
        }
      else {
        setClinicalLibraries(demoLibrarySeed)
        setDepartments(
          demoLibrarySeed.departments.map(([elName, enName]) => ({
            id: elName,
            name: language === 'el' ? elName : enName || elName,
            nameEn: enName,
          })),
        )
      }
    } catch (err) {
      setError(err?.message || t('actionFailed'))
    } finally {
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
  }, [tenant?.id, isDemo, patient, tab])
  if (loading)
    return (
      <Page title={t('clinicalRecords.patientRecord')}>
        <div className="surface clinical-surface">
          <p>{t('loading')}</p>
        </div>
      </Page>
    )
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
  const fmtDate = value =>
    value
      ? new Intl.DateTimeFormat(locale).format(new Date(`${String(value).slice(0, 10)}T12:00:00`))
      : '—'
  const fmtDateTime = value =>
    value
      ? new Intl.DateTimeFormat(locale, { dateStyle: 'short', timeStyle: 'short' }).format(
          new Date(value),
        )
      : '—'
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
          { id: 'clinicalData', label: t('clinicalRecords.clinicalData'), icon: Activity },
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

  function openAdmission(row) {
    const scoped = episodes.filter(ep => String(ep.admissionId || '') === String(row.id))
    setSelectedAdmissionId(row.id)
    setSelectedEpisodeId(scoped[0]?.id || '')
    setTab('summary')
  }
  function closeAdmission() {
    setSelectedAdmissionId('')
    setSelectedEpisodeId('')
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

  const shellSubtitle = selectedAdmission
    ? `${selectedAdmission.department || '—'} · ${t('clinicalRecords.admission')}: ${fmtDate(selectedAdmission.admissionDate)}`
    : patientMode
      ? patient?.hospitalRecordNumber || t('clinicalRecords.patientRecord')
      : `${department || '—'} · ${t('clinicalRecords.admission')}: ${fmtDate(record?.admissionDate || patient?.admissionDate)}`
  const shellStatus = selectedAdmission?.status || record?.status || patient?.status || 'active'
  return (
    <Page fill title={name} subtitle={code}>
      <EntityRecordShell
        className={`patient-record-shell workspace-fill${activeTab === 'clinicalScales' ? ' record-secondary-tab-active' : ''}`}
        avatar={name
          ?.split(' ')
          .map(x => x?.[0])
          .slice(0, 2)
          .join('')}
        eyebrow={code}
        title={name}
        subtitle={shellSubtitle}
        status={
          <>
            <span className={`status-badge ${shellStatus === 'active' ? 'active' : ''}`}>
              {t(shellStatus)}
            </span>
            {record?.resistance && <span className="status-badge danger">{record.resistance}</span>}
            {patient && (
              <ClinicalRiskFlags
                rows={riskFlagRows[patient.recordId] || riskFlagRows[patient.id] || []}
                language={language}
                compact
              />
            )}
          </>
        }
        recordNavigation={!patientMode || !selectedAdmission ? recordNavigation : null}
        headerActions={
          selectedAdmission || !patientMode ? (
            <PrintExportActions
              onExport={() =>
                downloadRecordJson(
                  {
                    patient,
                    admission: selectedAdmission,
                    record,
                    episodes: admissionEpisodes,
                    admissions,
                  },
                  { filename: record?.id || code },
                )
              }
            />
          ) : null
        }
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={setTab}
        onBack={patientMode && selectedAdmission ? closeAdmission : goBack}
        backLabel={
          patientMode && selectedAdmission
            ? translate('copy.clinicalRecordCopy.backToAdmissions', language === 'el' ? 'el' : 'en')
            : patientMode
              ? t('clinicalRecords.backToPatients')
              : t('clinicalRecords.backToSurveillance')
        }
      >
        {patientMode && !selectedAdmission && (
          <PatientAdmissionsHome
            patient={patient}
            rows={admissions}
            episodes={episodes}
            tenantId={tenant?.id}
            isDemo={isDemo}
            departments={departments}
            canEdit={has(CAPABILITIES.EDIT_PATIENT)}
            t={t}
            language={language}
            fmtDate={fmtDate}
            onAdded={row => setAdmissions(current => [row, ...current])}
            onChanged={() => load()}
            onSelect={openAdmission}
            actions={
              <PatientSummaryActions
                patient={patient}
                departments={departments}
                onReload={() => load()}
                onDeleted={goBack}
              />
            }
          />
        )}
        {(!patientMode || selectedAdmission) && activeTab === 'summary' && (
          <CanonicalSummary
            onOpenReassessment={() => {
              setJourneyStage('reassessment')
              setTab('surveillanceJourney')
            }}
            patient={patient}
            admission={selectedAdmission}
            record={record}
            tenantId={tenant?.id}
            isDemo={isDemo}
            departments={departments}
            canEdit={patientMode && has(CAPABILITIES.EDIT_PATIENT)}
            showPatientActions={patientMode}
            onDeleted={goBack}
            onChanged={() => load()}
            t={t}
            language={language}
            fmtDate={fmtDate}
          />
        )}
        {(!patientMode || selectedAdmission) && activeTab === 'surveillanceJourney' && (
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
        {activeTab === 'clinicalData' && record && (
          <ClinicalSnapshot record={record} t={t} language={language} fmtDate={fmtDate} />
        )}
        {activeTab === 'clinicalScales' && patient && selectedAdmission && (
          <PatientClinicalScalesPanel
            organizationId={tenant?.id}
            patient={patient}
            admission={selectedAdmission}
            isDemo={isDemo}
            language={language}
            canRecord={has(CAPABILITIES.RECORD_CLINICAL_ASSESSMENT)}
          />
        )}
        {activeTab === 'clinicalData' && !record && (
          <EmptyState
            title={translate(
              'copy.clinicalRecordCopy.noClinicalRecordYet',
              language === 'el' ? 'el' : 'en',
            )}
            description={translate(
              'copy.clinicalRecordCopy.thisAdmissionHasNoActiveSurveillance',
              language === 'el' ? 'el' : 'en',
            )}
          />
        )}
        {activeTab === 'documents' &&
          record &&
          (!isDemo && record.recordId ? (
            <DocumentsWorkspace
              title={translate(
                'copy.clinicalRecordCopy.documents',
                language === 'en' ? 'en' : 'el',
              )}
              disabled={!has(CAPABILITIES.RECORD_CLINICAL_ASSESSMENT)}
              organizationId={tenant?.id}
              entityType="clinical_case"
              entityId={record.recordId}
            />
          ) : isDemo ? (
            <DocumentsWorkspace
              title={translate(
                'copy.clinicalRecordCopy.documents',
                language === 'en' ? 'en' : 'el',
              )}
              disabled={!has(CAPABILITIES.RECORD_CLINICAL_ASSESSMENT)}
              value={demoDocuments[record.id] || []}
              onChange={files => setDemoDocuments(current => ({ ...current, [record.id]: files }))}
            />
          ) : (
            <div className="inline-empty">{t('clinicalRecords.noAttachments')}</div>
          ))}
        {activeTab === 'documents' && !record && (
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
        {activeTab === 'history' && record && (
          <Timeline
            record={record}
            t={t}
            language={language}
            fmtDateTime={value =>
              /^\d{4}-\d{2}-\d{2}$/.test(String(value || '')) ? fmtDate(value) : fmtDateTime(value)
            }
          />
        )}
        {activeTab === 'history' && !record && (
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
        {clearTestOpen && (
          <ObserverDialog
            title={translate(
              'copy.clinicalRecordCopy.clearClinicalTestData',
              language === 'el' ? 'el' : 'en',
            )}
            width="medium"
            onClose={() => setClearTestOpen(false)}
          >
            <p>
              {translate(
                'copy.clinicalRecordCopy.surveillanceEpisodesAndSamplesShownFor',
                language === 'el' ? 'el' : 'en',
              )}
            </p>
            <div className="dialog-actions">
              <Button variant="secondary" onClick={() => setClearTestOpen(false)}>
                {t('cancel')}
              </Button>
              <Button onClick={clearOwnerClinicalTestData}>
                {translate('copy.clinicalRecordCopy.confirmClear', language === 'el' ? 'el' : 'en')}
              </Button>
            </div>
          </ObserverDialog>
        )}
        {createOpen && (
          <NewSurveillanceFlow
            patient={patient}
            patients={patients}
            departments={departments}
            initialSample={sampleToLink}
            onPatientsChange={setPatients}
            onClose={() => {
              setCreateOpen(false)
              setSampleToLink(null)
              void load(selectedEpisodeId)
            }}
            onCreate={createEpisode}
            onCancelCreated={async (caseRecord, reason) => {
              await repository.voidCase(caseRecord, reason)
              setSelectedEpisodeId(null)
              await load()
            }}
            onSaveAssessment={(caseRecord, draft) => repository.saveAssessment(caseRecord, draft)}
            onRequestSample={(caseRecord, draft) => repository.requestSample(caseRecord, draft)}
            onSaveIsolation={(caseRecord, draft) =>
              draft.required === false
                ? repository.setIsolationNotRequired(caseRecord)
                : repository.beginIsolation(caseRecord, draft)
            }
            onRecordChange={updated => {
              setEpisodes(current => current.map(row => (row.id === updated.id ? updated : row)))
              setSelectedEpisodeId(updated.id)
            }}
          />
        )}
      </EntityRecordShell>
    </Page>
  )
}
