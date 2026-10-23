import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import { readAnalysisPageSource } from './helpers/analysisPageSource'
// Only the declarations matter here, not whether they carry !important.
const withoutImportant = css => css.replaceAll('!important', '')


const page = readAnalysisPageSource()
const service = fs.readFileSync('src/features/platform/platformService.js', 'utf8')
const demoSnapshot = fs.readFileSync('src/features/analysis/analysisDemoSnapshot.js', 'utf8')
const filterCss = fs.readFileSync('src/styles/features.css', 'utf8')
const tabsCss = fs.readFileSync('src/styles/responsive.css', 'utf8')

// `sample_type` is intentionally retained as a broad technical category for
// indicator compatibility and clinical/environment/staff filtering. The user-
// facing specimen dimension is `source`, which production now resolves from
// specimen_type_id and the central Sample types library.
describe('microbiology analysis separates the technical category from the exact specimen-library type', () => {
  it('production carries sample_type through to bySite while nationalRows also retain the exact source/specimen', () => {
    expect(service).toContain('row.sampleType')
    expect(service).toContain('bySite')
    expect(service).toContain('row.department,row.source,row.sampleType')
  })

  it('demo mirrors the same technical category dimension from laboratorySamples.type', () => {
    expect(demoSnapshot).toContain("bySite: sortedEntries(countBy(positive, x => x.type), 12)")
    expect(demoSnapshot).toContain('row.type].join')
  })

  it('the owner-level (multi-hospital) merge carries bySite and the technical category through nationalRows', () => {
    expect(service).toContain("mergeEntryRows(snapshots,'bySite')")
    expect(service).toContain('sampleType] of snapshot?.microbiology?.nationalRows')
  })

  it('AnalysisPage still translates the canonical technical categories used by indicators', () => {
    expect(page).toContain('bloodCulture:')
    expect(page).toContain('urineCulture:')
    expect(page).toContain('respiratorySample:')
    expect(page).toContain('woundCulture:')
    expect(page).toContain('function siteLabel(')
  })

  it('renders the user-facing organism matrix by exact specimen type from the central library', () => {
    expect(page).toContain("tx('Μικροοργανισμοί ανά είδος δείγματος','Organisms by specimen type')")
    expect(page).toContain("tx('Είδος δείγματος','Specimen type')")
    expect(page).toContain("key:'source',label:tx('Είδος δείγματος','Specimen type')")
    expect(page).toContain('organismRows.map(([organism,,,source,count])=>[organism,specimenLabel(source,tx),count])')
  })

  it('keeps the broad technical category visible but clearly labels it as a category, not an infection site', () => {
    expect(page).toContain("tx('Κατηγορία κλινικού δείγματος','Clinical specimen category')")
    expect(page).toContain("key:'category',label:tx('Κατηγορία δείγματος','Specimen category')")
    expect(page).not.toContain("key:'site',label:tx('Σημείο λοίμωξης','Infection site')")
  })
})

// Non-clinical sample types remain technical categories used to separate
// environment/staff findings from patient specimens. They must never leak as a
// raw user-facing specimen name.
describe('non-clinical sample types remain classification-only', () => {
  it('siteLabel falls back to a generic translated label instead of a raw value for an unmapped sample_type', () => {
    expect(page).toContain("function siteLabel(value,tx){const pair=SITE_LABELS[value];return pair?tx(pair[0],pair[1]):tx('Λοιπό δείγμα','Other sample')}")
  })

  it('SITE_LABELS covers known non-clinical technical categories', () => {
    expect(page).toContain('environmental:')
    expect(page).toContain('surveillance:')
    expect(page).toContain('surface:')
  })

  it('the category distribution is restricted to clinical sites while the specimen matrix uses library source values', () => {
    expect(page).toContain('const CLINICAL_SITES=')
    expect(page).toContain('(details?.bySite||[]).filter(([value])=>CLINICAL_SITES.includes(value))')
    expect(page).toContain('specimenLabel(source,tx)')
  })
})

describe('detailed microbiology line lists can be exported as CSV', () => {
  it('reuses the shared downloadCsv utility instead of a one-off implementation', () => {
    expect(page).toContain("import { downloadCsv } from '../../core/export/csvExport'")
    expect(page).toContain('function exportNationalRowsCsv(')
  })

  it('wires an export button into the detailed line list, exporting the resistant subset when it is narrowed', () => {
    expect(page).toContain('<ExportCsvButton rows={listRows}')
    expect(page).toContain("resistantOnly?nationalRows.filter(")
  })

  it('exports both exact specimen type and technical specimen category with explicit headers', () => {
    expect(page).toContain("tx('Είδος δείγματος','Specimen type')")
    expect(page).toContain("tx('Κατηγορία δείγματος','Specimen category')")
  })
})

// User-reported: the filter toolbar split into three equal-width boxes
// regardless of how many fields each held, so a 1-field group (Scope in the
// single-hospital view) rendered as a huge mostly-empty box next to the
// cramped 3-field Time-period group. Tabs separately: 13 sections were
// forced into equal grid columns, truncating even short labels to ellipsis.
describe('filter toolbar groups size to their own field count, and analytics tabs show full labels', () => {
  it('the filter toolbar is a flex row of auto-width groups instead of a fixed 3-column grid', () => {
    expect(filterCss).toContain('.analysis-filter-toolbar{\n  display:flex;\n  flex-wrap:wrap;')
    expect(filterCss).toContain('.analysis-filter-group{\n  flex:0 0 auto;')
  })

  it('each filter field has a fixed comfortable width so group width tracks field count', () => {
    expect(filterCss).toContain('.analysis-filter-field{\n  display:flex;\n  width:190px;')
  })

  it('the analytics tabs keep natural width and wrap onto a second row instead of being forced into 13 equal grid columns or scrolling', () => {
    expect(withoutImportant(tabsCss)).toContain('.analysis-workspace>.analysis-tabs.entity-record-tabs{\n display:flex;flex-wrap:wrap;overflow:visible;')
    expect(withoutImportant(tabsCss)).toContain('text-overflow:clip;')
    expect(withoutImportant(tabsCss)).not.toContain('overflow-x:auto;overflow-y:hidden;\n scrollbar-width:thin')
  })

  it('tab buttons carry a title tooltip with the full label', () => {
    expect(page).toContain('title:en?enLabel:elLabel')
  })
})
