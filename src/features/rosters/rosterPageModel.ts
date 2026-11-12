// What the roster page and its parts (RosterSheet, RosterPanels) share.

// At least two people on every shift by default (owner, 8/11/2026); more on a shift is fine.
export const DEMAND = { weekday: { M: 2, I: 0, A: 2, N: 2 }, weekend: { M: 2, I: 0, A: 2, N: 2 }, overrides: {} }
export const SHIFTS = ['M', 'I', 'A', 'N']
export const LEAVES = ['L', 'S', 'H', 'U']
export const HOURS = 8
export const RULE_FIELDS = ['maxConsecutive', 'maxConsecutiveNights', 'restAfterNight', 'restAfterTwoNights', 'weeklyRestDays', 'minWeekendOff']
// A request turns into: a leave code, a wished day off, a day off that is fixed («cannot work»), or a swap.
export const REQUEST_CODE = { leave: 'L', sick: 'S', unpaid: 'U', unavailable: 'R' }
// The head is supernumerary unless set otherwise: not counted in the shifts, there only where the others are short.
export const isExtra = m => (typeof m.extra === 'boolean' ? m.extra : Boolean(m.isHead))
