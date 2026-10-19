import { describe, expect, it } from 'vitest'
import fs from 'node:fs'

const read = path => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const additive = read('supabase/migrations/20261120100000_surveillance_relational.sql')
const seeds = read('supabase/migrations/20261120100050_surveillance_relational_demo_seeds.sql')
const retire = read('supabase/migrations/20261120100100_surveillance_relational_json_retired.sql')
const TABLES = ['clinical_assessment_findings', 'hai_classification_criteria', 'isolation_episode_precautions', 'microbiology_result_organisms',
  'amr_classification_categories', 'surveillance_case_infection_types', 'surveillance_surgical_procedures', 'surveillance_neonatal_details']
const PARENTS = {
  clinical_assessment_findings: ['assessment_id', 'clinical_assessments'],
  hai_classification_criteria: ['hai_classification_id', 'hai_classifications'],
  isolation_episode_precautions: ['isolation_episode_id', 'isolation_episodes'],
  microbiology_result_organisms: ['microbiology_result_id', 'microbiology_results'],
  amr_classification_categories: ['amr_classification_id', 'amr_classifications'],
  surveillance_case_infection_types: ['surveillance_case_id', 'surveillance_cases'],
  surveillance_surgical_procedures: ['surveillance_case_id', 'surveillance_cases'],
  surveillance_neonatal_details: ['surveillance_case_id', 'surveillance_cases'],
}
const tableDefinition = name => { const start = additive.indexOf(`create table public.${name} (`); expect(start, name).toBeGreaterThan(-1); return additive.slice(start, additive.indexOf('\n);', start)) }
const fnBody = (sql, name) => { const start = sql.indexOf(`create or replace function ${name}(`); expect(start, name).toBeGreaterThan(-1); return sql.slice(start, sql.indexOf('$function$;', start)) }

describe('surveillance relational migration: tables', () => {
  it('gives every new table its organization, a composite key to its parent, audit stamps and no JSON', () => {
    for (const table of TABLES) {
      const definition = tableDefinition(table)
      const [column, parent] = PARENTS[table]
      expect(definition, table).toContain('organization_id uuid not null references public.organizations(id) on delete cascade')
      expect(definition, table).toContain(`foreign key (${column}, organization_id) references public.${parent}(id, organization_id) on delete cascade`)
      for (const stamp of ['created_by uuid default auth.uid()', 'created_at timestamptz not null default now()', 'updated_by uuid', 'updated_at timestamptz not null default now()']) expect(definition, table).toContain(stamp)
      expect(definition, table).not.toMatch(/\bjsonb?\b/)
    }
  })

  it('moves the start event payload and the isolation decision into case columns', () => {
    for (const column of ['case_kind text', 'review_due_on date', 'room text', 'reason text', 'reason_en text', 'suspected_source text', 'isolation_required boolean',
      'isolation_decided_at timestamptz', 'isolation_decided_by uuid references auth.users(id)', 'hospital_acquired boolean', 'sepsis_severity text', 'final_diagnosis text'])
      expect(additive).toContain(`add column if not exists ${column}`)
    expect(additive).toContain("alter table public.surveillance_events add column if not exists detail text;")
    for (const column of ['case_number text', 'environmental_position text', 'document_type text', 'people_observed integer', "source text not null default 'laboratory'"])
      expect(additive).toContain(`add column if not exists ${column}`)
  })

  it('lets clients only read organism rows, kept equal to the result label by the database', () => {
    expect(additive).toContain("grant select on table public.%I to authenticated")
    expect(additive).toContain('create trigger trg_microbiology_result_organisms_sync after insert or update of organism on public.microbiology_results')
    expect(fnBody(additive, 'private.microbiology_result_organisms_sync')).toContain('security definer set search_path = \'\'')
    expect(fnBody(retire, 'private.microbiology_result_organisms_sync')).toContain('o.position > (select count(*) from private.organism_list(new.organism))')
  })
})

describe('surveillance relational migration: copy', () => {
  it('copies the latest start event of each case, as the application shows it', () => {
    expect(additive).toContain("order by e.surveillance_case_id, e.created_at desc, e.id desc")
  })

  it('verifies every field and list and aborts on any difference', () => {
    const verify = additive.slice(additive.indexOf('do $verify$'), additive.indexOf('$verify$;'))
    for (const label of ['case start', 'isolation not required', 'event detail', 'assessment signs / risk factors', 'HAI criteria', 'isolation precautions', 'organisms', 'organisms jsonb not empty', 'AMR snapshot', 'unknown event payload keys'])
      expect(verify).toContain(`(''${label}''`)
    expect(verify).toContain("raise exception 'SURVEILLANCE_RELATIONAL_COPY_MISMATCH: %'")
  })

  it('adds the audit-field triggers only after the copy', () => {
    expect(additive.indexOf("'trg_' || t || '_audit_fields'")).toBeGreaterThan(additive.indexOf('$verify$;'))
  })
})

describe('surveillance relational migration: the two parts', () => {
  it('keeps the first part and the seeds additive: no deletion, no drop', () => {
    for (const sql of [additive, seeds]) expect(sql).not.toMatch(/\bdelete\s+from\b|\bdrop\b|\btruncate\b/i)
  })

  it('retires the JSON columns and the legacy triggers only in the second part', () => {
    for (const column of ['surveillance_events drop column if exists payload', 'clinical_assessments drop column if exists signs_symptoms, drop column if exists risk_factors',
      'hai_classifications drop column if exists criteria_evidence', 'isolation_episodes drop column if exists precautions', 'microbiology_results drop column if exists organisms',
      'amr_classifications drop column if exists calculation_snapshot'])
      expect(retire).toContain(`alter table public.${column};`)
    for (const name of ['surveillance_events', 'clinical_assessments', 'hai_classifications', 'isolation_episodes', 'amr_classifications'])
      expect(retire).toContain(`drop trigger if exists trg_${name}_legacy on public.${name};`)
    expect(fnBody(retire, 'public.enforce_microbiology_result_immutability')).not.toContain('organisms')
    expect(retire).toContain('alter table public.employee_vaccinations alter column vaccination_date drop not null;')
  })

  it('rewrites the demo seeds so they write columns and rows, not JSON', () => {
    for (const name of ['demo_seed_surveillance', 'demo_seed_susceptibility', 'demo_seed_clinical_case_depth', 'demo_seed_clinical_kpc_cluster', 'demo_seed_clinical_paediatric']) {
      const body = fnBody(seeds, `private.${name}`)
      expect(body, name).not.toMatch(/\bpayload\b|signs_symptoms|risk_factors|calculation_snapshot|criteria_evidence|precautions,/)
    }
    expect(fnBody(seeds, 'private.demo_seed_clinical_kpc_cluster')).toContain('perform private.clinical_assessment_add_lists(v_assessment, v_x.signs, v_x.risks);')
  })
})
