import { escapeHtml, factsHtml, reportTableHtml } from '../../core/export/reportDocument'
import { resolveEnvironmentalStandard } from './laboratoryCloudService'
import { buildLaboratorySampleReport } from './laboratorySampleReport'
import { copy } from './laboratorySampleFormat'
import { sampleProgress } from './laboratorySampleProgress'
import { labSampleStatus } from './LaboratoryStatus'

// The printed document of a whole culture plate: every position prints as the sample's own report does (details,
// microbiology result with organism, CFU, limit and assessment, antibiogram, communication, history), one after the
// other, in the shared report style. samples: the plate's samples; standards: the environmental protocols.
export function buildPlateReport({ samples, standards = [], language = 'el', t, fmt }) {
  const en = language === 'en'
  const L = (el, enText) => (en ? enText : el)
  const tx = key => copy[language]?.[key] || copy.en[key] || key
  const first = samples[0]
  const sections = samples.flatMap(item => {
    const progress = sampleProgress(item)
    const own = buildLaboratorySampleReport({
      sample: item,
      steps: [],
      progress: { result: progress.result, ast: progress.ast, amr: progress.amr, communications: progress.communications, organisms: progress.organisms },
      isEnvironmental: true,
      standard: resolveEnvironmentalStandard(standards, item.type, item.environmentalMethod),
      language, t, tx, fmt,
      statusWord: progress.rejected ? t('rejected') : progress.finalized ? t('completed') : labSampleStatus(item, language).text,
    })
    const position = `${L('Θέση', 'Position')} ${item.environmentalPosition || '—'}`
    const heading = `${position} · ${[item.location, item.point].filter(Boolean).join(' · ') || item.id}`
    return own.sections
      .filter(section => !['progress', 'documents'].includes(section.id))
      .map((section, index) => {
        const facts = (section.pairs || []).filter(pair => pair && pair[1] != null && pair[1] !== '' && pair[1] !== '—')
        const isolates = (section.items || []).map(isolate => ({
          title: isolate.title,
          facts: (isolate.pairs || []).filter(pair => pair && pair[1]),
          table: isolate.table?.length ? { columns: [L('Αντιβιοτικό', 'Antibiotic'), L('Ευαισθησία', 'Susceptibility')], rows: isolate.table } : null,
        }))
        const isolateHtml = isolates.map(isolate => `<h3>${escapeHtml(isolate.title)}</h3>${isolate.facts.length ? factsHtml(isolate.facts) : ''}${isolate.table ? reportTableHtml(isolate.table, en) : ''}`).join('')
        const events = (section.events || []).map(event => [event.when, event.title, event.by].filter(Boolean).join(' · '))
        const nothing = !facts.length && !isolates.length && !events.length && !(section.list || []).length
        return {
          id: `${item.id}-${section.id}`,
          title: index === 0 ? `${heading} — ${section.title}` : `${position} — ${section.title}`,
          facts,
          list: [...(section.list || []), ...events],
          html: isolateHtml || undefined,
          note: nothing ? section.emptyText || L('Δεν υπάρχουν καταχωρίσεις.', 'No entries.') : undefined,
        }
      })
  })
  return {
    language,
    kind: L('Εργαστήριο', 'Laboratory'),
    code: `${t('clinicalRecords.envPlate')} ${first.environmentalPlate}`,
    title: `${t('clinicalRecords.envPlate')} ${first.environmentalPlate}`,
    subtitle: [first.department, first.collectedAt && fmt(first.collectedAt), first.environmentalBatchId && `${L('Παρτίδα', 'Batch')} ${first.environmentalBatchId}`].filter(Boolean).join(' · '),
    summaryText: L(`Τρυβλίο ${first.environmentalPlate} με ${samples.length} θέσεις.`, `Plate ${first.environmentalPlate} with ${samples.length} positions.`),
    sections,
    signatures: [L('Επικυρώθηκε από', 'Validated by')],
    filename: `${en ? 'plate' : 'trivlio'}-${first.environmentalPlate}`,
  }
}
