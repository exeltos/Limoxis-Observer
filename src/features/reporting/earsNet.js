// EARS-Net (ECDC) isolate reporting: invasive isolates (blood, CSF) of the eight
// EARS-Net pathogens, de-duplicated to the first isolate per patient, pathogen
// and year, exported as one row per antimicrobial test in the EARS-Net
// (TESSy) variable layout.
import { currentResults, isValidatedPositive, organismsOf, specimenOf, testsForOrganism } from './labResults'

export const EARS_NET_PATHOGENS = [
  ['ESCCOL', /escherichia\s+coli|^e\.\s*coli/i, 'Escherichia coli'],
  ['KLEPNE', /klebsiella\s+pneumoniae/i, 'Klebsiella pneumoniae'],
  ['PSEAER', /pseudomonas\s+aeruginosa/i, 'Pseudomonas aeruginosa'],
  ['ACISPP', /acinetobacter/i, 'Acinetobacter spp.'],
  ['STAAUR', /staphylococcus\s+aureus|\bmrsa\b/i, 'Staphylococcus aureus'],
  ['STRPNE', /streptococcus\s+pneumoniae/i, 'Streptococcus pneumoniae'],
  ['ENCFAE', /enterococcus\s+faecalis/i, 'Enterococcus faecalis'],
  ['ENCFAI', /enterococcus\s+faecium|\bvre\b/i, 'Enterococcus faecium'],
]

// WHONET/EARS-Net antimicrobial codes, matched on English and Greek names.
// Order matters: combinations first.
const ANTIBIOTICS = [
  ['CZA', /ceftazidime.{0,3}avibactam|κεφταζιδίμη.{0,3}αβιβακτάμη/i], ['TZP', /piperacillin.{0,3}tazobactam|πιπερακιλλίνη.{0,3}ταζομπακτάμη/i], ['AMC', /amoxicillin.{0,3}clavulan|αμοξικιλλίνη.{0,3}κλαβουλαν/i], ['SXT', /trimethoprim.{0,3}sulfamethoxazole|co-?trimoxazole|τριμεθοπρίμη/i], ['MEV', /meropenem.{0,3}vaborbactam|μεροπενέμη.{0,3}βαμπορμπακτάμη/i], ['C_T', /ceftolozane|κεφτολοζάνη/i],
  ['AMK', /amikacin|αμικασίνη/i], ['GEN', /gentamicin|γενταμικίνη/i], ['TOB', /tobramycin|τομπραμυκίνη/i],
  ['AMP', /ampicillin|αμπικιλλίνη/i], ['AMX', /amoxicillin|αμοξικιλλίνη/i], ['PEN', /penicillin|πενικιλλίνη/i], ['OXA', /oxacillin|οξακιλλίνη/i], ['FOX', /cefoxitin|κεφοξιτίνη/i],
  ['CAZ', /ceftazidime|κεφταζιδίμη/i], ['CRO', /ceftriaxone|κεφτριαξόνη/i], ['CTX', /cefotaxime|κεφοταξίμη/i], ['FEP', /cefepime|κεφεπίμη/i], ['FDC', /cefiderocol|κεφιδεροκόλη/i],
  ['IPM', /imipenem|ιμιπενέμη/i], ['MEM', /meropenem|μεροπενέμη/i], ['ETP', /ertapenem|ερταπενέμη/i],
  ['CIP', /ciprofloxacin|σιπροφλοξασίνη|σιπροφλοξακίνη/i], ['LVX', /levofloxacin|λεβοφλοξασίνη|λεβοφλοξακίνη/i], ['MFX', /moxifloxacin|μοξιφλοξασίνη|μοξιφλοξακίνη/i], ['OFX', /ofloxacin|οφλοξασίνη|οφλοξακίνη/i],
  ['COL', /colistin|polymyxin|κολιστίνη|πολυμυξίνη/i], ['TGC', /tigecycline|τιγεκυκλίνη/i],
  ['VAN', /vancomycin|βανκομυκίνη/i], ['TEC', /teicoplanin|τεϊκοπλανίνη|τεικοπλανίνη/i], ['LNZ', /linezolid|λινεζολίδη/i], ['DAP', /daptomycin|δαπτομυκίνη/i],
  ['RIF', /rifampi|ριφαμπικίνη/i], ['ERY', /erythromycin|ερυθρομυκίνη/i], ['CLI', /clindamycin|κλινδαμυκίνη/i],
]
// Library codes that differ from the EARS-Net code.
const CODE_ALIASES = { PTZ: 'TZP', IMP: 'IPM', ERT: 'ETP', LEV: 'LVX', MOX: 'MFX', TEI: 'TEC', LZD: 'LNZ', CST: 'COL', TIG: 'TGC' }

