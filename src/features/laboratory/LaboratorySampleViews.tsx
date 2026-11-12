import { SectionHeader } from '../../design-system/SectionHeader'
import { environmentalResultWord, resultLimit } from './environmentalLimit'
import { HistoryTimeline } from '../../design-system/HistoryTimeline'
import { AlertTriangle } from 'lucide-react'
import { DetailList } from '../../design-system/DetailList'
import { methodLabel } from './laboratorySampleFormat'
import { LaboratoryStatus } from './LaboratoryStatus'
import type { ReactNode } from 'react'
import type { AnyRecord } from '../../types/featureTypes'

// A label lookup of the record: t (shared keys) and tx (the record's own copy).
export type LabelLookup = (key: string) => string

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
}: {
  t: LabelLookup
  tx: LabelLookup
  language: string
  result: AnyRecord | null | undefined
  organisms: string[]
  isEnvironmental: boolean
  standard?: AnyRecord | null
  menu?: ReactNode
  emptyState?: ReactNode
}) {
  // The limit the result was assessed with, or the protocol's: a result without either has no assessment.
  const limit = resultLimit(result, standard)
  const hasLimit = limit != null
  const title = isEnvironmental
    ? t('laboratoryRecords.environmentalResult')
    : t('laboratoryRecords.resultAndOrganism')
  return (
    <section className="lab-record-card lab-result-card">
      <SectionHeader title={title} actions={menu} />
      {isEnvironmental && (
        <div className={`smart-protocol-strip ${hasLimit ? 'configured' : 'missing'}`}>
          <div>
            <strong>{standard?.protocolCode || (hasLimit ? tx('assessedLimit') : tx('noProtocol'))}</strong>
            {hasLimit && (
              <span>
                {' '}
                · {limit} {standard?.unit || 'CFU'}
              </span>
            )}
          </div>
          <span className="smart-lock-chip">🔒 {tx('protocol')}</span>
        </div>
      )}
      {emptyState && !(result?.result || organisms.length) ? emptyState : result ? (
        <DetailList className="lab-result-details" sections={[{ items: ([
            {
              id: 'result',
              label: t('result'),
              value: result.result ? (
                <span className={`lab-result-value is-${result.result}`}>{(isEnvironmental && environmentalResultWord(result, language, standard)) || t(result.result)}</span>
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
          ] as (AnyRecord | false)[]).filter((field): field is AnyRecord => Boolean(field && !field.hidden)).map(field => ({ label: field.label, value: field.meta ? <>{field.value}{' '}{field.meta}</> : field.value })) }]}
        />
      ) : (
        <div className="lab-table-empty lab-result-empty">{tx('noResult')}</div>
      )}
    </section>
  )
}

// The sample's events, newest first (the History tab and the printed report).
export function labHistoryEvents(sample: AnyRecord, t: LabelLookup, tx: LabelLookup): { at: string, title: string, by?: string }[] {
  return [
    sample.requestedAt && { at: sample.requestedAt, title: t('requested') },
    sample.collectedAt && { at: sample.collectedAt, title: t('collectedLabel') },
    sample.receivedAt && { at: sample.receivedAt, title: t('received') },
    ...(sample.microbiologyResults || []).flatMap((item: AnyRecord) => [
      item.resultedAt && {
        at: item.resultedAt,
        title: `${t('laboratoryRecords.microbiologyResult')} · ${tx(item.resultStatus)}`,
      },
      ...(item.communications || []).map(
        (row: AnyRecord) =>
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
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
}
// The sample's history in the shared timeline (same look as the patient record).
export function LabHistory({ sample, t, tx, fmt }: { sample: AnyRecord, t: LabelLookup, tx: LabelLookup, fmt: (value: string | undefined) => string }) {
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
