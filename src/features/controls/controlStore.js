import { loadSnapshot, saveSnapshot } from '../../core/data/repository'
import { controlDefinitionRows as seedDefinitions, controlAssignmentRows as seedAssignments, controlExecutionRows as seedExecutions, controlDraftRows as seedDrafts } from './controlDemoData'

export function loadControlDefinitionsLocal(){const rows=loadSnapshot('control_local_definitions',structuredClone(seedDefinitions));return Array.isArray(rows)?rows:structuredClone(seedDefinitions)}
export function saveControlDefinitionsLocal(rows){return saveSnapshot('control_local_definitions',rows)}

export function loadControlAssignmentsLocal(){const rows=loadSnapshot('control_local_assignments',structuredClone(seedAssignments));return Array.isArray(rows)?rows:structuredClone(seedAssignments)}
export function saveControlAssignmentsLocal(rows){return saveSnapshot('control_local_assignments',rows)}

export function loadControlExecutionsLocal(){const rows=loadSnapshot('control_local_executions',structuredClone(seedExecutions));return Array.isArray(rows)?rows:structuredClone(seedExecutions)}
export function saveControlExecutionsLocal(rows){return saveSnapshot('control_local_executions',rows)}

export function loadControlDraftsLocal(){const rows=loadSnapshot('control_local_drafts',structuredClone(seedDrafts));return Array.isArray(rows)?rows:structuredClone(seedDrafts)}
export function saveControlDraftsLocal(rows){return saveSnapshot('control_local_drafts',rows)}
