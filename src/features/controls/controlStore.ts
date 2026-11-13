import { loadSnapshot, saveSnapshot } from '../../core/data/repository'
import type { ControlAssignmentRow, ControlDefinitionRow, ControlDraftRow, ControlExecutionRow } from './controlTypes'
import { controlDefinitionRows as seedDefinitions, controlAssignmentRows as seedAssignments, controlExecutionRows as seedExecutions, controlDraftRows as seedDrafts } from './controlDemoData'

export function loadControlDefinitionsLocal():ControlDefinitionRow[]{const rows=loadSnapshot('control_local_definitions',structuredClone(seedDefinitions));return Array.isArray(rows)?rows:structuredClone(seedDefinitions)}
export function saveControlDefinitionsLocal(rows:ControlDefinitionRow[]){return saveSnapshot('control_local_definitions',rows)}

export function loadControlAssignmentsLocal():ControlAssignmentRow[]{const rows=loadSnapshot('control_local_assignments',structuredClone(seedAssignments));return Array.isArray(rows)?rows:structuredClone(seedAssignments)}
export function saveControlAssignmentsLocal(rows:ControlAssignmentRow[]){return saveSnapshot('control_local_assignments',rows)}

export function loadControlExecutionsLocal():ControlExecutionRow[]{const rows=loadSnapshot('control_local_executions',structuredClone(seedExecutions));return Array.isArray(rows)?rows:structuredClone(seedExecutions)}
export function saveControlExecutionsLocal(rows:ControlExecutionRow[]){return saveSnapshot('control_local_executions',rows)}

export function loadControlDraftsLocal():ControlDraftRow[]{const rows=loadSnapshot('control_local_drafts',structuredClone(seedDrafts));return Array.isArray(rows)?rows:structuredClone(seedDrafts)}
export function saveControlDraftsLocal(rows:ControlDraftRow[]){return saveSnapshot('control_local_drafts',rows)}
