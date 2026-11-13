// The device, isolation and antimicrobial therapy steps of a surveillance episode's sheet (ClinicalJourney.tsx).
import { BedDouble, Pill, Stethoscope } from 'lucide-react'
import { Button } from '../../design-system/Button'
import { translate } from '../../core/i18n/LanguageContext'
import { StageTable, StateBadge } from './ClinicalJourneyParts'
import { IsolationDialog } from './ClinicalRecordDialogs'
import { OverflowMenu } from '../../design-system/OverflowMenu'
import { StagePanel } from './ClinicalRecordViews'
import { TherapyReviewCard } from './protocols/TherapyReviewCard'
import { reviewWindow, showsReviewCard } from './protocols/therapyReview'
import { createTherapyReview } from './protocols/protocolService'
import type { AuditActor } from '../../core/audit/actor'
import type { AntimicrobialTherapy, ClinicalDevice } from './clinicalTypes'
import type { ClinicalEntry, ClinicalPermissions, ClinicalRecordRepository, DeviceBundles, EpisodeProtocols, JourneyCase, ProtocolOptions, SheetDetailProps, SheetEdit } from './clinicalScreenTypes'

// A device row; older demo devices keep the start as startedAt.
type DeviceRow = ClinicalDevice & { startedAt?: string | null }
import type { Handler, Setter } from './surveillanceTypes'
import type { ComponentType, ReactNode } from 'react'
// `as string` below: an optional text of a record handed to a helper typed for text (t), which reads a missing one as before.
// `bundle!`: hasBundle is true only with a bundle.

