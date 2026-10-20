// Laboratory findings that trigger a mandatory notification to ΕΟΔΥ (National
// Public Health Organization). Each rule's id is the id of its disease in the
// official ΕΟΔΥ catalogue (eodyCatalogue.js, 57 diseases): the name and the
// deadline of a finding come from there. Two kinds of rule sit beside it:
// invasive isolates of the three meningitis organisms (the catalogue lists
// «Μηνιγγίτιδα», which applies when the specimen is CSF) and the national
// action plan for resistant pathogens (nationalPlan, not in the catalogue).
import { currentResults, isValidatedPositive, organismsOf, specimenOf, testsForOrganism } from './labResults'
import { eodyEntry } from './eodyCatalogue'

const INVASIVE = new Set(['BLOOD', 'CSF'])
const CARBAPENEM_NAME = /meropenem|imipenem|ertapenem|doripenem|μεροπενέμη|ιμιπενέμη|ερταπενέμη|δοριπενέμη/i
const CARBAPENEM_CODE = /^(ABX-)?(MEM|IPM|IMP|ETP|ERT|DOR)$/i

// Catalogue rules: { id, organism }; the labels and the deadline are the catalogue's.
// Order matters: the most specific rule wins (typhoid before salmonellosis, etc.).
const CATALOGUE_RULES = [
  { id: 'meningococcal', organism: /neisseria\s+meningitidis/i },
  { id: 'gonorrhoea', organism: /neisseria\s+gonorrhoeae/i },
  { id: 'tuberculosis', organism: /mycobacterium\s+(tuberculosis|bovis|africanum)|\bM\.?\s*tuberculosis complex/i },
  { id: 'legionellosis', organism: /legionella/i },
  { id: 'typhoid', organism: /salmonella\s+(enterica\s+)?(serovar\s+)?(typhi|paratyphi)\b/i },
  { id: 'salmonellosis', organism: /salmonella/i },
  { id: 'shigellosis', organism: /shigella/i },
  { id: 'listeriosis', organism: /listeria\s+monocytogenes/i },
  { id: 'campylobacteriosis', organism: /campylobacter/i },
  { id: 'brucellosis', organism: /brucella/i },
  { id: 'diphtheria', organism: /corynebacterium\s+diphtheriae/i },
  { id: 'pertussis', organism: /bordetella\s+pertussis/i },
  { id: 'cholera', organism: /vibrio\s+cholerae/i },
  { id: 'stec', organism: /\b(STEC|VTEC|EHEC)\b|escherichia\s+coli\s+O157/i },
  { id: 'anthrax', organism: /bacillus\s+anthracis/i },
  { id: 'tularaemia', organism: /francisella\s+tularensis/i },
  { id: 'q_fever', organism: /coxiella\s+burnetii/i },
  { id: 'chlamydia', organism: /chlamydia\s+trachomatis/i },
  { id: 'syphilis', organism: /treponema\s+pallidum/i },
  { id: 'trichinellosis', organism: /trichinella/i },
  { id: 'plague', organism: /yersinia\s+pestis/i },
  { id: 'lyme_tickborne', organism: /borrelia\s+(burgdorferi|afzelii|garinii|spielmanii)|rickettsia|anaplasma|ehrlichia/i },
  { id: 'leptospirosis', organism: /leptospira/i },
  { id: 'leishmaniasis', organism: /leishmania/i },
  { id: 'malaria', organism: /plasmodium/i },
  { id: 'echinococcosis', organism: /echinococcus/i },
  { id: 'melioidosis_glanders', organism: /burkholderia\s+(pseudomallei|mallei)/i },
].map(rule => {
  const entry = eodyEntry(rule.id)
  return { ...rule, catalogueId: entry.id, el: entry.el, en: entry.en, deadline: entry.deadline }
})

const NOTIFIABLE_RULES = [
  ...CATALOGUE_RULES,
  // Invasive isolates: in CSF they are meningitis (catalogue no. 36); a blood isolate has no entry of its own.
  { id: 'invasive_haemophilus', organism: /haemophilus\s+influenzae/i, invasiveOnly: true, csfCatalogueId: 'meningitis', el: 'Διεισδυτική νόσος από Haemophilus influenzae', en: 'Invasive Haemophilus influenzae disease' },
  { id: 'invasive_pneumococcal', organism: /streptococcus\s+pneumoniae/i, invasiveOnly: true, csfCatalogueId: 'meningitis', el: 'Διεισδυτική πνευμονιοκοκκική νόσος', en: 'Invasive pneumococcal disease' },
  { id: 'invasive_gas', organism: /streptococcus\s+pyogenes|group\s+a\s+strep/i, invasiveOnly: true, el: 'Διεισδυτική λοίμωξη από στρεπτόκοκκο ομάδας Α', en: 'Invasive group A streptococcal infection' },
  // Carbapenem-resistant Gram-negative bacteraemia (national action plan for
  // resistant pathogens in hospitals): not one of the 57 catalogue diseases.
  { id: 'carbapenem_resistant_bacteraemia', organism: /klebsiella|escherichia|enterobacter|acinetobacter|pseudomonas|serratia|citrobacter|proteus|morganella/i, bloodOnly: true, carbapenemResistant: true, nationalPlan: true, el: 'Βακτηριαιμία από στέλεχος ανθεκτικό στις καρβαπενέμες', en: 'Carbapenem-resistant bacteraemia' },
]

export const NOTIFIABLE_RULE_LIST = Object.freeze(NOTIFIABLE_RULES)

// The catalogue entry whose deadline applies to a finding of this rule; null for the national plan
// and for an invasive isolate outside CSF (it has no entry of its own).
export const catalogueEntryFor = (rule, specimen) => eodyEntry(rule.catalogueId || (specimen === 'CSF' && rule.csfCatalogueId) || '')

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
// Each carries its catalogue entry (the deadline) or null for the national plan.
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
        findings.push({ findingKey, rule, entry: catalogueEntryFor(rule, specimenOf(sample)), sample, result, organism, date: String(sample.collectedAt || result.resultedAt || '').slice(0, 10), report: byKey.get(findingKey) || null })
      }
    }
  }
  return findings.sort((a, b) => b.date.localeCompare(a.date))
}

export const notificationStatus = finding => finding.report?.status || 'pending'
