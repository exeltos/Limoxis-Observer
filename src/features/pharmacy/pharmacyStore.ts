import { loadSnapshot, saveSnapshot } from '../../core/data/repository'
import { antibioticDispensingRows as seedDispensing } from './pharmacyDemoData'

export function loadAntibioticDispensingLocal(){const rows=loadSnapshot('pharmacy_antibiotic_dispensing',structuredClone(seedDispensing));return Array.isArray(rows)?rows:structuredClone(seedDispensing)}
export function saveAntibioticDispensingLocal(rows){return saveSnapshot('pharmacy_antibiotic_dispensing',rows)}
