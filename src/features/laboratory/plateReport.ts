import { environmentalResultWord, resultLimit } from './environmentalLimit'
import { sampleProgress } from './laboratorySampleProgress'
import { resolveEnvironmentalStandard } from './laboratoryCloudService'
import { labSampleStatus } from './LaboratoryStatus'
import { platePointText } from './laboratoryPlates'
import { sirWord } from '../../design-system/recordReport'

// The printed document of a whole culture plate, on one page: a row per position (point, result, organism, CFU, limit,
// assessment, status) and, only when a position has one, its antibiogram below. Shared report style.
export function buildPlateReport({ samples, standards = [], language = 'el', t, fmt, withNames = true }) {
  const en = language === 'en'
  const L = (el, enText) => (en ? enText : el)
  const first = samples[0]
  const rows = samples.map(item => {
    const progress = sampleProgress(item)
    const result = progress.result
    const standard = resolveEnvironmentalStandard(standards, item.type, item.environmentalMethod)
    const limit = result ? resultLimit(result, standard) : null
    const cfu = result ? (result.result === 'negative' && result.cfuCount == null ? 0 : result.cfuCount) : null
    return {
      item, progress,
      cells: [
        item.environmentalPosition || '—',
        platePointText(item, language, withNames) === '—' ? item.id : platePointText(item, language, withNames),
        result?.result ? environmentalResultWord(result, language, standard) || t(result.result) : L('Χωρίς αποτέλεσμα', 'No result'),
        progress.organisms.join(', ') || (result?.result === 'positive' ? L('Δεν έχει καταχωριστεί', 'Not recorded') : '—'),
        cfu != null && cfu !== '' ? String(cfu) : '—',
        limit != null ? String(limit) : '—',
        progress.rejected ? t('rejected') : progress.finalized ? t('completed') : labSampleStatus(item, language).text,
      ],
    }
  })
  const antibiograms = rows.flatMap(({ item, progress }) => progress.organisms
    .map(name => ({ name, tagged: progress.ast.filter(row => row.organism === name), item }))
    .filter(entry => entry.tagged.length))
  const sections = [{
    id: 'positions',
    title: L('Αποτελέσματα ανά θέση', 'Results by position'),
    table: {
      columns: [L('Θέση', 'Pos.'), L('Σημείο', 'Point'), L('Αποτέλεσμα', 'Result'), L('Μικροοργανισμός', 'Organism'), 'CFU', L('Όριο', 'Limit'), L('Κατάσταση', 'Status')],
      rows: rows.map(row => row.cells),
    },
    keepTogether: true,
  }]
  if (antibiograms.length) sections.push({
    id: 'antibiograms',
    title: L('Αντιβιογράμματα', 'Antibiograms'),
    tables: antibiograms.map(entry => ({
      title: `${L('Θέση', 'Position')} ${entry.item.environmentalPosition || '—'} · ${entry.name}`,
      columns: [L('Αντιβιοτικό', 'Antibiotic'), L('Ευαισθησία', 'Susceptibility')],
      rows: entry.tagged.map(row => [`${row.drug}${row.mic != null && row.mic !== '' ? ` (MIC ${row.operator || ''}${row.mic})` : row.zone != null ? ` (${row.zone} mm)` : ''}`, sirWord(row.sir, en)]),
    })),
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
