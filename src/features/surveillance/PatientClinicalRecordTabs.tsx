// One tab of the patient / surveillance record (PatientClinicalCanonicalPage.tsx): on screen the active one, in print every tab.
import { EmptyState } from '../../design-system/EmptyState'
import { DocumentsWorkspace } from '../../design-system/DocumentsWorkspace'
import { formatDayTime } from '../../core/i18n/formatDay'
import { translate } from '../../core/i18n/LanguageContext'
import { CAPABILITIES } from '../../core/permissions/roles'
import { createManagementLibraryItem } from '../management/managementCloudService'
import { canReviewSamples } from '../laboratory/sampleReviewModel'
import { EpisodeFormsTab } from './forms/EpisodeFormsTab'
import { factorCountWords, originWords, riskWords } from './epiQuestionnaire/epiQuestionnaireText'
import { CanonicalSummary } from './ClinicalAdmissions'
import { SurveillanceWorkspace } from './ClinicalSurveillanceWorkspace'
import { Timeline } from './ClinicalRecordViews'
import { canDeleteRecord } from '../../core/recycleBin/recycleBinService'
import type { LibraryDepartment } from '../management/useLibraries'
import type { useEpisodeFormsData } from './forms/useEpisodeFormsData'
import type { ClinicalCase, ClinicalTimelineEvent } from './clinicalTypes'
import type { ClinicalLibraries, ClinicalRecordRepository, DeviceBundles, EpiEntry, EpisodeFormsData, LaboratoryRegistry, ProtocolRequest, RecordAdmission, RecordPatient, RecordSample } from './clinicalScreenTypes'
import type { DateValue, Handler, Setter } from './surveillanceTypes'
import type { AttachmentFile } from '../../design-system/AttachmentField'
import type { AuditActor } from '../../core/audit/actor'
import type { Tenant } from '../../core/tenant/tenantTypes'
import type { NavigateFunction } from 'react-router-dom'
import type { RiskFlagRow } from '../clinical-scales/patientRiskFlagsService'

