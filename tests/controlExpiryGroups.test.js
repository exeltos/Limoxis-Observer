import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const panel = readFileSync('src/features/controls/ControlExpiryPanel.jsx', 'utf8')
const form = readFileSync('src/features/controls/ControlExecutionForm.jsx', 'utf8')

describe('expiry: groups, department cards and «All in order»', () => {
  it('opens a department from its card in a dialog, grouped and printable', () => {
    expect(panel).toContain('className="control-expiry-departments"')
    expect(panel).toContain('<ObserverDialog width="workspace" className="control-expiry-dialog"')
    expect(panel).toContain('onClick:()=>printList(dialog,dialogItems)}')
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
