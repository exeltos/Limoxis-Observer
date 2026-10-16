// @vitest-environment jsdom
// Behavior of the prevention antiseptic and waste editors and of the antiseptic
// cloud service. Replaces source-text assertions (antisepticHospitalScope,
// preventionWasteBlankDefaults, preventionWasteSaveAndLayout) that pinned the
// formatting of these files instead of what they do.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'

vi.mock('../src/core/auth/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'user-1', email: 'nurse@example.org' }, profile: { id: 'user-1', fullName: 'Test Nurse', email: 'nurse@example.org' } }),
}))

let queries
let respond
function builder(table) {
  const query = { table, op: 'select', payload: null, filters: [] }
  queries.push(query)
  const chain = {
    select() { return chain },
    insert(payload) { query.op = 'insert'; query.payload = payload; return chain },
    update(payload) { query.op = 'update'; query.payload = payload; return chain },
    delete() { query.op = 'delete'; return chain },
    eq(column, value) { query.filters.push(['eq', column, value]); return chain },
    order() { return chain },
    single() { query.single = true; return chain },
    maybeSingle() { query.single = true; return chain },
    then(resolve, reject) { return Promise.resolve(respond(query)).then(resolve, reject) },
  }
  return chain
}
// The central libraries (Management > Libraries) the editors read their lists
// from; empty unless a test fills them, so the screen's own lists are used.
let centralDepartments = []
let centralLibraries = {}
vi.mock('../src/features/management/useLibraries', async importOriginal => {
  const actual = await importOriginal()
  return {
    ...actual,
    useLibraries: () => ({ libraries: centralLibraries, departments: centralDepartments, loading: false, error: '' }),
    useDepartments: () => ({ departments: centralDepartments, loading: false, error: '' }),
  }
})

vi.mock('../src/core/supabase/client', () => ({
  supabase: { from: table => builder(table), auth: { getUser: async () => ({ data: { user: { id: 'actor-1' } }, error: null }) } },
}))

const { LanguageProvider, loadLanguage } = await import('../src/core/i18n/LanguageContext')
const { AntisepticEntryEditor, HOSPITAL_SCOPE } = await import('../src/features/prevention/AntisepticEntryEditor')
const { WasteEntryEditor } = await import('../src/features/prevention/WasteEntryEditor')
const service = await import('../src/features/prevention/antisepticCloudService')
const wasteService = await import('../src/features/prevention/wasteCloudService')
const handHygieneService = await import('../src/features/prevention/handHygieneCloudService')

const departments = [{ id: 'dep-1', el: 'Παθολογική', en: 'Internal Medicine' }, { id: 'dep-2', el: 'Χειρουργική', en: 'Surgery' }]
const products = [{ id: 'prod-1', el: 'Αλκοολούχο αντισηπτικό', en: 'Alcohol hand rub', code: 'ANT-ABHR', metadata: { is_abhr: true } }, { id: 'prod-2', el: 'Χλωρεξιδίνη', en: 'Chlorhexidine', code: 'ANT-CHX', metadata: {} }]
const wasteTypes = [{ id: 'wt-1', el: 'ΕΑΑΜ', en: 'Hazardous infectious' }, { id: 'wt-2', el: 'Αστικά', en: 'Municipal' }]

const wrap = node => <LanguageProvider>{node}</LanguageProvider>
// Lists are SearchableSelects: a combobox named by its field title whose
// listbox opens on click; the input shows the chosen option's label.
const combo = name => screen.getByRole('combobox', { name })
const listOf = name => screen.getByRole('listbox', { name, hidden: true })
const optionLabels = name => {
  fireEvent.click(combo(name))
  const labels = [...listOf(name).querySelectorAll('.searchable-select-option-label')].map(node => node.textContent)
  fireEvent.blur(combo(name))
  return labels
}
const pick = (name, label) => {
  fireEvent.click(combo(name))
  const option = [...listOf(name).querySelectorAll('[role="option"]')].find(node => node.querySelector('.searchable-select-option-label')?.textContent === label)
  if (!option) throw new Error(`no option «${label}» in «${name}»`)
  fireEvent.click(option)
}
const clear = name => fireEvent.click(combo(name).closest('.searchable-select').querySelector('.searchable-select-clear'))
const fieldInput = labelText => screen.getByText(labelText).closest('label').querySelector('input')
const button = name => screen.getByRole('button', { name })