export function earsNetPathogen(organism) {
  const text = String(organism || '')
  return EARS_NET_PATHOGENS.find(([, pattern]) => pattern.test(text))?.[0] || null
}

export function earsNetAntibiotic(test = {}) {
  const raw = String(test.code || '').toUpperCase().replace(/^ABX-/, '')
  const code = CODE_ALIASES[raw] || raw
  if (ANTIBIOTICS.some(([known]) => known === code)) return code
  const name = String(test.drug || test.name || '')
  return ANTIBIOTICS.find(([, pattern]) => pattern.test(name))?.[0] || null
}

// Blood cultures, and any sample whose type or source names CSF.
export const earsNetSpecimen = sample => specimenOf(sample) || null

const dateOf = value => String(value || '').slice(0, 10)
const patientKey = sample => String(sample.subjectCode || sample.patientId || sample.subjectId || '').trim()

// Every validated positive result of an invasive sample of an EARS-Net pathogen.
export function earsNetIsolates(samples = []) {
  const isolates = []
  for (const sample of samples) {
    if ((sample.subjectType || 'patient') !== 'patient') continue
    const specimen = earsNetSpecimen(sample)
    if (!specimen) continue
    for (const result of currentResults(sample)) {
      if (!isValidatedPositive(result)) continue
      // One isolate per organism of a polymicrobial result, with its own tests.
      const organisms = organismsOf(result)
      for (const organism of organisms) {
        const pathogen = earsNetPathogen(organism)
        if (!pathogen) continue
        const date = dateOf(sample.collectedAt || result.resultedAt)
        isolates.push({ sample, result, organism, tests: testsForOrganism(result, organism, organisms.length), specimen, pathogen, patient: patientKey(sample), date, year: date.slice(0, 4) })
      }
    }
  }
  return isolates
}

