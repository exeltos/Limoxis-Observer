import { describe, it, expect } from 'vitest'
import { navigation } from '../src/app/navigation'

// User-reported: the sidebar showed the same icon for two different
// destinations (Ανάλυση/Analysis and Δείκτες/Indicators both used
// BarChart3; Ασθενείς/Patients and Κέντρο Ποιότητας/Quality both used
// HeartPulse), making it impossible to tell them apart at a glance.
// Every sidebar destination must use its own icon component.
describe('sidebar navigation entries each use a distinct icon', () => {
  it('has no two navigation entries sharing the same icon component', () => {
    const byIcon = new Map()
    for (const item of navigation) {
      const owners = byIcon.get(item.icon) || []
      owners.push(item.key)
      byIcon.set(item.icon, owners)
    }
    const duplicates = [...byIcon.values()].filter(owners => owners.length > 1)
    expect(duplicates).toEqual([])
  })
})
