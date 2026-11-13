import { describe,expect,it } from 'vitest'
import path from 'node:path'
import { readSource } from './helpers/readSource'

const historySql=readSource(path.resolve('supabase/migrations/20260901200512_v0306_committee_history_meeting_lifecycle.sql'))

describe('committee record lifecycle UI',()=>{

  it('allows governed meeting lifecycle actions to append committee history',()=>{
    expect(historySql).toContain("'create_committee_meeting'")
  })
})
