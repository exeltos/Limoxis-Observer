import { describe, expect, it } from 'vitest'
import fs from 'node:fs'

const read = path => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

describe('outbreak/cluster alert notification wiring', () => {
  it('gates cluster alerts to the same roles the cluster-detection RPC authorizes', () => {
    const context = read('src/core/notifications/NotificationContext.jsx')
    expect(context).toContain("CLUSTER_ALERT_ROLES=['hospital_admin','infection_control_lead','infection_control_member','laboratory','doctor_reviewer']")
    const migration = read('supabase/migrations/20260921140000_organism_cluster_detection.sql')
    expect(migration).toContain("array['hospital_admin','infection_control_lead','infection_control_member','laboratory','doctor_reviewer']")
  })

  it('computes demo cluster alerts from the same detector the Analysis page uses', () => {
    const context = read('src/core/notifications/NotificationContext.jsx')
    expect(context).toContain('collectDemoOrganismClusters')
    expect(context).toContain('loadActiveClustersAsync')
    expect(context).toContain('clusterAlertId')
  })

  it('routes cluster notification items into the notification bell as a distinct type', () => {
    const context = read('src/core/notifications/NotificationContext.jsx')
    expect(context).toContain("type:'cluster'")
    const center = read('src/core/notifications/NotificationCenter.jsx')
    expect(center).toContain("item.type==='cluster'?<ShieldAlert size={16}/>")
  })
})
