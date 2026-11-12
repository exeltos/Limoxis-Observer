import type { AnyRecord } from '../../types/featureTypes'

// The shape the register screens keep (registerCloud translates it to and from
// the database rows). Its lists are typed, so the screens read their items as
// records; every other property stays open as in the JavaScript it came from.
export interface RegisterSheetDef extends AnyRecord { rows?: AnyRecord[], measures?: AnyRecord[], groups?: AnyRecord[] }
export interface RegisterSettings extends AnyRecord { sections?: AnyRecord[], breakdowns?: string[] }
// The export handlers a tab hands to the record's header («Export ▾»).
export type ExportApi = { excel?: () => void, pdf?: () => void | Promise<void>, busy?: boolean, disabled?: boolean }
export interface Register extends AnyRecord { fields: AnyRecord[], indicators: AnyRecord[], sheet: RegisterSheetDef, settings: RegisterSettings, history?: AnyRecord[] }
