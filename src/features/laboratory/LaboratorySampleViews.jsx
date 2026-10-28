import { SectionHeader } from '../../design-system/SectionHeader'
import { HistoryTimeline } from '../../design-system/HistoryTimeline'
import { AlertTriangle } from 'lucide-react'
import { DetailList } from '../../design-system/DetailList'
import { methodLabel } from './laboratorySampleFormat'
import { LaboratoryStatus } from './LaboratoryStatus'

// Read-only views of the laboratory sample record: the result card and the history.

export function ResultCard({
  t,
  tx,
  language,
  result,
  organisms,
  isEnvironmental,
  standard,
  menu,
  emptyState = null,
}) {
  const hasLimit = standard?.limitCfu != null && standard?.limitCfu !== ''
  const title = isEnvironmental
    ? t('laboratoryRecords.environmentalResult')
    : t('laboratoryRecords.resultAndOrganism')
  return (
    <section className="lab-record-card lab-result-card">
      <SectionHeader title={title} actions={menu} />
      {isEnvironmental && (
        <div className={`smart-protocol-strip ${hasLimit ? 'configured' : 'missing'}`}>
          <div>
            <strong>{standard?.protocolCode || tx('noProtocol')}</strong>
            {hasLimit && (
              <span>
                {' '}
                · {standard.limitCfu} {standard.unit || 'CFU'}
              </span>
            )}
          </div>
          <span className="smart-lock-chip">🔒 {tx('protocol')}</span>
        </div>
      )}
      {emptyState && !(result?.result || organisms.length) ? emptyState : result ? (
        <DetailList className="lab-result-details" sections={[{ items: [
            {
              id: 'result',
              label: t('result'),
              value: result.result ? (
                <span className={`lab-result-value is-${result.result}`}>{t(result.result)}</span>
              ) : null,
              meta: result.critical ? (
                <span className="lab-result-critical">
                  <AlertTriangle size={12} /> {tx('critical')}
                </span>
              ) : null,
            },
            {
              id: 'organisms',
              label: tx('organisms'),
              value: organisms.length ? organisms.join(', ') : null,
            },
            { id: 'method', label: tx('method'), value: methodLabel(result.method, language), hidden: !result.method },
            {
              id: 'status',
              label: tx('status'),
              value: (
                <LaboratoryStatus
                  text={tx(result.resultStatus || 'draft')}
                  tone={(result.resultStatus || 'draft') === 'draft' ? 'info' : 'success'}
                />
              ),
            },
            isEnvironmental && {
              id: 'cfu',
              label: tx('cfu'),
              value:
                result.result === 'negative' && result.cfuCount == null ? '0' : result.cfuCount,
            },
            isEnvironmental && {
              id: 'assessment',
              label: tx('assessment'),
              value:
                result.withinLimit === true
                  ? tx('within')
                  : result.withinLimit === false
                    ? tx('outside')
                    : tx('noLimit'),
            },
          ].filter(field => field && !field.hidden).map(field => ({ label: field.label, value: field.meta ? <>{field.value}{' '}{field.meta}</> : field.value })) }]}
        />
      ) : (
        <div className="lab-table-empty lab-result-empty">{tx('noResult')}</div>
      )}
    </section>
  )
}

// The sample's events, newest first (the History tab and the printed report).
export function labHistoryEvents(sample, t, tx) {
  return [
    sample.requestedAt && { at: sample.requestedAt, title: t('requested') },
    sample.collectedAt && { at: sample.collectedAt, title: t('collectedLabel') },
    sample.receivedAt && { at: sample.receivedAt, title: t('received') },
    ...(sample.microbiologyResults || []).flatMap(item => [
      item.resultedAt && {
        at: item.resultedAt,
        title: `${t('laboratoryRecords.microbiologyResult')} · ${tx(item.resultStatus)}`,
      },
      ...(item.communications || []).map(
        row =>
          row.at && {
            at: row.at,
            title: tx('communicationTitle'),
            by: row.to || row.recipientName,
          },
      ),
    ]),
    sample.documentsReviewedAt && { at: sample.documentsReviewedAt, title: tx('documentsDone') },
    sample.rejectedAt && {
      at: sample.rejectedAt,
      title: `${tx('reject')} · ${sample.rejectionReason || '—'}`,
    },
    sample.finalizedAt && { at: sample.finalizedAt, title: tx('finalized') },
  ]
    .filter(Boolean)
    .sort((a, b) => new Date(b.at) - new Date(a.at))
}
// The sample's history in the shared timeline (same look as the patient record).
export function LabHistory({ sample, t, tx, fmt }) {
  const events = labHistoryEvents(sample, t, tx)
  return (
    <HistoryTimeline
      title={t('history')}
      events={events.map(event => ({ at: event.at, title: event.title, meta: [event.by] }))}
      when={fmt}
      emptyText={t('noData')}
    />
  )
}
