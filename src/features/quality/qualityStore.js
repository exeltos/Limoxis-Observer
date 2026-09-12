import { loadSnapshot, saveSnapshot } from '../../core/data/repository'
import { qualityIncidents, qualityFindings, qualityCapas, qualityAudits } from './qualityDemoData'

const seeds={incidents:qualityIncidents,findings:qualityFindings,capas:qualityCapas,audits:qualityAudits}
const tableFor={incidents:'quality_local_incidents',findings:'quality_local_findings',capas:'quality_local_capas',audits:'quality_local_audits'}

export function loadQualityLocal(section){
  const rows=loadSnapshot(tableFor[section],structuredClone(seeds[section]||[]))
  return Array.isArray(rows)?rows:structuredClone(seeds[section]||[])
}
export function saveQualityLocal(section,rows){
  return saveSnapshot(tableFor[section],rows)
}
