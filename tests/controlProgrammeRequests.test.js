// Controls programme: what it asks the database for. The whole programme
// starts every read at once (no waiting on the definitions for the
// assignments), and expiry controls read only the entries flagged as carrying
// an item list (has_item_list, indexed), never a jsonb filter over all entries.
import { beforeEach, describe, expect, it, vi } from 'vitest'

const calls = []
let definitionsGate
const rows = {
  control_definitions: [
    { id: 'def-1', code: 'CTRL-1', title: 'Ψυγείο', category: 'Φάρμακα', status: 'active', response_config: { mode: 'list', template: 'medication_expiry' }, frequency_config: { kind: 'monthly' } },
    { id: 'def-2', code: 'CTRL-2', title: 'Απολύμανση', category: 'Καθαριότητα', status: 'active', response_config: {}, frequency_config: { kind: 'daily' } },
  ],
  control_assignments: [
    { id: 'asg-1', control_id: 'def-1', department_id: 'dep-1', department: { id: 'dep-1', name: 'ΜΕΘ' }, status: 'scheduled' },
    { id: 'asg-2', control_id: 'def-2', department_id: 'dep-1', department: { id: 'dep-1', name: 'ΜΕΘ' }, status: 'scheduled' },
  ],
  control_drafts: [],
  control_executions: [],
}

function builder(table) {
  const call = { table, filters: [] }
  calls.push(call)
  const chain = {}
  for (const method of ['select', 'eq', 'neq', 'in', 'not', 'gte', 'lt', 'order', 'range', 'limit', 'is']) {
    chain[method] = (...args) => { call.filters.push([method, ...args]); return chain }
  }
  chain.then = (resolve, reject) => {
    const result = { data: rows[table] || [], error: null }
    const gate = table === 'control_definitions' ? definitionsGate : Promise.resolve()
    return gate.then(() => result).then(resolve, reject)
  }
  return chain
}

vi.mock('../src/core/supabase/client', () => ({
  supabase: {
    from: table => builder(table),
    rpc: (name, args) => { calls.push({ table: `rpc:${name}`, filters: [], args }); return Promise.resolve({ data: [], error: null }) },
  },
}))
vi.mock('../src/core/supabase/cloudContext', () => ({ assertCloud: () => {}, currentUserId: async () => 'user-1' }))

const { loadControlCategories, loadControlProgramme, loadExpiryProgramme } = await import('../src/features/controls/controlCloudService')

describe('controls programme requests', () => {
  beforeEach(() => { calls.length = 0 })

  it('asks for the assignments with the definitions, not after them', async () => {
    let open
    definitionsGate = new Promise(resolve => { open = resolve })
    const pending = loadControlProgramme('org-1')
    await Promise.resolve()
    expect(calls.map(c => c.table)).toEqual(expect.arrayContaining(['control_definitions', 'control_drafts', 'control_assignments', 'rpc:control_assignment_summary', 'rpc:control_period_progress']))
    open()
    const programme = await pending
    expect(programme.map(row => row.id)).toEqual(['CTRL-1', 'CTRL-2'])
    expect(calls.filter(c => c.table === 'control_assignments')).toHaveLength(1)
  })

  it('reads the expiry item lists through the indexed flag', async () => {
    definitionsGate = Promise.resolve()
    await loadControlProgramme('org-1')
    const executions = calls.filter(c => c.table === 'control_executions')
    expect(executions).toHaveLength(1)
    expect(executions[0].filters).toEqual(expect.arrayContaining([['in', 'control_id', ['def-1']], ['eq', 'has_item_list', true]]))
    expect(executions[0].filters.some(([method]) => method === 'not')).toBe(false)
  })

  it('reads one control with its own assignments and recent entries', async () => {
    definitionsGate = Promise.resolve()
    await loadControlProgramme('org-1', { code: 'CTRL-2' })
    const assignments = calls.filter(c => c.table === 'control_assignments')
    expect(assignments).toHaveLength(1)
    expect(assignments[0].filters).toEqual(expect.arrayContaining([['in', 'control_id', ['def-1', 'def-2']]]))
    expect(calls.some(c => c.table === 'rpc:control_assignment_summary')).toBe(true)
    // The recent entries of every department in one request, not one per assignment.
    const recent = calls.filter(c => c.table === 'rpc:control_recent_executions')
    expect(recent).toHaveLength(1)
    expect(recent[0].args).toEqual({ p_organization_id: 'org-1', p_assignment_ids: ['asg-1', 'asg-2'], p_limit: 50 })
    expect(calls.filter(c => c.table === 'control_executions')).toHaveLength(1)
  })

  it('reads for the bell only the expiry controls, their assignments and item lists', async () => {
    definitionsGate = Promise.resolve()
    const programme = await loadExpiryProgramme('org-1')
    expect(programme.map(row => row.id)).toEqual(['CTRL-1'])
    expect(calls.map(c => c.table).sort()).toEqual(['control_assignments', 'control_definitions', 'control_executions'])
    expect(calls.find(c => c.table === 'control_definitions').filters).toEqual(expect.arrayContaining([['eq', 'response_config->>template', 'medication_expiry']]))
    expect(calls.find(c => c.table === 'control_assignments').filters).toEqual(expect.arrayContaining([['in', 'control_id', ['def-1']]]))
    const executions = calls.find(c => c.table === 'control_executions').filters
    expect(executions).toEqual(expect.arrayContaining([['select', 'id,assignment_id,control_id,performed_at,status,response_data'], ['in', 'control_id', ['def-1']], ['eq', 'has_item_list', true]]))
  })

  it('reads the category suggestions as one column', async () => {
    definitionsGate = Promise.resolve()
    expect(await loadControlCategories('org-1')).toEqual(['Φάρμακα', 'Καθαριότητα'])
    expect(calls).toHaveLength(1)
    expect(calls[0].filters[0]).toEqual(['select', 'category'])
  })
})
