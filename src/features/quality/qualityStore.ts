import { loadSnapshot, saveSnapshot } from '../../core/data/repository'
import { qualityIncidents, qualityFindings, qualityCapas, qualityAudits } from './qualityDemoData'
import type { QualityRecord } from './qualityTypes'

const seeds: Record<string, QualityRecord[]>={incidents:qualityIncidents,findings:qualityFindings,capas:qualityCapas,audits:qualityAudits}
const tableFor: Record<string, string>={incidents:'quality_local_incidents',findings:'quality_local_findings',capas:'quality_local_capas',audits:'quality_local_audits'}

export function loadQualityLocal(section: string): QualityRecord[]{
  const rows=loadSnapshot(tableFor[section],structuredClone(seeds[section]||[]))
  return Array.isArray(rows)?rows:structuredClone(seeds[section]||[])
}
export function saveQualityLocal(section: string,rows: QualityRecord[]){
  return saveSnapshot(tableFor[section],rows)
}
