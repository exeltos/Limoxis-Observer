// The trend of a clinical scale in words, against the previous assessment of the same scale:
// «Ανεβαίνει κατά 3 από 17/10 · χειρότερα». Which way is worse depends on the scale (a higher
// NEWS2 is worse, a lower Braden or GCS is worse); an unknown scale counts a higher score as worse.
const LOWER_IS_WORSE = new Set(['braden', 'gcs', 'pediatric-gcs'])
export const higherIsWorse = scaleKey => !LOWER_IS_WORSE.has(scaleKey)

export function scaleTrend({ item, t, fmtDate }) {
  const sk = 'episodeForms.scales.'
  if (!item?.latest) return { kind: 'none', text: '' }
  if (!item.previous || item.delta == null) return { kind: 'first', text: t(`${sk}trendFirst`) }
  const since = fmtDate(item.previous.assessed_at)
  if (item.delta === 0) return { kind: 'same', text: `${t(`${sk}trendSame`)} ${since}` }
  const up = item.delta > 0
  const worse = up === higherIsWorse(item.scale_key)
  const verb = up ? t(`${sk}trendUp`) : t(`${sk}trendDown`)
  return {
    kind: up ? 'up' : 'down',
    worse,
    text: `${verb} ${Math.abs(item.delta)} ${t(`${sk}trendSince`)} ${since} · ${worse ? t(`${sk}worse`) : t(`${sk}better`)}`,
  }
}