// What the screen hands to this part (one object, so the part reads like the code it came from).
export interface JourneyCareStagesScope {
  actor: AuditActor
  deleteItem: Handler | null
  deviceBundles: DeviceBundles | null
  editing: boolean
  entryDelete: Handler
  fmtDate: (value: unknown) => string
  language: string
  now: Date
  organizationId: string | null | undefined
  permissions: ClinicalPermissions
  protocolOptions: ProtocolOptions
  protocols: EpisodeProtocols
  record: JourneyCase
  repository: ClinicalRecordRepository
  run: Handler
  runProtocol: Handler
  setBundleDevice: Setter<ClinicalDevice | null>
  setDialog: Setter<string | null>
  setEntryDetail: Setter<ClinicalEntry | null>
  SheetDetail: ComponentType<SheetDetailProps>
  sheetEdit: SheetEdit
  sheetForm: (node: ReactNode) => ReactNode
  stage: string
  stageForms: Record<string, string | null>
  t: (key: string) => string
}
export function JourneyCareStages({ j }: { j: JourneyCareStagesScope }) {
  const { actor, deleteItem, deviceBundles, editing, entryDelete, fmtDate, language, now, organizationId, permissions, protocolOptions, protocols, record, repository, run, runProtocol, setBundleDevice, setDialog, setEntryDetail, SheetDetail, sheetEdit, sheetForm, stage, stageForms, t } = j
  return (
    <>
        <div className="sheet-anchor" id={`sheet-devices-${record.id}`}>
        {stage === 'devices' && (
          <StagePanel
            icon={Stethoscope}
            title={translate(
              'copy.clinicalRecordCopy.devicesRiskFactors',
              language === 'el' ? 'el' : 'en',
            )}
            action={
              permissions.canAssess && !stageForms.devices ? (
                <Button
                  className="clinical-stage-action"
                  variant="secondary"
                  onClick={() => setDialog('device')}
                >
                  {translate(
                    'copy.clinicalRecordCopy.recordDevice',
                    language === 'el' ? 'el' : 'en',
                  )}
                </Button>
              ) : null
            }
          >
            {record.devices?.length ? (
              <StageTable
                columns={[
                  {
                    key: 'device',
                    label: translate(
                      'copy.clinicalRecordCopy.device',
                      language === 'el' ? 'el' : 'en',
                    ),
                  },
                  {
                    key: 'start',
                    label: translate(
                      'copy.clinicalRecordCopy.startDate',
                      language === 'el' ? 'el' : 'en',
                    ),
                  },
                  ...(deviceBundles ? [{ key: 'day', label: t('episodeForms.bundles.dayColumn') }] : []),
                  { key: 'status', label: t('status') },
                  ...(deviceBundles ? [{ key: 'bundle', label: t('episodeForms.bundles.column') }, { key: 'check', label: '' }] : []),
                  ...(deleteItem ? [{ key: 'menu', label: '' }] : []),
                ]}
                rows={record.devices}
                renderRow={(x: DeviceRow) => {
                  // The one place a bundle check starts: only a device still in place has one.
                  const bundle = deviceBundles && !x.removedAt && x.status !== 'removed' ? deviceBundles.info(x) : null
                  const hasBundle = Boolean(bundle?.bundleKeys.length)
                  return (
                  <>
                    <td>{x.name || x.type || '—'}</td>
                    <td>{fmtDate(x.insertedAt || x.startedAt)}</td>
                    {deviceBundles && <td>{bundle?.deviceDay ?? '—'}</td>}
                    <td>
                      <StateBadge status={x.status || 'active'} label={t(x.status || 'active')} />
                    </td>
                    {deviceBundles && (
                      <td>
                        {hasBundle ? (
                          <>
                            {bundle!.bundleKeys[0]}
                            <small className="entry-detail-note">{t(`episodeForms.status.${bundle!.status}`)}</small>
                          </>
                        ) : (
                          '—'
                        )}
                      </td>
                    )}
                    {deviceBundles && (
                      <td className="open-record-cell">
                        {editing && hasBundle && deviceBundles.canCheck && (
                          <Button
                            variant={bundle!.status === 'overdue' ? 'primary' : 'secondary'}
                            onClick={() => {
                              // Opens under the device, on the sheet (owner, 8/11/2026).
                              setBundleDevice(x)
                              setDialog('bundle')
                            }}
                          >
                            {t('episodeForms.bundles.check')}
                          </Button>
                        )}
                      </td>
                    )}
                    {deleteItem && (
                      <td className="open-record-cell">
                        {editing && entryDelete('device', x, x.name || x.type) && <OverflowMenu label={t('episodeForms.rowActions')} items={[entryDelete('device', x, x.name || x.type)]} />}
                      </td>
                    )}
                  </>
                  )
                }}
              />
            ) : (
              <div className="inline-empty">
                {translate(
                  'copy.clinicalRecordCopy.noInvasiveDevicesRecordedRiskFactors',
                  language === 'el' ? 'el' : 'en',
                )}
              </div>
            )}
          </StagePanel>
        )}
        </div>
        <div className="sheet-anchor" id={`sheet-isolation-${record.id}`}>
        {stage === 'isolation' && (
          <StagePanel
            icon={BedDouble}
            title={t('isolation')}
            menu={[entryDelete('isolation', record.isolation, t('isolation'))]}
            action={
              permissions.canIsolation ? (
                <div className="row-actions">
                  {record.isolation?.status === 'active' ? (stageForms.isolation ? null :
                    <Button
                      className="clinical-stage-action"
                      variant="secondary"
                      onClick={() => setDialog('endIsolation')}
                    >
                      {translate(
                        'copy.clinicalRecordCopy.endIsolation',
                        language === 'el' ? 'el' : 'en',
                      )}
                    </Button>
                  ) : sheetEdit.isolation ? null : (
                    <Button
                      className="clinical-stage-action"
                      variant="secondary"
                      onClick={() => setDialog('isolation')}
                    >
                      {translate(
                        'copy.clinicalRecordCopy.startIsolation',
                        language === 'el' ? 'el' : 'en',
                      )}
                    </Button>
                  )}
                  {/* «Not required» is the infection-control decision on the case
                      (surveillance_cases + its event); the departments only start and end isolation. */}
                  {!record.isolation && permissions.canReassess && (
                    <Button
                      variant="ghost"
                      onClick={() =>
                        run(() => repository.setIsolationNotRequired(record), t('actionCompleted'))
                      }
                    >
                      {t('notRequired')}
                    </Button>
                  )}
                </div>
              ) : null
            }
          >
            {record.isolation ? (
              <div className="detail-grid">
                <SheetDetail label={t('status')} value={t(record.isolation.status as string)} />
                <SheetDetail label={t('startDate')} value={fmtDate(record.isolation.startedAt)} />
                <SheetDetail label={t('reason')} value={record.isolation.reason} />
                <SheetDetail label={t('room')} value={record.isolation.room} />
              </div>
            ) : (
              <div className="inline-empty">
                {record.isolationDecision?.required === false
                  ? t('notRequired')
                  : t('clinicalRecords.noIsolationRecorded')}
              </div>
            )}
          </StagePanel>
        )}
        {stage === 'isolation' && sheetEdit.isolation && sheetForm(
          <IsolationDialog
            t={t}
            onClose={null}
            onSave={draft => run(() => repository.beginIsolation(record, draft), t('actionCompleted'))}
          />,
        )}
        </div>
        <div className="sheet-anchor" id={`sheet-therapy-${record.id}`}>
        {stage === 'therapy' && (
          <StagePanel
            icon={Pill}
            title={t('therapy')}
            action={
              permissions.canTherapy && !stageForms.therapy ? (
                <Button
                  className="clinical-stage-action"
                  variant="secondary"
                  onClick={() => setDialog('therapy')}
                >
                  {translate(
                    'copy.clinicalRecordCopy.newAntimicrobialTherapy',
                    language === 'el' ? 'el' : 'en',
                  )}
                </Button>
              ) : null
            }
          >
            {/* The protocols (sepsis Hour-1 bundle …) start from the sheet's «⋯», with every other action (owner, 8/11/2026). */}
            {record.therapy?.length ? (
              <StageTable
                columns={[
                  {
                    key: 'drug',
                    label: translate(
                      'copy.clinicalRecordCopy.antimicrobial',
                      language === 'el' ? 'el' : 'en',
                    ),
                  },
                  {
                    key: 'dose',
                    label: translate(
                      'copy.clinicalRecordCopy.doseRoute',
                      language === 'el' ? 'el' : 'en',
                    ),
                  },
                  {
                    key: 'start',
                    label: translate(
                      'copy.clinicalRecordCopy.start',
                      language === 'el' ? 'el' : 'en',
                    ),
                  },
                  { key: 'status', label: t('status') },
                ]}
                rows={record.therapy}
                onOpen={x => setEntryDetail({ kind: 'therapy', row: x })}
                renderRow={x => (
                  <>
                    <td>
                      <strong>{x.antimicrobial}</strong>
                    </td>
                    <td>
                      {x.dose || '—'} · {x.route || '—'}
                    </td>
                    <td>{fmtDate(x.startedAt)}</td>
                    <td>
                      <StateBadge status={x.status || 'active'} label={t(x.status || 'active')} />
                    </td>
                  </>
                )}
              />
            ) : (
              <div className="inline-empty">{t('clinicalRecords.noTherapyRecorded')}</div>
            )}
            {(record.therapy || []).map((therapy: AntimicrobialTherapy) => {
              const window = reviewWindow(therapy, protocols.reviews, now)
              return showsReviewCard(window) ? (
                <TherapyReviewCard
                  key={`review-${therapy.id}`}
                  record={record}
                  therapy={therapy}
                  window={window!}
                  t={t}
                  actorName={actor?.name}
                  canReview={editing && permissions.canTherapy}
                  quiet
                  onSave={draft =>
                    runProtocol(
                      () => createTherapyReview(organizationId, record, therapy, draft, protocolOptions),
                      t('sepsis.review.saved'),
                    )
                  }
                />
              ) : null
            })}
          </StagePanel>
        )}
        </div>
    </>
  )
}
