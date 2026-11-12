import { loadSnapshot, saveSnapshot } from '../../core/data/repository'
import { antibioticDispensingRows as seedDispensing } from './pharmacyDemoData'
import type { AnyRecord } from '../../types/featureTypes'

export function loadAntibioticDispensingLocal(): AnyRecord[]{const rows=loadSnapshot('pharmacy_antibiotic_dispensing',structuredClone(seedDispensing));return Array.isArray(rows)?rows:structuredClone(seedDispensing)}
export function saveAntibioticDispensingLocal(rows: AnyRecord[]){return saveSnapshot('pharmacy_antibiotic_dispensing',rows)}
