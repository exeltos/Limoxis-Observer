import { emptyInPreview } from '../../core/preview/emptyPreview'
import { surveillanceDemoData } from './surveillanceDemoData'
import { shiftDemoDatesInPlace } from '../../core/data/demoClock'
import { addDays } from '../../core/data/demoSeed'
import {
  SAMPLE_SITES,
  deviceFor,
  haiTextFor,
  historyCases,
  needsIsolation,
  susceptibilitySummary,
} from './demoInfectionHistory'
import { clinicalCases } from './clinicalDemoCases'

export { clinicalCases }

// The year's other episodes (demoInfectionHistory.js) as full records: assessment,
// HAI classification, device, culture, treatment with its administrations,
// precautions, reassessment and outcome.
const ASSESSORS = ['Α. Νικολάου', 'Δ. Παπαδάκη', 'Ε. Παπαδοπούλου']
const OUTCOME_NOTES = {
  resolved: ['Ολοκλήρωση αγωγής με κλινική ίαση.', 'Treatment completed, clinically cured.'],
  discharged: ['Έξοδος με από του στόματος αγωγή.', 'Discharged on oral treatment.'],
  transferred: [
    'Μεταφορά σε άλλο νοσοκομείο για συνέχιση νοσηλείας.',
    'Transferred to another hospital.',
  ],
  deceased: ['Κατέληξε παρά την αγωγή.', 'Died despite treatment.'],
}
const LAST_DOSE_DAY = '2026-08-28'
for (const item of historyCases) {
  const done = item.status === 'completed'
  const number = item.id.slice(-3)
  const assessor = ASSESSORS[Number(number) % ASSESSORS.length]
  const [deviceName, deviceNameEn] = deviceFor(item.device) || []
  const [sampleType, , , site, siteEn] = SAMPLE_SITES[item.site]
  const [summary, summaryEn, symptoms, symptomsEn] = haiTextFor(item.hai, item.organism)
  const [antimicrobial, dose, route, days, approvalStatus] = item.therapy
  const resultDay = addDays(item.startedAt, 1)
  const plannedEnd = addDays(resultDay, days - 1)
  const lastDose = done ? plannedEnd : LAST_DOSE_DAY
  const therapyId = `TX-${number}H`
  const administrations = []
  for (let day = resultDay; day <= lastDose; day = addDays(day, 1)) {
    const withheld = administrations.length === 2 && Number(number) % 4 === 0
    administrations.unshift({
      id: `ADM-${number}H-${administrations.length + 1}`,
      therapyId,
      administeredAt: `${day}T09:00:00`,
      dose,
      route,
      status: withheld ? 'withheld' : 'administered',
      withheldReason: withheld ? 'Αναμονή επιπέδων φαρμάκου' : '',
      administeredBy: 'demo',
      notes: '',
      createdBy: 'demo',
      createdAt: `${day}T09:05:00`,
    })
  }
  const therapy = [
    {
      id: therapyId,
      antimicrobial,
      dose,
      route,
      startedAt: resultDay,
      plannedEnd,
      ...(done ? { endedAt: plannedEnd, status: 'completed' } : { status: 'active' }),
      indication: [item.organism, item.resistance].filter(Boolean).join(' '),
      approvalStatus,
      administrations,
    },
  ]
  if (!done)
    therapy.push({
      id: `${therapyId}2`,
      antimicrobial: 'Daptomycin',
      dose: '8 mg/kg',
      route: 'IV',
      startedAt: LAST_DOSE_DAY,
      plannedEnd: addDays(LAST_DOSE_DAY, 13),
      status: 'active',
      indication: 'Αποκλιμάκωση από βανκομυκίνη (νεφροτοξικότητα)',
      approvalStatus: 'pending',
      administrations: [],
    })
  clinicalCases[item.id] = {
    id: item.id,
    patientId: item.patientId,
    patient: item.patient,
    patientEn: item.patientEn,
    dateOfBirth: item.dateOfBirth,
    ...(item.birthWeightGrams
      ? { birthWeightGrams: item.birthWeightGrams, gestationalAgeWeeks: item.gestationalAgeWeeks }
      : {}),
    department: item.department,
    departmentEn: item.departmentEn,
    room: item.room,
    admissionDate: item.admissionDate,
    startedAt: item.startedAt,
    reviewDue: done ? addDays(item.startedAt, 3) : LAST_DOSE_DAY,
    completedAt: item.completedAt,
    status: item.status,
    organism: item.organism,
    resistance: item.resistance,
    source: site,
    sourceEn: siteEn,
    haiClassification: item.hai
      ? {
          status: item.hai[0],
          type: item.hai[1],
          definitionSet: 'WHO HAI surveillance',
          criteriaMet: item.hai[0] === 'confirmed',
        }
      : null,
    devices: deviceName
      ? [
          {
            id: `DEV-${number}H`,
            name: deviceName,
            nameEn: deviceNameEn,
            insertedAt: addDays(item.admissionDate, 1),
            ...(done
              ? { status: 'removed', removedAt: addDays(item.startedAt, 2) }
              : { status: 'active', reviewDue: LAST_DOSE_DAY }),
          },
        ]
      : [],
    assessment: {
      date: item.startedAt,
      type: item.hai?.[0] === 'notHai' ? 'communityAcquired' : 'healthcareAssociated',
      classification: 'infection',
      assessedBy: assessor,
      summary,
      summaryEn,
      symptoms,
      symptomsEn,
      riskFactors: deviceName ? [deviceName] : [],
      riskFactorsEn: deviceNameEn ? [deviceNameEn] : [],
    },
    samples: [
      {
        id: item.sampleId,
        type: sampleType,
        collectedAt: `${item.startedAt}T08:10:00`,
        resultedAt: `${resultDay}T11:10:00`,
        result: 'positive',
        organism: item.organism,
        resistance: item.resistance,
        susceptibility: susceptibilitySummary(item.organism, item.resistance),
        critical: item.critical,
        communicatedAt: item.critical && done ? `${resultDay}T11:20:00` : null,
      },
    ],
    therapy,
    isolation: needsIsolation(item)
      ? {
          id: `ISO-${number}H`,
          precautions: ['contactPrecautions'],
          room: item.room,
          startedAt: resultDay,
          ...(done
            ? { endedAt: item.completedAt, status: 'ended' }
            : { nextReview: LAST_DOSE_DAY, status: 'active' }),
          reason: [item.resistance, item.organism].filter(Boolean).join(' '),
        }
      : null,
    reassessments: [
      {
        id: `REV-${number}H`,
        date: addDays(item.startedAt, 3),
        status: item.outcome === 'deceased' ? 'deterioration' : 'clinicalImprovement',
        decision: 'continueTreatment',
        notes: '',
        by: assessor,
      },
    ],
    outcome: done
      ? {
          status: item.outcome,
          date: item.completedAt,
          notes: OUTCOME_NOTES[item.outcome][0],
          notesEn: OUTCOME_NOTES[item.outcome][1],
        }
      : null,
    timeline: [],
  }
}

