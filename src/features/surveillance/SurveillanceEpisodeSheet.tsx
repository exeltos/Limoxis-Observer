// An open surveillance episode over the record (ClinicalSurveillanceWorkspace.tsx): header, «⋯» actions and the sheet.
import { Activity, Check, HeartPulse, Microscope, Pencil, Stethoscope, Trash2 } from 'lucide-react'
import { Button } from '../../design-system/Button'
import { Breadcrumbs } from '../../design-system/Breadcrumbs'
import { BackButton } from '../../design-system/BackButton'
import { OverflowMenu } from '../../design-system/OverflowMenu'
import { ManualDateField } from '../../design-system/ManualDateField'
import { Field } from '../../design-system/Field'
import { SearchableSelect } from '../../design-system/SearchableSelect'
import { StatusBadge } from '../../design-system/StatusBadge'
import { translate } from '../../core/i18n/LanguageContext'
import { episodeTypeLabel } from './clinicalRecordLabels'
import { CanonicalJourney } from './ClinicalJourney'
import { SimpleDialog, ReasonDialog } from './ClinicalRecordDialogs'
import { listTexts, statusTone, suspectedSourceOptions } from './surveillanceOptions'
import type { AnyRecord } from '../../types/featureTypes'
import type { Handler, Setter } from './surveillanceTypes'

