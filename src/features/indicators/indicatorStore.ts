import { loadSnapshot, saveSnapshot } from '../../core/data/repository'
import { indicatorDefinitionRows, indicatorSnapshotRows } from './indicatorDemoData'
import type { IndicatorDefinitionRow, IndicatorSnapshotRow } from './indicatorTypes'

export function loadIndicatorDefinitionsLocal(): IndicatorDefinitionRow[]{const rows=loadSnapshot('indicator_local_definitions',structuredClone(indicatorDefinitionRows));return Array.isArray(rows)?rows:structuredClone(indicatorDefinitionRows)}
export function saveIndicatorDefinitionsLocal(rows: IndicatorDefinitionRow[]){return saveSnapshot('indicator_local_definitions',rows)}

export function loadIndicatorSnapshotsLocal(): IndicatorSnapshotRow[]{const rows=loadSnapshot('indicator_local_snapshots',structuredClone(indicatorSnapshotRows));return Array.isArray(rows)?rows:structuredClone(indicatorSnapshotRows)}
export function saveIndicatorSnapshotsLocal(rows: IndicatorSnapshotRow[]){return saveSnapshot('indicator_local_snapshots',rows)}