beforeEach(() => {
  window.localStorage.clear()
  centralDepartments = []
  centralLibraries = {}
})
afterEach(() => {
  cleanup()
  window.localStorage.clear()
})

// Rule A1: the antiseptic scope choice offers an explicit whole-hospital scope
// (HOSPITAL_SCOPE) next to departments, and choosing it saves departmentScope
// 'hospital'; choosing a department saves departmentScope 'department'.
describe('antiseptic editor: whole-hospital scope', () => {
  it('lists the whole-hospital scope alongside the departments (Greek and English)', async () => {
    expect(HOSPITAL_SCOPE).toBe('__hospital__')
    const { unmount } = render(wrap(<AntisepticEntryEditor departments={departments} products={products} onSave={vi.fn()} onCancel={vi.fn()}/>))
    expect(combo('Εύρος / Τμήμα *')).toHaveProperty('placeholder', 'Επιλέξτε εύρος')
    expect(optionLabels('Εύρος / Τμήμα *')).toEqual(['Όλο το νοσοκομείο', 'Παθολογική', 'Χειρουργική'])
    unmount()

    await loadLanguage('en')
    window.localStorage.setItem('limoxis.language', 'en')
    render(wrap(<AntisepticEntryEditor departments={departments} products={products} onSave={vi.fn()} onCancel={vi.fn()}/>))
    expect(optionLabels('Scope / department *')[0]).toBe('Whole hospital')
  })

  it('saves a whole-hospital record with departmentScope hospital', async () => {
    const onSave = vi.fn()
    render(wrap(<AntisepticEntryEditor departments={departments} products={products} onSave={onSave} onCancel={vi.fn()}/>))
    pick('Εύρος / Τμήμα *', 'Όλο το νοσοκομείο')
    await act(async () => { fireEvent.click(button('Αποθήκευση κατανάλωσης')) })
    expect(onSave).toHaveBeenCalledTimes(1)
    expect(onSave.mock.calls[0][0]).toMatchObject({ departmentScope: 'hospital', departmentEl: 'Όλο το νοσοκομείο', departmentEn: 'Whole hospital' })
  })

  it('saves a department record with departmentScope department', async () => {
    const onSave = vi.fn()
    render(wrap(<AntisepticEntryEditor departments={departments} products={products} onSave={onSave} onCancel={vi.fn()}/>))
    pick('Εύρος / Τμήμα *', 'Χειρουργική')
    await act(async () => { fireEvent.click(button('Αποθήκευση κατανάλωσης')) })
    expect(onSave.mock.calls[0][0]).toMatchObject({ departmentScope: 'department', departmentEl: 'Χειρουργική', departmentEn: 'Surgery' })
  })

  it('offers the central departments, keeps the Greek name and the loaded English name', async () => {
    centralDepartments = [{ id: 'dep-1', name: 'Παθολογική', nameEn: 'Internal Medicine' }, { id: 'dep-3', name: 'ΤΕΠ', nameEn: 'Emergency Department' }]
    const onSave = vi.fn()
    render(wrap(<AntisepticEntryEditor departments={[...departments, { id: 'dep-ed', el: 'ΤΕΠ', en: 'ED' }]} products={products} onSave={onSave} onCancel={vi.fn()}/>))
    expect(optionLabels('Εύρος / Τμήμα *')).toEqual(['Όλο το νοσοκομείο', 'Παθολογική', 'ΤΕΠ'])
    pick('Εύρος / Τμήμα *', 'ΤΕΠ')
    await act(async () => { fireEvent.click(button('Αποθήκευση κατανάλωσης')) })
    expect(onSave.mock.calls[0][0]).toMatchObject({ departmentScope: 'department', departmentEl: 'ΤΕΠ', departmentEn: 'ED' })
  })

  it('keeps showing a stored department the library no longer has', () => {
    render(wrap(<AntisepticEntryEditor departments={departments} products={products} initialRecord={{ id: 'ANT-1', period: '2026-08', departmentScope: 'department', departmentEl: 'Παλιό τμήμα', product: 'Χλωρεξιδίνη', antisepticItemId: 'prod-2', litres: 2, method: 'pharmacy_issue' }} onSave={vi.fn()} onCancel={vi.fn()}/>))
    expect(combo('Εύρος / Τμήμα *').value).toBe('Παλιό τμήμα')
    expect(combo('Προϊόν *').value).toBe('Χλωρεξιδίνη')
  })
})

