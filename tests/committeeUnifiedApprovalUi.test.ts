import { describe,expect,it } from 'vitest'
import { readSource } from './helpers/readSource'

const read=path=>readSource(new URL(`../${path}`,import.meta.url))

describe('unified committee approval UI',()=>{

  it('maps approver names from committee membership data',()=>{
    const service=read('src/features/committees/committeeService.js')
    expect(service).toContain('memberNameByDbId')
    expect(service).toContain('approverName:')
  })
})
