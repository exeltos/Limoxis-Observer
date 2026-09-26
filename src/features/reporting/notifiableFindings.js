// Laboratory findings that trigger a mandatory notification to ΕΟΔΥ (National
// Public Health Organization). Each rule names the disease as it appears in the
// notifiable-diseases library, so the list stays aligned with Management.
import { currentResults, isValidatedPositive, organismsOf, specimenOf, testsForOrganism } from './labResults'

const INVASIVE = new Set(['BLOOD', 'CSF'])
const CARBAPENEM_NAME = /meropenem|imipenem|ertapenem|doripenem|μεροπενέμη|ιμιπενέμη|ερταπενέμη|δοριπενέμη/i
const CARBAPENEM_CODE = /^(ABX-)?(MEM|IPM|IMP|ETP|ERT|DOR)$/i

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
  { id: 'carbapenem_resistant_bacteraemia', organism: /klebsiella|escherichia|enterobacter|acinetobacter|pseudomonas|serratia|citrobacter|proteus|morganella/i, bloodOnly: true, carbapenemResistant: true, el: 'Βακτηριαιμία από στέλεχος ανθεκτικό στις καρβαπενέμες', en: 'Carbapenem-resistant bacteraemia' },
]

const isCarbapenem = test => CARBAPENEM_CODE.test(String(test.code || '').trim()) || CARBAPENEM_NAME.test(`${test.drug || ''} ${test.name || ''}`)
const carbapenemResistant = (tests, result) => tests.some(test => isCarbapenem(test) && String(test.sir || '').toUpperCase() === 'R')
  || /\b(CRE|CPE|CRAB|CRPA|KPC|NDM|VIM|OXA-?48)\b/i.test(`${result.resistance || ''}`)

// The notifiable rule for one organism of a result (the most specific rule
// wins: typhoid before salmonellosis, etc.).
export function notifiableRuleFor(sample, result, organism = result.organism, tests = testsForOrganism(result, organism)) {
  if (!String(organism || '').trim()) return null
  const specimen = specimenOf(sample)
  return NOTIFIABLE_RULES.find(rule => rule.organism.test(organism)
    && (!rule.invasiveOnly || INVASIVE.has(specimen))
    && (!rule.bloodOnly || specimen === 'BLOOD')
    && (!rule.carbapenemResistant || carbapenemResistant(tests, result))) || null
}

// The first result of an amendment chain, so the finding key survives amendments.
function rootResultId(sample, result) {
  const byId = new Map((sample.microbiologyResults || []).map(item => [item.id, item]))
  let current = result
  const visited = new Set()
  while (current?.amendedFrom && byId.has(current.amendedFrom) && !visited.has(current.id)) { visited.add(current.id); current = byId.get(current.amendedFrom) }
  return current?.id || 'result'
}

// One entry per validated positive patient result that matches a rule, newest first.
export function notifiableFindings(samples = [], reports = []) {
  const byKey = new Map(reports.map(report => [report.findingKey, report]))
  const findings = []
  for (const sample of samples) {
    if ((sample.subjectType || 'patient') !== 'patient') continue
    // Superseded (amended) results are skipped; an amendment keeps the
    // original result's notification key so a notified finding stays notified.
    const results = currentResults(sample)
    for (const result of results) {
      if (!isValidatedPositive(result)) continue
      const organisms = organismsOf(result)
      const seen = new Set()
      for (const organism of organisms) {
        const rule = notifiableRuleFor(sample, result, organism, testsForOrganism(result, organism, organisms.length))
        if (!rule || seen.has(rule.id)) continue
        seen.add(rule.id)
        const findingKey = `${sample.id}|${rootResultId(sample, result)}|${rule.id}`
        findings.push({ findingKey, rule, sample, result, organism, date: String(sample.collectedAt || result.resultedAt || '').slice(0, 10), report: byKey.get(findingKey) || null })
      }
    }
  }
  return findings.sort((a, b) => b.date.localeCompare(a.date))
}

export const NOTIFICATION_STATUSES = ['pending', 'notified', 'not_required']
export const notificationStatus = finding => finding.report?.status || 'pending'
