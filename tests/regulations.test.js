// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { REGULATION_TEMPLATES } from '../src/features/regulations/regulationTemplates'
import { applyFill, contentFromBlocks, contentFromTemplate, fillItems, nextRegulationCode, regulationProblems, regulationStatus, searchContent, staleSignatures, takeTemplateSection, templateChanges, textToHtml, validSignatures } from '../src/features/regulations/regulationModel'
import { sanitizeHtml } from '../src/features/regulations/regulationHtml'

const content = { chapters: [{ id: 'c1', title: 'Γενικά', sections: [
  { id: 's1', origin: 's1', title: 'Σκοπός', html: '<p>Ο σκοπός.</p><p class="reg-fill">Συμπληρώστε: τη σύνθεση της ΕΝΛ.</p><p>Μέση.</p><p class="reg-fill">Συμπληρώστε: τους στόχους.</p>' },
  { id: 's2', origin: 's2', title: 'Ορισμοί', html: '<p>Υγιεινή χεριών και αντισηψία.</p>' },
] }] }

describe('regulations', () => {
  it('starts from a template with the hospital in place and every section keeping its origin', () => {
    expect(REGULATION_TEMPLATES.map(item => item.key)).toEqual(['infection_control', 'healthcare_waste', 'food_safety', 'water_safety', 'sterilization', 'patient_safety'])
    const own = contentFromTemplate(REGULATION_TEMPLATES[0], { hospital: 'Νοσοκομείο <Α>' })
    const html = own.chapters.flatMap(chapter => chapter.sections).map(section => section.html).join('')
    expect(html).not.toContain('{hospital}')
    expect(html).toContain('Νοσοκομείο &lt;Α&gt;')
    expect(own.chapters[0].sections.every(section => section.origin === section.id)).toBe(true)
  })

  it('lists every note to fill in and puts the hospital’s text in its place', () => {
    const items = fillItems(content)
    expect(items.map(item => item.prompt)).toEqual(['τη σύνθεση της ΕΝΛ.', 'τους στόχους.'])
    const filled = applyFill(content, items[1], 'Στόχοι:\n\n- Συμμόρφωση 85%\n- Μείωση CLABSI')
    expect(filled.chapters[0].sections[0].html).toBe('<p>Ο σκοπός.</p><p class="reg-fill">Συμπληρώστε: τη σύνθεση της ΕΝΛ.</p><p>Μέση.</p><p>Στόχοι:</p><ul><li>Συμμόρφωση 85%</li><li>Μείωση CLABSI</li></ul>')
    expect(fillItems(filled)).toHaveLength(1)
    expect(applyFill(content, items[0], '   ')).toBe(content)
    expect(textToHtml('Α <b>\nΒ')).toBe('<p>Α &lt;b&gt;<br>Β</p>')
    expect(regulationProblems({ title: 'Τ' }, content)).toContain('2 σημεία ακόμη προς συμπλήρωση')
  })

  it('counts a signature only for the revision of the text it was given for', () => {
    const signatures = [
      { role: 'administrator', name: 'Α', revision: 2, signedAt: '2026-10-01T10:00:00Z' },
      { role: 'administrator', name: 'Β', revision: 3, signedAt: '2026-10-02T10:00:00Z' },
      { role: 'infection_lead', name: 'Γ', revision: 2, signedAt: '2026-10-01T11:00:00Z' },
    ]
    expect(validSignatures(signatures, 3).map(item => item.name)).toEqual(['Β'])
    expect(staleSignatures(signatures, 3)).toEqual(['infection_lead'])
    expect(validSignatures(signatures, 2).map(item => item.name)).toEqual(['Α', 'Γ'])
  })

  it('shows what a new template version changed and takes it into the draft', () => {
    const base = { chapters: [{ id: 'c1', title: 'Γενικά', sections: [{ id: 's1', title: 'Σκοπός', html: '<p>Παλιό</p>' }, { id: 's3', title: 'Παλιά', html: '<p>Χ</p>' }] }] }
    const latest = { chapters: [{ id: 'c1', title: 'Γενικά', sections: [{ id: 's1', title: 'Σκοπός', html: '<p>Νέο</p>' }] }, { id: 'c2', title: 'Νέο κεφάλαιο', sections: [{ id: 's4', title: 'Νέα', html: '<p>Ν</p>' }] }] }
    const changes = templateChanges({ base, latest, current: content })
    expect(changes.map(change => `${change.kind}:${change.origin}`)).toEqual(['changed:s1', 'new:s4', 'removed:s3'])
    const taken = takeTemplateSection(takeTemplateSection(content, latest, 's1'), latest, 's4')
    expect(taken.chapters[0].sections[0].html).toBe('<p>Νέο</p>')
    expect(taken.chapters.map(chapter => chapter.id)).toEqual(['c1', 'c2'])
  })

  it('finds sections regardless of accents, numbers codes and reads the status', () => {
    expect(searchContent(content, 'υγιεινη χεριων').map(hit => hit.title)).toEqual(['Ορισμοί'])
    expect(nextRegulationCode(['REG-01', 'REG-07', 'X'])).toBe('REG-08')
    expect(regulationStatus({ edition: 0 })).toBe('draft')
    expect(regulationStatus({ edition: 2, hasDraft: true })).toBe('revision')
    expect(regulationStatus({ edition: 2, archived: true })).toBe('archived')
  })

  it('keeps only the formatting a regulation needs', () => {
    expect(sanitizeHtml('<h1 style="color:red" onclick="x()">Τ</h1><script>alert(1)</script><p class="reg-fill other">Α <b>β</b> <a href="javascript:alert(1)">κ</a> <a href="https://eody.gov.gr">ΕΟΔΥ</a></p><img src=x onerror=alert(1)>'))
      .toBe('<h3>Τ</h3><p class="reg-fill">Α <strong>β</strong> <a>κ</a> <a href="https://eody.gov.gr" target="_blank" rel="noopener noreferrer">ΕΟΔΥ</a></p>')
  })

  it('turns the earlier tool’s blocks into formatted text', () => {
    const made = contentFromBlocks([{ title: 'Κ', sections: [{ title: '', blocks: [{ type: 'p', text: 'Α' }, { type: 'list', text: 'β' }, { type: 'list', text: 'γ' }, { type: 'p', text: '<δ>' }] }] }])
    expect(made.chapters[0].sections[0]).toMatchObject({ title: 'Γενικά', html: '<p>Α</p><ul><li>β</li><li>γ</li></ul><p>&lt;δ&gt;</p>' })
  })
})
