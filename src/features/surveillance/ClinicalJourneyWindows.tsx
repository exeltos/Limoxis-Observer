// The windows of a surveillance episode's sheet (ClinicalJourney.tsx): forms that open under their step.
import { translate } from '../../core/i18n/LanguageContext'
import { patientAgeDays } from '../clinical-scales/clinicalScaleContext'
import { ClinicalEntryDetail } from './ClinicalJourneyParts'
import { episodeTypeLabel } from './clinicalRecordLabels'
import { AssessmentDialog, DeviceDialog, SampleRequestDialog, HaiDialog, TherapyDialog, IsolationDialog, EndDialog, ReassessmentDialog, OutcomeDialog } from './ClinicalRecordDialogs'
import { EpisodeBundleCheck } from './forms/EpisodeBundleCheck'
import { EpiQuestionnaireDialog } from './epiQuestionnaire/EpiQuestionnaireViews'
import { canWriteEpi } from './epiQuestionnaire/epiQuestionnaireText'
import { ProtocolPickerDialog } from './protocols/ProtocolViews'
import { startProtocolRun } from './protocols/protocolService'
import { hospitalToday } from '../../core/dates/hospitalDate'

export function JourneyWindows({ j }) {
  const { active, admission, bundleDevice, closeDialog, deviceBundles, dialog, entryDelete, entryDetail, epi, fmtDate, fmtDateTime, isDemo, language, libraries, onLibraryAdded, organizationId, patient, permissions, protocolOptions, protocolPreset, protocols, record, repository, role, run, runProtocol, setBundleDevice, setDialog, setEntryDetail, setEpi, setFormNonce, setStage, shownDialog, t } = j
  return (
    <>
      {dialog === 'bundle' && bundleDevice && deviceBundles && (
        <EpisodeBundleCheck
          deviceBundles={deviceBundles}
          device={bundleDevice}
          episode={record}
          onClose={() => {
            setDialog(null)
            setBundleDevice(null)
          }}
          onSaved={() => {
            setDialog(null)
            setBundleDevice(null)
          }}
        />
      )}
      {shownDialog === 'epi' && (
        <EpiQuestionnaireDialog
          inSheet
          ctx={{ organizationId, isDemo, fmtDate, patient, admission, samples: (record.samples || []).map(sample => ({ ...sample, surveillanceCase: sample.surveillanceCase || record.id })) }}
          episode={record}
          row={epi.row}
          settings={epi.settings}
          canEdit={canWriteEpi(role)}
          onClose={closeDialog}
          onSaved={() => {
            setDialog(null)
            setFormNonce(value => value + 1)
            setEpi(current => ({ ...current, nonce: current.nonce + 1 }))
          }}
        />
      )}
      {dialog === 'protocolPicker' && (
        <ProtocolPickerDialog
          t={t}
          runs={protocols.runs}
          preset={protocolPreset}
          onClose={closeDialog}
          onStart={async draft => {
            const run = await runProtocol(() =>
              startProtocolRun(organizationId, record, draft, protocolOptions),
            )
            if (run?.id) setStage(`protocol:${run.id}`)
            return run
          }}
        />
      )}
      {dialog === 'assessment' && (
        <AssessmentDialog
          t={t}
          record={record}
          symptomRows={libraries.clinicalSymptoms || []}
          riskRows={libraries.clinicalRiskFactors || []}
          onClose={closeDialog}
          onSave={draft =>
            run(() => repository.saveAssessment(record, draft), t('actionCompleted'))
          }
        />
      )}{' '}
      {shownDialog === 'device' && (
        <DeviceDialog
          t={t}
          items={libraries.deviceTypes || []}
          onAddLibraryItem={item => onLibraryAdded?.('deviceTypes', item)}
          onClose={closeDialog}
          onSave={draft => run(() => repository.addDevice(record, draft), t('actionCompleted'))}
        />
      )}{' '}
      {shownDialog === 'sample' && (
        <SampleRequestDialog
          t={t}
          context={{
            patient: language === 'el' ? record.patient : record.patientEn || record.patient,
            episode: [episodeTypeLabel(record, t), fmtDate(record.startedAt)].filter(Boolean).join(' · '),
            department: language === 'el' ? record.department : record.departmentEn || record.department,
          }}
          epi={{ episode: record, admission: null, samples: record.samples || [] }}
          inSheet
          onClose={closeDialog}
          onSave={draft => run(() => repository.requestSample(record, draft), t('actionCompleted'))}
        />
      )}{' '}
      {shownDialog === 'hai' && (
        <HaiDialog
          t={t}
          items={libraries.surveillanceDefinitions || []}
          patientAgeDays={patientAgeDays(record.dateOfBirth)}
          organizationId={organizationId}
          isDemo={isDemo}
          onAddLibraryItem={item => onLibraryAdded?.('surveillanceDefinitions', item)}
          onClose={closeDialog}
          onSave={draft => run(() => repository.saveHai(record, draft), t('actionCompleted'))}
        />
      )}{' '}
      {shownDialog === 'therapy' && (
        <TherapyDialog
          t={t}
          antibiotics={libraries.antibiotics || []}
          advancedAntibiotics={libraries.advancedAntibiotics || []}
          onClose={closeDialog}
          onSave={draft => run(() => repository.addTherapy(record, draft), t('actionCompleted'))}
        />
      )}{' '}
      {dialog === 'isolation' && (
        <IsolationDialog
          t={t}
          onClose={closeDialog}
          onSave={draft =>
            run(() => repository.beginIsolation(record, draft), t('actionCompleted'))
          }
        />
      )}{' '}
      {shownDialog === 'endIsolation' && (
        <EndDialog
          title={translate('copy.clinicalRecordCopy.endIsolation', language === 'el' ? 'el' : 'en')}
          t={t}
          onClose={closeDialog}
          onSave={draft =>
            run(() => repository.finishIsolation(record, draft), t('actionCompleted'))
          }
        />
      )}{' '}
      {dialog === 'reassessment' && (
        <ReassessmentDialog
          t={t}
          onClose={closeDialog}
          onSave={draft => run(() => repository.reassess(record, draft), t('actionCompleted'))}
        />
      )}{' '}
      {dialog === 'outcome' && (
        <OutcomeDialog
          t={t}
          onClose={closeDialog}
          onSave={draft =>
            run(() => repository.complete(record, draft), t('clinicalRecords.outcomeSaved'))
          }
        />
      )}{' '}
      {entryDetail && (
        <ClinicalEntryDetail
          entry={entryDetail}
          t={t}
          language={language}
          fmtDate={fmtDate}
          fmtDateTime={fmtDateTime}
          canManage={active}
          onClose={() => setEntryDetail(null)}
          onDelete={
            entryDetail.kind === 'therapy' || entryDetail.kind === 'reassessment'
              ? entryDelete(entryDetail.kind, entryDetail.row, entryDetail.kind === 'therapy' ? entryDetail.row.antimicrobial : t('reassessment'))
              : null
          }
          onEdit={() => {
            const kind = entryDetail.kind
            setEntryDetail(null)
            if (kind === 'therapy') return
            setDialog(kind === 'sample' ? 'sample' : kind)
          }}
          onFinishTherapy={
            entryDetail.kind === 'therapy' &&
            entryDetail.row?.status === 'active' &&
            permissions.canTherapy
              ? () => {
                  const row = entryDetail.row
                  setEntryDetail(null)
                  run(
                    () =>
                      repository.finishTherapy(record, row.id, {
                        endedAt: hospitalToday(),
                      }),
                    t('actionCompleted'),
                  )
                }
              : null
          }
          onApproveTherapy={
            entryDetail.kind === 'therapy' && permissions.canTherapy
              ? () => {
                  const row = entryDetail.row
                  setEntryDetail(null)
                  run(
                    () => repository.updateTherapyApproval(record, row.id, 'approved'),
                    t('actionCompleted'),
                  )
                }
              : null
          }
          onRejectTherapy={
            entryDetail.kind === 'therapy' && permissions.canTherapy
              ? () => {
                  const row = entryDetail.row
                  setEntryDetail(null)
                  run(
                    () => repository.updateTherapyApproval(record, row.id, 'rejected'),
                    t('actionCompleted'),
                  )
                }
              : null
          }
          onRecordAdministration={
            entryDetail.kind === 'therapy' && permissions.canTherapy
              ? draft => {
                  const row = entryDetail.row
                  setEntryDetail(null)
                  run(
                    () => repository.recordAdministration(record, row.id, draft),
                    t('actionCompleted'),
                  )
                }
              : null
          }
        />
      )}
    </>
  )
}
