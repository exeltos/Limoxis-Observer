import fs from 'node:fs'
import { describe, expect, it } from 'vitest'

const registryRoute = fs.readFileSync('src/features/laboratory/LaboratoryPage.jsx', 'utf8')
const recordRoute = fs.readFileSync('src/features/laboratory/LaboratorySampleRecordPage.jsx', 'utf8')
const demoRegistry = fs.readFileSync('src/features/laboratory/LaboratoryWorkspace.jsx', 'utf8')
const demoRecord = fs.readFileSync('src/features/laboratory/LaboratorySampleDemoRecordPage.jsx', 'utf8')
const productionRecord = fs.readFileSync('src/features/laboratory/LaboratorySampleCloudRecordPage.jsx', 'utf8')

describe('Laboratory Demo UI migration direction', () => {
  it('keeps the complete Demo registry and record available during migration', () => {
    expect(registryRoute).toContain('LaboratoryWorkspace')
    expect(recordRoute).toContain('LaboratorySampleDemoRecordPage')
    expect(demoRegistry).toContain('lab-kpis')
    expect(demoRecord).toContain('workflowOrder')
  })

  it('never makes production import Demo persistence', () => {
    expect(demoRegistry).not.toContain('laboratoryDemoData')
    expect(productionRecord).not.toContain('laboratoryDemoData')
  })

  it('treats the Demo presentation as the migration reference, not disposable code', () => {
    expect(demoRegistry).toContain('lab-kpis')
    expect(demoRecord.length).toBeGreaterThan(productionRecord.length)
  })
})
