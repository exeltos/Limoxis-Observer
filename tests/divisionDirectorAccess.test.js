// Διευθυντής Διεύθυνσης: μόνο ανάγνωση στα τμήματα των διευθύνσεών του (μεταναστεύσεις 20261231430000–20261231460000).
import { describe, expect, it } from 'vitest'
import { readSource } from './helpers/readSource'

const FILES = [
  'supabase/migrations/20261231430000_division_director_read_only.sql',
  'supabase/migrations/20261231440000_division_director_helpers.sql',
  'supabase/migrations/20261231450000_division_director_read.sql',
  'supabase/migrations/20261231460000_division_overview.sql',
]
const sql = Object.fromEntries(FILES.map(file => [file, readSource(file)]))
const [readOnly, helpers, read, overview] = FILES.map(file => sql[file])
// Χωρίς σχόλια, για να μη μετρούν λέξεις μέσα στο κείμενο που εξηγεί.
const code = text => text.split('\n').filter(line => !line.trim().startsWith('--')).join('\n')

const HOLE_TABLES = [
  'quality_department_meetings', 'quality_department_meeting_decisions', 'quality_department_meeting_participants',
  'quality_department_meeting_topics', 'quality_department_meeting_trainings', 'quality_equipment_events',
  'quality_survey_responses', 'control_drafts',
]
const READ_TABLES = [
  'department_rosters', 'roster_requests', 'employees', 'employee_training_summary', 'training_assignments',
  'training_records', 'hand_hygiene_sessions', 'hand_hygiene_observations',
]

