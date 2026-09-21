import { supabase } from '../../core/supabase/client'
import { isDemoDataEnvironment } from '../../core/data/dataEnvironment'
import { laboratorySamples } from '../laboratory/laboratoryDemoData'
import { detectOrganismClusters } from './clusterDetection'

export const CLUSTER_WINDOW_DAYS = 14
export const CLUSTER_THRESHOLD = 3

function demoClusterRecords() {
  return laboratorySamples
    .filter(x => x.result === 'positive' && ['validated', 'amended'].includes(x.resultStatus) && x.organism)
    .map(x => ({ organism: x.organism.trim(), department: x.department, resistance: x.resistance || null, date: String(x.resultedAt || '').slice(0, 10) }))
    .filter(x => x.date)
}

export function collectDemoOrganismClusters({ windowDays = CLUSTER_WINDOW_DAYS, threshold = CLUSTER_THRESHOLD } = {}) {
  return detectOrganismClusters(demoClusterRecords(), { windowDays, threshold })
}

function mapCloudCluster(row) {
  return {
    department: row.department_name,
    organism: row.organism,
    count: Number(row.case_count),
    windowDays: CLUSTER_WINDOW_DAYS,
    firstDate: row.first_event,
    lastDate: row.last_event,
    resistanceLabels: row.resistance_class ? [row.resistance_class] : [],
    lastEventDate: row.last_event,
  }
}

export async function loadActiveClustersAsync(organizationId, { windowDays = CLUSTER_WINDOW_DAYS, threshold = CLUSTER_THRESHOLD } = {}) {
  if (isDemoDataEnvironment()) return collectDemoOrganismClusters({ windowDays, threshold })
  if (!supabase || !organizationId) return []
  const { data, error } = await supabase.rpc('get_organism_clusters', { p_organization_id: organizationId, p_window_days: windowDays, p_threshold: threshold })
  if (error) throw error
  return (data || []).map(mapCloudCluster)
}