// Rule A2: when products arrive after the first render the first product is
// selected so Save can enable; Save is not held disabled just because support
// arrays were empty; Save needs period, scope/department and product.
describe('antiseptic editor: product hydration and save readiness', () => {
  it('selects the first product once support data arrives and then enables Save', async () => {
    const onSave = vi.fn()
    const props = { departments: [], products: [], onSave, onCancel: vi.fn() }
    const { rerender } = render(wrap(<AntisepticEntryEditor {...props}/>))
    pick('Εύρος / Τμήμα *', 'Όλο το νοσοκομείο')
    expect(button('Αποθήκευση κατανάλωσης').disabled).toBe(true)

    rerender(wrap(<AntisepticEntryEditor {...props} products={products}/>))
    expect(combo('Προϊόν *').value).toBe('Αλκοολούχο αντισηπτικό')
    // departments are still empty: the whole-hospital scope alone is enough
    expect(button('Αποθήκευση κατανάλωσης').disabled).toBe(false)
    await act(async () => { fireEvent.click(button('Αποθήκευση κατανάλωσης')) })
    expect(onSave.mock.calls[0][0]).toMatchObject({ antisepticItemId: 'prod-1', product: 'Αλκοολούχο αντισηπτικό', departmentScope: 'hospital' })
  })

  it('keeps Save disabled without a product', () => {
    render(wrap(<AntisepticEntryEditor departments={departments} products={[]} onSave={vi.fn()} onCancel={vi.fn()}/>))
    pick('Εύρος / Τμήμα *', 'Παθολογική')
    expect(combo('Προϊόν *').value).toBe('')
    expect(button('Αποθήκευση κατανάλωσης').disabled).toBe(true)
  })

  it('takes the products from the central antiseptics library, keeping the loaded ids', async () => {
    centralLibraries = { antiseptics: [{ value: 'Χλωρεξιδίνη', code: 'ANT-CHX', el: 'Χλωρεξιδίνη', en: 'Chlorhexidine', meta: {} }, { value: 'Ιωδιούχος ποβιδόνη', code: 'ANT-PVP', el: 'Ιωδιούχος ποβιδόνη', en: 'Povidone-iodine', meta: { id: 'lib-pvp' } }] }
    const onSave = vi.fn()
    render(wrap(<AntisepticEntryEditor departments={departments} products={products} onSave={onSave} onCancel={vi.fn()}/>))
    expect(optionLabels('Προϊόν *')).toEqual(['Χλωρεξιδίνη', 'Ιωδιούχος ποβιδόνη'])
    expect(combo('Προϊόν *').value).toBe('Χλωρεξιδίνη')
    pick('Εύρος / Τμήμα *', 'Παθολογική')
    await act(async () => { fireEvent.click(button('Αποθήκευση κατανάλωσης')) })
    expect(onSave.mock.calls[0][0]).toMatchObject({ antisepticItemId: 'prod-2', product: 'Χλωρεξιδίνη', productCode: 'ANT-CHX' })
  })

  it('enables Save only with period and department once a product is selected', () => {
    render(wrap(<AntisepticEntryEditor departments={departments} products={products} onSave={vi.fn()} onCancel={vi.fn()}/>))
    const save = button('Αποθήκευση κατανάλωσης')
    expect(save.disabled).toBe(true) // no department yet
    pick('Εύρος / Τμήμα *', 'Παθολογική')
    expect(save.disabled).toBe(false)
    clear('Εύρος / Τμήμα *')
    expect(save.disabled).toBe(true)
    pick('Εύρος / Τμήμα *', 'Παθολογική')
    pick('Προϊόν *', 'Χλωρεξιδίνη')
    expect(save.disabled).toBe(false)
    fireEvent.change(screen.getByRole('combobox', { name: 'Μήνας' }), { target: { value: '' } })
    expect(save.disabled).toBe(true)
  })
})

