import { useState } from 'react'
import { sampleParentCode, sampleTone } from './patientRecordScope'
import {
  Activity,
  ArrowLeft,
  CalendarClock,
  ChevronRight,
  Download,
  Microscope,
  PlayCircle,
  Printer,
  RefreshCcw,
  Trash2,
} from 'lucide-react'
import { Button } from '../../design-system/Button'
import { OverflowMenu } from '../../design-system/OverflowMenu'
import { ManualDateField } from '../../design-system/ManualDateField'
import { ObserverDialog } from '../../design-system/ObserverDialog'
import { translate } from '../../core/i18n/LanguageContext'
import { useFeedback } from '../../core/feedback/FeedbackContext'
import { RESISTANCE_ALERT, printSurveillanceReport, episodeTypeLabel } from './clinicalRecordLabels'
import { CanonicalJourney } from './ClinicalJourney'
import { SimpleDialog, SampleDialog, ReasonDialog } from './ClinicalRecordDialogs'

// Surveillance workspace of the clinical record: the episode tree and its samples.
export function SurveillanceWorkspace({
  initialStage = null,
  samples = [],
  episodes,
  selectedId,
  onSelect,
  onCreate,
  onCreateFromSample,
  onCreateSample,
  onClearTestData,
  canCreate,
  canCreateSample,
  repository,
  onReload,
  t,
  language,
  fmtDate,
  fmtDateTime,
  libraries = {},
  organizationId,
  isDemo,
  onLibraryAdded,
  permissions,
}) {
  const { notify } = useFeedback()
  const [sampleOpen, setSampleOpen] = useState(false),
    [samplePrompt, setSamplePrompt] = useState(null),
    [followUpParent, setFollowUpParent] = useState(null),
    [detailId, setDetailId] = useState('')
  const [deleteOpen, setDeleteOpen] = useState(false),
    [deleteReason, setDeleteReason] = useState('')
  const [editOpen, setEditOpen] = useState(false),
    [editBusy, setEditBusy] = useState(false),
    [editDraft, setEditDraft] = useState({
      startedAt: '',
      reviewDue: '',
      room: '',
      reason: '',
      suspectedSource: '',
    })
  const detailRecord = episodes.find(ep => String(ep.id) === String(detailId)) || null
  async function saveSample(draft) {
    if (!onCreateSample) return
    const parent = followUpParent
    const siblings = parent
      ? samples.filter(x => String(x.id || '').startsWith(`${parent.id}-R`)).length
      : 0
    const payload = parent
      ? {
          ...draft,
          type: draft.type || parent.type,
          sampleCode: `${parent.id}-R${siblings + 1}`,
          surveillanceCaseId: parent.surveillanceCase || null,
        }
      : draft
    let created = null
    try {
      created = await onCreateSample(payload)
    } catch (error) {
      notify(error?.message || t('actionFailed'), 'danger')
      return
    }
    setSampleOpen(false)
    setFollowUpParent(null)
    if (created && !parent) setSamplePrompt(created)
  }
  function openEpisode(id) {
    onSelect?.(id)
    setDetailId(id)
  }
  function openEditEpisode() {
    if (!detailRecord) return
    setEditDraft({
      startedAt: String(detailRecord.startedAt || '').slice(0, 10),
      reviewDue: String(detailRecord.reviewDue || '').slice(0, 10),
      room: detailRecord.room || '',
      reason: detailRecord.reason || '',
      suspectedSource: detailRecord.suspectedSource || '',
    })
    setEditOpen(true)
  }
  async function saveEpisodeEdit() {
    if (!detailRecord || !editDraft.startedAt || !editDraft.reason.trim()) return
    setEditBusy(true)
    try {
      const updated = await repository.updateCase(detailRecord, editDraft)
      setEditOpen(false)
      await onReload(updated?.id || detailRecord.id)
      notify(
        translate('copy.clinicalRecordCopy.surveillanceUpdated', language === 'el' ? 'el' : 'en'),
        'success',
      )
    } catch (error) {
      notify(error?.message || t('actionFailed'), 'danger')
    } finally {
      setEditBusy(false)
    }
  }
  async function removeEpisode() {
    if (!detailRecord || !deleteReason.trim()) return
    try {
      await repository.voidCase(detailRecord, deleteReason.trim())
      setDeleteOpen(false)
      setDeleteReason('')
      setDetailId('')
      await onReload()
      notify(t('clinicalRecords.surveillanceDeleted'), 'success')
    } catch (error) {
      notify(error?.message || t('actionFailed'), 'danger')
    }
  }
  if (detailRecord)
    return (
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
              <button
                type="button"
                className="episode-back"
                title={translate(
                  'copy.clinicalRecordCopy.backToSurveillance',
                  language === 'el' ? 'el' : 'en',
                )}
                aria-label={translate(
                  'copy.clinicalRecordCopy.backToSurveillance',
                  language === 'el' ? 'el' : 'en',
                )}
                onClick={() => setDetailId('')}
              >
                <ArrowLeft size={18} />
              </button>
              <div>
                <span className="eyebrow">
                  {t('surveillance')} · {fmtDate(detailRecord.startedAt)}
                </span>
                <h2>
                  {episodeTypeLabel(detailRecord, t) ||
                    translate(
                      'copy.clinicalRecordCopy.surveillanceEpisode',
                      language === 'el' ? 'el' : 'en',
                    )}
                </h2>
                <p>
                  {[
                    detailRecord.department,
                    translate(
                      'copy.clinicalRecordCopy.clinicalFollowUp',
                      language === 'el' ? 'el' : 'en',
                    ),
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
              </div>
            </div>
            <div className="episode-detail-actions">
              <span className={`status-badge ${detailRecord.status === 'active' ? 'active' : ''}`}>
                {t(detailRecord.status)}
              </span>
              <OverflowMenu
                label={translate(
                  'copy.clinicalRecordCopy.surveillanceActions',
                  language === 'el' ? 'el' : 'en',
                )}
                items={[
                  permissions.canEdit
                    ? {
                        id: 'edit',
                        label: translate(
                          'copy.clinicalRecordCopy.editSurveillance',
                          language === 'el' ? 'el' : 'en',
                        ),
                        icon: Activity,
                        onClick: openEditEpisode,
                      }
                    : null,
                  {
                    id: 'print',
                    label: translate(
                      'copy.clinicalRecordCopy.print',
                      language === 'el' ? 'el' : 'en',
                    ),
                    icon: Printer,
                    onClick: () => window.print(),
                  },
                  {
                    id: 'download',
                    label: translate(
                      'copy.clinicalRecordCopy.surveillanceReportPdf',
                      language === 'el' ? 'el' : 'en',
                    ),
                    icon: Download,
                    onClick: () => {
                      if (
                        !printSurveillanceReport(detailRecord, {
                          language,
                          fmtDate,
                          fmtDateTime,
                          t,
                          libraries,
                        })
                      )
                        notify(
                          language === 'el'
                            ? 'Το πρόγραμμα περιήγησης εμπόδισε το άνοιγμα της αναφοράς. Επιτρέψτε τα αναδυόμενα παράθυρα για το Limoxis Observer.'
                            : 'The browser blocked the report window. Allow pop-ups for Limoxis Observer.',
                          'error',
                        )
                    },
                  },
                  permissions.canDelete
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
            <label>
              <span>{t('room')}</span>
              <input
                value={editDraft.room}
                onChange={e => setEditDraft(d => ({ ...d, room: e.target.value }))}
              />
            </label>
            <label>
              <span>{t('clinicalRecords.suspectedSource')}</span>
              <select
                value={editDraft.suspectedSource}
                onChange={e => setEditDraft(d => ({ ...d, suspectedSource: e.target.value }))}
              >
                <option value="">{t('underAssessment')}</option>
                <option value="bloodstream">{t('clinicalRecords.bloodstream')}</option>
                <option value="urinary">{t('clinicalRecords.urinary')}</option>
                <option value="respiratory">{t('clinicalRecords.respiratory')}</option>
                <option value="surgicalSite">{t('clinicalRecords.surgicalSite')}</option>
                <option value="other">{t('other')}</option>
              </select>
            </label>
            <label className="entry-span-2">
              <span>{t('surveillanceReason')}</span>
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
          />
        )}
      </div>
    )
  return (
    <div className="patient-surveillance-clean unified-surveillance-workspace">
      <section className="record-section surveillance-tree-section">
        <div className="record-section-header">
          <div>
            <h3>
              {translate(
                'copy.clinicalRecordCopy.surveillanceSamples',
                language === 'el' ? 'el' : 'en',
              )}
            </h3>
            <p>
              {translate(
                'copy.clinicalRecordCopy.unifiedClinicalFlowLinkedSamplesAppear',
                language === 'el' ? 'el' : 'en',
              )}
            </p>
          </div>
          <div className="button-row">
            {onClearTestData && (
              <Button variant="ghost" onClick={onClearTestData}>
                <Trash2 size={15} />
                {translate(
                  'copy.clinicalRecordCopy.clearTestData',
                  language === 'el' ? 'el' : 'en',
                )}
              </Button>
            )}
            {canCreateSample && onCreateSample && (
              <Button
                className="clinical-add-action"
                variant="secondary"
                onClick={() => {
                  setFollowUpParent(null)
                  setSampleOpen(true)
                }}
              >
                <Microscope size={15} />
                {translate('copy.clinicalRecordCopy.newSample', language === 'el' ? 'el' : 'en')}
              </Button>
            )}
            {canCreate && (
              <Button className="clinical-primary-action" onClick={onCreate}>
                <PlayCircle size={15} />{' '}
                {translate(
                  'copy.clinicalRecordCopy.startNewSurveillance',
                  language === 'el' ? 'el' : 'en',
                )}
              </Button>
            )}
          </div>
        </div>
        <div className="sv-tree">
          {episodes.map(ep => {
            const listed = samples.filter(
              sample =>
                String(
                  sample.surveillanceCase ||
                    sample.surveillanceCaseId ||
                    sample.surveillance_case_id ||
                    '',
                ) === String(ep.id) ||
                (Boolean(sample.surveillanceCase) &&
                  String(sample.surveillanceCase) === String(ep.recordId || '')),
            )
            const listedIds = new Set(listed.map(x => String(x.id || '')))
            const linked = [
              ...listed,
              ...(ep.samples || []).filter(x => !listedIds.has(String(x.id || ''))),
            ]
            const organism =
              ep.samples?.find(x => x.organism)?.organism ||
              linked.find(x => x.organism)?.organism ||
              ''
            const resistance = ep.resistance || linked.find(x => x.resistance)?.resistance || ''
            return (
              <div
                className={`sv-episode sv-status-${ep.status || 'active'} ${String(selectedId) === String(ep.id) ? 'is-selected' : ''}`}
                key={ep.id}
              >
                <button
                  type="button"
                  className="sv-episode-head"
                  onClick={() => openEpisode(ep.id)}
                >
                  <span className="sv-episode-icon" aria-hidden="true">
                    <Activity size={17} />
                  </span>
                  <span className="sv-episode-main">
                    <span className="sv-episode-title">
                      <strong>
                        {episodeTypeLabel(ep, t) ||
                          translate(
                            'copy.clinicalRecordCopy.surveillance',
                            language === 'el' ? 'el' : 'en',
                          )}
                      </strong>
                      <b className={`status-badge ${ep.status === 'active' ? 'active' : ''}`}>
                        {t(ep.status)}
                      </b>
                    </span>
                    <small>
                      {translate(
                        'copy.clinicalRecordCopy.surveillance',
                        language === 'el' ? 'el' : 'en',
                      )}{' '}
                      ·{' '}
                      {translate(
                        'copy.clinicalRecordCopy.started',
                        language === 'el' ? 'el' : 'en',
                      )}{' '}
                      {fmtDate(ep.startedAt)}
                      {ep.reviewDue ? (
                        <>
                          {' '}
                          · <CalendarClock size={12} />{' '}
                          {translate(
                            'copy.clinicalRecordCopy.review',
                            language === 'el' ? 'el' : 'en',
                          )}{' '}
                          {fmtDate(ep.reviewDue)}
                        </>
                      ) : null}
                    </small>
                  </span>
                  <span className="sv-episode-findings">
                    {organism ? (
                      <em className="sv-chip sv-chip-organism">{organism}</em>
                    ) : (
                      <em className="sv-chip sv-chip-muted">
                        {translate(
                          'copy.clinicalRecordCopy.noFinding',
                          language === 'el' ? 'el' : 'en',
                        )}
                      </em>
                    )}
                    {resistance && (
                      <em
                        className={`sv-chip ${RESISTANCE_ALERT.has(String(resistance).toUpperCase()) ? 'sv-chip-danger' : 'sv-chip-muted'}`}
                      >
                        {resistance}
                      </em>
                    )}
                    <span className="sv-sample-count">
                      <Microscope size={13} />
                      {linked.length}
                    </span>
                  </span>
                  <ChevronRight className="sv-episode-open" size={18} />
                </button>
                {linked.length > 0 && (
                  <div className="sv-samples">
                    <SampleTree
                      samples={linked}
                      linked
                      onFollowUp={sample => {
                        setFollowUpParent(sample)
                        setSampleOpen(true)
                      }}
                      onCreateFromSample={onCreateFromSample}
                      canCreate={canCreate}
                      canCreateSample={canCreateSample}
                      t={t}
                      language={language}
                      fmtDate={fmtDate}
                    />
                  </div>
                )}
              </div>
            )
          })}
          {(() => {
            const unlinked = samples.filter(
              sample =>
                !episodes.some(
                  ep =>
                    String(
                      sample.surveillanceCase ||
                        sample.surveillanceCaseId ||
                        sample.surveillance_case_id ||
                        '',
                    ) === String(ep.id) ||
                    (Boolean(sample.surveillanceCase) &&
                      String(sample.surveillanceCase) === String(ep.recordId || '')) ||
                    (ep.samples || []).some(x => x.id && String(x.id) === String(sample.id)),
                ),
            )
            return unlinked.length ? (
              <div className="sv-unlinked">
                <div className="sv-unlinked-heading">
                  <Microscope size={15} />
                  <strong>
                    {translate(
                      'copy.clinicalRecordCopy.samplesWithoutSurveillance',
                      language === 'el' ? 'el' : 'en',
                    )}
                  </strong>
                  <span>{unlinked.length}</span>
                </div>
                <div className="sv-samples sv-samples-flat">
                  <SampleTree
                    samples={unlinked}
                    linked={false}
                    onFollowUp={sample => {
                      setFollowUpParent(sample)
                      setSampleOpen(true)
                    }}
                    onCreateFromSample={onCreateFromSample}
                    canCreate={canCreate}
                    canCreateSample={canCreateSample}
                    t={t}
                    language={language}
                    fmtDate={fmtDate}
                  />
                </div>
              </div>
            ) : null
          })()}
          {!episodes.length && !samples.length && (
            <div className="inline-empty">
              {translate(
                'copy.clinicalRecordCopy.noSurveillanceEpisodesOrSamplesFor',
                language === 'el' ? 'el' : 'en',
              )}
            </div>
          )}
        </div>
      </section>
      {sampleOpen && (
        <SampleDialog
          t={t}
          title={
            followUpParent
              ? translate('copy.clinicalRecordCopy.sampleFollowUp', language === 'el' ? 'el' : 'en')
              : null
          }
          initialType={followUpParent?.type || followUpParent?.sampleType || ''}
          onClose={() => {
            setSampleOpen(false)
            setFollowUpParent(null)
          }}
          onSave={saveSample}
        />
      )}{' '}
      {samplePrompt && (
        <ObserverDialog
          title={translate(
            'copy.clinicalRecordCopy.sampleRecorded2',
            language === 'el' ? 'el' : 'en',
          )}
          onClose={() => setSamplePrompt(null)}
        >
          <p>
            {translate(
              'copy.clinicalRecordCopy.startSurveillanceFromThisSample',
              language === 'el' ? 'el' : 'en',
            )}
          </p>
          <div className="dialog-actions">
            <Button variant="secondary" onClick={() => setSamplePrompt(null)}>
              {translate('copy.clinicalRecordCopy.later', language === 'el' ? 'el' : 'en')}
            </Button>
            {canCreate && (
              <Button
                onClick={() => {
                  const sample = samplePrompt
                  setSamplePrompt(null)
                  onCreateFromSample?.(sample)
                }}
              >
                {translate(
                  'copy.clinicalRecordCopy.startSurveillance',
                  language === 'el' ? 'el' : 'en',
                )}
              </Button>
            )}
          </div>
        </ObserverDialog>
      )}
    </div>
  )
}
function SampleTree({
  samples = [],
  linked,
  onFollowUp,
  onCreateFromSample,
  canCreate,
  canCreateSample,
  t,
  language,
  fmtDate,
}) {
  const codes = new Set(samples.map(x => String(x.id || '')))
  const byDate = (a, b) =>
    String(a.collectedAt || a.requestedAt || '').localeCompare(
      String(b.collectedAt || b.requestedAt || ''),
    )
  const roots = samples
    .filter(x => !sampleParentCode(x) || !codes.has(sampleParentCode(x)))
    .sort(byDate)
  const render = (sample, depth = 0) => {
    const children = samples
      .filter(x => sampleParentCode(x) === String(sample.id || ''))
      .sort(byDate)
    return (
      <div
        className={`sv-sample-node ${depth ? 'is-followup' : ''}`}
        data-sample-root={depth === 0 ? 'true' : undefined}
        key={sample.recordId || sample.id}
      >
        <SampleTreeRow
          sample={sample}
          linked={linked}
          depth={depth}
          onFollowUp={onFollowUp}
          onCreateFromSample={onCreateFromSample}
          canCreate={canCreate}
          canCreateSample={canCreateSample}
          t={t}
          language={language}
          fmtDate={fmtDate}
        />
        {children.length > 0 && (
          <div className="sv-sample-children">
            {children.map(child => render(child, depth + 1))}
          </div>
        )}
      </div>
    )
  }
  return <>{roots.map(x => render(x, 0))}</>
}
function SampleTreeRow({
  sample,
  linked,
  depth = 0,
  onFollowUp,
  onCreateFromSample,
  canCreate,
  canCreateSample,
  t,
  language,
  fmtDate,
}) {
  const type = t(sample.sampleType || sample.type) || sample.sampleType || sample.type || '—'
  const status = t(sample.result || sample.status || 'pending')
  const clean = value => {
    const text = String(value ?? '').trim()
    return text && text !== '—' ? text : ''
  }
  const organism = clean(
    sample.organism ||
      sample.microorganism ||
      sample.microbiologyResults?.find(x => x.organism)?.organism,
  )
  const amr = clean(
    sample.resistance || sample.amr || sample.microbiologyResults?.find(x => x.amr)?.amr,
  )
  const tone = sampleTone(sample)
  const isNegative = tone === 'negative'
  return (
    <div className={`sv-sample sv-tone-${tone} ${linked ? 'is-linked' : 'is-unlinked'}`}>
      <span className="sv-sample-icon" aria-hidden="true">
        {depth ? <RefreshCcw size={14} /> : <Microscope size={15} />}
      </span>
      <span className="sv-sample-main">
        <strong>
          {depth
            ? `${translate('copy.clinicalRecordCopy.followUp', language === 'el' ? 'el' : 'en')} ${depth} · `
            : ''}
          {type}
        </strong>
        <small>
          {fmtDate(sample.collectedAt || sample.requestedAt)}
          {sample.id ? ` · ${sample.id}` : ''}
        </small>
      </span>
      <span className="sv-sample-result">
        <b className={`sv-result sv-result-${tone}`}>{status}</b>
        {organism && <em className="sv-chip sv-chip-organism">{organism}</em>}
        {amr && (
          <em
            className={`sv-chip ${RESISTANCE_ALERT.has(String(amr).toUpperCase()) ? 'sv-chip-danger' : 'sv-chip-muted'}`}
          >
            {amr}
          </em>
        )}
      </span>
      <span className="sv-sample-actions">
        {linked ? null : isNegative ? (
          <em
            className="sample-negative-note"
            title={translate(
              'copy.clinicalRecordCopy.aNegativeResultCannotStartA',
              language === 'el' ? 'el' : 'en',
            )}
          >
            {translate(
              'copy.clinicalRecordCopy.negativeNoSurveillance',
              language === 'el' ? 'el' : 'en',
            )}
          </em>
        ) : canCreate ? (
          <Button
            className="sample-start-action"
            variant="secondary"
            onClick={() => onCreateFromSample?.(sample)}
          >
            <PlayCircle size={14} />
            {translate(
              'copy.clinicalRecordCopy.startSurveillance',
              language === 'el' ? 'el' : 'en',
            )}
          </Button>
        ) : null}
        {canCreateSample && (
          <Button
            className="sample-followup-action"
            variant="secondary"
            onClick={() => onFollowUp?.(sample)}
          >
            <RefreshCcw size={14} />
            {translate('copy.clinicalRecordCopy.followUp', language === 'el' ? 'el' : 'en')}
          </Button>
        )}
      </span>
    </div>
  )
}
