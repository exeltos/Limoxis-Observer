import fs from 'node:fs'
import { describe, expect, it } from 'vitest'

// The database side of «Φόρμες & ερωτηματολόγια»: additive only. New nullable columns with
// composite (id, organization_id) foreign keys, new indexes, one new restrictive policy and one
// new counting function. Nothing existing is dropped, revoked or has its policy altered.
const read = name => fs.readFileSync(`supabase/migrations/${name}`, 'utf8')
const FILES = [
  '20261204100000_bundle_assessment_episode_links.sql',
  '20261204110000_scale_assessment_episode_link.sql',
  '20261204120000_incident_episode_links.sql',
  '20261204130000_exposure_episode_links.sql',
  '20261204130100_exposure_count_privileges.sql',
]
const code = sql => sql.replace(/--[^\n]*/g, '')

describe('episode forms migrations', () => {
  it('only add: no drop, no delete, no alter policy, revoke only on the new function', () => {
    for (const file of FILES) {
      const sql = code(read(file))
      expect(sql, file).not.toMatch(/\bdrop\s+(table|column|policy|constraint|function|index)\b/i)
      expect(sql, file).not.toMatch(/\balter\s+policy\b/i)
      expect(sql, file).not.toMatch(/\bdelete\s+from\b/i)
      for (const line of sql.split(';').filter(statement => /\brevoke\b/i.test(statement)))
        expect(line, file).toMatch(/function public\.surveillance_case_exposure_count\(uuid\)/)
    }
  })

  it('links every form through a composite foreign key that cannot cross organizations', () => {
    expect(code(read(FILES[0]))).toMatch(/foreign key \(surveillance_case_id, organization_id\)\s+references public\.surveillance_cases \(id, organization_id\)/)
    expect(code(read(FILES[0]))).toMatch(/foreign key \(surveillance_device_id, organization_id\)\s+references public\.surveillance_devices \(id, organization_id\)/)
    expect(code(read(FILES[1]))).toMatch(/foreign key \(surveillance_case_id, organization_id\)/)
    expect(code(read(FILES[2]))).toMatch(/foreign key \(linked_patient_id, organization_id\)/)
    expect(code(read(FILES[2]))).toMatch(/validate constraint quality_incidents_case_fk/)
    expect(code(read(FILES[3]))).toMatch(/foreign key \(source_case_id, organization_id\)/)
  })

  it('shows the patient link of a bundle check only to those who see the surveillance case (restrictive select)', () => {
    const sql = code(read(FILES[0]))
    expect(sql).toMatch(/create policy prevention_bundle_assessments_case_scope on public\.prevention_bundle_assessments\s+as restrictive for select/)
    expect(sql).toMatch(/can_view_surveillance_record\(sc\.organization_id, sc\.department_id\)/)
    expect(sql).toMatch(/surveillance_case_id is null/)
  })

  it('counts exposed employees as a number only, for whoever can see the episode, with a fixed search path', () => {
    const sql = code(read(FILES[3]))
    expect(sql).toMatch(/returns integer/)
    expect(sql).toMatch(/security definer\s+set search_path = ''/)
    expect(sql).toMatch(/can_view_surveillance_record\(v_org, v_department\)/)
    expect(sql).toMatch(/auth\.uid\(\) is null/)
    expect(sql).not.toMatch(/select[^;]*employee_id[^;]*into/i)
    const manifest = JSON.parse(read('../security-definer-manifest.json')).functions
    expect(manifest.surveillance_case_exposure_count).toMatchObject({ category: 'rpc', authenticated: true })
    expect(manifest.surveillance_case_exposure_count.anon).toBeFalsy()
  })
})