// Rule B: a whole-hospital antiseptic record is stored with department_id null;
// hospital-wide patient-days use the hospital-total row (department_id null)
// and, when there is none, the sum of the department rows.
describe('antiseptic cloud service: hospital scope', () => {
  let patientDayRows
  beforeEach(() => {
    queries = []
    patientDayRows = []
    respond = query => {
      if (query.table === 'departments') return { data: [{ id: 'dep-1', name: 'Παθολογική' }], error: null }
      if (query.table === 'master_library_items') return { data: [{ id: 'prod-1', name_el: 'Αλκοολούχο', name_en: 'Hand rub', code: 'ANT-ABHR', metadata: { is_abhr: true } }], error: null }
      if (query.table === 'patient_day_periods') return { data: patientDayRows, error: null }
      if (query.op === 'insert') return { data: { id: 'ant-new', ...query.payload }, error: null }
      return { data: [], error: null }
    }
  })
  const inserts = () => queries.filter(q => q.table === 'antiseptic_consumption_periods' && q.op === 'insert')

  it('stores a whole-hospital record with a null department', async () => {
    await service.saveAntisepticRecord('org-1', { departmentScope: 'hospital', departmentEl: 'Όλο το νοσοκομείο', antisepticItemId: 'prod-1', period: '2026-08', litres: 3, method: 'pharmacy_issue' })
    const [insert] = inserts()
    expect(insert.payload).toMatchObject({ organization_id: 'org-1', department_id: null, antiseptic_item_id: 'prod-1', period_start: '2026-08-01', period_end: '2026-08-31', created_by: 'actor-1' })
  })

  it('stores a department record with its department id', async () => {
    await service.saveAntisepticRecord('org-1', { departmentScope: 'department', departmentEl: 'Παθολογική', antisepticItemId: 'prod-1', period: '2026-08', litres: 3 })
    expect(inserts()[0].payload.department_id).toBe('dep-1')
  })

  it('sums department rows when there is no hospital-total row', async () => {
    patientDayRows = [{ department_id: 'dep-1', patient_days: 300 }, { department_id: 'dep-2', patient_days: '150' }]
    await expect(service.findPatientDaysForPeriod('org-1', null, '2026-08-01', '2026-08-31')).resolves.toBe(450)
    const [query] = queries.filter(q => q.table === 'patient_day_periods')
    expect(query.filters).toEqual(expect.arrayContaining([['eq', 'organization_id', 'org-1'], ['eq', 'period_start', '2026-08-01'], ['eq', 'period_end', '2026-08-31'], ['eq', 'review_status', 'approved']]))
    expect(query.filters.some(([, column]) => column === 'department_id')).toBe(false)
  })

  it('prefers the hospital-total row when one exists', async () => {
    patientDayRows = [{ department_id: 'dep-1', patient_days: 300 }, { department_id: null, patient_days: 1000 }]
    await expect(service.findPatientDaysForPeriod('org-1', null, '2026-08-01', '2026-08-31')).resolves.toBe(1000)
  })

  it('returns null for hospital scope when no rows exist', async () => {
    await expect(service.findPatientDaysForPeriod('org-1', null, '2026-08-01', '2026-08-31')).resolves.toBeNull()
  })
})

const WASTE_SAVE = 'Αποθήκευση μέτρησης'
function fillWastePeriod(container, start = '2026-08-01', end = '2026-08-31') {
  const [startInput, endInput] = container.querySelectorAll('input.manual-date-native')
  fireEvent.change(startInput, { target: { value: start } })
  fireEvent.change(endInput, { target: { value: end } })
}

// Rule C1: a new waste record starts with blank dates and no department, and an
// empty department is not auto-filled when departments arrive later.
describe('waste editor: blank defaults for a new record', () => {
  it('does not preselect the period dates or the department', () => {
    const { container } = render(wrap(<WasteEntryEditor departments={departments} wasteTypes={wasteTypes} onSave={vi.fn()} onCancel={vi.fn()}/>))
    expect(combo('Τμήμα *').value).toBe('')
    expect(combo('Τμήμα *')).toHaveProperty('placeholder', 'Επιλέξτε τμήμα')
    expect(optionLabels('Τμήμα *')).toEqual(['Παθολογική', 'Χειρουργική'])
    for (const input of container.querySelectorAll('.waste-date-field input')) expect(input.value).toBe('')
  })

  it('shows the English empty department option', async () => {
    await loadLanguage('en')
    window.localStorage.setItem('limoxis.language', 'en')
    render(wrap(<WasteEntryEditor departments={departments} wasteTypes={wasteTypes} onSave={vi.fn()} onCancel={vi.fn()}/>))
    expect(combo('Department *').value).toBe('')
    expect(combo('Department *')).toHaveProperty('placeholder', 'Select department')
    expect(optionLabels('Department *')).toEqual(['Internal Medicine', 'Surgery'])
  })

  it('leaves the department empty when departments arrive after the first render', () => {
    const props = { departments: [], wasteTypes: [], onSave: vi.fn(), onCancel: vi.fn() }
    const { rerender } = render(wrap(<WasteEntryEditor {...props}/>))
    rerender(wrap(<WasteEntryEditor {...props} departments={departments} wasteTypes={wasteTypes}/>))
    expect(combo('Τμήμα *').value).toBe('')
    expect(button(WASTE_SAVE).disabled).toBe(true)
  })
})

