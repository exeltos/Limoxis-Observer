import { parseSusceptibility, sirWord } from '../../design-system/recordReport'
import { clinicalTerm, clinicalValueLabel, episodeTypeLabel, libraryLabel, termLabel, timelineLabel } from './clinicalRecordLabels'

// The printed report of a surveillance episode (or of a patient's admission): the
// description RecordReportPrint lays out as a document. Pure: the page passes what the
// user can see (permissions are decided by `can`), the labels come from the same
// helpers as the screen, never raw keys.
function sampleItem(sample, { L, en, t, fmtDate, fmtDateTime, sampleLabel }) {
  const when = sample.collectedAt || sample.requestedAt
  const antibiogram = Array.isArray(sample.ast) && sample.ast.length
    ? sample.ast.map(row => [row.drug, sirWord(row.sir, en)])
    : parseSusceptibility(sample.susceptibility, en)
  return {
    title: [sampleLabel(sample), when && fmtDate(when)].filter(Boolean).join(' · '),
    meta: sample.sampleCode || sample.id,
    pairs: [
      [L('Προέλευση', 'Source'), sample.source],
      [L('Λήψη', 'Collected'), sample.collectedAt && fmtDateTime(sample.collectedAt)],
      [L('Αποτέλεσμα', 'Result'), sample.resultedAt ? `${clinicalTerm(sample.result, en ? 'en' : 'el', t)} (${fmtDateTime(sample.resultedAt)})` : clinicalTerm(sample.result || 'pending', en ? 'en' : 'el', t)],
      [L('Μικροοργανισμός', 'Organism'), sample.organism],
      [L('Αντοχή', 'Resistance'), sample.resistance || sample.amr],
      [L('Κρίσιμο αποτέλεσμα', 'Critical result'), sample.critical ? `${L('Ναι', 'Yes')}${sample.communicatedAt ? ` · ${L('ανακοινώθηκε', 'communicated')} ${fmtDateTime(sample.communicatedAt)}` : ''}` : ''],
    ],
    table: antibiogram,
  }
}

function episodeBlocks(record, ctx, { libraries = {} } = {}) {
  const { L, en, t, fmtDate, language } = ctx
  const items = []
  const hai = record.haiClassification
  if (hai) items.push({
    title: L('Ταξινόμηση λοίμωξης (HAI)', 'Infection classification (HAI)'),
    pairs: [
      [L('Τύπος', 'Type'), hai.type && termLabel(hai.type, t, language)],
      [L('Κατάσταση ταξινόμησης', 'Classification status'), hai.status && t(hai.status)],
      [L('Αιτιολόγηση', 'Rationale'), en ? hai.rationaleEn || hai.rationale : hai.rationale],
    ],
  })
  const assessment = record.assessment
  if (assessment) items.push({
    title: L('Κλινική αξιολόγηση', 'Clinical assessment'),
    pairs: [
      [L('Ημερομηνία', 'Date'), assessment.date && fmtDate(assessment.date)],
      [L('Αξιολογήθηκε από', 'Assessed by'), assessment.assessedBy],
      [L('Ταξινόμηση', 'Classification'), assessment.classification && clinicalTerm(assessment.classification, language, t)],
      [L('Περιγραφή', 'Summary'), en ? assessment.summaryEn || assessment.summary : assessment.summary],
      [L('Σημεία / συμπτώματα', 'Signs / symptoms'), (assessment.symptoms || []).map(x => libraryLabel(x, libraries.clinicalSymptoms || [], language, t)).join(', ')],
      [L('Παράγοντες κινδύνου', 'Risk factors'), (assessment.riskFactors || []).map(x => libraryLabel(x, libraries.clinicalRiskFactors || [], language, t)).join(', ')],
    ],
  })
  if (record.devices?.length) items.push({
    title: L('Επεμβατικές συσκευές', 'Invasive devices'),
    list: record.devices.map(device => [en ? device.nameEn || device.name : device.name, en ? device.siteEn || device.site : device.site, device.insertedAt && `${L('τοποθέτηση', 'inserted')} ${fmtDate(device.insertedAt)}`, device.status && t(device.status)].filter(Boolean).join(' · ')),
  })
  if (record.isolation) items.push({
    title: L('Απομόνωση', 'Isolation'),
    pairs: [
      [L('Κατάσταση', 'Status'), record.isolation.status && t(record.isolation.status)],
      [L('Έναρξη', 'Start'), record.isolation.startedAt && fmtDate(record.isolation.startedAt)],
      [L('Αιτία', 'Reason'), record.isolation.reason],
      [L('Θάλαμος', 'Room'), record.isolation.room],
      [L('Επόμενη επανεκτίμηση', 'Next review'), record.isolation.nextReview && fmtDate(record.isolation.nextReview)],
    ],
  })
  if (record.therapy?.length) items.push({
    title: L('Αντιμικροβιακή αγωγή', 'Antimicrobial therapy'),
    list: record.therapy.map(x => [x.antimicrobial || x.drug, [x.dose, x.route].filter(Boolean).join(' '), (x.startedAt || x.startDate) && `${L('από', 'from')} ${fmtDate(x.startedAt || x.startDate)}`, (x.endedAt || x.endDate || x.plannedEnd || x.plannedEndAt) && `${L('έως', 'to')} ${fmtDate(x.endedAt || x.endDate || x.plannedEnd || x.plannedEndAt)}`, x.indication, x.approvalStatus === 'pending' && L('εκκρεμεί έγκριση', 'awaiting approval')].filter(Boolean).join(' · ')),
  })
  if (record.reassessments?.length) items.push({
    title: L('Επανεκτιμήσεις', 'Reassessments'),
    list: record.reassessments.map(x => [x.date && fmtDate(x.date), clinicalTerm(x.status, language, t), x.decision && termLabel(x.decision, t, language), en ? x.notesEn || x.notes : x.notes, x.by].filter(Boolean).join(' · ')),
  })
  if (record.outcome) items.push({
    title: L('Έκβαση', 'Outcome'),
    pairs: [
      [L('Κατάσταση', 'Status'), record.outcome.status && t(record.outcome.status)],
      [L('Ημερομηνία', 'Date'), record.outcome.date && fmtDate(record.outcome.date)],
      [L('Σημειώσεις', 'Notes'), record.outcome.notes],
    ],
  })
  return items
}

