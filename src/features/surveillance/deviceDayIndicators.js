import { clinicalCases } from './clinicalDemoData'

// clinicalDemoData stores hai classification types as descriptive keys
// (bloodstreamInfection/urinaryTractInfection/ventilatorAssociatedPneumonia)
// rather than the clabsi/cauti/vap keys liraHaiMetrics.HAI_DEVICE_RULES expects.
const HAI_TYPE_TO_RULE_KEY = {
  bloodstreamInfection: 'clabsi',
  urinaryTractInfection: 'cauti',
  ventilatorAssociatedPneumonia: 'vap',
}

// NHSN neonatal CLABSI surveillance stratifies rates by birth-weight
// category rather than pooling neonates with the rest of the hospital,
// since baseline CLABSI risk varies sharply with birth weight.
export const BIRTH_WEIGHT_BANDS = [
  { id: 'le750', labelEl: '≤750 g', labelEn: '≤750 g', max: 750 },
  { id: 'bw751_1000', labelEl: '751–1000 g', labelEn: '751-1000 g', min: 751, max: 1000 },
  { id: 'bw1001_1500', labelEl: '1001–1500 g', labelEn: '1001-1500 g', min: 1001, max: 1500 },
  { id: 'bw1501_2500', labelEl: '1501–2500 g', labelEn: '1501-2500 g', min: 1501, max: 2500 },
  { id: 'gt2500', labelEl: '>2500 g', labelEn: '>2500 g', min: 2501 },
]

export function birthWeightBandId(grams) {
  const value = Number(grams)
  if (!Number.isFinite(value) || value <= 0) return null
  return BIRTH_WEIGHT_BANDS.find(band => (band.min == null || value >= band.min) && (band.max == null || value <= band.max))?.id || null
}

function canonicalDeviceType(device) {
  const text = `${device?.nameEn || device?.name || ''} ${device?.indicationEn || device?.indication || ''}`.toLowerCase()
  if (text.includes('central') && (text.includes('venous') || text.includes('line'))) return 'central line'
  if (text.includes('urinary') || text.includes('foley')) return 'urinary catheter'
  if (text.includes('ventil') || text.includes('tracheal')) return 'ventilator'
  return null
}

// Flattens the (richer) per-patient clinicalDemoData case records into the
// {devices, haiClassifications} shape liraHaiMetrics.calculateHaiRate expects,
// so device-day rates can be computed as a primary surveillance indicator
// using the same NHSN-style logic LIRA already relies on internally.
export function collectDeviceDaySources() {
  const cases = Object.values(clinicalCases)
  const devices = cases.flatMap(item => (item.devices || []).map(device => ({
    deviceType: canonicalDeviceType(device),
    insertedAt: device.insertedAt,
    removedAt: device.removedAt || null,
    department: item.department,
  })))
  const haiClassifications = cases
    .filter(item => item.haiClassification)
    .map(item => ({
      haiType: HAI_TYPE_TO_RULE_KEY[item.haiClassification.type] || item.haiClassification.type,
      criteriaMet: item.haiClassification.criteriaMet,
      classifiedAt: item.haiClassification.classifiedAt || item.startedAt,
      department: item.department,
    }))
  return { devices, haiClassifications }
}

// Same shape as collectDeviceDaySources(), but scoped to cases that carry a
// recorded birth weight and split per NHSN birth-weight band, so CLABSI
// rates in the NICU can be stratified the way NHSN requires instead of
// being pooled with the rest of the hospital's device-day sources.
export function collectNeonatalDeviceDaySourcesByBand() {
  const byBand = Object.fromEntries(BIRTH_WEIGHT_BANDS.map(band => [band.id, { devices: [], haiClassifications: [] }]))
  for (const item of Object.values(clinicalCases)) {
    if (!item.birthWeightGrams) continue
    const bandId = birthWeightBandId(item.birthWeightGrams)
    if (!bandId) continue
    for (const device of item.devices || []) {
      byBand[bandId].devices.push({ deviceType: canonicalDeviceType(device), insertedAt: device.insertedAt, removedAt: device.removedAt || null, department: item.department })
    }
    if (item.haiClassification) {
      byBand[bandId].haiClassifications.push({ haiType: HAI_TYPE_TO_RULE_KEY[item.haiClassification.type] || item.haiClassification.type, criteriaMet: item.haiClassification.criteriaMet, classifiedAt: item.haiClassification.classifiedAt || item.startedAt, department: item.department })
    }
  }
  return byBand
}
