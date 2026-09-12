import { loadSnapshot, saveSnapshot } from '../../core/data/repository'
import { handHygieneRows as seedHandHygiene, wasteRows as seedWaste, antisepticRows as seedAntiseptic, bundleRows as seedBundles } from './preventionDemoData'

export function loadHandHygieneLocal(){const rows=loadSnapshot('prevention_hand_hygiene',structuredClone(seedHandHygiene));return Array.isArray(rows)?rows:structuredClone(seedHandHygiene)}
export function saveHandHygieneLocal(rows){return saveSnapshot('prevention_hand_hygiene',rows)}

export function loadWasteLocal(){const rows=loadSnapshot('prevention_waste',structuredClone(seedWaste));return Array.isArray(rows)?rows:structuredClone(seedWaste)}
export function saveWasteLocal(rows){return saveSnapshot('prevention_waste',rows)}

export function loadAntisepticLocal(){const rows=loadSnapshot('prevention_antiseptic',structuredClone(seedAntiseptic));return Array.isArray(rows)?rows:structuredClone(seedAntiseptic)}
export function saveAntisepticLocal(rows){return saveSnapshot('prevention_antiseptic',rows)}

export function loadBundlesLocal(){const rows=loadSnapshot('prevention_bundles',structuredClone(seedBundles));return Array.isArray(rows)?rows:structuredClone(seedBundles)}
export function saveBundlesLocal(rows){return saveSnapshot('prevention_bundles',rows)}
