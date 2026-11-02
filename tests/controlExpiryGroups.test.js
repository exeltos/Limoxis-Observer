import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const panel = readFileSync('src/features/controls/ControlExpiryPanel.jsx', 'utf8')
const form = readFileSync('src/features/controls/ControlExecutionForm.jsx', 'utf8')

describe('expiry: groups and «All in order»', () => {
  it('shows the list of items straight away, grouped, with the department in each line and printable', () => {
    expect(panel).toContain('<ExpiryGroupList items={searched} showDepartment={several}')
    expect(panel).not.toContain('control-expiry-departments')
    expect(panel).not.toContain('ObserverDialog')
    expect(panel).not.toContain('RegistryPagination')
  })
  it('groups expired, expiring soon, findings check by check, and keeps in-date items closed', () => {
    expect(panel).toContain("else if(item.state==='expired')put('expired',{kind:'expired'},item)")
    expect(panel).toContain("const closed=group.head.kind==='ok'")
    expect(panel).toContain('className="control-expiry-remove"')
    expect(panel).not.toContain('OverflowMenu')
  })
  it('saves «All in order» without items: full compliance, no finding, the list kept', () => {
    expect(form).toContain("if(expiryControl&&allOk)return {value:en?'Full compliance':'Πλήρης συμμόρφωση'")
    expect(form).toContain('rows:rows.filter(r=>r.fromCatalogue),allOk:true},hasFinding:false')
    expect(form).toContain("const hasFinding=!(expiryControl&&allOk)&&")
  })
})

describe('the page of a control: rates, missed executions and the time of each entry', () => {
  const record = readFileSync('src/features/controls/ControlRecordPage.jsx', 'utf8')
  it('shows the responsible, the adherence of the period and the missed executions per department', () => {
    expect(record).toContain("{key:'responsible'")
    expect(record).toContain('useAdherenceLines(')
    expect(record).toContain('<ControlMissedDialog')
  })
  it('lists the executions of a period with the control time, no email and the missed ones on request', () => {
    expect(record).toContain("{key:'slot',label:en?'Control time':'Ώρα ελέγχου'}")
    expect(record).toContain('from:periodRange(period,new Date()).from')
    // The period, the department and the missed ones are selects of one «Filters» button; the date column sorts the whole list.
    expect(record).toContain("label={en?'Executions':'Εκτελέσεις'}")
    expect(record).toContain("sort={{key:'at',dir:historyOrder}}")
    expect(record).not.toContain("<small>{h.email||''}</small>")
  })
})
