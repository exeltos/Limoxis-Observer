import fs from 'node:fs'
import { describe, expect, it } from 'vitest'
import { filterControlRows } from '../src/features/controls/controlFilters'

const page = fs.readFileSync('src/features/controls/ControlsPage.jsx', 'utf8')
const record = fs.readFileSync('src/features/controls/ControlRecordPage.jsx', 'utf8')
const editor = fs.readFileSync('src/features/controls/ControlEditor.jsx', 'utf8')
const expiry = fs.readFileSync('src/features/controls/ControlExpiryPanel.jsx', 'utf8')

const row = (id, extra = {}) => ({
  item: { id, title: id, category: 'Θερμοκρασίες', frequency: { kind: 'weekly', interval: 1 }, responseConfig: { criticality: 'high' }, ...extra },
  departments: ['ΜΕΘ'],
})

describe('controls list: department cards, key figures per tab, no filter popover', () => {
  it('opens on the department cards, with the key figures of the open tab under the tabs', () => {
    expect(page).toContain("value:'departments',label:tx.departments,icon:LayoutGrid")
    expect(page).toContain('<ControlDepartmentCards cards={cards}')
    expect(page).toContain('function openDepartment(dep){setDepartment(dep);setStatus(\'all\');setView(\'programme\')}')
    expect(page.indexOf('<CanonicalTabs')).toBeLessThan(page.indexOf('<ControlsKpis view={activeView}'))
    expect(page).not.toContain('module-summary-strip')
    expect(page).not.toContain('<Kpi ')
  })

  it('has no filter popover: the department is a chip and the status two toggle chips', () => {
    const bar = page.slice(page.indexOf('<FilterBar'), page.indexOf('</FilterBar>'))
    // The only select beside the search is the period of the rates.
    expect(bar).not.toContain('<FilterSelect ')
    expect(page).toContain('const periodSelect=<FilterSelect className="controls-period-select" label={tx.period}')
    expect(bar).toContain("activeFilters={department!=='all'&&showCards?")
    expect(bar).toContain('<ChoiceChips className="controls-status-switch"')
    expect(page).toContain('registry.loadViewState({query:')
    expect(page).toContain("registry.saveViewState({query,department,status,view,period})")
  })

  it('finds frequency, type and criticality through the search box, in both languages', () => {
    const rows = [row('A'), row('B', { frequency: { kind: 'daily', timesPerDay: 1, times: ['09:00'] }, responseConfig: { criticality: 'low' }, category: 'Καθαριότητα' })]
    const ids = (query) => filterControlRows(rows, { query }).map((r) => r.item.id)
    expect(ids('εβδομαδιαία')).toEqual(['A'])
    expect(ids('weekly')).toEqual(['A'])
    expect(ids('καθημερινά')).toEqual(['B'])
    expect(ids('υψηλή')).toEqual(['A'])
    expect(ids('καθαριότητα')).toEqual(['B'])
  })
})

describe('one place per action (Ο6)', () => {
  it('has no «Στο ημερολόγιο» button; the calendar link keeps working', () => {
    expect(page).not.toContain('toCalendar')
    expect(page).toContain("get('tab')==='calendar'")
  })

  it('records from the header only for one department, otherwise only from the department rows', () => {
    expect(record).toContain('{canExecute&&visibleDepartments.length===1&&!heldBack(department)&&<ActionButton')
    expect(record).toContain('{allowed&&assignments.length>1&&!heldBack(dep)&&<ActionButton')
  })

  it('has one export per tab: the expiry panel hands its form to the page menu', () => {
    expect(expiry).toContain('{!onExportChange&&<ExportMenu')
    expect(page).toContain('onExportChange={setExpiryExport}')
    expect(record).toContain('onExportChange={setExpiryExport}')
  })

  it('leaves «Δημιουργία» as the only create button of an empty list', () => {
    expect(page).not.toContain('emptyAction=')
    expect(page).toContain('πατήστε «Δημιουργία» πάνω δεξιά')
  })

  it('saves from the form footer only', () => {
    expect(editor).not.toContain('headerActions=')
    expect((editor.match(/<FormSubmit /g) || []).length).toBe(1)
    expect(editor).not.toContain('<SaveButton ')
    expect(editor).toContain('<div className="inline-edit-footer control-editor-footer"')
  })
})

describe('control record page (Ο5)', () => {
  it('shows the values as a DetailList on the card, without a second title or frame', () => {
    expect(record).toContain("import { DetailList } from '../../design-system/DetailList'")
    expect(record).not.toContain('RecordDetailsGrid')
    expect(record).not.toContain('RecordTabPanel')
    expect(record).not.toContain("<SectionHeader title={en?'Control details'")
    expect(record).not.toContain("title={en?'Executions':'Εκτελέσεις'} subtitle")
  })

  it('has one «…» menu per execution row, with the print inside it', () => {
    expect(record).toContain("id:'entry-form'")
    expect(record).not.toContain('<ExportMenu compact')
    expect((record.match(/<OverflowMenu items=\{historyActions\(h\)\}/g) || []).length).toBe(1)
  })
})

describe('control form: three tabs, one row per department', () => {
  it('puts every required field on «Details», per-department differences and instructions on their own tabs', () => {
    expect(editor).toContain("activeTab={tab} onTabChange={setTab}")
    const details = editor.indexOf("{tab==='details'&&<>")
    const departments = editor.indexOf("{tab==='departments'&&<>")
    const instructions = editor.indexOf("{tab==='instructions'&&<>")
    expect(details).toBeGreaterThan(0)
    expect(details).toBeLessThan(departments)
    expect(departments).toBeLessThan(instructions)
    expect(editor.indexOf('<MultiSelect className="control-departments-select"')).toBeGreaterThan(departments)
    for (const required of ["What is checked", "en?'Schedule':'Προγραμματισμός'", "How it is recorded"]) {
      const at = editor.indexOf(required)
      expect(at).toBeGreaterThan(details)
      expect(at).toBeLessThan(departments)
    }
    expect(editor.indexOf("Actions on deviation':'Ενέργειες σε απόκλιση'}><textarea")).toBeGreaterThan(instructions)
    expect(editor).not.toContain('<MoreSection')
  })

  it('shows one table row per department, pauses and resumes departments, and opens the tab with what Save finds missing', () => {
    expect(editor).toContain('<table className="data-table control-editor-department-table">')
    expect(editor).toContain('<ControlDepartmentSchedules compact departments={[dep]}')
    expect(editor).toContain('<ControlDepartmentResponses compact departments={[dep]}')
    // A department's own schedule or limits open full width under its row.
    expect(editor).toContain('<ControlDepartmentSchedules compact part="fields" departments={[dep]}')
    expect(editor).toContain("onClickCapture={()=>{if(!form.valid)setTab(draft.departments.length?'details':'departments')}}")
    // Pausing keeps the department's history; a paused department comes back with «Resume».
    expect(editor).toContain("onClick={()=>set('departments',draft.departments.filter(x=>x!==dep))}")
    expect(editor).toContain("onClick={()=>set('departments',[...draft.departments,dep])}")
    expect(editor.indexOf('inline-edit-footer control-editor-footer')).toBeGreaterThan(editor.indexOf("{tab==='instructions'&&<>"))
  })
})
