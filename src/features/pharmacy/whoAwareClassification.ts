// WHO AWaRe (Access/Watch/Reserve) antimicrobial classification, matched by
// English antibiotic name against the canonical antimicrobial library used
// across Management/Pharmacy (src/features/management/managementData.js
// `antibiotics`) and the Pharmacy consumption demo data
// (src/features/pharmacy/pharmacyDemoData.js `antibioticLibrary`).
// Source: WHO 2021 AWaRe classification database.

const CATEGORY_BY_ANTIBIOTIC: Record<string, string> = {
  amoxicillin: 'access',
  'amoxicillin/clavulanic acid': 'access',
  ampicillin: 'access',
  cefazolin: 'access',
  oxacillin: 'access',
  gentamicin: 'access',
  cefuroxime: 'watch',
  ceftriaxone: 'watch',
  cefotaxime: 'watch',
  ceftazidime: 'watch',
  cefepime: 'watch',
  'piperacillin/tazobactam': 'watch',
  ertapenem: 'watch',
  imipenem: 'watch',
  meropenem: 'watch',
  aztreonam: 'watch',
  amikacin: 'watch',
  ciprofloxacin: 'watch',
  levofloxacin: 'watch',
  vancomycin: 'watch',
  teicoplanin: 'watch',
  linezolid: 'reserve',
  daptomycin: 'reserve',
  colistin: 'reserve',
  tigecycline: 'reserve',
  'ceftazidime/avibactam': 'reserve',
  'ceftolozane/tazobactam': 'reserve',
}

function normalize(name: unknown) {
  return String(name || '').trim().toLowerCase()
}

export function awareCategoryFor(antibioticName: unknown): string | null {
  return CATEGORY_BY_ANTIBIOTIC[normalize(antibioticName)] || null
}

const CATEGORY_LABELS: Record<string, [string, string]> = {
  access: ['Πρόσβαση', 'Access'],
  watch: ['Επιτήρηση', 'Watch'],
  reserve: ['Εφεδρικά', 'Reserve'],
}

// The WHO's own (English) name of the category, for the tooltip of the Greek label.
export const awareCategoryWhoName = (category: string | null | undefined) => CATEGORY_LABELS[category || '']?.[1] || ''

export function awareCategoryLabel(category: string | null | undefined, language = 'el') {
  return CATEGORY_LABELS[category || '']?.[language === 'en' ? 1 : 0] || '—'
}