// Rule C2: the waste type is hydrated from the first waste type when support
// data arrives after the first render.
describe('waste editor: waste type hydration', () => {
  it('selects the first waste type once support data arrives and saves it', async () => {
    const onSave = vi.fn()
    const props = { departments: [], wasteTypes: [], onSave, onCancel: vi.fn() }
    const { container, rerender } = render(wrap(<WasteEntryEditor {...props}/>))
    rerender(wrap(<WasteEntryEditor {...props} departments={departments} wasteTypes={wasteTypes}/>))
    expect(combo('Κατηγορία αποβλήτου *').value).toBe('ΕΑΑΜ')
    fillWastePeriod(container)
    pick('Τμήμα *', 'Παθολογική')
    fireEvent.change(fieldInput('Συνολικό βάρος περιόδου (kg) *'), { target: { value: '12.5' } })
    fireEvent.change(fieldInput('Περιέκτες'), { target: { value: '3' } })
    await act(async () => { fireEvent.click(button(WASTE_SAVE)) })
    expect(onSave).toHaveBeenCalledTimes(1)
    expect(onSave.mock.calls[0][0]).toMatchObject({ wasteTypeId: 'wt-1', wasteType: 'ΕΑΑΜ', type: 'ΕΑΑΜ', typeEn: 'Hazardous infectious', departmentEl: 'Παθολογική', weight: 12.5, containers: 3, periodStart: '2026-08-01', periodEnd: '2026-08-31' })
  })

  it('takes the categories from the central wasteTypes library and saves the chosen one', async () => {
    centralLibraries = { wasteTypes: [{ value: 'Αστικά', code: 'WASTE-MUN', el: 'Αστικά', en: 'Municipal', meta: {} }, { value: 'ΜΕΑ', code: 'WASTE-MEA', el: 'ΜΕΑ', en: 'Hazardous medical', meta: { id: 'lib-mea' } }] }
    const onSave = vi.fn()
    const { container } = render(wrap(<WasteEntryEditor departments={departments} wasteTypes={wasteTypes} onSave={onSave} onCancel={vi.fn()}/>))
    expect(optionLabels('Κατηγορία αποβλήτου *')).toEqual(['Αστικά', 'ΜΕΑ'])
    pick('Κατηγορία αποβλήτου *', 'ΜΕΑ')
    fillWastePeriod(container)
    pick('Τμήμα *', 'Χειρουργική')
    fireEvent.change(fieldInput('Συνολικό βάρος περιόδου (kg) *'), { target: { value: '2' } })
    fireEvent.change(fieldInput('Περιέκτες'), { target: { value: '1' } })
    await act(async () => { fireEvent.click(button(WASTE_SAVE)) })
    expect(onSave.mock.calls[0][0]).toMatchObject({ wasteTypeId: 'lib-mea', wasteType: 'ΜΕΑ', typeEn: 'Hazardous medical', departmentEl: 'Χειρουργική' })
  })
})

// Rule C3: Save enables once period, department, waste type, weight > 0 and
// containers >= 0 are given, and is not blocked because support arrays were
// empty on the first render (or the department list is empty for a fixed department).
describe('waste editor: save readiness', () => {
  it('enables Save only when every required field is valid', () => {
    const { container } = render(wrap(<WasteEntryEditor departments={departments} wasteTypes={wasteTypes} onSave={vi.fn()} onCancel={vi.fn()}/>))
    const save = button(WASTE_SAVE)
    fillWastePeriod(container)
    fireEvent.change(fieldInput('Περιέκτες'), { target: { value: '0' } })
    fireEvent.change(fieldInput('Συνολικό βάρος περιόδου (kg) *'), { target: { value: '4' } })
    expect(save.disabled).toBe(true) // no department
    pick('Τμήμα *', 'Χειρουργική')
    expect(save.disabled).toBe(false)
    fireEvent.change(fieldInput('Συνολικό βάρος περιόδου (kg) *'), { target: { value: '0' } })
    expect(save.disabled).toBe(true) // no weight
    fireEvent.change(fieldInput('Συνολικό βάρος περιόδου (kg) *'), { target: { value: '4' } })
    expect(save.disabled).toBe(false)
    fireEvent.change(fieldInput('Περιέκτες'), { target: { value: '-1' } })
    expect(save.disabled).toBe(true)
    fireEvent.change(fieldInput('Περιέκτες'), { target: { value: '2' } })
    fillWastePeriod(container, '2026-08-31', '2026-08-01')
    expect(save.disabled).toBe(true) // end before start
    fillWastePeriod(container)
    expect(save.disabled).toBe(false)
  })

  it('is not blocked by an empty department list when the department is fixed', () => {
    const props = { departments: [], wasteTypes: [], fixedDepartment: 'Παθολογική', onSave: vi.fn(), onCancel: vi.fn() }
    const { container, rerender } = render(wrap(<WasteEntryEditor {...props}/>))
    rerender(wrap(<WasteEntryEditor {...props} wasteTypes={wasteTypes}/>))
    fillWastePeriod(container)
    fireEvent.change(fieldInput('Συνολικό βάρος περιόδου (kg) *'), { target: { value: '4' } })
    fireEvent.change(fieldInput('Περιέκτες'), { target: { value: '1' } })
    expect(button(WASTE_SAVE).disabled).toBe(false)
  })
})

