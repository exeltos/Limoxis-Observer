import type { AnyRecord } from '../../types/featureTypes'

// The shapes the Controls screens keep (mapDefinition in controlCloudService).
// The lists are typed, so the screens read their items as records; every other
// property stays open as in the JavaScript it came from.

// One department's assignment of a control: its own schedule and limits, its
// recent executions (history), the counts (summary) and the current period.
export interface ControlAssignment extends AnyRecord { history: AnyRecord[] }

// A control with its departments and their assignments, by department name.
export interface ControlRecord extends AnyRecord { departments: string[], assignments: Record<string, ControlAssignment> }

// A row of the Controls list: the control and the departments the filters leave.
export interface ControlRow extends AnyRecord { item: ControlRecord, departments: string[] }
