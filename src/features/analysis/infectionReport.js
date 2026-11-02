import { loadOperationalIndicatorDefinitions } from '../indicators/indicatorCloudService'
import { loadObjectives } from '../quality/review/reviewService'
import { loadDossierIndicators, missingDataTable, platformIndicatorsTable } from '../quality/review/dossierIndicators'

// The annual infections and microbiology report: the platform's indicators of infection surveillance, multidrug-resistant
// isolations, bacteraemias, resistance, hand hygiene and care bundles and antimicrobial use, each with its value, the numerator and
// denominator it comes from and its target, and a last page of what is not recorded. (The objectives' file holds none of these.)

const keyOf = def => String(def.id || def.key || '')
const GROUPS = [
  { id: 'hai', el: 'Λοιμώξεις συνδεόμενες με τη φροντίδα', en: 'Healthcare-associated infections', match: def => def.category === 'surveillance' && !/^mdr/.test(keyOf(def)) },
  { id: 'mdr', el: 'Πολυανθεκτικά στελέχη (MDR)', en: 'Multidrug-resistant isolations', match: def => /^mdr/.test(keyOf(def)) && def.category === 'surveillance' },
  { id: 'bact', el: 'Μικροβιολογία: μικροβιαιμίες', en: 'Microbiology: bacteraemias', match: def => /^(bacteremia|mdro-bsi)/.test(keyOf(def)) && def.category === 'laboratory' },
  { id: 'amr', el: 'Μικροβιολογία: αντοχή στα αντιβιοτικά', en: 'Microbiology: antibiotic resistance', match: def => /^amr-/.test(keyOf(def)) },
  { id: 'prevention', el: 'Πρόληψη: υγιεινή χεριών και δέσμες μέτρων', en: 'Prevention: hand hygiene and care bundles', match: def => def.category === 'prevention' },
  { id: 'antimicrobials', el: 'Αντιμικροβιακά', en: 'Antimicrobials', match: def => def.category === 'pharmacy' },
]
export const infectionDefinitions = definitions => (definitions || []).filter(def => GROUPS.some(group => group.match(def)))

export async function loadInfectionReportRows(organizationId, year) {
  const definitions = infectionDefinitions(await loadOperationalIndicatorDefinitions(organizationId).catch(() => []))
  const [rows, objectives] = await Promise.all([loadDossierIndicators(organizationId, year, definitions), loadObjectives(organizationId).catch(() => [])])
  // The hospital's own objective of the year, where it has one, is the target of the indicator it is measured by.
  return { rows, objectives: (objectives || []).filter(objective => Number(objective.year) === Number(year)) }
}

export function infectionReportDocument({ rows, objectives = [], year, language }) {
  const en = language === 'en'
  const sections = GROUPS.map(group => ({ group, list: rows.filter(row => group.match(row.def)) })).filter(({ list }) => list.length)
    .map(({ group, list }) => ({ title: en ? group.en : group.el, table: platformIndicatorsTable(list, objectives, language) }))
  const missing = missingDataTable({ indicatorRows: rows, registerRows: [], objectives: [] }, language)
  const withValue = rows.filter(row => row.value != null).length
  return {
    language,
    kind: en ? 'Infections report' : 'Αναφορά λοιμώξεων',
    code: String(year),
    title: en ? `Infections and microbiology ${year}` : `Λοιμώξεις και μικροβιολογία ${year}`,
    subtitle: en ? 'Infection surveillance, multidrug-resistant isolations, bacteraemias, antibiotic resistance, hand hygiene and care bundles and antimicrobial use for the year so far, with the figures each is computed from.' : 'Επιτήρηση λοιμώξεων, πολυανθεκτικά στελέχη, μικροβιαιμίες, αντοχή στα αντιβιοτικά, υγιεινή χεριών και δέσμες μέτρων και χρήση αντιμικροβιακών για το έτος έως σήμερα, με τα στοιχεία από τα οποία υπολογίζεται κάθε δείκτης.',
    meta: [[en ? 'Indicators' : 'Δείκτες', String(rows.length)], [en ? 'With a value' : 'Με τιμή', String(withValue)], [en ? 'Without a value' : 'Χωρίς τιμή', String(rows.length - withValue)]],
    sections: [
      ...sections,
      ...(missing ? [{ title: en ? 'Missing data' : 'Δεδομένα που λείπουν', pageBreak: true, text: en ? 'What the platform does not record, and the indicators it leaves without a value.' : 'Τι δεν καταγράφεται στην πλατφόρμα και ποιους δείκτες αφήνει χωρίς τιμή.', table: missing }] : []),
    ],
    signatures: [en ? 'Prepared by' : 'Συντάχθηκε από', en ? 'Infection control' : 'Επιτροπή Λοιμώξεων'],
    filename: `${en ? 'infections-report' : 'anafora-loimoxeon'}-${year}`,
  }
}
