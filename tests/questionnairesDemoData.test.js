import { describe, expect, it } from 'vitest'
import fs from 'node:fs'

const panel = fs.readFileSync(new URL('../src/features/management/QuestionnairesPanel.jsx', import.meta.url), 'utf8')

describe('questionnaires demo data (platform review roadmap, P3)', () => {
  it('seeds more than the single trainer-evaluation questionnaire', () => {
    expect(panel).toContain("id:'trainer-evaluation'")
    expect(panel).toContain("id:'hand-hygiene-audit'")
    expect(panel).toContain("id:'quality-incident-review'")
    expect(panel).toContain("id:'staff-satisfaction'")
  })

  it('covers more than one questionnaire category so the panel shows real variety', () => {
    expect(panel).toContain("category:'training'")
    expect(panel).toContain("category:'audit'")
    expect(panel).toContain("category:'quality'")
    expect(panel).toContain("category:'general'")
  })

  it('exercises every supported answer type across the new seed questionnaires', () => {
    expect(panel).toContain("type:'yesno'")
    expect(panel).toContain("type:'single'")
    expect(panel).toContain("type:'multiple'")
    expect(panel).toContain("type:'text'")
  })
})
