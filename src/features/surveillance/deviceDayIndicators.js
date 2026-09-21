import { clinicalCases } from './clinicalDemoData'

// clinicalDemoData stores hai classification types as descriptive keys
// (bloodstreamInfection/urinaryTractInfection/ventilatorAssociatedPneumonia)
// rather than the clabsi/cauti/vap keys liraHaiMetrics.HAI_DEVICE_RULES expects.
const HAI_TYPE_TO_RULE_KEY = {
  bloodstreamInfection: 'clabsi',
  urinaryTractInfection: 'cauti',
  ventilatorAssociatedPneumonia: 'vap',
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
