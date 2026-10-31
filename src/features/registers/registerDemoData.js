import { registerFromTemplate } from './registerTemplates'

// Sample registers for the demo: the NICU (one card per neonate) and the
// Endoscopy unit (a monthly sheet), fourteen months back from today so every
// indicator has a trend and a same-month-last-year value. Generated with a
// fixed seed, so the numbers are the same on every visit.

function seeded(seed) {
  let state = seed
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296
    return state / 4294967296
  }
}
const pad = n => String(n).padStart(2, '0')
const addDays = (day, days) => {
  const date = new Date(`${day}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}
const pick = (random, weighted) => {
  const total = weighted.reduce((sum, [, weight]) => sum + weight, 0)
  let roll = random() * total
  for (const [value, weight] of weighted) { roll -= weight; if (roll <= 0) return value }
  return weighted[0][0]
}

export const DEMO_NICU_ID = 'reg-demo-nicu'
export const DEMO_ENDOSCOPY_ID = 'reg-demo-endoscopy'
export const DEMO_ICU_ID = 'reg-demo-icu'
export const DEMO_PAEDIATRICS_ID = 'reg-demo-paediatrics'
export const DEMO_OBSTETRICS_ID = 'reg-demo-obstetrics'
export const DEMO_EMERGENCY_ID = 'reg-demo-emergency'
export const DEMO_CATHLAB_ID = 'reg-demo-cathlab'
export const DEMO_CHEMO_ID = 'reg-demo-chemo'
export const DEMO_OPHTHALMOLOGY_ID = 'reg-demo-ophthalmology'
export const DEMO_DELIVERYROOM_ID = 'reg-demo-deliveryroom'

export function demoRegisters() {
  const nicu = { ...registerFromTemplate('nicu', { departmentId: 'Νεογνολογική / ΜΕΝΝ', department: 'Νεογνολογική / ΜΕΝΝ', departmentEn: 'Neonatal / NICU' }), id: DEMO_NICU_ID, code: 'REG-MENN' }
  // Targets the Quality team set with the department, so the demo shows statuses.
  const targets = { mean_ventilator: { target: 5 }, mean_cpap: { target: 7 }, mortality: { target: 2, threshold: 4 }, readmissions: { target: 5, threshold: 8 }, late_infection_rate: { target: 5, threshold: 8 }, breast_milk: { target: 50, threshold: 35 } }
  nicu.indicators = nicu.indicators.map(indicator => ({ ...indicator, ...(targets[indicator.id] || {}) }))
  const endoscopy = { ...registerFromTemplate('endoscopy', { departmentId: 'Παθολογική', department: 'Παθολογική', departmentEn: 'Internal Medicine' }), id: DEMO_ENDOSCOPY_ID, code: 'REG-ENDO', name: 'Πράξεις Ενδοσκοπικού', nameEn: 'Endoscopy procedures' }
  // The demo shows the daily sheets: the earlier months are monthly totals, from the current month on it is one sheet per day.
  endoscopy.sheet = { ...endoscopy.sheet, dailyFrom: `${new Date().toISOString().slice(0, 7)}-01` }
  const icu = { ...registerFromTemplate('icu', { departmentId: 'ΜΕΘ', department: 'ΜΕΘ', departmentEn: 'ICU' }), id: DEMO_ICU_ID, code: 'REG-ICU' }
  icu.indicators = icu.indicators.map(indicator => ({ ...indicator, ...({ mortality_scored: { target: 15 }, mean_ventilator_hours: { target: 96 } }[indicator.id] || {}) }))
  const paediatrics = { ...registerFromTemplate('paediatrics', { departmentId: 'Παιδιατρική', department: 'Παιδιατρική', departmentEn: 'Paediatrics' }), id: DEMO_PAEDIATRICS_ID, code: 'REG-PAED' }
  const obstetrics = { ...registerFromTemplate('obstetrics', { departmentId: 'Μαιευτική', department: 'Μαιευτική', departmentEn: 'Obstetrics' }), id: DEMO_OBSTETRICS_ID, code: 'REG-OBS' }
  obstetrics.indicators = obstetrics.indicators.map(indicator => ({ ...indicator, ...({ cs_rate: { target: 55, threshold: 65, direction: 'lower' }, exclusive_bf: { target: 60 }, weaning: { target: 10 }, antenatal: { target: 50 } }[indicator.id] || {}) }))
  const emergency = { ...registerFromTemplate('emergency', { departmentId: 'ΤΕΠ', department: 'ΤΕΠ', departmentEn: 'Emergency department' }), id: DEMO_EMERGENCY_ID, code: 'REG-ED' }
  emergency.sheet = { ...emergency.sheet, dailyFrom: `${new Date().toISOString().slice(0, 7)}-01` }
  const cathLab = { ...registerFromTemplate('cathLab', { departmentId: 'Αιμοδυναμικό', department: 'Αιμοδυναμικό', departmentEn: 'Cath lab' }), id: DEMO_CATHLAB_ID, code: 'REG-CATH' }
  const chemo = { ...registerFromTemplate('chemotherapy', { departmentId: 'Χημειοθεραπεία', department: 'Χημειοθεραπεία', departmentEn: 'Chemotherapy' }), id: DEMO_CHEMO_ID, code: 'REG-CHEMO' }
  chemo.fields = chemo.fields.map(field => (field.key === 'physician' ? { ...field, options: [{ value: 'dr_a', label: 'Παπαδόπουλος Γ.', labelEn: 'Papadopoulos G.' }, { value: 'dr_b', label: 'Νικολάου Μ.', labelEn: 'Nikolaou M.' }, { value: 'dr_c', label: 'Καραγιάννη Ε.', labelEn: 'Karagianni E.' }] } : field))
  const ophthalmology = { ...registerFromTemplate('ophthalmology', { departmentId: 'Οφθαλμολογική', department: 'Οφθαλμολογική', departmentEn: 'Ophthalmology' }), id: DEMO_OPHTHALMOLOGY_ID, code: 'REG-OPH' }
  ophthalmology.sheet = { ...ophthalmology.sheet, dailyFrom: `${new Date().toISOString().slice(0, 7)}-01` }
  const deliveryRoom = { ...registerFromTemplate('deliveryRoom', { departmentId: 'Μαιευτική', department: 'Μαιευτική', departmentEn: 'Obstetrics' }), id: DEMO_DELIVERYROOM_ID, code: 'REG-DR' }
  deliveryRoom.sheet = { ...deliveryRoom.sheet, dailyFrom: `${new Date().toISOString().slice(0, 7)}-01` }
  deliveryRoom.indicators = deliveryRoom.indicators.map(indicator => ({ ...indicator, ...({ cs_rate: { target: 50, threshold: 60 }, vbac_rate: { target: 10 } }[indicator.id] || {}) }))
  return [nicu, endoscopy, icu, paediatrics, obstetrics, emergency, cathLab, chemo, ophthalmology, deliveryRoom].map(register => ({ ...register, history: [{ at: '2026-01-10T09:00:00Z', action: 'created', actor: 'Ομάδα Ποιότητας' }] }))
}

export function demoRegisterEntries(today = new Date().toISOString().slice(0, 10)) {
  const random = seeded(20261105)
  const entries = []
  const identities = {}
  const [year, month] = today.split('-').map(Number)
  let caseNumber = 10613000
  for (let back = 13; back >= 0; back -= 1) {
    const date = new Date(Date.UTC(year, month - 1 - back, 1))
    const y = date.getUTCFullYear(), m = date.getUTCMonth() + 1
    const days = new Date(Date.UTC(y, m, 0)).getUTCDate()
    const count = 16 + Math.floor(random() * 8)
    for (let index = 0; index < count; index += 1) {
      const admission = `${y}-${pad(m)}-${pad(1 + Math.floor(random() * days))}`
      if (admission > today) continue
      const born = random() < 0.85 ? admission : addDays(admission, -(1 + Math.floor(random() * 10)))
      const gestation = Math.round(Math.max(170, Math.min(290, 266 - Math.abs(random() * 70 - 10) + (random() - 0.5) * 20)))
      const preterm = gestation < 259
      const weight = Math.round(Math.max(600, Math.min(4600, 3400 - (280 - gestation) * 42 + (random() - 0.5) * 600)) / 10) * 10
      const ventilator = preterm && random() < 0.55 ? 1 + Math.floor(random() * (gestation < 224 ? 18 : 6)) : 0
      const cpap = preterm && random() < 0.7 ? 1 + Math.floor(random() * 9) : random() < 0.1 ? 1 + Math.floor(random() * 3) : 0
      const line = preterm && random() < 0.6 ? 2 + Math.floor(random() * 12) : 0
      const stay = Math.max(2, Math.round((preterm ? (280 - gestation) * 0.55 : 4) + random() * 6))
      const discharge = addDays(admission, stay)
      const out = discharge <= today
      const death = out && (gestation < 196 ? random() < 0.25 : random() < 0.008)
      const values = {
        admission_date: admission,
        birth_date: born,
        readmission: random() < 0.05,
        admission_reason: preterm ? 'prematurity' : pick(random, [['observation', 5], ['respiratory', 3], ['jaundice', 3], ['infection', 1], ['other', 1]]),
        admission_origin: born === admission ? pick(random, [['delivery_room', 8], ['maternity', 2]]) : pick(random, [['other_hospital', 2], ['home', 3]]),
        gestation,
        pregnancy_type: pick(random, [['single', 88], ['twin', 11], ['multiple', 1]]),
        delivery: random() < 0.03 ? '' : random() < 0.8 ? 'cs' : 'vaginal',
        ivf: random() < 0.12,
        prom_24h: random() < 0.08,
        birth_weight: weight,
        apgar_1: Math.max(2, Math.min(10, Math.round(8 - (preterm ? 2 : 0) + (random() - 0.5) * 3))),
        apgar_5: Math.max(4, Math.min(10, Math.round(9 - (preterm ? 1 : 0) + (random() - 0.5) * 2))),
        resuscitation: preterm ? pick(random, [['oxygen', 3], ['bag_mask', 3], ['intubation', 2]]) : pick(random, [['none', 8], ['oxygen', 2]]),
        congenital_anomalies: random() < 0.03,
        ventilator_days: ventilator || null,
        hfov: ventilator ? random() < 0.15 : null,
        cpap_days: cpap || null,
        oxygen_days: ventilator + cpap ? ventilator + cpap + Math.floor(random() * 4) : null,
        oxygen_after_36w: gestation < 224 && random() < 0.4,
        umbilical_catheter: line ? pick(random, [['venous', 6], ['both', 2], ['arterial', 1]]) : 'none',
        central_line_days: line || null,
        tpn_days: line ? Math.max(1, line - 1) : null,
        nasogastric: preterm,
        breast_milk: out ? pick(random, [['exclusive', 5], ['mixed', 4], ['none', 2]]) : '',
        early_infection: random() < 0.02,
        late_infection: line > 0 && random() < 0.06,
        discharge_date: out ? discharge : '',
        discharge_weight: out && !death ? weight + stay * 18 : null,
        outcome: out ? (death ? 'death' : pick(random, [['home', 9], ['transfer_ward', 1], ['transfer_hospital', 0.4]])) : '',
      }
      caseNumber += 1 + Math.floor(random() * 3)
      const id = `reg-entry-nicu-${entries.length + 1}`
      entries.push({ id, registerId: DEMO_NICU_ID, entryDate: admission, periodStart: null, values, status: 'complete', locked: false, createdAt: `${admission}T10:00:00Z`, createdByLabel: 'Νοσηλεύτρια ΜΕΝΝ' })
      identities[id] = { caseNumber: String(caseNumber), patientName: `Νεογνό ${String.fromCharCode(913 + (entries.length % 24))}. ${pad(entries.length % 100)}` }
    }
    // Endoscopy: one sheet per completed month (the current one still open).
    if (back === 0) {
      // The current month, day by day (working days only; a day now and then is missing).
      const dayRandom = seeded(20261113)
      const perDay = { gastroscopy: 4, colonoscopy: 2.6, gastrostomy: 0.07, cystoscopy: 0.43, bronchoscopy: 0.24, ercp: 0.14, eus: 0.12, ebus: 0.12 }
      for (let day = 1; day <= days; day += 1) {
        const iso = `${y}-${pad(m)}-${pad(day)}`
        const weekday = new Date(`${iso}T00:00:00Z`).getUTCDay()
        if (iso >= today || weekday === 0 || weekday === 6 || dayRandom() < 0.08) continue
        const dayValues = Object.fromEntries(Object.entries(perDay).map(([key, mean]) => [key, { count: Math.max(0, Math.round(mean * (0.4 + dayRandom() * 1.2) + (mean < 1 && dayRandom() < mean ? 1 : 0))) }]))
        entries.push({ id: `reg-entry-endo-${iso}`, registerId: DEMO_ENDOSCOPY_ID, entryDate: iso, periodStart: iso, values: dayValues, status: 'complete', locked: false, createdAt: `${iso}T14:00:00Z`, createdByLabel: 'Προϊσταμένη Ενδοσκοπικού' })
      }
    }
    if (back > 0) {
      const base = { gastroscopy: 85, colonoscopy: 55, gastrostomy: 1.5, cystoscopy: 9, bronchoscopy: 5, ercp: 3, eus: 2.5, ebus: 2.5 }
      const values = Object.fromEntries(Object.entries(base).map(([key, mean]) => {
        return [key, { count: Math.max(0, Math.round(mean * (0.85 + random() * 0.3))) }]
      }))
      entries.push({ id: `reg-entry-endo-${y}-${pad(m)}`, registerId: DEMO_ENDOSCOPY_ID, entryDate: `${y}-${pad(m)}-01`, periodStart: `${y}-${pad(m)}-01`, values, status: 'complete', locked: back > 1, createdAt: `${y}-${pad(m)}-${pad(days)}T14:00:00Z`, createdByLabel: 'Προϊσταμένη Ενδοσκοπικού' })
    }
  }
  // ICU: General and Cardiac surgery patients, its own seed so the NICU's numbers stay the same.
  const icuRandom = seeded(20261107)
  let icuNumber = 10590000
  for (let back = 13; back >= 0; back -= 1) {
    const date = new Date(Date.UTC(year, month - 1 - back, 1))
    const y = date.getUTCFullYear(), m = date.getUTCMonth() + 1
    const days = new Date(Date.UTC(y, m, 0)).getUTCDate()
    const count = 14 + Math.floor(icuRandom() * 7)
    for (let index = 0; index < count; index += 1) {
      const admission = `${y}-${pad(m)}-${pad(1 + Math.floor(icuRandom() * days))}`
      if (admission > today) continue
      const cardiac = icuRandom() < 0.38
      const age = Math.round(cardiac ? 58 + icuRandom() * 24 : 38 + icuRandom() * 48)
      const apache = Math.max(3, Math.min(45, Math.round((cardiac ? 11 : 17) + (icuRandom() - 0.4) * 18)))
      const ventilated = cardiac ? icuRandom() < 0.7 : icuRandom() < 0.55
      const stay = Math.max(1, Math.round((cardiac ? 2.5 : 6) + icuRandom() * (cardiac ? 3 : 9)))
      const discharge = addDays(admission, stay)
      const out = discharge <= today
      const death = out && icuRandom() < (cardiac ? 0.04 : 0.17) + apache / 400
      const values = {
        admission_date: admission,
        category: cardiac ? 'cardiac' : 'general',
        age,
        sex: icuRandom() < (cardiac ? 0.7 : 0.55) ? 'male' : 'female',
        admission_reason: cardiac ? pick(icuRandom, [['cardiac_surgery', 6], ['cardiac', 2]]) : pick(icuRandom, [['respiratory', 4], ['sepsis', 3], ['postop', 3], ['neuro', 1], ['trauma', 1], ['other', 1]]),
        requisition: icuRandom() < 0.05,
        readmission_48h: icuRandom() < 0.025,
        apache_score: apache,
        apache_postop: cardiac || icuRandom() < 0.3,
        euroscore: cardiac ? Math.round((1 + icuRandom() * 7) * 10) / 10 : null,
        ventilator_hours: ventilated ? Math.round(6 + icuRandom() * (cardiac ? 30 : 160)) : 0,
        pressure_ulcer: !cardiac && icuRandom() < 0.045,
        vap: ventilated && !cardiac && icuRandom() < 0.05,
        air_mattress: !cardiac && icuRandom() < 0.7,
        daily_cleaning: icuRandom() < 0.97,
        line_care: icuRandom() < 0.94,
        cultures: icuRandom() < (cardiac ? 0.3 : 0.85),
        discharge_date: out ? discharge : '',
        outcome: out ? (death ? 'death' : pick(icuRandom, [['transfer_ward', 12], ['transfer_hospital', 1]])) : '',
      }
      if (values.outcome === 'transfer_ward') values.transfer_department = cardiac ? pick(icuRandom, [['cardiac_surgery_ward', 7], ['cardiology', 3]]) : pick(icuRandom, [['internal', 5], ['pulmonary', 3], ['surgical', 3], ['neurology', 1], ['orthopaedic', 1]])
      icuNumber += 1 + Math.floor(icuRandom() * 3)
      const id = `reg-entry-icu-${entries.filter(item => item.registerId === DEMO_ICU_ID).length + 1}`
      entries.push({ id, registerId: DEMO_ICU_ID, entryDate: admission, periodStart: null, values, status: 'complete', locked: false, createdAt: `${admission}T10:00:00Z`, createdByLabel: 'Νοσηλεύτρια ΜΕΘ' })
      identities[id] = { caseNumber: String(icuNumber), patientName: `${cardiac ? 'Ασθενής Κ' : 'Ασθενής Γ'}-${pad(entries.length % 100)}` }
    }
  }
  // Emergency department: totals per shift; earlier months as one total, the current month day by day.
  const edRandom = seeded(20261115)
  const edMeans = { surgical: [9, 7, 3], urgent: [5, 4, 2], admissions: [3, 3, 2], dressings: [4, 3, 0.6], septic: [1.5, 1, 0.4], assessments: [0.3, 0.2, 0.1], checkup: [0.6, 0.3, 0.05], preop: [2.5, 0.3, 0], left_without_seen: [0.2, 0.2, 0.2], revisit_72h: [0.3, 0.2, 0.1], transfers: [0.2, 0.2, 0.1] }
  const shifts = ['morning', 'afternoon', 'night']
  const edValues = factor => Object.fromEntries(Object.entries(edMeans).map(([row, means]) => [row, Object.fromEntries(shifts.map((shift, index) => [shift, Math.max(0, Math.round(means[index] * factor * (0.5 + edRandom())))]))]))
  for (let back = 13; back >= 0; back -= 1) {
    const date = new Date(Date.UTC(year, month - 1 - back, 1))
    const y = date.getUTCFullYear(), m = date.getUTCMonth() + 1
    if (back > 0) entries.push({ id: `reg-entry-ed-${y}-${pad(m)}`, registerId: DEMO_EMERGENCY_ID, entryDate: `${y}-${pad(m)}-01`, periodStart: `${y}-${pad(m)}-01`, values: edValues(22), status: 'complete', locked: false, createdAt: `${y}-${pad(m)}-28T14:00:00Z`, createdByLabel: 'Προϊστάμενος ΤΕΠ' })
    else {
      for (let day = 1; day <= new Date(Date.UTC(y, m, 0)).getUTCDate(); day += 1) {
        const iso = `${y}-${pad(m)}-${pad(day)}`
        if (iso >= today || edRandom() < 0.05) continue
        entries.push({ id: `reg-entry-ed-${iso}`, registerId: DEMO_EMERGENCY_ID, entryDate: iso, periodStart: iso, values: edValues(1), status: 'complete', locked: false, createdAt: `${iso}T23:30:00Z`, createdByLabel: 'Προϊστάμενος ΤΕΠ' })
      }
    }
  }
  // Obstetrics: one card per mother, its own seed.
  const momRandom = seeded(20261111)
  let momNumber = 10550000
  for (let back = 13; back >= 0; back -= 1) {
    const date = new Date(Date.UTC(year, month - 1 - back, 1))
    const y = date.getUTCFullYear(), m = date.getUTCMonth() + 1
    const days = new Date(Date.UTC(y, m, 0)).getUTCDate()
    const count = 42 + Math.floor(momRandom() * 14)
    for (let index = 0; index < count; index += 1) {
      const day = `${y}-${pad(m)}-${pad(1 + Math.floor(momRandom() * days))}`
      if (day > today) continue
      const values = {
        date: day,
        delivery: momRandom() < 0.04 ? '' : momRandom() < 0.6 + back * -0.004 ? 'cs' : 'vaginal',
        breastfeeding: pick(momRandom, [['exclusive', 60], ['mixed', 28], ['weaning', 12]]),
        antenatal: pick(momRandom, [['attended', 9], ['aware_not_attended', 12], ['not_aware', 29], ['no', 50]]),
        breast_pump: momRandom() < 0.3,
      }
      momNumber += 1 + Math.floor(momRandom() * 3)
      const id = `reg-entry-obs-${entries.filter(item => item.registerId === DEMO_OBSTETRICS_ID).length + 1}`
      entries.push({ id, registerId: DEMO_OBSTETRICS_ID, entryDate: day, periodStart: null, values, status: 'complete', locked: false, createdAt: `${day}T10:00:00Z`, createdByLabel: 'Μαία Μαιευτικής' })
      identities[id] = { caseNumber: String(momNumber), patientName: `Λεχωίδα ${String.fromCharCode(913 + (entries.length % 24))}. ${pad(entries.length % 100)}` }
    }
  }
  // Paediatrics: children up to 16 (newborns stay with the NICU), its own seed.
  const kidRandom = seeded(20261109)
  let kidNumber = 10570000
  for (let back = 13; back >= 0; back -= 1) {
    const date = new Date(Date.UTC(year, month - 1 - back, 1))
    const y = date.getUTCFullYear(), m = date.getUTCMonth() + 1
    const days = new Date(Date.UTC(y, m, 0)).getUTCDate()
    const winter = [11, 12, 1, 2, 3].includes(m)
    const count = (winter ? 38 : 24) + Math.floor(kidRandom() * 10)
    for (let index = 0; index < count; index += 1) {
      const admission = `${y}-${pad(m)}-${pad(1 + Math.floor(kidRandom() * days))}`
      if (admission > today) continue
      const ageDays = Math.round(Math.pow(kidRandom(), 1.7) * 16 * 365) + 30
      const years = Math.floor(ageDays / 365.25)
      const reason = pick(kidRandom, winter ? [['respiratory', 9], ['gastro', 3], ['fever', 3], ['uti', 1], ['seizure', 1], ['injury', 1], ['other', 1]] : [['respiratory', 3], ['gastro', 4], ['fever', 3], ['uti', 2], ['seizure', 1], ['injury', 2], ['surgical', 1], ['other', 1]])
      const stay = Math.max(1, Math.round((reason === 'respiratory' ? 3.5 : 2.5) + kidRandom() * 3))
      const discharge = addDays(admission, stay)
      const out = discharge <= today
      const ivAbx = ['respiratory', 'uti', 'fever'].includes(reason) && kidRandom() < 0.7
      const lineDays = ivAbx || kidRandom() < 0.4 ? Math.max(1, stay - (kidRandom() < 0.3 ? 1 : 0)) : 0
      const values = {
        admission_date: admission,
        birth_date: addDays(admission, -ageDays),
        age_group: years < 1 ? 'infant' : years < 5 ? 'toddler' : years < 12 ? 'child' : 'adolescent',
        sex: kidRandom() < 0.53 ? 'male' : 'female',
        admission_reason: reason,
        from_ed: kidRandom() < 0.82,
        readmission_30d: kidRandom() < 0.04,
        isolation: reason === 'gastro' ? kidRandom() < 0.7 : reason === 'respiratory' ? kidRandom() < 0.4 : kidRandom() < 0.05,
        iv_antibiotics: ivAbx,
        iv_antibiotic_days: ivAbx ? Math.max(1, stay - 1) : null,
        peripheral_line_days: lineDays || null,
        phlebitis: lineDays > 0 && kidRandom() < 0.025,
        hai: kidRandom() < 0.012,
        fall: kidRandom() < 0.006,
        discharge_date: out ? discharge : '',
        outcome: out ? pick(kidRandom, [['home', 96], ['picu', 1.2], ['transfer_hospital', 2], ['against_advice', 0.8]]) : '',
      }
      kidNumber += 1 + Math.floor(kidRandom() * 3)
      const id = `reg-entry-paed-${entries.filter(item => item.registerId === DEMO_PAEDIATRICS_ID).length + 1}`
      entries.push({ id, registerId: DEMO_PAEDIATRICS_ID, entryDate: admission, periodStart: null, values, status: 'complete', locked: false, createdAt: `${admission}T10:00:00Z`, createdByLabel: 'Νοσηλεύτρια Παιδιατρικής' })
      identities[id] = { caseNumber: String(kidNumber), patientName: `Παιδί ${String.fromCharCode(913 + (entries.length % 24))}. ${pad(entries.length % 100)}` }
    }
  }
  // Ophthalmology and the delivery room: a total a month before the current month, a sheet a day in it.
  const sheetRandom = seeded(20261125)
  const sheetMeans = {
    [DEMO_OPHTHALMOLOGY_ID]: { cataract: 7.5, vitrectomy: 1.1, intravitreal: 2.6, other_local: 1.2 },
    [DEMO_DELIVERYROOM_ID]: { vaginal: 1.5, cs: 2.2, vbac: 0.15, multiple_vaginal: 0.03, multiple_cs: 0.07, born_before_arrival: 0.05, hysteroscopy: 0.5, septic: 0.15, pregnancy_monitoring: 0.2, cerclage: 0.05 },
  }
  for (const [registerId, means] of Object.entries(sheetMeans)) {
    const label = registerId === DEMO_OPHTHALMOLOGY_ID ? 'Προϊσταμένη Οφθαλμολογικού' : 'Μαία Αίθουσας Τοκετών'
    for (let back = 13; back >= 0; back -= 1) {
      const date = new Date(Date.UTC(year, month - 1 - back, 1))
      const y = date.getUTCFullYear(), m = date.getUTCMonth() + 1
      const days = new Date(Date.UTC(y, m, 0)).getUTCDate()
      const cell = (mean, factor) => ({ count: Math.max(0, Math.round(mean * factor * (0.6 + sheetRandom() * 0.8))) })
      if (back > 0) entries.push({ id: `reg-entry-${registerId}-${y}-${pad(m)}`, registerId, entryDate: `${y}-${pad(m)}-01`, periodStart: `${y}-${pad(m)}-01`, values: Object.fromEntries(Object.entries(means).map(([key, mean]) => [key, cell(mean, registerId === DEMO_OPHTHALMOLOGY_ID ? 21 : 30)])), status: 'complete', locked: back > 1, createdAt: `${y}-${pad(m)}-${pad(days)}T14:00:00Z`, createdByLabel: label })
      else {
        for (let day = 1; day <= days; day += 1) {
          const iso = `${y}-${pad(m)}-${pad(day)}`
          const weekday = new Date(`${iso}T00:00:00Z`).getUTCDay()
          if (iso >= today || (registerId === DEMO_OPHTHALMOLOGY_ID && (weekday === 0 || weekday === 6)) || sheetRandom() < 0.05) continue
          entries.push({ id: `reg-entry-${registerId}-${iso}`, registerId, entryDate: iso, periodStart: iso, values: Object.fromEntries(Object.entries(means).map(([key, mean]) => [key, cell(mean, 1)])), status: 'complete', locked: false, createdAt: `${iso}T15:00:00Z`, createdByLabel: label })
        }
      }
    }
  }
  // Cath lab: one card per patient procedure, its own seed.
  const cathRandom = seeded(20261117)
  let cathNumber = 10610000
  for (let back = 13; back >= 0; back -= 1) {
    const date = new Date(Date.UTC(year, month - 1 - back, 1))
    const y = date.getUTCFullYear(), m = date.getUTCMonth() + 1
    const days = new Date(Date.UTC(y, m, 0)).getUTCDate()
    const count = 52 + Math.floor(cathRandom() * 14)
    for (let index = 0; index < count; index += 1) {
      const day = `${y}-${pad(m)}-${pad(1 + Math.floor(cathRandom() * days))}`
      if (day > today) continue
      const kind = pick(cathRandom, [['angiography', 52], ['angioplasty', 28], ['pacemaker', 13], ['icd', 3], ['ep_study', 2], ['other', 2]])
      const indication = kind === 'pacemaker' || kind === 'icd' || kind === 'ep_study' ? 'rhythm' : kind === 'other' ? 'other' : pick(cathRandom, kind === 'angioplasty' ? [['stemi', 30], ['nstemi', 28], ['unstable_angina', 20], ['stable', 22]] : [['stemi', 6], ['nstemi', 24], ['unstable_angina', 22], ['stable', 48]])
      const values = {
        date: day,
        procedures: kind === 'angioplasty' && cathRandom() < 0.9 ? ['angiography', 'angioplasty'] : [kind],
        indication,
        urgent: indication === 'stemi' ? true : indication === 'nstemi' || indication === 'unstable_angina' ? cathRandom() < 0.45 : cathRandom() < 0.05,
        age: Math.round(48 + cathRandom() * 38),
        sex: cathRandom() < 0.68 ? 'male' : 'female',
        to_surgery: kind === 'angiography' ? cathRandom() < 0.1 : false,
      }
      cathNumber += 1 + Math.floor(cathRandom() * 3)
      const id = `reg-entry-cath-${entries.filter(item => item.registerId === DEMO_CATHLAB_ID).length + 1}`
      entries.push({ id, registerId: DEMO_CATHLAB_ID, entryDate: day, periodStart: null, values, status: 'complete', locked: false, createdAt: `${day}T12:00:00Z`, createdByLabel: 'Νοσηλεύτρια Αιμοδυναμικού' })
      identities[id] = { caseNumber: String(cathNumber), patientName: '' }
    }
  }
  // Chemotherapy: one card per patient, active until an end date; about a third have finished.
  const chemoRandom = seeded(20261121)
  let chemoNumber = 10520000
  for (let back = 13; back >= 0; back -= 1) {
    const date = new Date(Date.UTC(year, month - 1 - back, 1))
    const y = date.getUTCFullYear(), m = date.getUTCMonth() + 1
    const days = new Date(Date.UTC(y, m, 0)).getUTCDate()
    const count = 9 + Math.floor(chemoRandom() * 6)
    for (let index = 0; index < count; index += 1) {
      const start = `${y}-${pad(m)}-${pad(1 + Math.floor(chemoRandom() * days))}`
      if (start > today) continue
      const length = 60 + Math.floor(chemoRandom() * 200)
      const end = addDays(start, length)
      const finished = end <= today && chemoRandom() < 0.8
      const diagnosis = pick(chemoRandom, [['C50', 28], ['C34', 20], ['C18', 12], ['C56', 9], ['C25', 8], ['C16', 7], ['C61', 6], ['C83', 4]])
      const values = {
        birth_date: addDays(start, -Math.round((42 + chemoRandom() * 42) * 365.25)),
        sex: diagnosis === 'C50' || diagnosis === 'C56' ? 'female' : diagnosis === 'C61' ? 'male' : chemoRandom() < 0.5 ? 'male' : 'female',
        start_date: start,
        diagnosis,
        physician: pick(chemoRandom, [['dr_a', 4], ['dr_b', 3], ['dr_c', 3]]),
        regimen: pick(chemoRandom, [['FOLFOX', 3], ['AC-T', 3], ['Carboplatin / Paclitaxel', 3], ['Gemcitabine', 1]]),
        end_date: finished ? end : '',
        end_reason: finished ? pick(chemoRandom, [['Ολοκλήρωση κύκλων', 7], ['Αλλαγή θεραπείας', 2], ['Διακοπή λόγω τοξικότητας', 1]]) : '',
      }
      chemoNumber += 1 + Math.floor(chemoRandom() * 3)
      const id = `reg-entry-chemo-${entries.filter(item => item.registerId === DEMO_CHEMO_ID).length + 1}`
      entries.push({ id, registerId: DEMO_CHEMO_ID, entryDate: start, periodStart: null, values, status: 'complete', locked: false, createdAt: `${start}T11:00:00Z`, createdByLabel: 'Νοσηλεύτρια Χημειοθεραπείας' })
      identities[id] = { caseNumber: String(chemoNumber), patientName: `Ασθενής Χ-${pad(entries.length % 100)}` }
    }
  }
  return { entries, identities }
}
