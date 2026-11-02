// The change of a key figure against the previous period, for KpiCard's `delta`:
// rates in percentage points (`points`), totals by their relative change (`percent`),
// better or worse by the direction that is good for it (`lowerIsBetter`).
export function kpiDelta(now, before, { lowerIsBetter = false, points = false, percent = false, language = 'el', title } = {}) {
  if (now == null || before == null) return null
  const en = language === 'en'
  const diff = Math.round((now - before) * 10) / 10
  const amount = percent ? (before ? Math.round((diff / before) * 1000) / 10 : null) : diff
  if (amount == null) return null
  const good = diff === 0 ? null : lowerIsBetter ? diff < 0 : diff > 0
  const number = new Intl.NumberFormat(en ? 'en-GB' : 'el-GR', { maximumFractionDigits: 1 }).format(amount)
  const unit = percent ? '%' : points ? (en ? ' pts' : ' μον.') : ''
  const word = good == null ? (en ? 'unchanged' : 'σταθερό') : good ? (en ? 'better' : 'βελτίωση') : (en ? 'worse' : 'επιδείνωση')
  return { text: `${amount > 0 ? '+' : ''}${number}${unit} ${word}`, trend: diff > 0 ? 'up' : diff < 0 ? 'down' : 'flat', good, title: title || (en ? 'Against the month before' : 'Έναντι του προηγούμενου μήνα') }
}
