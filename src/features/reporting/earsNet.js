// EARS-Net (ECDC) isolate reporting: invasive isolates (blood, CSF) of the eight
// EARS-Net pathogens, de-duplicated to the first isolate per patient, pathogen
// and year, exported as one row per antimicrobial test in the EARS-Net
// (TESSy) variable layout.

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

// WHONET/EARS-Net antimicrobial codes. Order matters: combinations first.
const ANTIBIOTICS = [
  ['CZA', /ceftazidime.{0,3}avibactam/i], ['TZP', /piperacillin.{0,3}tazobactam/i], ['AMC', /amoxicillin.{0,3}clavulan/i], ['SXT', /trimethoprim.{0,3}sulfamethoxazole|co-?trimoxazole/i], ['MEV', /meropenem.{0,3}vaborbactam/i], ['C_T', /ceftolozane/i],
  ['AMK', /amikacin/i], ['GEN', /gentamicin/i], ['TOB', /tobramycin/i],
  ['AMP', /ampicillin/i], ['AMX', /amoxicillin/i], ['PEN', /penicillin/i], ['OXA', /oxacillin/i], ['FOX', /cefoxitin/i],
  ['CAZ', /ceftazidime/i], ['CRO', /ceftriaxone/i], ['CTX', /cefotaxime/i], ['FEP', /cefepime/i], ['FDC', /cefiderocol/i],
  ['IPM', /imipenem/i], ['MEM', /meropenem/i], ['ETP', /ertapenem/i],
  ['CIP', /ciprofloxacin/i], ['LVX', /levofloxacin/i], ['MFX', /moxifloxacin/i], ['OFX', /ofloxacin/i],
  ['COL', /colistin|polymyxin/i], ['TGC', /tigecycline/i],
  ['VAN', /vancomycin/i], ['TEC', /teicoplanin/i], ['LNZ', /linezolid/i], ['DAP', /daptomycin/i],
  ['RIF', /rifampi/i], ['ERY', /erythromycin/i], ['CLI', /clindamycin/i],
]

const VALIDATED = new Set(['validated', 'amended'])

export function earsNetPathogen(organism) {
  const text = String(organism || '')
  return EARS_NET_PATHOGENS.find(([, pattern]) => pattern.test(text))?.[0] || null
}

export function earsNetAntibiotic(test = {}) {
  const code = String(test.code || '').toUpperCase().replace(/^ABX-/, '')
  if (/^[A-Z_]{3}$/.test(code) && ANTIBIOTICS.some(([known]) => known === code)) return code
  const name = String(test.drug || test.name || '')
  return ANTIBIOTICS.find(([, pattern]) => pattern.test(name))?.[0] || null
}

// Blood cultures, and any sample whose type or source names CSF.
export function earsNetSpecimen(sample = {}) {
  if (sample.type === 'bloodCulture' || sample.sampleType === 'bloodCulture') return 'BLOOD'
  const text = `${sample.type || ''} ${sample.source || ''} ${sample.sourceEn || ''}`
  if (/\bcsf\b|cerebrospinal|εγκεφαλονωτια|(^|[^\p{L}])ε\.?ν\.?υ\.?($|[^\p{L}])/iu.test(text)) return 'CSF'
  return null
}

const dateOf = value => String(value || '').slice(0, 10)
const patientKey = sample => String(sample.subjectCode || sample.patientId || sample.subjectId || '').trim()

// Every validated positive result of an invasive sample of an EARS-Net pathogen.
export function earsNetIsolates(samples = []) {
  const isolates = []
  for (const sample of samples) {
    if ((sample.subjectType || 'patient') !== 'patient') continue
    const specimen = earsNetSpecimen(sample)
    if (!specimen) continue
    const results = sample.microbiologyResults?.length ? sample.microbiologyResults : [sample]
    for (const result of results) {
      if (result.result !== 'positive' || !VALIDATED.has(result.resultStatus)) continue
      const pathogen = earsNetPathogen(result.organism)
      if (!pathogen) continue
      const date = dateOf(sample.collectedAt || result.resultedAt)
      isolates.push({ sample, result, specimen, pathogen, patient: patientKey(sample), date, year: date.slice(0, 4) })
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

export const EARS_NET_COLUMNS = ['RecordId', 'ReportingCountry', 'DataSource', 'DateUsedForStatistics', 'Specimen', 'Gender', 'Age', 'PatientType', 'HospitalUnitType', 'HospitalId', 'LaboratoryCode', 'PatientCounter', 'IsolateId', 'Pathogen', 'Antibiotic', 'SIR', 'ResultMICSign', 'ResultMICValue', 'ResultZoneValue', 'ReferenceGuidelinesSIR']

// One row per (first isolate × tested antimicrobial). Tests without a known
// EARS-Net antimicrobial code are reported separately so they can be mapped.
export function buildEarsNetRows(samples, { patients = [], year, hospitalId = '', laboratoryCode = '', dataSource = '', salt = '' } = {}) {
  const byPatient = new Map(patients.map(patient => [String(patient.id || patient.patientCode || ''), patient]))
  const isolates = firstIsolates(earsNetIsolates(samples)).filter(isolate => !year || isolate.year === String(year))
  const rows = []; const unmapped = new Map(); let withoutAst = 0
  for (const isolate of isolates) {
    const { sample, result } = isolate
    const tests = result.ast || sample.ast || []
    if (!tests.length) { withoutAst++; continue }
    const patient = byPatient.get(isolate.patient)
    const isolateId = pseudonym(`${sample.id}|${result.id || ''}`, salt)
    for (const test of tests) {
      const antibiotic = earsNetAntibiotic(test)
      if (!antibiotic) { const name = test.drug || test.code || '?'; unmapped.set(name, (unmapped.get(name) || 0) + 1); continue }
      const mic = MIC.exec(String(test.mic ?? '').replace(',', '.'))
      const sign = { '≤': '<=', '≥': '>=' }[mic?.[1]] || mic?.[1] || (mic ? '=' : '')
      rows.push({
        RecordId: `${isolateId}-${antibiotic}`,
        ReportingCountry: 'EL',
        DataSource: dataSource,
        DateUsedForStatistics: isolate.date,
        Specimen: isolate.specimen,
        Gender: GENDER[String(patient?.sex || '').toLowerCase()] || 'UNK',
        Age: ageInYears(patient?.dateOfBirth, isolate.date) || 'UNK',
        PatientType: 'INPAT',
        HospitalUnitType: hospitalUnitType(patient, sample),
        HospitalId: hospitalId,
        LaboratoryCode: laboratoryCode,
        PatientCounter: isolate.patient ? pseudonym(isolate.patient, salt) : 'UNK',
        IsolateId: isolateId,
        Pathogen: isolate.pathogen,
        Antibiotic: antibiotic,
        SIR: ['S', 'I', 'R'].includes(String(test.sir || '').toUpperCase()) ? String(test.sir).toUpperCase() : 'UNK',
        ResultMICSign: mic ? sign : '',
        ResultMICValue: mic ? mic[2] : '',
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