function timelineEvents(rows, { t, language, fmtDate, fmtDateTime }) {
  return (rows || []).filter(row => row?.at).map(row => ({
    when: /^\d{4}-\d{2}-\d{2}$/.test(String(row.at)) ? fmtDate(row.at) : fmtDateTime(row.at),
    sort: String(row.at),
    title: timelineLabel(row.type, language, t),
    detail: row.detail ? clinicalValueLabel(row.detail, language, t) : '',
    by: row.actor || row.actorId || '',
  }))
}

export function buildSurveillanceReport({
  language = 'el',
  t,
  fmtDate,
  fmtDateTime,
  record = null,
  patient = null,
  admission = null,
  patientMode = false,
  admissionEpisodes = [],
  samples = [],
  admissionTimeline = [],
  outsideTimeline = [],
  libraries = {},
  documents = null,
  department = '',
  status = '',
  sampleLabel = sample => sample.typeLabel || sample.type,
  can = {},
  // Sections of the «Φόρμες & ερωτηματολόγια» tab (forms/formsRegistry.js buildReport), after the scales.
  formSections = [],
}) {
  const en = language === 'en'
  const L = (el, enText) => (en ? enText : el)
  const ctx = { L, en, t, fmtDate, fmtDateTime, language, sampleLabel }
  const name = en ? patient?.nameEn || record?.patientEn || patient?.name || record?.patient : patient?.name || record?.patient
  const code = patient?.id || record?.patientId
  const statusWord = status ? t(status) : ''
  const latest = samples.find(sample => sample.organism) || samples[0]
  const admittedAt = admission ? admission.admissionDate : patient?.admissionDate || record?.admissionDate
  const patientPairs = [
    [L('Ασθενής', 'Patient'), name],
    [L('Κωδικός ασθενούς', 'Patient code'), code],
    [L('Ημερομηνία γέννησης', 'Date of birth'), (patient?.dateOfBirth || record?.dateOfBirth) && fmtDate(patient?.dateOfBirth || record?.dateOfBirth)],
    [L('Τμήμα', 'Department'), department],
    [L('Θάλαμος / κλίνη', 'Room / bed'), record?.room],
    [L('Ημερομηνία εισαγωγής', 'Admission date'), admittedAt && fmtDate(admittedAt)],
    [L('Ημερομηνία εξόδου', 'Discharge date'), admission?.dischargeDate && fmtDate(admission.dischargeDate)],
  ]
  const episodeTypeText = record ? episodeTypeLabel(record, t) : ''
  const summaryText = record
    ? [
        `${L('Επεισόδιο επιτήρησης', 'Surveillance episode')} ${record.id}${name ? ` ${L('για τον/την', 'for')} ${name}` : ''}${department ? ` (${department})` : ''}, ${L('έναρξη', 'started')} ${fmtDate(record.startedAt)}.`,
        statusWord && `${L('Κατάσταση', 'Status')}: ${statusWord}.`,
        episodeTypeText && episodeTypeText !== '—' && `${L('Αντικείμενο', 'Subject')}: ${episodeTypeText}.`,
        latest?.organism && `${L('Τελευταίο εύρημα', 'Latest finding')}: ${latest.organism}${latest.resistance || record.resistance ? ` (${latest.resistance || record.resistance})` : ''}.`,
      ].filter(Boolean).join(' ')
    : ''
  const summaryPairs = record
    ? [
        [L('Δείγματα', 'Samples'), samples.length ? String(samples.length) : ''],
        [L('Αντιμικροβιακή αγωγή', 'Antimicrobial therapy'), (record.therapy || []).map(x => x.antimicrobial).filter(Boolean).join(', ')],
        [L('Επόμενη επανεκτίμηση', 'Next review'), record.reviewDue && fmtDate(record.reviewDue)],
      ]
    : [
        [L('Ασθενής', 'Patient'), name],
        [L('Τμήμα', 'Department'), department],
        [L('Εισαγωγή', 'Admission'), admittedAt && fmtDate(admittedAt)],
        [L('Επεισόδια επιτήρησης', 'Surveillance episodes'), admissionEpisodes.length ? String(admissionEpisodes.length) : ''],
        [L('Δείγματα', 'Samples'), samples.length ? String(samples.length) : ''],
      ]

  const sections = [
    { id: 'patient', title: L('Στοιχεία ασθενούς', 'Patient details'), pairs: patientPairs },
    can.surveillance !== false && (record
      ? { id: 'surveillance', title: L('Επιτήρηση', 'Surveillance'), pairs: [
          [L('Λόγος επιτήρησης', 'Reason'), record.reason],
          [L('Έναρξη επιτήρησης', 'Surveillance start'), record.startedAt && fmtDate(record.startedAt)],
          [L('Κατάσταση', 'Status'), statusWord],
        ], items: episodeBlocks(record, ctx, { libraries }), keep: true }
      : { id: 'surveillance', title: L('Επιτήρηση', 'Surveillance'), items: admissionEpisodes.map(ep => ({
          title: `${episodeTypeLabel(ep, t)}`,
          meta: ep.id,
          pairs: [
            [L('Έναρξη', 'Start'), ep.startedAt && fmtDate(ep.startedAt)],
            [L('Κατάσταση', 'Status'), ep.status && t(ep.status)],
            [L('Μικροοργανισμός', 'Organism'), ep.organism],
            [L('Αντοχή', 'Resistance'), ep.resistance],
            [L('Αντιμικροβιακή αγωγή', 'Antimicrobial therapy'), (ep.therapy || []).map(x => x.antimicrobial).filter(Boolean).join(', ')],
            [L('Απομόνωση', 'Isolation'), ep.isolation?.status && t(ep.isolation.status)],
          ],
        })), keep: true }),
    can.lab !== false && { id: 'samples', title: L('Δείγματα και αποτελέσματα', 'Samples and results'), items: samples.map(sample => sampleItem(sample, ctx)), keep: true },
    ...formSections,
    { id: 'documents', title: L('Έγγραφα', 'Documents'), documents: documents || { value: [] } },
    { id: 'history', title: L('Ιστορικό', 'History'), events: timelineEvents(record ? [...(record.timeline || []), ...outsideTimeline] : [...admissionTimeline, ...outsideTimeline], ctx), keep: true },
  ].filter(Boolean)

  return {
    kind: record ? L('Επεισόδιο επιτήρησης', 'Surveillance episode') : patientMode && admission ? L('Νοσηλεία ασθενούς', 'Patient admission') : L('Φάκελος ασθενούς', 'Patient record'),
    code: record?.id || code,
    title: name || record?.id || '',
    subtitle: record ? [department, record.startedAt && `${L('έναρξη', 'start')} ${fmtDate(record.startedAt)}`].filter(Boolean).join(' · ') : [code, department].filter(Boolean).join(' · '),
    statusLabel: L('Κατάσταση', 'Status'),
    status: statusWord,
    summaryText,
    summaryPairs,
    sections,
  }
}
