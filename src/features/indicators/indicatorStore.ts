import { loadSnapshot, saveSnapshot } from '../../core/data/repository'
import { indicatorDefinitionRows, indicatorSnapshotRows } from './indicatorDemoData'
import type { AnyRecord } from '../../types/featureTypes'

export function loadIndicatorDefinitionsLocal(): AnyRecord[]{const rows=loadSnapshot('indicator_local_definitions',structuredClone(indicatorDefinitionRows));return Array.isArray(rows)?rows:structuredClone(indicatorDefinitionRows)}
export function saveIndicatorDefinitionsLocal(rows: AnyRecord[]){return saveSnapshot('indicator_local_definitions',rows)}

export function loadIndicatorSnapshotsLocal(): AnyRecord[]{const rows=loadSnapshot('indicator_local_snapshots',structuredClone(indicatorSnapshotRows));return Array.isArray(rows)?rows:structuredClone(indicatorSnapshotRows)}
export function saveIndicatorSnapshotsLocal(rows: AnyRecord[]){return saveSnapshot('indicator_local_snapshots',rows)}
