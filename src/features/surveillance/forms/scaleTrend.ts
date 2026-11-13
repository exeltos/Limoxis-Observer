// The trend of a clinical scale in words, against the previous assessment of the same scale:
// «Ανεβαίνει κατά 3 από 17/10 · χειρότερα». Which way is worse depends on the scale (a higher
// NEWS2 is worse, a lower Braden or GCS is worse); an unknown scale counts a higher score as worse.
const LOWER_IS_WORSE = new Set<string | null | undefined>(['braden', 'gcs', 'pediatric-gcs'])
export const higherIsWorse = (scaleKey: string | null | undefined) => !LOWER_IS_WORSE.has(scaleKey)

// A scale of the patient with its latest and previous assessment (the scales panel's context).
export interface ScaleTrendItem {
  scale_key?: string | null
  latest?: unknown
  previous?: { assessed_at?: string | null } | null
  delta?: number | null
}
interface ScaleTrendOptions {
  item: ScaleTrendItem | null | undefined
  t: (key: string) => string
  fmtDate: (value: unknown) => string
}
export function scaleTrend({ item, t, fmtDate }: ScaleTrendOptions) {
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