// What the screen hands to this part (one object, so the part reads like the code it came from).
// The start fields of an episode being corrected.
export interface EpisodeEditDraft {
  startedAt: string
  reviewDue: string
  room: string
  reason: string
  suspectedSource: string
}
// An action of the sheet's «⋯»: its step and its window.
export interface SheetAction {
  stage: string
  dialog: string
  nonce: number
}
export interface SurveillanceEpisodeSheetScope {
  askSampleFor: string | null
  askSheet: (stage: string, dialog: string) => void
  canEditSheet: boolean
  copyText: (key: string) => string
  deleteItem: Handler
  deleteOpen: boolean
  deleteReason: string
  detailRecord: AnyRecord
  deviceBundles: AnyRecord | null
  editBusy: boolean
  editDraft: EpisodeEditDraft
  editOpen: boolean
  fmtDate: (value: unknown) => string
  fmtDateTime: (value: unknown) => string
  initialStage: string | null
  isDemo: boolean
  language: string
  libraries: AnyRecord
  onLibraryAdded: Handler
  onReload: Handler
  onSampleAsked: Handler
  openEditEpisode: Handler
  organizationId: string | null | undefined
  permissions: AnyRecord
  removeEpisode: Handler
  repository: AnyRecord
  saveEpisodeEdit: Handler
  setDeleteOpen: Setter<boolean>
  setDeleteReason: Setter<string>
  setDetailId: Setter<string>
  setEditDraft: Setter<EpisodeEditDraft>
  setEditOpen: Setter<boolean>
  setSheetAction: Setter<SheetAction | null>
  setSheetEditing: Setter<boolean>
  setStartRequest: Setter<AnyRecord | null>
  sheetAction: SheetAction | null
  sheetActive: boolean
  sheetEditing: boolean
  startRequest: AnyRecord | null
  t: (key: string) => string
}
export function SurveillanceEpisodeSheet({ j }: { j: SurveillanceEpisodeSheetScope }) {
  const { askSampleFor, askSheet, canEditSheet, copyText, deleteItem, deleteOpen, deleteReason, detailRecord, deviceBundles, editBusy, editDraft, editOpen, fmtDate, fmtDateTime, initialStage, isDemo, language, libraries, onLibraryAdded, onReload, onSampleAsked, openEditEpisode, organizationId, permissions, removeEpisode, repository, saveEpisodeEdit, setDeleteOpen, setDeleteReason, setDetailId, setEditDraft, setEditOpen, setSheetAction, setSheetEditing, setStartRequest, sheetAction, sheetActive, sheetEditing, startRequest, t } = j
  return (
    <>
      <div
        className="episode-overlay new-surveillance-flow-overlay surveillance-episode-page"
        role="region"
        aria-label={translate(
          'copy.clinicalRecordCopy.surveillanceEpisode',
          language === 'el' ? 'el' : 'en',
        )}
      >
        <section className="episode-detail-card new-surveillance-flow-card">
          <header className="episode-detail-header">
            <div className="episode-detail-title">
              {/* Back, as on every record page (owner, 8/11/2026). */}
              <BackButton label={translate('copy.clinicalRecordCopy.surveillanceSamples', language === 'el' ? 'el' : 'en')} onClick={() => setDetailId('')} />
              <div>
                <Breadcrumbs
                  ariaLabel={translate(
                    'copy.clinicalRecordCopy.surveillanceEpisode',
                    language === 'el' ? 'el' : 'en',
                  )}
                  items={[
                    {
                      label: translate(
                        'copy.clinicalRecordCopy.surveillanceSamples',
                        language === 'el' ? 'el' : 'en',
                      ),
                      onClick: () => setDetailId(''),
                    },
                    { label: `${t('surveillance')} · ${fmtDate(detailRecord.startedAt)}` },
                  ]}
                />
                <h2>
                  {episodeTypeLabel(detailRecord, t) ||
                    translate(
                      'copy.clinicalRecordCopy.surveillanceEpisode',
                      language === 'el' ? 'el' : 'en',
                    )}
                </h2>
                <p>
                  {/* Over the whole screen the patient's header is hidden: the sheet names the patient itself. */}
                  {[
                    language === 'el' ? detailRecord.patient : detailRecord.patientEn || detailRecord.patient,
                    detailRecord.patientId,
                    detailRecord.department,
                    detailRecord.startedAt && `${translate('copy.clinicalRecordCopy.started', language === 'el' ? 'el' : 'en')} ${fmtDate(detailRecord.startedAt)}`,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
              </div>
            </div>
            <div className="episode-detail-actions">
              <StatusBadge tone={statusTone(detailRecord.status)}>{t(detailRecord.status)}</StatusBadge>
              {sheetEditing && (
                <Button className="sheet-done" variant="primary" onClick={() => setSheetEditing(false)}>
                  <Check size={15} />
                  {copyText('finishSheetEditing')}
                </Button>
              )}
              <OverflowMenu
                label={translate(
                  'copy.clinicalRecordCopy.surveillanceActions',
                  language === 'el' ? 'el' : 'en',
                )}
                items={[
                  canEditSheet && !sheetEditing
                    ? { id: 'editSheet', label: copyText('editSheet'), icon: Pencil, onClick: () => setSheetEditing(true) }
                    : null,
                  sheetActive && permissions.canLab
                    ? { id: 'newSample', label: copyText('newSample'), icon: Microscope, separatorBefore: true, onClick: () => askSheet('samples', 'sample') }
                    : null,
                  sheetActive && permissions.canAssess
                    ? { id: 'device', label: copyText('recordDevice'), icon: Stethoscope, onClick: () => askSheet('devices', 'device') }
                    : null,
                  sheetActive && permissions.canProtocol
                    ? { id: 'protocol', label: t('sepsis.startProtocol'), icon: HeartPulse, onClick: () => askSheet('therapy', 'protocolPicker') }
                    : null,
                  permissions.canEdit
                    ? {
                        id: 'edit',
                        separatorBefore: true,
                        label: translate(
                          'copy.clinicalRecordCopy.editSurveillance',
                          language === 'el' ? 'el' : 'en',
                        ),
                        icon: Activity,
                        onClick: openEditEpisode,
                      }
                    : null,
                  
                  
                  permissions.canDelete?.(detailRecord)
                    ? {
                        id: 'delete',
                        label: translate(
                          'copy.clinicalRecordCopy.deleteSurveillance',
                          language === 'el' ? 'el' : 'en',
                        ),
                        icon: Trash2,
                        tone: 'danger',
                        separatorBefore: true,
                        onClick: () => {
                          setDeleteReason('')
                          setDeleteOpen(true)
                        },
                      }
                    : null,
                ].filter(Boolean)}
              />
            </div>
          </header>
          <div className="episode-detail-scroll progressive-surveillance-scroll">
            <CanonicalJourney
              initialStage={initialStage}
              askSample={Boolean(askSampleFor) && String(askSampleFor) === String(detailRecord.id)}
              onSampleAsked={onSampleAsked}
              startProtocolRequest={
                startRequest && String(startRequest.episodeId) === String(detailRecord.id)
                  ? startRequest
                  : null
              }
              onProtocolRequestHandled={() => setStartRequest(null)}
              editing={sheetEditing}
              actionRequest={sheetAction}
              onActionHandled={() => setSheetAction(null)}
              record={detailRecord}
              repository={repository}
              libraries={libraries}
              organizationId={organizationId}
              isDemo={isDemo}
              onLibraryAdded={onLibraryAdded}
              onReload={() => onReload(detailRecord.id)}
              t={t}
              language={language}
              fmtDate={fmtDate}
              fmtDateTime={fmtDateTime}
              permissions={permissions}
              deviceBundles={deviceBundles}
              deleteItem={deleteItem}
            />
          </div>
        </section>
        {editOpen && (
          <SimpleDialog
            title={translate(
              'copy.clinicalRecordCopy.editSurveillance',
              language === 'el' ? 'el' : 'en',
            )}
            t={t}
            onClose={() => !editBusy && setEditOpen(false)}
            onSave={saveEpisodeEdit}
            disabled={editBusy || !editDraft.startedAt || !editDraft.reason.trim()}
          >
            <ManualDateField
              label={translate(
                'copy.clinicalRecordCopy.startDate',
                language === 'el' ? 'el' : 'en',
              )}
              value={editDraft.startedAt}
              onChange={v => setEditDraft(d => ({ ...d, startedAt: v }))}
            />
            <ManualDateField
              label={t('nextReview')}
              optional
              value={editDraft.reviewDue}
              onChange={v => setEditDraft(d => ({ ...d, reviewDue: v }))}
            />
            <Field label={t('room')}>
              <input
                value={editDraft.room}
                onChange={e => setEditDraft(d => ({ ...d, room: e.target.value }))}
              />
            </Field>
            <SearchableSelect
              label={t('clinicalRecords.suspectedSource')}
              value={editDraft.suspectedSource}
              options={suspectedSourceOptions(t)}
              placeholder={t('underAssessment')}
              emptyLabel={listTexts(language).emptyLabel}
              clearLabel={listTexts(language).clearLabel}
              onChange={v => setEditDraft(d => ({ ...d, suspectedSource: v }))}
            />
            <label className="field entry-span-2">
              <span className="lo-field-label">{t('surveillanceReason')}</span>
              <textarea
                rows={3}
                value={editDraft.reason}
                onChange={e => setEditDraft(d => ({ ...d, reason: e.target.value }))}
              />
            </label>
          </SimpleDialog>
        )}
        {deleteOpen && (
          <ReasonDialog
            title={translate(
              'copy.clinicalRecordCopy.deleteSurveillance',
              language === 'el' ? 'el' : 'en',
            )}
            t={t}
            reason={deleteReason}
            setReason={setDeleteReason}
            onClose={() => {
              setDeleteOpen(false)
              setDeleteReason('')
            }}
            onSave={removeEpisode}
            saveLabel={t('moveToRecycleBin')}
            note={t('moveToRecycleBinNote')}
            danger
          />
        )}
      </div>
    </>
  )
}
