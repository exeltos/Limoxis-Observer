import { loadSnapshot, saveSnapshot } from '../../core/data/repository'
import {
  handHygieneRows as seedHandHygiene,
  wasteRows as seedWaste,
  antisepticRows as seedAntiseptic,
  bundleRows as seedBundles,
} from './preventionDemoData'
import type { AntisepticRecord, BundleAssessment, HandHygieneSession, WasteMeasurement } from './preventionTypes'

export function loadHandHygieneLocal(): HandHygieneSession[] {
  const rows = loadSnapshot('prevention_hand_hygiene', structuredClone(seedHandHygiene))
  return Array.isArray(rows) ? rows : structuredClone(seedHandHygiene)
}
export function saveHandHygieneLocal(rows: HandHygieneSession[]) {
  return saveSnapshot('prevention_hand_hygiene', rows)
}

export function loadWasteLocal(): WasteMeasurement[] {
  const rows = loadSnapshot('prevention_waste', structuredClone(seedWaste))
  return Array.isArray(rows) ? rows : structuredClone(seedWaste)
}
export function saveWasteLocal(rows: WasteMeasurement[]) {
  return saveSnapshot('prevention_waste', rows)
}

export function loadAntisepticLocal(): AntisepticRecord[] {
  const rows = loadSnapshot('prevention_antiseptic', structuredClone(seedAntiseptic))
  return Array.isArray(rows) ? rows : structuredClone(seedAntiseptic)
}
export function saveAntisepticLocal(rows: AntisepticRecord[]) {
  return saveSnapshot('prevention_antiseptic', rows)
}

export function loadBundlesLocal(): BundleAssessment[] {
  const rows = loadSnapshot('prevention_bundles', structuredClone(seedBundles))
  return Array.isArray(rows) ? rows : structuredClone(seedBundles)
}
export function saveBundlesLocal(rows: BundleAssessment[]) {
  return saveSnapshot('prevention_bundles', rows)
}
