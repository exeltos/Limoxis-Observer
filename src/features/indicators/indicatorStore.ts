import { loadSnapshot, saveSnapshot } from '../../core/data/repository'
import { indicatorDefinitionRows, indicatorSnapshotRows } from './indicatorDemoData'

export function loadIndicatorDefinitionsLocal(){const rows=loadSnapshot('indicator_local_definitions',structuredClone(indicatorDefinitionRows));return Array.isArray(rows)?rows:structuredClone(indicatorDefinitionRows)}
export function saveIndicatorDefinitionsLocal(rows){return saveSnapshot('indicator_local_definitions',rows)}

export function loadIndicatorSnapshotsLocal(){const rows=loadSnapshot('indicator_local_snapshots',structuredClone(indicatorSnapshotRows));return Array.isArray(rows)?rows:structuredClone(indicatorSnapshotRows)}
export function saveIndicatorSnapshotsLocal(rows){return saveSnapshot('indicator_local_snapshots',rows)}
