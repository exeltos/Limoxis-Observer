// Common skin flora and culture contaminants. One positive culture of these says little
// (a single contaminated bottle), so a cluster counts them only for patients with 2+
// distinct positive samples. The same pattern lives in the SQL function
// private.detect_organism_clusters (migration 20261205200000); tests/clusterDetection.test.js pins both.
export const SKIN_FLORA_PATTERN_SOURCE = '^(coagulase[ -]negative|cons$|staphylococcus (epidermidis|haemolyticus|hominis|capitis|warneri|simulans|cohnii|xylosus|auricularis|pasteuri)|s\\. ?(epidermidis|haemolyticus|hominis|capitis)|corynebacterium(?! diphtheriae)|bacillus(?! anthracis)|micrococcus|cutibacterium|propionibacterium|viridans|streptococcus (mitis|oralis|sanguinis|salivarius|parasanguinis|gordonii))'
const SKIN_FLORA_PATTERN = new RegExp(SKIN_FLORA_PATTERN_SOURCE)

export function isSkinFloraOrganism(organism) {
  return SKIN_FLORA_PATTERN.test(String(organism || '').trim().toLowerCase())
}

export function skinFloraRuleNote(en) {
  return en ? 'Skin organism: only patients with 2+ samples are counted' : 'Μικρόβιο δέρματος: μετράνε μόνο ασθενείς με 2+ δείγματα'
}

// A contaminated culture whose «organism» is the laboratory's note, not an organism: never part of a cluster.
// Pinned to private.detect_organism_clusters (20261231220300) by tests/clusterDetection.test.js.
export const CONTAMINATION_PATTERN_SOURCE = '(επιμ[οό]λυνσ|αναπτ[υύ]χθηκαν [0-9]+ ε[ιί]δη|αν[αά]πτυξη [0-9]+ ειδ[ωώ]ν|contaminat|mixed flora|μικτ[ηή] χλωρ[ιί]δα)'
const CONTAMINATION_PATTERN = new RegExp(CONTAMINATION_PATTERN_SOURCE, 'i')
export function isContaminationNote(organism) {
  return CONTAMINATION_PATTERN.test(String(organism || '').toLocaleLowerCase('el'))
}
// Environmental samples (surfaces, water, equipment, air) are no infection.
export const ENVIRONMENTAL_SAMPLE_TYPES = Object.freeze(['surface', 'water', 'equipment', 'air', 'environment'])
