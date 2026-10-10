import { describe,expect,it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

const historySql=fs.readFileSync(path.resolve('supabase/migrations/20260901200512_v0306_committee_history_meeting_lifecycle.sql'),'utf8')

describe('committee record lifecycle UI',()=>{

  it('allows governed meeting lifecycle actions to append committee history',()=>{
    expect(historySql).toContain("'create_committee_meeting'")
  })
})
