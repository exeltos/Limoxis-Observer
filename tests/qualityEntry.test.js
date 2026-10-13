import { describe, expect, it } from 'vitest'
import fs from 'node:fs'

const page = fs.readFileSync('src/features/quality/QualityPage.jsx', 'utf8')

describe('Quality center entry and audits tab', () => {
  it('starts on Incidents and restores a tab only when returning from a record', () => {
    // The key is shared with the risk assessment page, which returns to its tab.
    const returnSection = fs.readFileSync('src/features/quality/qualityReturnSection.js', 'utf8')
    expect(returnSection).toContain("QUALITY_RETURN_KEY = 'limoxis.quality.returnSection'")
    expect(page).toContain("import { QUALITY_RETURN_KEY as RETURN_KEY } from './qualityReturnSection'")
    expect(page).toContain("useEffect(()=>{writeSessionValue(RETURN_KEY,'')},[])")
    expect(page).not.toContain("writeSessionValue('limoxis.quality.section',id)")
  })

  it('names the audits tab "Επιθεωρήσεις" and shows audit-specific columns', () => {
    const i18n = fs.readFileSync('src/core/i18n/stringsEl.js', 'utf8')
    expect(i18n).toContain("qualityAudits:'Επιθεωρήσεις'")
    expect(page).toContain("section==='audits'?t('auditType'):t('department')")
    expect(page).toContain("audits:{el:'Νέα επιθεώρηση'")
  })
})
