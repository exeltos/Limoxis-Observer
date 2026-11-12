// The clinical protocols a surveillance episode can start. Data, not screens:
// a new protocol is a new entry here (key, steps, timing) plus its strings in
// the `sepsis` namespace of stringsEl / stringsEn. The database stores only the
// key (clinical_protocol_runs.protocol_key) and the step keys.
//
// Sources: Surviving Sepsis Campaign Hour-1 bundle (Levy et al., 2018) and the
// SSC International Guidelines 2021 (Evans et al.); definitions Sepsis-3
// (Singer et al., 2016). See docs/SEPSIS_STEWARDSHIP.md.

// Minutes from the recognition time within which a step counts as on time.
export const HOUR_ONE_MINUTES = 60

// kind: how the step's value is entered. 'number' keeps a numeric reading
// (lactate mmol/L), 'text' a short free text (sample code, agent and dose).
// canSkip: the step may be recorded as «not indicated» with a reason.
// beforeStep: the step should be done before that one (cultures before the antibiotic).
// followUp: shown only when `when(run)` holds, with its own window in minutes.
const LACTATE = { key: 'lactate', icon: 'lactate', kind: 'number', unit: 'mmol/L', canSkip: false }
const CULTURES = { key: 'blood_cultures', icon: 'cultures', kind: 'text', canSkip: false, beforeStep: 'antibiotic' }
const ANTIBIOTIC = { key: 'antibiotic', icon: 'antibiotic', kind: 'text', canSkip: false, linksTherapy: true }
const FLUIDS = { key: 'fluids', icon: 'fluids', kind: 'text', canSkip: true, mlPerKg: 30 }
const VASOPRESSOR = { key: 'vasopressor', icon: 'vasopressor', kind: 'text', canSkip: true }
const REPEAT_LACTATE = {
  key: 'lactate_repeat',
  icon: 'lactate',
  kind: 'number',
  unit: 'mmol/L',
  canSkip: true,
  followUp: true,
  windowMinutes: [120, 240],
  when: run => Number(String(stepOf(run, 'lactate')?.value || '').replace(',', '.')) > 2,
}

export const CLINICAL_PROTOCOLS = Object.freeze([
  {
    key: 'sepsis_hour1',
    family: 'sepsis',
    version: 'SSC-2018/2021',
    steps: [LACTATE, CULTURES, ANTIBIOTIC, FLUIDS, VASOPRESSOR, REPEAT_LACTATE],
  },
  {
    // Variant of the bundle for suspected septic shock: the same steps, with the
    // vasopressor (MAP ≥ 65 mmHg) and the fluids brought forward and emphasised.
    key: 'septic_shock',
    family: 'sepsis',
    version: 'SSC-2018/2021',
    emphasis: ['vasopressor', 'fluids'],
    steps: [LACTATE, CULTURES, ANTIBIOTIC, { ...VASOPRESSOR, emphasis: true }, { ...FLUIDS, emphasis: true }, REPEAT_LACTATE],
  },
])

export const protocolByKey = key => CLINICAL_PROTOCOLS.find(item => item.key === key) || null

export function stepOf(run, key) {
  return (run?.steps || []).find(step => step.key === key) || null
}

// The steps a run shows now: the protocol's steps, without the follow-ups whose
// condition does not hold yet.
export function visibleSteps(run) {
  const protocol = protocolByKey(run?.protocolKey)
  if (!protocol) return []
  return protocol.steps.filter(step => !step.followUp || step.when?.(run) || stepOf(run, step.key))
}

// The steps that count for completion: every visible main step done or
// recorded «not indicated».
export function pendingSteps(run) {
  return visibleSteps(run).filter(step => !step.followUp && !['done', 'not_indicated'].includes(stepOf(run, step.key)?.status))
}
