// What the roster page and its parts (RosterSheet, RosterPanels) share.
import type { Dispatch, SetStateAction } from 'react'
import type { AnyRecord, Translate } from '../../types/featureTypes'
import type { RosterDay, RosterHistory, RosterRules, RosterViolation } from './rosterRules'
import type { Roster, RosterMember, RosterRequest } from './rosterService'

// At least two people on every shift by default (owner, 8/11/2026); more on a shift is fine.
export const DEMAND: Record<string, Record<string, number>> = { weekday: { M: 2, I: 0, A: 2, N: 2 }, weekend: { M: 2, I: 0, A: 2, N: 2 }, overrides: {} }
export const SHIFTS = ['M', 'I', 'A', 'N']
export const LEAVES = ['L', 'S', 'H', 'U']
export const HOURS = 8
export const RULE_FIELDS = ['maxConsecutive', 'maxConsecutiveNights', 'restAfterNight', 'restAfterTwoNights', 'weeklyRestDays', 'minWeekendOff']
// A request turns into: a leave code, a wished day off, a day off that is fixed («cannot work»), or a swap.
export const REQUEST_CODE: Record<string, string> = { leave: 'L', sick: 'S', unpaid: 'U', unavailable: 'R' }
// The head is supernumerary unless set otherwise: not counted in the shifts, there only where the others are short.
export const isExtra = (m: { extra?: unknown, isHead?: unknown }) => (typeof m.extra === 'boolean' ? m.extra : Boolean(m.isHead))

// The codes on the sheet: their short form, label and (for the shifts) name.
export type RosterCodes = Record<string, { short: string, label: string, name?: string }>
type Setter<T> = Dispatch<SetStateAction<T>>
// The small menus over the sheet and a staff member's new request.
export interface CellMenu { employeeId: string, date: string, top: number, left: number }
export interface NeedMenu { date: string, shift: string, value: string, top: number, left: number }
export interface LimitsMenu { employeeId: string, top: number, left: number }
export interface RosterAsk { kind: string, from: string, to: string, swapEmployeeId: string, swapDate: string, note: string }

// What the page hands to its parts (RosterSheet, RosterPanels): its state, texts and actions. The parts render only
// once the roster has loaded.
export interface RosterView {
  tx: Translate
  canEdit: boolean
  roster: Roster
  codeStyle: string
  CODES: RosterCodes
  REQUEST_KINDS: Record<string, string>
  REQUEST_STATUS: Record<string, [string, string]>
  RULE_TEXT: Record<string, string>
  RULE_LABELS: Record<string, string>
  days: RosterDay[]
  history: { history: RosterHistory, dates: string[] }
  dirty: boolean
  saving: boolean
  cell: CellMenu | null
  setCell: Setter<CellMenu | null>
  need: NeedMenu | null
  setNeed: Setter<NeedMenu | null>
  limits: LimitsMenu | null
  setLimits: Setter<LimitsMenu | null>
  setPanel: Setter<string>
  ask: RosterAsk
  setAsk: Setter<RosterAsk>
  dragId: string | null
  setDragId: Setter<string | null>
  newShift: { code: string, from: string, to: string }
  setNewShift: Setter<{ code: string, from: string, to: string }>
  dropId: string | null
  setDropId: Setter<string | null>
  rules: RosterRules
  violations: RosterViolation[]
  targets: Record<string, number>
  me: RosterMember | null
  update: (next: Roster) => void
  setMember: (employeeId: string, patch: AnyRecord) => void
  setDemand: (kind: string, shift: string, value: unknown) => void
  setRule: (key: string, value: unknown) => void
  addOther: (code: unknown, from: string, to: string) => void
  setOther: (code: string, patch: AnyRecord) => void
  removeOther: (code: string) => void
  setDayNeed: (date: string, shift: string, value: string | null) => void
  setCode: (employeeId: string, date: string, code: string) => void
  dropOn: (targetId: string) => void
  save: (next?: Roster, message?: string) => Promise<boolean>
  sendRequest: () => Promise<void>
  withdraw: (request: RosterRequest) => Promise<void>
  active: RosterMember[]
  inactive: RosterMember[]
  nameOf: (id: string) => string
  codeAt: (id: string, date: string) => string
  countOf: (id: string, test: (code: string) => boolean) => number
  shown: string[]
  others: AnyRecord[]
  shortOf: (code: string) => string
  labelOf: (code: string) => string
  cellClass: (code: string) => string
  fmtDay: (iso: string | null | undefined) => string
  weekdays: string[]
  hasShifts: boolean
  historyDays: RosterDay[]
  myRequests: RosterRequest[]
  limitTag: (m: RosterMember) => string
}