// One demo source for surveillance: list-only fixtures (older completed cases)
// become full records too, so every row in the Surveillance Center opens a
// record and every record appears in the list.
for (const row of surveillanceDemoData) {
  if (clinicalCases[row.id]) continue
  clinicalCases[row.id] = {
    id: row.id,
    patientId: row.patientId,
    patient: row.patient,
    patientEn: row.patientEn,
    department: row.department,
    departmentEn: row.departmentEn,
    admissionDate: row.startedAt,
    startedAt: row.startedAt,
    reviewDue: row.reviewDue,
    status: row.status,
    completedAt: row.status === 'completed' ? row.reviewDue : null,
    organism: row.organism || null,
    resistance: row.resistance || null,
    isolation: row.isolation
      ? { status: row.status === 'active' ? 'active' : 'ended', startedAt: row.startedAt }
      : null,
    samples: [],
    therapy: [],
    devices: [],
    reassessments: [],
    timeline: [],
  }
}

// Records written without a history get one derived from what they contain, so
// the History tab of every Demo record tells its story like a live record does.
const recordHistory = item =>
  [
    { at: item.startedAt, type: 'surveillance_start', actor: item.assessment?.assessedBy },
    item.assessment && {
      at: item.assessment.date,
      type: 'clinical_assessment',
      actor: item.assessment.assessedBy,
      detail: item.assessment.classification,
    },
    ...(item.samples || []).flatMap(sample => [
      { at: sample.collectedAt, type: 'sample_collected', sampleId: sample.id },
      sample.resultedAt && {
        at: sample.resultedAt,
        type: 'sample_result',
        actor: 'Μικροβιολογικό',
        actorEn: 'Microbiology Laboratory',
        detail: sample.result,
        sampleId: sample.id,
      },
    ]),
    ...(item.therapy || []).map(therapy => ({
      at: therapy.startedAt,
      type: 'therapy_started',
      detail: therapy.antimicrobial,
    })),
    item.isolation?.startedAt && { at: item.isolation.startedAt, type: 'isolation_started' },
    ...(item.reassessments || []).map(review => ({
      at: review.date || review.at,
      type: 'reassessment',
      actor: review.by,
      detail: review.status,
    })),
    item.completedAt && { at: item.completedAt, type: 'surveillance_closed' },
  ].filter(event => event?.at)
for (const item of Object.values(clinicalCases))
  if (!item.timeline?.length) item.timeline = recordHistory(item)