describe('Division Director access (database)', () => {
  it('defines the role check and restrictive write policies for every insert/update/delete', () => {
    expect(readOnly).toMatch(/create or replace function private\.current_user_is_division_director\(p_organization_id uuid\)/)
    expect(readOnly).toMatch(/om\.role = 'division_director'/)
    for (const command of ['insert', 'update', 'delete']) {
      expect(readOnly).toMatch(new RegExp(`as restrictive for ${command} to authenticated`))
    }
    expect(readOnly).toMatch(/not private\.current_user_is_division_director\(organization_id\)/)
  })

  it('closes every pre-existing write hole and every table opened for reading', () => {
    const list = readOnly.match(/foreach v_table in array array\[([\s\S]*?)\]/)[1]
    for (const table of [...HOLE_TABLES, ...READ_TABLES]) expect(list, table).toContain(`'${table}'`)
    for (const table of ['control_executions', 'control_assignments', 'control_definitions']) expect(list, table).toContain(`'${table}'`)
    // Η αναφορά συμβάντος μένει ανοιχτή σε όλους· όχι ενημέρωση ή διαγραφή.
    expect(readOnly).toMatch(/add_division_director_read_only\('quality_incidents', array\['update','delete'\]\)/)
  })

  it('guards the dynamic register tables, new and existing', () => {
    const fast = readOnly.match(/create or replace function private\.register_fast_policies[\s\S]*?\$function\$([\s\S]*?)\$function\$/)[1]
    expect(fast).toContain("perform private.add_division_director_read_only(r.table_name);")
    expect(fast).toContain("perform private.add_division_director_read_only(r.table_name || '_identity');")
    // Η προηγούμενη συμπεριφορά μένει.
    expect(fast).toContain('alter policy register_read on public.%I using ((select private.register_can_read(%L::uuid)))')
    expect(readOnly).toMatch(/for v_register in select r\.table_name from public\.department_registers r/)
    expect(readOnly).toMatch(/if exists \(select 1 from pg_policies p where p\.schemaname = 'public' and p\.tablename = p_table and p\.policyname = v_policy\) then/)
  })

  it('blocks the self-assessment RPC with a trigger', () => {
    expect(readOnly).toMatch(/create or replace trigger quality_self_assessments_division_director_read_only/)
    expect(readOnly).toMatch(/DIVISION_DIRECTOR_READ_ONLY/)
  })

  it('uses only create / create or replace (no drop, delete, alter policy) in its own statements', () => {
    for (const [file, text] of Object.entries(sql)) {
      const body = code(text)
      expect(body, file).not.toMatch(/\bdrop\s+(policy|function|table|trigger|view|index)\b/i)
      expect(body, file).not.toMatch(/\bdelete\s+from\b/i)
      expect(body, file).not.toMatch(/^\s*alter\s+policy\b/im)
    }
  })

  it('opens only SELECT, scoped to the division departments', () => {
    const policies = [...code(read).matchAll(/create policy (\w+) on public\.(\w+) for (\w+) to authenticated/g)]
    expect(policies.map(match => match[2]).sort()).toEqual([...READ_TABLES, 'quality_incidents'].sort())
    for (const [, name, table, command] of policies) {
      expect(command, name).toBe('select')
      expect(name).toBe(`${table}_division_director_read`)
    }
    expect(read).toMatch(/private\.current_user_division_category_keys\(\)/)
    expect(read).not.toMatch(/on public\.employee_vaccinations/)
    expect(readOnly + helpers + read).not.toMatch(/create policy \w+ on public\.employee_vaccinations/)
  })

  it('limits employees to the division professional categories', () => {
    expect(helpers).toMatch(/create or replace function private\.employee_professional_category\(p_profession_name text, p_staff_category text\)/)
    expect(helpers).toMatch(/immutable/)
    expect(helpers).toMatch(/when p_staff_category = 'physician' then 'medical'/)
    expect(helpers).toMatch(/ΝΟΣΗΛΕΥ\|ΝΟΣΗΛΕΥΤ\|ΜΑΙΑ\|ΜΑΙΕΥΤ\|ΒΟΗΘ\.\*ΝΟΣΗΛ/)
    for (const category of ['nursing', 'medical', 'paramedical', 'administrative', 'technical', 'support']) expect(helpers).toContain(`then '${category}'`)
    expect(helpers).toMatch(/create or replace function private\.current_user_division_departments\(p_organization_id uuid\)\s+returns uuid\[\]/)
    expect(helpers).toMatch(/create or replace function private\.current_user_division_categories\(p_organization_id uuid\)\s+returns text\[\]/)
    expect(read).toMatch(/employees_division_director_read[\s\S]*?employee_professional_category\(profession_name, staff_category\)/)
  })

  it('adds the role to view_controls and view_training only', () => {
    const lists = [...read.matchAll(/when '([a-z_]+)' then om\.role in \(([^)]*)\)/g)].filter(match => match[2].includes("'division_director'")).map(match => match[1])
    expect(lists.sort()).toEqual(['view_controls', 'view_training'])
  })

  it('division_overview checks the caller and the role and returns only aggregates', () => {
    const body = overview.match(/create or replace function public\.division_overview[\s\S]*?\$function\$([\s\S]*?)\$function\$/)[1]
    expect(overview).toMatch(/returns jsonb\s+language plpgsql\s+stable\s+security definer\s+set search_path to ''/)
    expect(body).toMatch(/if auth\.uid\(\) is null then/)
    expect(body).toMatch(/private\.current_user_is_division_director\(p_organization_id\)/)
    expect(body).toMatch(/public\.is_org_admin\(p_organization_id\)/)
    expect(body).toMatch(/private\.hr_my_divisions\(p_organization_id\)/)
    expect(body).toMatch(/raise exception 'PERMISSION_DENIED' using errcode = '42501'/)
    expect(body).toMatch(/'Europe\/Athens'/)
    for (const key of ['staff', 'staffOnLeave', 'staffNew30', 'rosterNextMonth', 'uncoveredNights', 'pendingRequests', 'pendingRequestsOver3Days', 'trainingPct', 'trainingExpiring30', 'fluPct', 'handHygienePct', 'falls30', 'pressureUlcers30', 'incidentsOpen']) {
      expect(body, key).toContain(`'${key}'`)
    }
    // Ο εμβολιασμός μόνο ως ποσοστό: καμία γραμμή εμβολιασμού στην απάντηση.
    expect(body).not.toMatch(/to_jsonb\(v\)|jsonb_agg\(v\b/)
    expect(overview).toMatch(/grant execute on function public\.division_overview\(uuid, uuid\) to authenticated/)
  })

  it('declares the RPC in the security definer manifest', () => {
    const manifest = JSON.parse(readSource('supabase/security-definer-manifest.json'))
    expect(manifest.functions.division_overview).toMatchObject({ category: 'rpc', authenticated: true })
  })
})
