// SECURITY DEFINER aggregates skip RLS, so each one must apply the module lock itself, the way
// the <table>_module_gate policies do (private.org_modules_locked, built on
// private.org_disabled_modules; the Platform Owner is never locked). The checks read the
// latest migration that defines each function.
import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const MIGRATIONS = 'supabase/migrations'
const files = fs.readdirSync(MIGRATIONS).filter(name => name.endsWith('.sql')).sort()

function latestFunction(name) {
  let found = null
  for (const file of files) {
    const sql = fs.readFileSync(path.join(MIGRATIONS, file), 'utf8')
    const match = sql.match(new RegExp(`create or replace function ${name.replace('.', '\\.')}\\([\\s\\S]*?\\$function\\$([\\s\\S]*?)\\$function\\$`, 'i'))
    if (match) found = { file, body: match[1] }
  }
  if (!found) throw new Error(`${name} not found in ${MIGRATIONS}`)
  return found
}

describe('module lock in SECURITY DEFINER aggregates', () => {
  it('private.org_modules_locked mirrors the gate rule', () => {
    const { body } = latestFunction('private.org_modules_locked')
    expect(body).toContain('current_user_is_platform_owner()')
    expect(body).toContain('p_modules <@ private.org_disabled_modules(target_org)')
  })

  // function -> module groups it must check (a group is locked when all its modules are)
  const expected = {
    'public.analysis_domain_metrics': ["'analysis'", "'surveillance'", "'prevention'", "'controls'", "'quality'", "'surveillance','pharmacy'", "'surveillance','prevention'"],
    'public.analysis_crosstab_metrics': ["'analysis'", "'surveillance'", "'controls'", "'quality'", "'surveillance','pharmacy'"],
    'public.analysis_people_metrics': ["'analysis'", "'governance'"],
    'public.analysis_quality_food_metrics': ["'analysis'", "'quality'", "'suppliers'", "'kitchen'"],
    'public.analysis_amr_susceptibility': ["'analysis'", "'laboratory','surveillance'"],
    'public.analysis_microbiology_findings': ["'analysis'", "'laboratory','surveillance'"],
    'public.platform_report_summary': ["'analysis'", "'surveillance'", "'laboratory','surveillance'", "'prevention'", "'controls'", "'quality'", "'governance'", "'surveillance','pharmacy'"],
    'public.executive_governance_status': ["'governance'"],
    'public.document_acknowledgement_members': ["'governance'"],
  }

  for (const [name, groups] of Object.entries(expected)) {
    it(`${name} checks the module lock`, () => {
      const { body } = latestFunction(name)
      expect(body).toContain('private.org_modules_locked(p_organization_id')
      for (const group of groups) expect(body).toContain(`array[${group}]`)
    })
    it(`${name} stays SECURITY DEFINER with a fixed search_path`, () => {
      const { file } = latestFunction(name)
      const sql = fs.readFileSync(path.join(MIGRATIONS, file), 'utf8')
      const header = sql.match(new RegExp(`create or replace function ${name.replace('.', '\\.')}\\([\\s\\S]*?as \\$function\\$`, 'i'))[0]
      expect(header).toMatch(/security definer/i)
      expect(header).toMatch(/set search_path/i)
    })
  }

  it('the migration revokes and drops nothing', () => {
    const sql = fs.readFileSync(path.join(MIGRATIONS, '20261207200000_module_gate_aggregates.sql'), 'utf8')
    expect(sql).not.toMatch(/\b(drop|revoke|delete|alter policy)\b/i)
  })
})
