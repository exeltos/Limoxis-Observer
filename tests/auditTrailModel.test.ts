import { describe, expect, it } from 'vitest'
import { describeAuditGroup, entityLabel, eventLabel, groupAuditEvents } from '../src/features/platform/auditTrailModel'

const at = minutes => new Date(Date.UTC(2026, 10, 10, 12, 0) + minutes * 60000).toISOString()
const row = (id, minutes, extra = {}) => ({ id, actorId: 'u1', actorName: 'Α', actorRole: 'hospital_admin', organizationId: 'o1', eventType: 'update', entityType: 'employees', entityId: `e${id}`, metadata: {}, createdAt: at(minutes), ...extra })

describe('audit trail in words', () => {
  it('names every kind of record and action, never the raw code', () => {
    expect(entityLabel('employees', false)).toBe('Εργαζόμενος')
    expect(entityLabel('organization_members', true)).toBe('Organization member')
    expect(entityLabel('quality_something_new', false)).toBe('Εγγραφή ποιότητας')
    expect(entityLabel('totally_unknown_table', false)).toBe('Άλλη εγγραφή')
    expect(entityLabel('totally_unknown_table', true)).toBe('Other record')
    expect(eventLabel('insert', false)).toBe('Δημιουργία')
    expect(eventLabel('organization.user.created_active', true)).toBe('Active user created')
    expect(eventLabel('some_new_event', false)).toBe('Άλλη ενέργεια')
    expect(eventLabel('some_new_event', true)).toBe('Other action')
  })
  it('collapses identical consecutive events within 15 minutes into one row with a count', () => {
    const rows = [row(1, 19), row(2, 15), row(3, 10), row(4, 4), row(5, -5), row(6, -60)]
    const groups = groupAuditEvents(rows)
    expect(groups).toHaveLength(2)
    expect(groups[0].count).toBe(5)
    expect(groups[1].count).toBe(1)
    const text = describeAuditGroup(groups[0], { en: false })
    expect(text.action).toBe('Ενημέρωση ×5')
    expect(text.entity).toBe('Εργαζόμενος')
    expect(text.when).toMatch(/^\d\d:\d\d–\d\d:\d\d$/)
    expect(text.technical).toContain('e1')
    expect(text.action + text.entity + text.name).not.toMatch(/employees|[0-9a-f]{8}-/)
  })
  it('does not merge a different person, kind of record or action, and keeps newest first', () => {
    const groups = groupAuditEvents([row(1, 10), row(2, 9, { actorId: 'u2' }), row(3, 8, { entityType: 'departments' }), row(4, 7, { eventType: 'delete' }), row(5, 6)])
    expect(groups.map(group => group.count)).toEqual([1, 1, 1, 1, 1])
    expect(groups.map(group => group.id)).toEqual([1, 2, 3, 4, 5])
  })
  it('shows the name of a single record when it is known, the identifier only as the tooltip', () => {
    const [group] = groupAuditEvents([row(1, 0, { entityType: 'organization', entityId: 'o1', eventType: 'update' })])
    const text = describeAuditGroup(group, { names: { organization: id => (id === 'o1' ? 'ΙΑΣΩ ΘΕΣΣΑΛΙΑΣ' : '') } })
    expect(text.name).toBe('ΙΑΣΩ ΘΕΣΣΑΛΙΑΣ')
    expect(text.technical).toBe('o1')
    expect(describeAuditGroup(group, {}).name).toBe('')
  })
})
