import type { QualityDraft } from './qualityTypes'
// Where a corrective action came from, read from its source reference (source_id): the kind of record,
// its code as shown, and the page that opens it (null when there is none, e.g. a committee decision brought
// over without its meeting). One place for the action list, the action record, the print and the filter.
//
// The references:
//   FND-… finding · INC-… report · AUD-… audit · CTRL-…#… control execution · BND-… bundle assessment
//   TRAINING:<programme> · RISK:<assessment>:<risk> · SRV:<survey> · EQ:<equipment> · SUP:<supplier>
//   LEG:<text> · MR:<review>#<action> · DM:<department meeting>#<decision>
//   COM:<committee>:<meeting>#<topic> (a decision in the minutes) · COM-… (a committee) · DEC-… (a committee
//   decision brought over without its meeting) · QO-… (a quality objective)

export const SOURCE_KINDS: Record<string, string[]> = {
  finding: ['Απόκλιση', 'Deviation'],
  incident: ['Συμβάν', 'Incident'],
  audit: ['Επιθεώρηση', 'Audit'],
  control: ['Έλεγχος', 'Control'],
  bundle: ['Δέσμη μέτρων', 'Bundle'],
  training: ['Εκπαίδευση', 'Training'],
  risk: ['Κίνδυνος', 'Risk'],
  review: ['Ανασκόπηση διοίκησης', 'Management review'],
  meeting: ['Συνάντηση τμήματος', 'Department meeting'],
  committee: ['Επιτροπή', 'Committee'],
  objective: ['Στόχος ποιότητας', 'Quality objective'],
  survey: ['Έρευνα ικανοποίησης', 'Satisfaction survey'],
  equipment: ['Εξοπλισμός', 'Equipment'],
  supplier: ['Προμηθευτής', 'Supplier'],
  legislation: ['Νομοθεσία', 'Legislation'],
  manual: ['Χωρίς πηγή', 'No source'],
}

export const sourceKindLabel = (kind: string, language = 'el') => (SOURCE_KINDS[kind] || SOURCE_KINDS.manual)[language === 'en' ? 1 : 0]

const after = (value: string, prefix: string) => value.slice(prefix.length)
const head = (value: string) => value.split('#')[0]

// { kind, code, path } of a source reference (and of the action's own source type when there is no reference).
export function capaSourceInfo(sourceId = '', sourceType = '') {
  const id = String(sourceId || '').trim()
  if (!id) return { kind: sourceType === 'review' ? 'review' : 'manual', code: '', path: null }
  if (id.startsWith('FND-')) return { kind: 'finding', code: id, path: `/quality/findings/${id}` }
  if (id.startsWith('INC-')) return { kind: 'incident', code: id, path: `/quality/incidents/${id}` }
  if (id.startsWith('AUD-')) return { kind: 'audit', code: id, path: `/quality/audits/${id}` }
  if (id.startsWith('CTRL-')) return { kind: 'control', code: head(id), path: `/controls/${head(id)}` }
  if (id.startsWith('BND-')) return { kind: 'bundle', code: after(id, 'BND-'), path: `/prevention/bundles/${after(id, 'BND-')}` }
  if (id.startsWith('TRAINING:')) return { kind: 'training', code: after(id, 'TRAINING:'), path: `/training/${after(id, 'TRAINING:')}` }
  if (id.startsWith('RISK:')) {
    const [, code, key] = id.split(':')
    return { kind: 'risk', code: [code, key].filter(Boolean).join(' · '), path: `/quality/risks/${code}${key ? `?risk=${key}` : ''}` }
  }
  if (id.startsWith('SRV:')) return { kind: 'survey', code: after(id, 'SRV:'), path: `/quality/surveys/${after(id, 'SRV:')}` }
  if (id.startsWith('EQ:')) return { kind: 'equipment', code: after(id, 'EQ:'), path: `/quality/equipment/${after(id, 'EQ:')}` }
  if (id.startsWith('SUP:')) return { kind: 'supplier', code: after(id, 'SUP:'), path: `/quality/suppliers/${after(id, 'SUP:')}` }
  if (id.startsWith('LEG:')) return { kind: 'legislation', code: after(id, 'LEG:'), path: `/legislation/${after(id, 'LEG:')}` }
  if (id.startsWith('MR:')) return { kind: 'review', code: head(after(id, 'MR:')), path: `/quality/reviews/${head(after(id, 'MR:'))}` }
  if (id.startsWith('DM:')) return { kind: 'meeting', code: head(after(id, 'DM:')), path: `/meetings/${head(after(id, 'DM:'))}` }
  if (id.startsWith('COM:')) {
    const [committee, meeting = ''] = head(after(id, 'COM:')).split(':')
    return { kind: 'committee', code: committee, meeting, path: `/committees/${committee}${meeting ? `?minutes=${encodeURIComponent(meeting)}` : ''}` }
  }
  if (id.startsWith('COM-')) return { kind: 'committee', code: id, path: `/committees/${id}` }
  if (id.startsWith('DEC-')) return { kind: 'committee', code: '', path: null }
  if (id.startsWith('QO-')) return { kind: 'objective', code: id, path: `/quality/objectives/${id}` }
  return { kind: 'manual', code: '', path: null }
}

// The reference of a decision in a committee's minutes.
export const committeeDecisionSourceId = (committeeCode: string, meetingId: string, topicId: string) => `COM:${committeeCode}:${meetingId}#${topicId}`

// The live actions of a source: those with this exact reference, or (prefix) any of its parts («DM:<code>#»).
export function actionsOfSource<T extends QualityDraft>(capas: T[] = [], sourceId: string, { prefix = false } = {}) {
  if (!sourceId) return []
  return capas.filter(capa => capa.lifecycleStatus !== 'voided' && (prefix ? String(capa.sourceId || '').startsWith(sourceId) : capa.sourceId === sourceId))
}
