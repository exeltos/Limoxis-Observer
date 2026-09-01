import { describe,expect,it } from 'vitest'
import fs from 'node:fs'

const service=fs.readFileSync(new URL('../src/features/training/trainingService.js',import.meta.url),'utf8')

describe('training manager and learner concurrency',()=>{
  it('preserves learner-owned assignment outcomes during manager saves',()=>{
    expect(service).toContain('learnerOwnedAssignmentFields')
    expect(service).toContain("'attendanceConfirmedAt'")
    expect(service).toContain("'completionConfirmedAt'")
    expect(service).toContain("'score'")
    expect(service).toContain("'competent'")
    expect(service).not.toContain("'checkInAt'")
  })

  it('preserves server-side feedback projection when a manager edits the program',()=>{
    expect(service).toContain('existing?.payload?.feedbackResponses')
    expect(service).toContain('cleanPayload.feedbackResponses=existing.payload.feedbackResponses')
  })
})
