// The organisms the reports show (owner, 7/11/2026: not every organism, only those the surveillance names):
// the WHO Bacterial Priority Pathogens List 2024 and the national surveillance of resistant organisms
// (carbapenem-resistant Enterobacterales, Acinetobacter baumannii, Pseudomonas aeruginosa, MRSA, VRE,
// Clostridioides difficile). Matched on the genus / species name, whatever the spelling of the laboratory.
const PATTERNS = [
  // Enterobacterales (WHO critical: 3rd-generation cephalosporin- and carbapenem-resistant)
  /\bescherichia\b|\be\.?\s*coli\b/i,
  /\bklebsiella\b/i,
  /\benterobacter\b/i,
  /\bserratia\b/i,
  /\bproteus\b/i,
  /\bcitrobacter\b/i,
  /\bmorganella\b/i,
  /\bprovidencia\b/i,
  /\bsalmonella\b/i,
  /\bshigella\b/i,
  // WHO critical / high
  /\bacinetobacter\b/i,
  /\bpseudomonas\s+aeruginosa\b|\bp\.?\s*aeruginosa\b/i,
  /\bstaphylococcus\s+aureus\b|\bs\.?\s*aureus\b|\bmrsa\b/i,
  /\benterococcus\s+(faecium|faecalis)\b|\bvre\b/i,
  /\bmycobacterium\s+tuberculosis\b/i,
  /\bneisseria\s+gonorrhoeae\b/i,
  // WHO medium
  /\bstreptococcus\s+(pneumoniae|pyogenes|agalactiae)\b/i,
  /\bhaemophilus\s+influenzae\b/i,
  // National surveillance
  /\bclostridi(oides|um)\s+difficile\b|\bc\.?\s*difficile\b/i,
]

export function isSurveillanceOrganism(name) {
  const text = String(name || '').trim()
  return Boolean(text) && PATTERNS.some((pattern) => pattern.test(text))
}
