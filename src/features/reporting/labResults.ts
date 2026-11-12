// Shared reading of laboratory samples for reporting: current (not superseded)
// results, specimen class, organisms of polymicrobial results and the
// susceptibility tests that belong to each organism.

import type { AnyRecord } from '../../types/featureTypes'

const VALIDATED = new Set(['validated', 'amended'])

// A result that a later amendment replaced is no longer current.
export function currentResults(sample: AnyRecord = {}): AnyRecord[] {
  const results = sample.microbiologyResults?.length ? sample.microbiologyResults : (sample.result || sample.resultStatus ? [sample] : [])
  const superseded = new Set(results.map((result: AnyRecord) => result.amendedFrom).filter(Boolean))
  return results.filter((result: AnyRecord) => !result.id || !superseded.has(result.id))
}

export const isValidatedPositive = (result: AnyRecord) => result.result === 'positive' && VALIDATED.has(result.resultStatus)

// BLOOD for blood cultures; CSF when the type or source names cerebrospinal fluid.
export function specimenOf(sample: AnyRecord = {}) {
  if (sample.type === 'bloodCulture' || sample.sampleType === 'bloodCulture') return 'BLOOD'
  const text = `${sample.type || ''} ${sample.source || ''} ${sample.sourceEn || ''}`
  return /\bcsf\b|cerebrospinal|εγκεφαλονωτια|(^|[^\p{L}])ε\.?ν\.?υ\.?($|[^\p{L}])/iu.test(text) ? 'CSF' : ''
}

// The result editor stores several organisms as a comma-separated list.
export function organismsOf(result: AnyRecord = {}) {
  return String(result.organism || '').split(/\s*[,;+]\s*|\s+\/\s+/).map(name => name.trim()).filter(Boolean)
}

const sameOrganism = (a: unknown, b: unknown) => { const x = String(a || '').toLowerCase().trim(), y = String(b || '').toLowerCase().trim(); return Boolean(x && y) && (x.includes(y) || y.includes(x)) }

// Tests recorded for this organism. A test without an organism belongs to the
// result's only organism; in a polymicrobial result it cannot be attributed.
export function testsForOrganism(result: AnyRecord = {}, organism?: string, organismCount = organismsOf(result).length): AnyRecord[] {
  return (result.ast || []).filter((test: AnyRecord) => test.organism ? sameOrganism(test.organism, organism) : organismCount <= 1)
}
