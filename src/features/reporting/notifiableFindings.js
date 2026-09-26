// Laboratory findings that trigger a mandatory notification to ΕΟΔΥ (National
// Public Health Organization). Each rule names the disease as it appears in the
// notifiable-diseases library, so the list stays aligned with Management.

const INVASIVE = new Set(['BLOOD', 'CSF'])
const CARBAPENEM = /meropenem|imipenem|ertapenem|doripenem/i
const VALIDATED = new Set(['validated', 'amended'])

export const NOTIFIABLE_RULES = [
  { id: 'meningococcal', organism: /neisseria\s+meningitidis/i, el: 'Μηνιγγιτιδοκοκκική νόσος', en: 'Meningococcal disease' },
  { id: 'tuberculosis', organism: /mycobacterium\s+(tuberculosis|bovis|africanum)|\bM\.?\s*tuberculosis complex/i, el: 'Φυματίωση', en: 'Tuberculosis' },
  { id: 'legionellosis', organism: /legionella/i, el: 'Λεγιονέλλωση', en: 'Legionnaires’ disease' },
  { id: 'typhoid', organism: /salmonella\s+(enterica\s+)?(serovar\s+)?(typhi|paratyphi)\b/i, el: 'Τυφοειδής / παρατυφοειδής πυρετός', en: 'Typhoid / paratyphoid fever' },
  { id: 'salmonellosis', organism: /salmonella/i, el: 'Σαλμονέλλωση', en: 'Salmonellosis' },
  { id: 'shigellosis', organism: /shigella/i, el: 'Σιγκέλλωση', en: 'Shigellosis' },
  { id: 'listeriosis', organism: /listeria\s+monocytogenes/i, el: 'Λιστερίωση', en: 'Listeriosis' },
  { id: 'campylobacteriosis', organism: /campylobacter/i, el: 'Καμπυλοβακτηρίωση', en: 'Campylobacteriosis' },
  { id: 'brucellosis', organism: /brucella/i, el: 'Βρουκέλλωση', en: 'Brucellosis' },
  { id: 'diphtheria', organism: /corynebacterium\s+diphtheriae/i, el: 'Διφθερίτιδα', en: 'Diphtheria' },
  { id: 'pertussis', organism: /bordetella\s+pertussis/i, el: 'Κοκκύτης', en: 'Pertussis' },
  { id: 'cholera', organism: /vibrio\s+cholerae/i, el: 'Χολέρα', en: 'Cholera' },
  { id: 'stec', organism: /\b(STEC|VTEC|EHEC)\b|escherichia\s+coli\s+O157/i, el: 'Λοίμωξη από STEC/VTEC', en: 'STEC/VTEC infection' },
  { id: 'invasive_haemophilus', organism: /haemophilus\s+influenzae/i, invasiveOnly: true, el: 'Διεισδυτική νόσος από Haemophilus influenzae', en: 'Invasive Haemophilus influenzae disease' },
  { id: 'invasive_pneumococcal', organism: /streptococcus\s+pneumoniae/i, invasiveOnly: true, el: 'Διεισδυτική πνευμονιοκοκκική νόσος', en: 'Invasive pneumococcal disease' },
  { id: 'invasive_gas', organism: /streptococcus\s+pyogenes|group\s+a\s+strep/i, invasiveOnly: true, el: 'Διεισδυτική λοίμωξη από στρεπτόκοκκο ομάδας Α', en: 'Invasive group A streptococcal infection' },
  // Carbapenem-resistant Gram-negative bacteraemia (national action plan for
  // resistant pathogens in hospitals).
  { id: 'carbapenem_resistant_bacteraemia', organism: /klebsiella|escherichia|enterobacter|acinetobacter|pseudomonas|serratia|citrobacter|proteus|morganella/i, invasiveOnly: true, carbapenemResistant: true, el: 'Βακτηριαιμία από στέλεχος ανθεκτικό στις καρβαπενέμες', en: 'Carbapenem-resistant bacteraemia' },
]

function specimenOf(sample) {
  if (sample.type === 'bloodCulture' || sample.sampleType === 'bloodCulture') return 'BLOOD'
  const text = `${sample.type || ''} ${sample.source || ''} ${sample.sourceEn || ''}`
  return /\bcsf\b|cerebrospinal|εγκεφαλονωτια|(^|[^\p{L}])ε\.?ν\.?υ\.?($|[^\p{L}])/iu.test(text) ? 'CSF' : ''
}

const carbapenemResistant = result => (result.ast || []).some(test => CARBAPENEM.test(String(test.drug || test.code || '')) && String(test.sir || '').toUpperCase() === 'R')
  || /\b(CRE|CPE|CRAB|CRPA|KPC|NDM|VIM|OXA-?48)\b/i.test(`${result.resistance || ''}`)

export function notifiableRuleFor(sample, result) {
  const organism = String(result.organism || '')
  if (!organism) return null
  const invasive = INVASIVE.has(specimenOf(sample))
  // The most specific rule wins: typhoid before salmonellosis, etc.
  return NOTIFIABLE_RULES.find(rule => rule.organism.test(organism)
    && (!rule.invasiveOnly || invasive)
    && (!rule.carbapenemResistant || carbapenemResistant(result))) || null
}

// One entry per validated positive patient result that matches a rule, newest first.
export function notifiableFindings(samples = [], reports = []) {
  const byKey = new Map(reports.map(report => [report.findingKey, report]))
  const findings = []
  for (const sample of samples) {
    if ((sample.subjectType || 'patient') !== 'patient') continue
    const results = sample.microbiologyResults?.length ? sample.microbiologyResults : [sample]
    for (const result of results) {
      if (result.result !== 'positive' || !VALIDATED.has(result.resultStatus)) continue
      const rule = notifiableRuleFor(sample, result)
      if (!rule) continue
      const findingKey = `${sample.id}|${result.id || 'result'}|${rule.id}`
      findings.push({ findingKey, rule, sample, result, date: String(sample.collectedAt || result.resultedAt || '').slice(0, 10), report: byKey.get(findingKey) || null })
    }
  }
  return findings.sort((a, b) => b.date.localeCompare(a.date))
}

export const NOTIFICATION_STATUSES = ['pending', 'notified', 'not_required']
export const notificationStatus = finding => finding.report?.status || 'pending'
