// A register that has gone quiet: not archived and no entry for STALE_DAYS days
// (the Quality Center and the Registers screen count it the same way).
export const STALE_DAYS = 45

export const isStaleRegister = (register, todayIso) =>
  register.status !== 'archived' && (!register.lastEntry || (Date.parse(todayIso) - Date.parse(register.lastEntry)) / 86400000 > STALE_DAYS)
