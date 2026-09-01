import { describe,expect,it } from 'vitest'
import fs from 'node:fs'

const read=path=>fs.readFileSync(new URL(`../${path}`,import.meta.url),'utf8')

describe('training production isolation',()=>{
  it('loads production training from the governed service instead of local demo storage',()=>{
    const service=read('src/features/training/trainingService.js')
    expect(service).toContain("from('training_records')")
    expect(service).toContain('loadTrainingStateAsync')
    expect(service).toContain('isDemoDataEnvironment()')
  })

  it('keeps learner writes behind narrow authenticated RPCs',()=>{
    const service=read('src/features/training/trainingService.js')
    expect(service).toContain("supabase.rpc('training_check_in'")
    expect(service).toContain("supabase.rpc('training_complete'")
    expect(service).not.toContain("from('training_records').update")
  })

  it('protects the training access route with authentication',()=>{
    const app=read('src/app/App.jsx')
    const protectedIndex=app.indexOf('<Route element={<ProtectedRoute />}>')
    const trainingIndex=app.indexOf('path="training-access/:token"')
    expect(protectedIndex).toBeGreaterThanOrEqual(0)
    expect(trainingIndex).toBeGreaterThan(protectedIndex)
  })

  it('keeps employee-code identification demo-only',()=>{
    const access=read('src/features/training/TrainingAccessPage.jsx')
    expect(access).toContain('DemoTrainingAccess')
    expect(access).toContain('ProductionTrainingAccess')
    expect(access).toContain('Production requires a signed-in account')
  })
})
