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

  it('keeps learner writes behind narrow secure-token email-flow RPCs',()=>{
    const service=read('src/features/training/trainingInvitationService.js')
    expect(service).toContain("supabase.rpc('training_confirm_attendance'")
    expect(service).toContain("supabase.rpc('training_submit_evaluation'")
    expect(service).toContain("supabase.rpc('training_email_access'")
  })

  it('keeps login and the personal training token route public',()=>{
    const app=read('src/app/App.jsx')
    const loginIndex=app.indexOf('path="/login"')
    const trainingIndex=app.indexOf('path="training-access/:token"')
    const protectedIndex=app.indexOf('<Route element={<ProtectedRoute/>}>')
    expect(loginIndex).toBeGreaterThanOrEqual(0)
    expect(trainingIndex).toBeGreaterThan(loginIndex)
    expect(protectedIndex).toBeGreaterThan(trainingIndex)
  })

  it('keeps employee-code identification demo-only and production token-bound',()=>{
    const access=read('src/features/training/TrainingAccessPage.jsx')
    expect(access).toContain('DemoTrainingAccess')
    expect(access).toContain('ProductionTrainingAccess')
    expect(access).toContain('loadTrainingEmailAccessAsync')
    expect(access).toContain('Δεν απαιτείται λογαριασμός Limoxis')
    expect(access).toContain('No Limoxis account is required')
  })
})