// Rule A2 (fixed department variant): antiseptic Save is not held disabled by
// an empty department list when the department is fixed.
describe('antiseptic editor: fixed department with empty department list', () => {
  it('enables Save once products arrive', () => {
    const props = { departments: [], products: [], fixedDepartment: 'Παθολογική', onSave: vi.fn(), onCancel: vi.fn() }
    const { rerender } = render(wrap(<AntisepticEntryEditor {...props}/>))
    expect(button('Αποθήκευση κατανάλωσης').disabled).toBe(true)
    rerender(wrap(<AntisepticEntryEditor {...props} products={products}/>))
    expect(button('Αποθήκευση κατανάλωσης').disabled).toBe(false)
  })
})

// Rule D: the Prevention services share one patient-days lookup and one delete
// through the recycle bin (prevention/preventionCloud.js).
describe('prevention cloud helpers', () => {
  let patientDayRows
  beforeEach(() => {
    queries = []
    patientDayRows = []
    respond = query => {
      if (query.table === 'patient_day_periods') return { data: patientDayRows, error: null }
      if (query.single) return { data: { id: 'HH-1', observation_date: '2026-08-02' }, error: null }
      if (query.op === 'select') return { data: [{ id: 'row-1' }], error: null }
      return { data: null, error: null }
    }
  })

  it('finds the approved waste patient-days of exactly that department and period', async () => {
    patientDayRows = [{ department_id: 'dep-1', patient_days: '612', period_start: '2026-08-01', period_end: '2026-08-31', source: null }]
    await expect(wasteService.findWastePatientDays('org-1', 'dep-1', '2026-08-01', '2026-08-31')).resolves.toEqual({ patientDays: 612, periodStart: '2026-08-01', periodEnd: '2026-08-31', source: 'library' })
    const [query] = queries.filter(q => q.table === 'patient_day_periods')
    expect(query.filters).toEqual(expect.arrayContaining([['eq', 'organization_id', 'org-1'], ['eq', 'department_id', 'dep-1'], ['eq', 'period_start', '2026-08-01'], ['eq', 'period_end', '2026-08-31'], ['eq', 'review_status', 'approved']]))
    queries = []
    await expect(wasteService.findWastePatientDays('org-1', '', { periodStart: '2026-08-01', periodEnd: '2026-08-31' })).resolves.toBeNull()
    expect(queries).toEqual([])
  })

  it('bins a hand-hygiene session, then deletes its observations before the session', async () => {
    await handHygieneService.deleteHandHygieneSession('org-1', 'HH-1')
    const bin = queries.find(q => q.table === 'recycle_bin')
    expect(bin.payload).toMatchObject({ organization_id: 'org-1', module: 'clinical', kind: 'hand_hygiene_sessions' })
    expect(bin.payload.payload.parts.map(part => part.table)).toEqual(['hand_hygiene_observations', 'hand_hygiene_sessions'])
    const deletes = queries.filter(q => q.op === 'delete')
    expect(deletes.map(q => [q.table, q.filters])).toEqual([
      ['hand_hygiene_observations', [['eq', 'organization_id', 'org-1'], ['eq', 'session_id', 'HH-1']]],
      ['hand_hygiene_sessions', [['eq', 'organization_id', 'org-1'], ['eq', 'id', 'HH-1']]],
    ])
  })
})
