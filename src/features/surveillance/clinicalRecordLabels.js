import {
  DEMO_REPORT_MARK_EL,
  DEMO_REPORT_MARK_EN,
  isDemoReport,
} from '../../core/organization/branding'
import { translate } from '../../core/i18n/LanguageContext'

// Labels, HAI criteria helpers and the printable report of the clinical record
// (PatientClinicalCanonicalPage.jsx). No React components live here.
// Resistance classes that are highlighted in red wherever a finding is shown.
export const RESISTANCE_ALERT = new Set([
  'MDR',
  'XDR',
  'PDR',
  'MRSA',
  'MRSE',
  'VRE',
  'CRE',
  'CPE',
  'ESBL',
  'CRAB',
  'CRPA',
])

export function approvalStatusLabel(status, language) {
  return (
    {
      pending: translate(
        'copy.clinicalRecordCopy.pendingApproval',
        language === 'el' ? 'el' : 'en',
      ),
      approved: translate('copy.clinicalRecordCopy.approved', language === 'el' ? 'el' : 'en'),
      rejected: translate('copy.clinicalRecordCopy.rejected', language === 'el' ? 'el' : 'en'),
      not_required: translate(
        'copy.clinicalRecordCopy.notRequired',
        language === 'el' ? 'el' : 'en',
      ),
    }[status] ||
    status ||
    '—'
  )
}
export function administrationStatusLabel(status, language) {
  return (
    {
      administered: translate(
        'copy.clinicalRecordCopy.administered',
        language === 'el' ? 'el' : 'en',
      ),
      withheld: translate('copy.clinicalRecordCopy.withheld', language === 'el' ? 'el' : 'en'),
      refused: translate('copy.clinicalRecordCopy.refused', language === 'el' ? 'el' : 'en'),
    }[status] ||
    status ||
    '—'
  )
}
function escapeReport(value) {
  return String(value ?? '—').replace(/[&<>"]/g, ch =>
    ch === '&' ? '&amp;' : ch === '<' ? '&lt;' : ch === '>' ? '&gt;' : '&quot;',
  )
}
export function printSurveillanceReport(
  record,
  { language = 'el', fmtDate, fmtDateTime, t = null, libraries = {} },
) {
  const esc = escapeReport
  const L = (el, en) => (language === 'el' ? el : en)
  const rows = (items, empty = '—') =>
    items?.length ? items.map(x => `<li>${esc(x)}</li>`).join('') : `<li>${empty}</li>`
  const samples = (record.samples || [])
    .map(
      s =>
        `<tr><td>${esc(fmtDate(s.collectedAt || s.requestedAt))}</td><td>${esc(s.type || s.sampleType)}</td><td>${esc(s.sampleCode || s.id)}</td><td>${esc(clinicalTerm(s.result, language, t))}</td><td>${esc(s.organism)}</td><td>${esc(s.resistance || s.amr)}</td></tr>`,
    )
    .join('')
  const therapy = (record.therapy || [])
    .map(
      x =>
        `<tr><td>${esc(x.antimicrobial || x.drug)}</td><td>${esc(x.dose)}</td><td>${esc(x.route)}</td><td>${esc(fmtDate(x.startedAt || x.startDate))}</td><td>${esc(fmtDate(x.endedAt || x.endDate))}</td></tr>`,
    )
    .join('')
  const timeline = (record.timeline || [])
    .slice()
    .sort((a, b) => new Date(a.at || a.createdAt) - new Date(b.at || b.createdAt))
    .map(
      x =>
        `<tr><td>${esc(fmtDateTime(x.at || x.createdAt))}</td><td>${esc(x.label || x.type)}</td><td>${esc(clinicalTerm(x.value || x.detail || x.notes, language, t))}</td></tr>`,
    )
    .join('')
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${L('Αναφορά επιτήρησης', 'Surveillance report')}</title><style>@page{size:A4;margin:14mm}body{font:12px Arial,sans-serif;color:#17324a}h1{font-size:21px;margin:0 0 4px}h2{font-size:14px;border-bottom:1px solid #cbd8e3;padding-bottom:5px;margin:20px 0 8px}.muted{color:#687b8d}.grid{display:grid;grid-template-columns:1fr 1fr;gap:6px 18px}.field{padding:6px 0;border-bottom:1px solid #edf1f4}.field b{display:block;font-size:10px;color:#687b8d;text-transform:uppercase;margin-bottom:2px}table{width:100%;border-collapse:collapse}th,td{text-align:left;padding:6px;border-bottom:1px solid #dfe7ed;vertical-align:top}th{font-size:10px;color:#607487;background:#f5f8fa}ul{margin:5px 0;padding-left:18px}.footer{margin-top:24px;padding-top:8px;border-top:1px solid #cbd8e3;color:#687b8d;font-size:10px}@media print{button{display:none}}</style></head><body>${isDemoReport() ? `<div style="margin:0 0 10px;padding:5px 8px;border-radius:6px;background:#fff3e0;color:#a24d0a;font-weight:700;font-size:11px;text-align:center">${L(DEMO_REPORT_MARK_EL, DEMO_REPORT_MARK_EN)}</div>` : ''}<h1>${L('Αναλυτική αναφορά επιτήρησης', 'Detailed surveillance report')}</h1><div class="muted">${L('Limoxis Observer · Κλινική επιτήρηση', 'Limoxis Observer · Clinical surveillance')}</div><h2>${L('Στοιχεία επεισοδίου', 'Episode details')}</h2><div class="grid"><div class="field"><b>${L('Ασθενής', 'Patient')}</b>${esc(record.patient || record.patientName)}</div><div class="field"><b>${L('Κωδικός ασθενούς', 'Patient code')}</b>${esc(record.patientId)}</div><div class="field"><b>${L('Τμήμα', 'Department')}</b>${esc(record.department)}</div><div class="field"><b>${L('Έναρξη επιτήρησης', 'Surveillance start')}</b>${esc(fmtDate(record.startedAt))}</div><div class="field"><b>${L('Κατάσταση', 'Status')}</b>${esc(clinicalTerm(record.status, language, t))}</div><div class="field"><b>${L('Λόγος επιτήρησης', 'Surveillance reason')}</b>${esc(record.reason)}</div></div><h2>${L('Κλινική αξιολόγηση', 'Clinical assessment')}</h2><div class="grid"><div class="field"><b>${L('Ημερομηνία αξιολόγησης', 'Assessment date')}</b>${esc(fmtDate(record.assessment?.date))}</div><div class="field"><b>${L('Κλινική ταξινόμηση', 'Clinical classification')}</b>${esc(clinicalTerm(record.assessment?.classification, language, t))}</div></div><b>${L('Σημεία / συμπτώματα', 'Signs / symptoms')}</b><ul>${rows((record.assessment?.symptoms || []).map(x => libraryLabel(x, libraries.clinicalSymptoms || [], language, t)))}</ul><b>${L('Παράγοντες κινδύνου', 'Risk factors')}</b><ul>${rows((record.assessment?.riskFactors || []).map(x => libraryLabel(x, libraries.clinicalRiskFactors || [], language, t)))}</ul><h2>${L('Μικροβιολογικά δείγματα', 'Microbiology samples')}</h2><table><thead><tr><th>${L('Ημερομηνία', 'Date')}</th><th>${L('Τύπος', 'Type')}</th><th>${L('Κωδικός', 'Code')}</th><th>${L('Αποτέλεσμα', 'Result')}</th><th>${L('Μικροοργανισμός', 'Organism')}</th><th>AMR</th></tr></thead><tbody>${samples || `<tr><td colspan="6">${L('Δεν υπάρχουν καταχωρισμένα δείγματα.', 'No samples recorded.')}</td></tr>`}</tbody></table><h2>${L('Απομόνωση', 'Isolation')}</h2><div class="grid"><div class="field"><b>${L('Κατάσταση', 'Status')}</b>${esc(record.isolation ? clinicalTerm(record.isolation.status || 'yes', language, t) : L('Δεν απαιτείται / δεν έχει καταχωριστεί', 'Not required / not recorded'))}</div><div class="field"><b>${L('Έναρξη', 'Start')}</b>${esc(fmtDate(record.isolation?.startedAt))}</div></div><h2>${L('Αντιμικροβιακή αγωγή', 'Antimicrobial therapy')}</h2><table><thead><tr><th>${L('Φάρμακο', 'Drug')}</th><th>${L('Δόση', 'Dose')}</th><th>${L('Οδός', 'Route')}</th><th>${L('Έναρξη', 'Start')}</th><th>${L('Λήξη', 'End')}</th></tr></thead><tbody>${therapy || `<tr><td colspan="5">${L('Δεν έχει καταχωριστεί αγωγή.', 'No therapy recorded.')}</td></tr>`}</tbody></table><h2>${L('Χρονολογικό ιστορικό', 'Chronological history')}</h2><table><thead><tr><th>${L('Ημερομηνία / ώρα', 'Date / time')}</th><th>${L('Ενέργεια', 'Action')}</th><th>${L('Λεπτομέρειες', 'Details')}</th></tr></thead><tbody>${timeline || `<tr><td colspan="3">${L('Δεν υπάρχουν συμβάντα.', 'No events recorded.')}</td></tr>`}</tbody></table><div class="footer">${L('Η αναφορά δημιουργήθηκε από το Limoxis Observer.', 'Report generated by Limoxis Observer.')} · ${esc(new Date().toLocaleString(language === 'el' ? 'el-GR' : 'en-GB'))}</div></body></html>`
  const win = window.open('', '_blank')
  if (!win) return false
  win.document.open()
  win.document.write(html)
  win.document.close()
  win.focus()
  setTimeout(() => win.print(), 150)
  return true
}
// Surveillance tree label: the HAI type once classified, otherwise the
// suspected source, otherwise the free-text reason. Previously showed the raw
// suspectedSource key or "—" for classified episodes.
export function episodeTypeLabel(ep, t) {
  const type = ep?.haiClassification?.type
  if (type) {
    const label = t(type)
    if (typeof label === 'string' && label !== type) return label
    const nested = t(`clinicalRecords.${type}`)
    if (typeof nested === 'string' && nested !== `clinicalRecords.${type}`) return nested
    return clinicalTerm(type, 'el', null)
  }
  if (ep?.suspectedSource) {
    const label = t(`clinicalRecords.${ep.suspectedSource}`)
    return typeof label === 'string' && label !== `clinicalRecords.${ep.suspectedSource}`
      ? label
      : ep.suspectedSource
  }
  return ep?.reason || '—'
}
export function clinicalTerm(value, language = 'el', t = null) {
  if (value == null || value === '') return '—'
  const key = String(value).trim().toUpperCase()
  const el = {
    UNDETERMINED: 'Δεν έχει ακόμη καθοριστεί',
    PENDING: 'Εκκρεμεί',
    POSITIVE: 'Θετικό',
    NEGATIVE: 'Αρνητικό',
    FEVER: 'Πυρετός',
    CHILLS: 'Ρίγος',
    RIGORS: 'Έντονο ρίγος',
    ICU_STAY: 'Νοσηλεία σε ΜΕΘ',
    ICU: 'Νοσηλεία σε ΜΕΘ',
    DEVICE: 'Παρουσία επεμβατικής συσκευής',
    RECENT_SURGERY: 'Πρόσφατη χειρουργική επέμβαση',
    IMMUNOSUPPRESSION: 'Ανοσοκαταστολή',
    ANTIBIOTIC_EXPOSURE: 'Πρόσφατη έκθεση σε αντιμικροβιακά',
    YES: 'Ναι',
    NO: 'Όχι',
    Y: 'Ναι',
    N: 'Όχι',
    P: 'Θετικό',
    R: 'Ανθεκτικό',
    S: 'Ευαίσθητο',
    I: 'Ευαίσθητο με αυξημένη έκθεση',
  }
  const en = {
    UNDETERMINED: 'Not yet determined',
    PENDING: 'Pending',
    POSITIVE: 'Positive',
    NEGATIVE: 'Negative',
    FEVER: 'Fever',
    CHILLS: 'Chills',
    RIGORS: 'Rigors',
    ICU_STAY: 'ICU stay',
    ICU: 'ICU stay',
    DEVICE: 'Invasive device present',
    RECENT_SURGERY: 'Recent surgery',
    IMMUNOSUPPRESSION: 'Immunosuppression',
    ANTIBIOTIC_EXPOSURE: 'Recent antimicrobial exposure',
    YES: 'Yes',
    NO: 'No',
    Y: 'Yes',
    N: 'No',
    P: 'Positive',
    R: 'Resistant',
    S: 'Susceptible',
    I: 'Susceptible, increased exposure',
  }
  const known = (language === 'el' ? el : en)[key]
  if (known) return known
  const translated = typeof t === 'function' ? t(String(value).trim()) : null
  if (typeof translated === 'string' && translated !== String(value).trim()) return translated
  return String(value)
    .replaceAll('_', ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/^\w/, c => c.toUpperCase())
}
// Assessment values are stored as library ids/codes; show the library label
// (Greek or English) and fall back to the clinical dictionary for legacy text values.
export function libraryLabel(value, rows = [], language = 'el', t = null) {
  const key = String(value ?? '').trim()
  const row = rows.find(item =>
    [item?.[2]?.id, item?.[2]?.code, item?.[0], item?.[1]].some(
      candidate => candidate != null && String(candidate) === key,
    ),
  )
  if (row) return language === 'el' ? row[0] || row[1] : row[1] || row[0]
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(key))
    return translate(
      'copy.clinicalRecordCopy.libraryItemNoLongerAvailable',
      language === 'el' ? 'el' : 'en',
    )
  return clinicalTerm(value, language, t)
}
export function clinicalValueLabel(value, language, t) {
  if (value === null || value === undefined || value === '') return '—'
  const labels = {
    FEVER: translate('copy.clinicalRecordCopy.fever', language === 'el' ? 'el' : 'en'),
    CHILLS: translate('copy.clinicalRecordCopy.chills', language === 'el' ? 'el' : 'en'),
    ICU_STAY: translate('copy.clinicalRecordCopy.icuStay', language === 'el' ? 'el' : 'en'),
    undetermined: ['Δεν έχει ακόμη καθοριστεί', 'Not yet determined'],
    created: ['Δημιουργήθηκε', 'Created'],
    no: ['Όχι', 'No'],
    yes: ['Ναι', 'Yes'],
    pending: ['Εκκρεμεί', 'Pending'],
    infection: ['Λοίμωξη', 'Infection'],
    colonization: ['Αποικισμός', 'Colonization'],
    no_infection: ['Δεν τεκμηριώνεται λοίμωξη', 'No evidence of infection'],
    under_investigation: ['Υπό διερεύνηση', 'Under investigation'],
    probable_infection: ['Πιθανή λοίμωξη', 'Probable infection'],
    confirmed_infection: ['Επιβεβαιωμένη λοίμωξη', 'Confirmed infection'],
  }
  const mapped = labels[String(value)]
  if (mapped) return mapped[language === 'el' ? 0 : 1]
  const translated = t(String(value))
  return translated === String(value) ? String(value).replaceAll('_', ' ') : translated
}
export function timelineLabel(type, language, t) {
  const labels = {
    created: ['Δημιουργία επιτήρησης', 'Surveillance created'],
    surveillance_start: ['Έναρξη επιτήρησης', 'Surveillance started'],
    clinical_assessment: ['Κλινική αξιολόγηση', 'Clinical assessment'],
    sample_requested: ['Αίτημα δείγματος', 'Sample requested'],
    sample_collected: ['Λήψη δείγματος', 'Sample collected'],
    sample_result: ['Αποτέλεσμα δείγματος', 'Sample result'],
    isolation_started: ['Έναρξη απομόνωσης', 'Isolation started'],
    isolation_not_required: ['Δεν απαιτείται απομόνωση', 'Isolation not required'],
    therapy_started: ['Έναρξη αντιμικροβιακής αγωγής', 'Antimicrobial therapy started'],
    reassessment: ['Επανεκτίμηση', 'Reassessment'],
    outcome: ['Έκβαση', 'Outcome'],
    surveillance_close: ['Ολοκλήρωση επιτήρησης', 'Surveillance closed'],
    surveillance_closed: ['Ολοκλήρωση επιτήρησης', 'Surveillance closed'],
  }
  return (
    labels[type]?.[language === 'el' ? 0 : 1] || t(type) || String(type || '—').replaceAll('_', ' ')
  )
}

// Final report of a completed episode: full-width summary header and one card per clinical area.
export const ISOLATION_STATUS = {
  active: 'finalReport.isolationActive',
  ended: 'finalReport.isolationEnded',
  completed: 'finalReport.isolationEnded',
}
export function termLabel(value, t, language) {
  if (!value) return '—'
  if (typeof t === 'function') {
    const translated = t(value)
    if (typeof translated === 'string' && translated !== value) return translated
    const nested = t(`clinicalRecords.${value}`)
    if (typeof nested === 'string' && nested !== `clinicalRecords.${value}`) return nested
  }
  return clinicalTerm(value, language, t)
}
// NHSN applies infant-specific (≤1 year) bloodstream criteria; offer them first
// for infants and flag an age/definition mismatch either way.
export const criteriaKeyOf = row => row?.[2]?.criteriaKey || row?.[2]?.id || null
const isNeonatalCriteria = row =>
  /neonatal/.test(String(criteriaKeyOf(row) || '')) ||
  /neonatal|infant/i.test(String(row?.[1] || ''))
// Surveillance-definition library rows carry library ids, not criteria keys, so
// the structured NHSN/ECDC checklist never opened for them. Link each library
// row to its criteria set by its standard prefix, then offer the criteria sets
// the library lacks (e.g. the infant CLABSI definition).
const CRITERIA_PREFIXES = [
  ['clabsi', /^CLABSI\b/i],
  ['cauti', /^CAUTI\b/i],
  ['vap', /^VAP\b/i],
  ['ssi', /^SSI\b/i],
]
export function withCriteriaKeys(items = [], criteriaRows = []) {
  const known = new Set(criteriaRows.map(criteriaKeyOf).filter(Boolean))
  const linked = items.map(row => {
    if (row?.[2]?.criteriaKey) return row
    const label = `${row?.[1] || ''} ${row?.[0] || ''}`.trim()
    const key = CRITERIA_PREFIXES.find(
      ([id, pattern]) =>
        known.has(id) &&
        (pattern.test(String(row?.[1] || '')) || pattern.test(String(row?.[0] || ''))),
    )?.[0]
    return key && label && !/neonatal|infant/i.test(String(row?.[1] || ''))
      ? [row[0], row[1], { ...(row[2] || {}), criteriaKey: key }]
      : row
  })
  const covered = new Set(linked.map(criteriaKeyOf).filter(Boolean))
  return [...linked, ...criteriaRows.filter(row => !covered.has(criteriaKeyOf(row)))]
}
export function orderCriteriaForAge(options = [], ageDays = null) {
  if (ageDays == null || ageDays > 365) return options
  return [...options.filter(isNeonatalCriteria), ...options.filter(row => !isNeonatalCriteria(row))]
}
export function criteriaAgeWarning(criteriaKey, ageDays = null) {
  if (ageDays == null || !criteriaKey) return null
  if (criteriaKey === 'clabsi' && ageDays <= 365) return 'useInfantDefinition'
  if (/neonatal/.test(criteriaKey) && ageDays > 365) return 'infantDefinitionOverOneYear'
  return null
}
// surveillance_outcomes.outcome check: ongoing is not a closing outcome, so it is not offered here.
export const SURVEILLANCE_OUTCOMES = ['resolved', 'discharged', 'transferred', 'deceased', 'other']
