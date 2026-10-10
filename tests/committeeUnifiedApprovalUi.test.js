import { describe,expect,it } from 'vitest'
import fs from 'node:fs'

const read=path=>fs.readFileSync(new URL(`../${path}`,import.meta.url),'utf8')

describe('unified committee approval UI',()=>{

  it('maps approver names from committee membership data',()=>{
    const service=read('src/features/committees/committeeService.js')
    expect(service).toContain('memberNameByDbId')
    expect(service).toContain('approverName:')
  })
})