// What the record page hands to its tabs (one object, so the tabs read like the code they came from).
export interface PatientRecordTabScope {
  actor: AuditActor
  actualRole: string | null
  admissionEpisodes: ClinicalCase[]
  admissions: RecordAdmission[]
  admissionSamples: RecordSample[]
  admissionTimeline: ClinicalTimelineEvent[]
  askSampleFor: string | null
  canCreateLabSample: boolean
  canLab: boolean
  canTherapy: boolean
  caseId: string | undefined
  clinicalLibraries: ClinicalLibraries
  createAdmissionSample: Handler
  demoDocuments: Record<string, AttachmentFile[]>
  departments: LibraryDepartment[]
  deviceBundles: DeviceBundles | null
  documentsScope: { key: string, entityType: string, entityId: string | undefined } | null
  epiEntry: EpiEntry | null
  fmtDate: (value: unknown) => string
  fmtDateTime: (value: unknown) => string
  forms: EpisodeFormsData
  formsCtx: Parameters<typeof useEpisodeFormsData>[0]
  formsOpenRequest: { id: string, nonce: unknown } | null
  goBack: Handler
  has: (capability: string) => boolean
  isDemo: boolean
  journeyStage: string | null
  laboratory: LaboratoryRegistry
  language: string
  load: Handler
  navigate: NavigateFunction
  outsideTimeline: ClinicalTimelineEvent[]
  patient: RecordPatient | null
  patientMode: boolean
  protocolRequest: ProtocolRequest | null
  record: ClinicalCase | null
  recordSamples: RecordSample[]
  repository: ClinicalRecordRepository
  riskFlagRows: Record<string, RiskFlagRow[]>
  role: string | null
  selectedAdmission: RecordAdmission | null
  setAskSampleFor: Setter<string | null>
  setClinicalLibraries: Setter<ClinicalLibraries>
  setCreateOpen: Setter<boolean>
  setDemoDocuments: Setter<Record<string, AttachmentFile[]>>
  setJourneyStage: Setter<string | null>
  setSampleToLink: Setter<RecordSample | null>
  setSelectedAdmissionId: Setter<string>
  setSelectedEpisodeId: Setter<string>
  setTab: Setter<string>
  t: (key: string) => string
  tenant: Tenant | null
}
// originWords' own type until the questionnaire helpers take a missing origin (they read it as «unknown»).
export function renderPatientRecordTab(tabId: string, j: PatientRecordTabScope) {
  const { actor, actualRole, admissionEpisodes, admissions, admissionSamples, admissionTimeline, askSampleFor, canCreateLabSample, canLab, canTherapy, caseId, clinicalLibraries, createAdmissionSample, demoDocuments, departments, deviceBundles, documentsScope, epiEntry, fmtDate, fmtDateTime, forms, formsCtx, formsOpenRequest, goBack, has, isDemo, journeyStage, laboratory, language, load, navigate, outsideTimeline, patient, patientMode, protocolRequest, record, recordSamples, repository, riskFlagRows, role, selectedAdmission, setAskSampleFor, setClinicalLibraries, setCreateOpen, setDemoDocuments, setJourneyStage, setSampleToLink, setSelectedAdmissionId, setSelectedEpisodeId, setTab, t, tenant } = j
  return (
    <>
      {(!patientMode || selectedAdmission) && tabId === 'summary' && (
        <CanonicalSummary
          samples={patientMode ? admissionSamples : recordSamples}
          scaleRows={patient ? riskFlagRows[String(patient.recordId)] || riskFlagRows[String(patient.id)] || [] : []}
          onOpenStage={stage => {
            setJourneyStage(stage)
            setTab('surveillanceJourney')
          }}
          onOpenHistory={() => setTab('history')}
          epiItems={
            epiEntry
              ? [
                  { label: t('epiQuestionnaire.originLabel'), value: originWords(epiEntry.summary.origin as Parameters<typeof originWords>[0], t) },
                  {
                    label: t('epiQuestionnaire.riskLabel'),
                    value: (
                      <>
                        {/* Pending: one word that opens the questionnaire. Done: the risk factors, then the link
                            (with a risk signal the «Needs attention» box already links to it). */}
                        {epiEntry.summary.status === 'done' && <>{riskWords(epiEntry.row, language, t)}{!epiEntry.summary.signal ? ' · ' : ' '}</>}
                        {(epiEntry.summary.status !== 'done' || !epiEntry.summary.signal) && (
                          <button
                            type="button"
                            className="record-summary-link"
                            onClick={() => {
                              // The questionnaire is a step of the surveillance sheet (owner, 8/11/2026).
                              setJourneyStage('questionnaire')
                              setTab('surveillanceJourney')
                            }}
                          >
                            {epiEntry.summary.status === 'done' ? t('epiQuestionnaire.link') : t('episodeForms.status.pending')}
                          </button>
                        )}
                      </>
                    ),
                  },
                ]
              : []
          }
          extraAttention={
            epiEntry?.summary.signal
              ? [{ id: 'epiRisk', tone: 'warning', stage: 'questionnaire', text: `${t('epiQuestionnaire.signal')}: ${factorCountWords(epiEntry.summary.factorCount, t)}`, action: t('epiQuestionnaire.link') }]
              : []
          }
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
          protocolRequest={protocolRequest}
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
          canCreate={has(CAPABILITIES.CREATE_SURVEILLANCE)}
          canCreateSample={canCreateLabSample || canReviewSamples(role)}
          onOpenSample={has(CAPABILITIES.VIEW_LAB) ? sample => navigate(`/laboratory/${encodeURIComponent(sample.id)}`) : null}
          onRemoveSample={sample => laboratory.repository.remove(sample.id)}
          askSampleFor={askSampleFor}
          onSampleAsked={() => setAskSampleFor(null)}
          repository={repository}
          onReload={preferred => load(preferred || record?.id)}
          onEpisodeDeleted={deleted => {
            if (patientMode || String(deleted?.id) !== String(caseId)) return false
            goBack()
            return true
          }}
          deviceBundles={deviceBundles}
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
            const created = await createManagementLibraryItem(tenant!.id, key, {
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
            // Protocols (Hour-1 bundle) are recorded by the clinical team and,
            // in their departments, by the roles that manage isolation.
            canProtocol:
              has(CAPABILITIES.RECORD_CLINICAL_ASSESSMENT) || has(CAPABILITIES.MANAGE_ISOLATION),
            canReassess: has(CAPABILITIES.REASSESS_SURVEILLANCE),
            canOutcome:
              has(CAPABILITIES.RECORD_SURVEILLANCE_OUTCOME) ||
              has(CAPABILITIES.CLOSE_SURVEILLANCE),
            canEdit: has(CAPABILITIES.EDIT_SURVEILLANCE),
            canDelete: (record: ClinicalCase) => canDeleteRecord({ role, actualRole, userId: actor?.id, createdBy: record?.createdBy }),
            canReopen: has(CAPABILITIES.REOPEN_SURVEILLANCE),
          }}
        />
      )}
      {tabId === 'episodeForms' && <EpisodeFormsTab ctx={formsCtx as Parameters<typeof EpisodeFormsTab>[0]['ctx']} forms={forms} openRequest={formsOpenRequest} />}
      {/* Documents belong to the surveillance when there is one, else to the
          admission itself, so they can be added before any surveillance. */}
      {tabId === 'documents' && documentsScope && (
        <DocumentsWorkspace
          disabled={!has(CAPABILITIES.RECORD_CLINICAL_ASSESSMENT)}
          {...(isDemo
            ? {
                value: demoDocuments[documentsScope.key] ?? repository.demoDocuments(),
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
          record={{ ...record, timeline: [...(record.timeline || []), ...outsideTimeline] }}
          title=""
          t={t}
          language={language}
          fmtDateTime={value =>
            /^\d{4}-\d{2}-\d{2}$/.test(String(value || '')) ? fmtDate(value) : formatDayTime(value as DateValue, language)
          }
        />
      )}
      {tabId === 'history' && !record && selectedAdmission && (
        <Timeline
          record={{ timeline: [...admissionTimeline, ...outsideTimeline] }}
          title=""
          subtitle={t('clinicalRecords.admissionHistoryHint')}
          t={t}
          language={language}
          fmtDateTime={value =>
            /^\d{4}-\d{2}-\d{2}$/.test(String(value || '')) ? fmtDate(value) : formatDayTime(value as DateValue, language)
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
    </>
  )
}