// ECDC/EARS-Net rule: only the first isolate per patient, pathogen and year.
// Isolates without a patient identifier cannot be de-duplicated and are kept.
export function firstIsolates(isolates = []) {
  const sorted = [...isolates].sort((a, b) => a.date.localeCompare(b.date) || String(a.sample.id).localeCompare(String(b.sample.id)))
  const seen = new Set()
  return sorted.filter(isolate => {
    if (!isolate.patient) return true
    const key = `${isolate.patient}|${isolate.pathogen}|${isolate.year}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

// Stable, non-reversible patient counter (FNV-1a), so the export carries no
// patient code or name.
export function pseudonym(value, salt = '') {
  let hash = 0x811c9dc5
  for (const ch of `${salt}|${value}`) { hash ^= ch.codePointAt(0); hash = Math.imul(hash, 0x01000193) >>> 0 }
  return hash.toString(36).toUpperCase().padStart(7, '0')
}

export function ageInYears(dateOfBirth, onDate) {
  if (!dateOfBirth || !onDate) return ''
  const birth = new Date(dateOfBirth), at = new Date(onDate)
  if (Number.isNaN(birth.getTime()) || Number.isNaN(at.getTime())) return ''
  let age = at.getFullYear() - birth.getFullYear()
  if (at.getMonth() < birth.getMonth() || (at.getMonth() === birth.getMonth() && at.getDate() < birth.getDate())) age--
  return age >= 0 ? String(age) : ''
}

const GENDER = { male: 'M', m: 'M', female: 'F', f: 'F', other: 'O' }
const UNIT_TYPE = { icu: 'ICU', nicu: 'ICU', picu: 'ICU' }

function hospitalUnitType(patient, sample) {
  const type = String(patient?.departmentType || '').toLowerCase()
  if (UNIT_TYPE[type]) return UNIT_TYPE[type]
  const name = `${sample.department || ''} ${sample.departmentEn || ''}`
  if (/\bICU\b|ΜΕΘ|ΜΕΝΝ|Μ\.Ε\.Θ/i.test(name)) return 'ICU'
  if (/ΤΕΠ|\bED\b|emergency/i.test(name)) return 'ED'
  if (/παιδ|pediatr|paediatr/i.test(name)) return 'PEDS'
  if (/χειρουργ|surg/i.test(name)) return 'SURG'
  if (/παθολογ|internal/i.test(name)) return 'INTMED'
  if (/μαιευτ|γυναικ|obstet|gyn/i.test(name)) return 'OBGYN'
  return 'O'
}

const MIC = /^\s*(<=|>=|≤|≥|<|>|=)?\s*([0-9]+(?:[.,][0-9]+)?)\s*$/
const SIGNS = { '≤': '<=', '≥': '>=', '<=': '<=', '>=': '>=', '<': '<', '>': '>', '=': '=' }

// MIC sign and value: the stored operator wins; otherwise it is read from the value ("≥16").
export function micOf(test = {}) {
  const match = MIC.exec(String(test.mic ?? '').replace(',', '.'))
  if (!match) return { sign: '', value: '' }
  return { sign: SIGNS[String(test.operator || '').trim()] || SIGNS[match[1]] || '=', value: match[2] }
}

// Inpatient when the isolate falls within the patient's recorded admission;
// unknown otherwise (admission is optional, so its absence proves nothing).
export function patientTypeOf(patient, date) {
  const from = String(patient?.admissionDate || '').slice(0, 10), to = String(patient?.dischargeDate || '').slice(0, 10)
  return from && date >= from && (!to || date <= to) ? 'INPAT' : 'UNK'
}

export const EARS_NET_COLUMNS = ['RecordId', 'ReportingCountry', 'DataSource', 'DateUsedForStatistics', 'Specimen', 'Gender', 'Age', 'PatientType', 'HospitalUnitType', 'HospitalId', 'LaboratoryCode', 'PatientCounter', 'IsolateId', 'Pathogen', 'Antibiotic', 'SIR', 'ResultMICSign', 'ResultMICValue', 'ResultZoneValue', 'ReferenceGuidelinesSIR']

// One row per (first isolate × tested antimicrobial). Tests without a known
// EARS-Net antimicrobial code are reported separately so they can be mapped.
export function buildEarsNetRows(samples, { patients = [], year, hospitalId = '', laboratoryCode = '', dataSource = '', salt = '' } = {}) {
  const byPatient = new Map(patients.map(patient => [String(patient.id || patient.patientCode || ''), patient]))
  const isolates = firstIsolates(earsNetIsolates(samples)).filter(isolate => !year || isolate.year === String(year))
  const rows = []; const unmapped = new Map(); let withoutAst = 0
  for (const isolate of isolates) {
    const { sample, result, tests } = isolate
    if (!tests.length) { withoutAst++; continue }
    const patient = byPatient.get(isolate.patient)
    const isolateId = pseudonym(`${sample.id}|${result.id || ''}|${isolate.pathogen}`, salt)
    for (const test of tests) {
      const antibiotic = earsNetAntibiotic(test)
      if (!antibiotic) { const name = test.drug || test.code || '?'; unmapped.set(name, (unmapped.get(name) || 0) + 1); continue }
      const mic = micOf(test)
      rows.push({
        RecordId: `${isolateId}-${antibiotic}`,
        ReportingCountry: 'EL',
        DataSource: dataSource,
        DateUsedForStatistics: isolate.date,
        Specimen: isolate.specimen,
        Gender: GENDER[String(patient?.sex || '').toLowerCase()] || 'UNK',
        Age: ageInYears(patient?.dateOfBirth, isolate.date) || 'UNK',
        PatientType: patientTypeOf(patient, isolate.date),
        HospitalUnitType: hospitalUnitType(patient, sample),
        HospitalId: hospitalId,
        LaboratoryCode: laboratoryCode,
        PatientCounter: isolate.patient ? pseudonym(isolate.patient, salt) : 'UNK',
        IsolateId: isolateId,
        Pathogen: isolate.pathogen,
        Antibiotic: antibiotic,
        SIR: ['S', 'I', 'R'].includes(String(test.sir || '').toUpperCase()) ? String(test.sir).toUpperCase() : 'UNK',
        ResultMICSign: mic.sign,
        ResultMICValue: mic.value,
        ResultZoneValue: test.zone ?? '',
        ReferenceGuidelinesSIR: test.standard ? `${test.standard}${test.version ? ` ${test.version}` : ''}` : '',
      })
    }
  }
  return { rows, isolates: isolates.length, withoutAst, unmapped: [...unmapped.entries()] }
}

export function toCsv(rows, columns = EARS_NET_COLUMNS) {
  const cell = value => { const text = String(value ?? ''); return /[",\n;]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text }
  return [columns.join(','), ...rows.map(row => columns.map(column => cell(row[column])).join(','))].join('\r\n') + '\r\n'
}
