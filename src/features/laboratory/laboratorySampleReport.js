import { sirWord } from '../../design-system/recordReport'
import { sampleSummaryFields } from './LaboratorySampleSummary'
import { labHistoryEvents } from './LaboratorySampleViews'
import { methodLabel } from './laboratorySampleFormat'
import { sampleTypeLabel } from './laboratoryCloudService'

// The printed report of a laboratory sample: the description RecordReportPrint lays out
// as a document (patient/sample details, progress, microbiology result with the
// antibiogram per organism in words, documents, history). Labels come from the same
// helpers as the screen; nothing is printed as a raw key.
export function buildLaboratorySampleReport({ sample, steps = [], progress, isEnvironmental = false, standard = null, language = 'el', t, tx, fmt, statusWord = '', documents = null }) {
  const en = language === 'en'
  const L = (el, enText) => (en ? enText : el)
  const { result, ast = [], amr = [], communications = [], organisms = [] } = progress || {}
  const fields = sampleSummaryFields({ sample, t, language, fmt }).filter(field => !field.hidden)
  const stateWord = step => (step.state === 'done' ? L('Ολοκληρώθηκε', 'Completed') : step.state === 'na' ? L('Δεν απαιτείται', 'Not required') : L('Εκκρεμεί', 'Pending'))
  const hasLimit = standard?.limitCfu != null && standard?.limitCfu !== ''
  const cfu = result ? (result.result === 'negative' && result.cfuCount == null ? '0' : result.cfuCount) : ''
  const resultPairs = result
    ? [
        [t('result'), result.result && t(result.result)],
        [tx('critical'), result.critical ? L('Ναι', 'Yes') : ''],
        [tx('organisms'), organisms.join(', ')],
        [tx('method'), methodLabel(result.method, language)],
        [tx('status'), tx(result.resultStatus || 'draft')],
        isEnvironmental && [tx('cfu'), cfu],
        isEnvironmental && [tx('assessment'), result.withinLimit === true ? tx('within') : result.withinLimit === false ? tx('outside') : tx('noLimit')],
        isEnvironmental && hasLimit && [tx('protocol'), `${standard.protocolCode || ''} · ${standard.limitCfu} ${standard.unit || 'CFU'}`],
      ].filter(Boolean)
    : []
  const isolates = organisms.map(name => {
    const tagged = ast.filter(row => row.organism === name)
    const current = amr.filter(row => row.organism === name).slice(-1)[0] || null
    return {
      title: name,
      pairs: current ? [[tx('amrTitle'), [current.classification, [current.definitionSource, current.definitionVersion].filter(Boolean).join(' ')].filter(Boolean).join(' · ')], [L('Αιτιολόγηση', 'Rationale'), current.rationale]] : [],
      table: tagged.map(row => [`${row.drug}${row.mic != null && row.mic !== '' ? ` (MIC ${row.operator || ''}${row.mic})` : row.zone != null ? ` (${row.zone} mm)` : ''}`, sirWord(row.sir, en)]),
    }
  })
  const communicationLines = communications.map(row => [row.to || row.recipientName, [row.recipientRole, row.recipientDepartment].filter(Boolean).join(', '), row.at && fmt(row.at), row.method && t(row.method), row.readBack && t('laboratoryRecords.readBack')].filter(Boolean).join(' · '))
  const events = labHistoryEvents(sample, t, tx).map(event => ({ when: fmt(event.at), sort: String(event.at), title: event.title, by: event.by }))

  return {
    kind: L('Εργαστηριακό δείγμα', 'Laboratory sample'),
    code: sample.id,
    title: sampleTypeLabel(sample.type, t),
    subtitle: [sample.subjectName || sample.patient, sample.subjectCode || sample.patientId, sample.department].filter(Boolean).join(' · '),
    statusLabel: L('Κατάσταση', 'Status'),
    status: statusWord,
    summaryText: [
      `${L('Δείγμα', 'Sample')} ${sample.id} (${sampleTypeLabel(sample.type, t)})${sample.collectedAt ? `, ${L('λήψη', 'collected')} ${fmt(sample.collectedAt)}` : ''}.`,
      statusWord && `${L('Κατάσταση', 'Status')}: ${statusWord}.`,
      result?.result && `${t('result')}: ${t(result.result)}${organisms.length ? ` (${organisms.join(', ')})` : ''}.`,
    ].filter(Boolean).join(' '),
    sections: [
      { id: 'sample', title: L('Στοιχεία δείγματος', 'Sample details'), pairs: fields.map(field => [field.label, [field.value, field.meta].filter(value => typeof value === 'string' && value && value !== '—').join(' · ')]).concat([[tx('rejectReason'), sample.status === 'rejected' ? sample.rejectionReason : '']]) },
      { id: 'progress', title: L('Πρόοδος δείγματος', 'Sample progress'), list: steps.map(step => `${step.label}: ${stateWord(step)}${step.meta && step.state === 'done' ? ` · ${step.meta}` : ''}`) },
      { id: 'result', title: L('Μικροβιολογικό αποτέλεσμα', 'Microbiology result'), pairs: resultPairs, items: isolates, keep: true, emptyText: tx('noResult') },
      { id: 'communication', title: tx('communicationTitle'), list: communicationLines },
      { id: 'documents', title: L('Έγγραφα', 'Documents'), documents: documents || { value: [] } },
      { id: 'history', title: L('Ιστορικό', 'History'), events, keep: true },
    ],
  }
}