// Registry rows for the Surveillance Center, derived from the live record store.
export function demoSurveillanceList() {
  return Object.values(clinicalCases)
    .filter(item => item.lifecycleStatus !== 'voided')
    .map(item => ({
      id: item.id,
      patientId: item.patientId,
      patient: item.patient,
      patientEn: item.patientEn,
      department: item.department,
      departmentEn: item.departmentEn,
      startedAt: item.startedAt,
      reviewDue: item.reviewDue,
      status: item.status,
      organism: item.organism || item.samples?.find(sample => sample.organism)?.organism || null,
      resistance: item.resistance || null,
      isolation: item.isolation ? { ...item.isolation } : null,
      samples: item.samples || [],
    }))
    .sort((a, b) => String(b.startedAt).localeCompare(String(a.startedAt)))
}

export function getClinicalCase(caseId) {
  return clinicalCases[caseId] ?? null
}
export function findCasesByPatient(patientId) {
  return Object.values(clinicalCases)
    .filter(item => item.patientId === patientId && item.lifecycleStatus !== 'voided')
    .sort((a, b) => new Date(b.startedAt) - new Date(a.startedAt))
}

export function createClinicalSurveillance(data) {
  const now = new Date().toISOString()
  const numericIds = Object.keys(clinicalCases)
    .map(id => Number(String(id).replace(/\D/g, '')))
    .filter(Number.isFinite)
  const next = Math.max(260000, ...numericIds) + 1
  const id = `SUR-${String(next).slice(-6)}`
  const record = {
    id,
    patientId: data.patientId,
    patient: data.patient,
    patientEn: data.patientEn || data.patient,
    dateOfBirth: data.dateOfBirth || null,
    department: data.department,
    departmentEn: data.departmentEn || data.department,
    room: data.room || '',
    admissionDate: data.admissionDate,
    startedAt: data.startedAt,
    reviewDue: data.reviewDue,
    status: 'active',
    lifecycleStatus: 'active',
    createdAt: now,
    createdBy: data.createdBy || 'Unknown actor',
    createdById: data.createdById || 'unknown',
    updatedAt: now,
    updatedBy: data.createdBy || 'Unknown actor',
    updatedById: data.createdById || 'unknown',
    reason: data.reason || '',
    reasonEn: data.reasonEn || data.reason || '',
    suspectedSource: data.suspectedSource || null,
    organism: null,
    resistance: null,
    source: null,
    sourceEn: null,
    isolation: null,
    haiClassification: null,
    devices: [],
    assessment: null,
    samples: [],
    therapy: [],
    reassessments: [],
    outcome: null,
    timeline: [
      {
        at: now,
        type: 'surveillanceStarted',
        actor: data.createdBy || 'Unknown actor',
        actorId: data.createdById || 'unknown',
        detail: data.reason || '',
      },
    ],
  }
  clinicalCases[id] = record
  return record
}

const surveillanceDeletionAudit = []
export function deleteClinicalSurveillance(
  id,
  { actor = 'Unknown actor', actorId = 'unknown', reason = 'Deleted as erroneous entry' } = {},
) {
  const existing = clinicalCases[id]
  if (!existing || existing.status !== 'active') return false
  surveillanceDeletionAudit.unshift({
    id: `DEL-${Date.now()}`,
    surveillanceId: id,
    patientId: existing.patientId,
    actor,
    actorId,
    reason,
    at: new Date().toISOString(),
    snapshot: { ...existing },
  })
  clinicalCases[id] = {
    ...existing,
    lifecycleStatus: 'voided',
    voidedAt: new Date().toISOString(),
    voidedBy: actor,
    voidedById: actorId,
    voidReason: reason,
    updatedAt: new Date().toISOString(),
    updatedBy: actor,
    updatedById: actorId,
    timeline: [
      { at: new Date().toISOString(), type: 'surveillanceVoided', actor, actorId, detail: reason },
      ...(existing.timeline || []),
    ],
  }
  return true
}

// Dates follow today (src/core/data/demoClock.js).
shiftDemoDatesInPlace([clinicalCases])
// Empty-hospital preview (?helpEmpty=1): no sample records.
emptyInPreview(clinicalCases)

// Demo: the one sample attachment every episode's «Documents» tab starts with (a text file that opens).
export const demoClinicalDocuments = () =>
  Object.keys(clinicalCases).length === 0
    ? []
    : [
  {
    id: 'demo-document-1',
    name: 'Συνοδευτικό ιστορικό νοσηλείας.txt',
    size: 96,
    type: 'text/plain',
    dataUrl: `data:text/plain;charset=utf-8,${encodeURIComponent('Δείγμα επισύναψης του demo: συνοδευτικό ιστορικό νοσηλείας.')}`,
    category: 'other',
    description: 'Δείγμα επισύναψης demo',
  },
]
