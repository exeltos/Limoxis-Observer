// WHO AWaRe (Access/Watch/Reserve) antimicrobial classification, matched by
// English antibiotic name against the canonical antimicrobial library used
// across Management/Pharmacy (src/features/management/managementData.js
// `antibiotics`) and the Pharmacy consumption demo data
// (src/features/pharmacy/pharmacyDemoData.js `antibioticLibrary`).
// Source: WHO 2021 AWaRe classification database.
export const WHO_AWARE_CATEGORIES = Object.freeze(['access', 'watch', 'reserve'])

const CATEGORY_BY_ANTIBIOTIC = {
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

function normalize(name) {
  return String(name || '').trim().toLowerCase()
}

export function awareCategoryFor(antibioticName) {
  return CATEGORY_BY_ANTIBIOTIC[normalize(antibioticName)] || null
}

const CATEGORY_LABELS = {
  access: ['Access', 'Access'],
  watch: ['Watch', 'Watch'],
  reserve: ['Reserve', 'Reserve'],
}

export function awareCategoryLabel(category, language = 'el') {
  return CATEGORY_LABELS[category]?.[language === 'en' ? 1 : 0] || '—'
}
