import { loadSnapshot, saveSnapshot } from '../../core/data/repository'
import { antibioticDispensingRows as seedDispensing } from './pharmacyDemoData'
import type { DispensingRecord } from './pharmacyTypes'

export function loadAntibioticDispensingLocal(): DispensingRecord[]{const rows=loadSnapshot('pharmacy_antibiotic_dispensing',structuredClone(seedDispensing));return Array.isArray(rows)?rows:structuredClone(seedDispensing)}
export function saveAntibioticDispensingLocal(rows: DispensingRecord[]){return saveSnapshot('pharmacy_antibiotic_dispensing',rows)}
