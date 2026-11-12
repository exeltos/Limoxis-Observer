import { useState } from 'react'
import { Button } from '../../design-system/Button'
import { ObserverDialog } from '../../design-system/ObserverDialog'
import { RegistryTable } from '../../design-system/RegistryTable'
import { StatusBadge } from '../../design-system/StatusBadge'
import { translate } from '../../core/i18n/LanguageContext'
import { Detail } from './ClinicalAdmissions'
import { approvalStatusLabel, administrationStatusLabel, clinicalValueLabel } from './clinicalRecordLabels'
import { AdministrationDialog } from './ClinicalRecordDialogs'
import { statusTone } from './surveillanceOptions'

// The detail window of a clinical entry of an episode, and the table and badge the stages share
// (split from ClinicalJourney.jsx; the episode journey itself stays there).
export function ClinicalEntryDetail({
  entry,
  t,
  language,
  fmtDate,
  fmtDateTime,
  canManage,
  onClose,
  onDelete,
  onEdit,
  onFinishTherapy,
  onApproveTherapy,
  onRejectTherapy,
  onRecordAdministration,
}) {
  const [showAdminForm, setShowAdminForm] = useState(false)
  const row = entry.row || {}
  const titleMap = {
    sample: translate('copy.clinicalRecordCopy.sampleDetails', language === 'el' ? 'el' : 'en'),
    therapy: translate(
      'copy.clinicalRecordCopy.antimicrobialTherapyDetails',
      language === 'el' ? 'el' : 'en',
    ),
    reassessment: translate(
      'copy.clinicalRecordCopy.reassessmentDetails',
      language === 'el' ? 'el' : 'en',
    ),
  }
  const fields =
    entry.kind === 'sample'
      ? [
          [
            translate('copy.clinicalRecordCopy.sampleCode', language === 'el' ? 'el' : 'en'),
            row.id,
          ],
          [t('sampleType'), clinicalValueLabel(row.type || row.sampleType, language, t)],
          [t('status'), clinicalValueLabel(row.result || row.status || 'pending', language, t)],
          [t('organism'), row.organism || '—'],
          ['AMR', row.resistance || '—'],
        ]
      : entry.kind === 'therapy'
        ? [
            [
              translate('copy.clinicalRecordCopy.antimicrobial', language === 'el' ? 'el' : 'en'),
              row.antimicrobial,
            ],
            [translate('copy.clinicalRecordCopy.dose', language === 'el' ? 'el' : 'en'), row.dose],
            [
              translate('copy.clinicalRecordCopy.route', language === 'el' ? 'el' : 'en'),
              clinicalValueLabel(row.route, language, t),
            ],
            [
              translate('copy.clinicalRecordCopy.started2', language === 'el' ? 'el' : 'en'),
              fmtDate(row.startedAt),
            ],
            [t('status'), clinicalValueLabel(row.status || 'active', language, t)],
            [
              language === 'el' ? 'Stewardship' : 'Stewardship',
              approvalStatusLabel(row.approvalStatus, language),
            ],
          ]
        : [
            [
              translate('copy.clinicalRecordCopy.date', language === 'el' ? 'el' : 'en'),
              fmtDate(row.date),
            ],
            [t('status'), clinicalValueLabel(row.status, language, t)],
            [
              translate('copy.clinicalRecordCopy.notes', language === 'el' ? 'el' : 'en'),
              row.notes || '—',
            ],
            [
              translate('copy.clinicalRecordCopy.nextReview', language === 'el' ? 'el' : 'en'),
              fmtDate(row.nextReviewDue),
            ],
          ]
  const pendingApproval = row.approvalStatus === 'pending'
  const canAdminister =
    row.status === 'active' && !pendingApproval && row.approvalStatus !== 'rejected'
  const hasFooterActions =
    (entry.kind === 'therapy' &&
      Boolean(
        (pendingApproval && (onRejectTherapy || onApproveTherapy)) ||
        (canAdminister && onRecordAdministration) ||
        onFinishTherapy,
      )) ||
    (entry.kind === 'reassessment' && canManage) ||
    Boolean(onDelete)
  const footerActions = (
    <>
      {entry.kind === 'therapy' && pendingApproval && onRejectTherapy && (
        <Button variant="secondary" onClick={onRejectTherapy}>
          {translate('copy.clinicalRecordCopy.reject', language === 'el' ? 'el' : 'en')}
        </Button>
      )}
      {entry.kind === 'therapy' && pendingApproval && onApproveTherapy && (
        <Button variant="secondary" onClick={onApproveTherapy}>
          {translate('copy.clinicalRecordCopy.approve', language === 'el' ? 'el' : 'en')}
        </Button>
      )}
      {entry.kind === 'therapy' && canAdminister && onRecordAdministration && (
        <Button variant="secondary" onClick={() => setShowAdminForm(true)}>
          {translate(
            'copy.clinicalRecordCopy.recordAdministration',
            language === 'el' ? 'el' : 'en',
          )}
        </Button>
      )}
      {entry.kind === 'therapy' && onFinishTherapy && (
        <Button variant="secondary" onClick={onFinishTherapy}>
          {translate('copy.clinicalRecordCopy.endTherapy', language === 'el' ? 'el' : 'en')}
        </Button>
      )}
      {onDelete && (
        <Button
          variant="secondary"
          onClick={() => {
            onClose()
            onDelete.onClick()
          }}
        >
          {onDelete.label}
        </Button>
      )}
      {entry.kind === 'reassessment' && canManage && (
        <Button onClick={onEdit}>
          {translate('copy.clinicalRecordCopy.newReassessment', language === 'el' ? 'el' : 'en')}
        </Button>
      )}
    </>
  )
  return (
    <ObserverDialog
      title={titleMap[entry.kind] || t('details')}
      onClose={onClose}
      footer={hasFooterActions ? footerActions : null}
    >
      <div className="detail-grid clinical-entry-detail-grid">
        {fields.map(([label, value]) => (
          <Detail key={label} label={label} value={value} />
        ))}
      </div>
      {entry.kind === 'therapy' && (
        <div className="record-section-header">
          <div>
            <span className="eyebrow">
              {translate(
                'copy.clinicalRecordCopy.actualAdministrations',
                language === 'el' ? 'el' : 'en',
              )}
            </span>
          </div>
        </div>
      )}
      {entry.kind === 'therapy' &&
        (row.administrations?.length ? (
          <StageTable
            columns={[
              {
                key: 'date',
                label: translate('copy.clinicalRecordCopy.date', language === 'el' ? 'el' : 'en'),
              },
              {
                key: 'dose',
                label: translate('copy.clinicalRecordCopy.dose', language === 'el' ? 'el' : 'en'),
              },
              {
                key: 'route',
                label: translate('copy.clinicalRecordCopy.route2', language === 'el' ? 'el' : 'en'),
              },
              { key: 'status', label: t('status') },
            ]}
            rows={row.administrations}
            renderRow={a => (
              <>
                <td>{fmtDateTime ? fmtDateTime(a.administeredAt) : fmtDate(a.administeredAt)}</td>
                <td>{a.dose || '—'}</td>
                <td>{a.route || '—'}</td>
                <td>
                  <StateBadge
                    status={a.status}
                    label={administrationStatusLabel(a.status, language)}
                  />
                </td>
              </>
            )}
          />
        ) : (
          <div className="inline-empty">
            {translate(
              'copy.clinicalRecordCopy.noAdministrationRecordedYet',
              language === 'el' ? 'el' : 'en',
            )}
          </div>
        ))}
      {entry.kind === 'therapy' && pendingApproval && (
        <div className="entry-detail-note">
          {translate(
            'copy.clinicalRecordCopy.restrictedAntibioticStewardshipApprovalIsRequired',
            language === 'el' ? 'el' : 'en',
          )}
        </div>
      )}
      {entry.kind === 'sample' && canManage && (
        <span className="entry-detail-note">
          {translate(
            'copy.clinicalRecordCopy.resultsAndCorrectionsAreManagedBy',
            language === 'el' ? 'el' : 'en',
          )}
        </span>
      )}
      {entry.kind === 'reassessment' && canManage && (
        <span className="entry-detail-note">
          {translate(
            'copy.clinicalRecordCopy.reassessmentsRemainHistoricalRecordANew',
            language === 'el' ? 'el' : 'en',
          )}
        </span>
      )}
      {showAdminForm && (
        <AdministrationDialog
          t={t}
          language={language}
          onClose={() => setShowAdminForm(false)}
          onSave={draft => {
            setShowAdminForm(false)
            onRecordAdministration?.(draft)
          }}
        />
      )}
    </ObserverDialog>
  )
}

// Lists inside an episode use the same table as the registries; rows that open
// a detail window are clickable and keyboard-reachable.
export function StageTable({ columns, rows, renderRow, onOpen }) {
  return (
    <RegistryTable
      columns={columns}
      rows={rows}
      renderRow={renderRow}
      rowProps={
        onOpen
          ? row => ({
              className: 'clickable-row',
              tabIndex: 0,
              onClick: () => onOpen(row),
              onKeyDown: event => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  onOpen(row)
                }
              },
            })
          : undefined
      }
    />
  )
}
// The same coloured status labels as the surveillance list.
export function StateBadge({ status, label }) {
  return <StatusBadge tone={statusTone(status)}>{label}</StatusBadge>
}
