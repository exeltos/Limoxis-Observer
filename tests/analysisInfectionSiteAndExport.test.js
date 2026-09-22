import { describe, expect, it } from 'vitest'
import fs from 'node:fs'

const page = fs.readFileSync('src/features/analysis/AnalysisPage.jsx', 'utf8')
const service = fs.readFileSync('src/features/platform/platformService.js', 'utf8')
const demoSnapshot = fs.readFileSync('src/features/analysis/analysisDemoSnapshot.js', 'utf8')
const filterCss = fs.readFileSync('src/styles/modules.css', 'utf8')
const tabsCss = fs.readFileSync('src/styles/analysis-print.css', 'utf8')

// User-reported gap: the RPC behind the National/AMR tabs (and its demo
// mirror) already carried sample_type — the infection-site category
// (bloodCulture/urineCulture/respiratorySample/woundCulture) distinct from
// `source` (specimen collection detail like "central line") — but nothing
// on the page ever surfaced it. Organisms could only be cross-referenced by
// department and collection detail, never by infection site.
describe('organisms are shown by infection site (bloodstream/urinary/respiratory/wound), not only by department and collection detail', () => {
  it('production carries sample_type through to a bySite aggregate and the nationalRows line list', () => {
    expect(service).toContain('row.sampleType')
    expect(service).toContain('bySite')
    expect(service).toContain('row.department,row.source,row.sampleType')
  })

  it('demo mirrors the same site dimension from laboratorySamples.type', () => {
    expect(demoSnapshot).toContain("bySite: sortedEntries(countBy(positive, x => x.type), 12)")
    expect(demoSnapshot).toContain('row.type].join')
  })

  it('the owner-level (multi-hospital) merge carries bySite and the site dimension through nationalRows', () => {
    expect(service).toContain("mergeEntryRows(snapshots,'bySite')")
    expect(service).toContain('sampleType] of snapshot?.microbiology?.nationalRows')
  })

  it('AnalysisPage translates the four canonical sample types to Greek/English infection-site labels', () => {
    expect(page).toContain('bloodCulture:')
    expect(page).toContain('urineCulture:')
    expect(page).toContain('respiratorySample:')
    expect(page).toContain('woundCulture:')
    expect(page).toContain('function siteLabel(')
  })

  it('renders a dedicated organism-by-infection-site breakdown and a site-only distribution, plus the site column in the detailed line list', () => {
    expect(page).toContain('function organismBySiteRows(')
    expect(page).toContain("tx('Μικροοργανισμοί ανά σημείο λοίμωξης','Organisms by infection site')")
    expect(page).toContain("tx('Σημείο λοίμωξης','Infection site')")
    expect(page).toContain("key:'site',label:tx('Σημείο λοίμωξης','Infection site')")
  })
})

// User-reported regression: a real production sample_type outside the four
// clinical culture types ('surface', an environmental swab) echoed verbatim
// in the infection-site column, appearing as a meaningless duplicate right
// next to the specimen-detail column showing the same raw string.
describe('non-clinical sample types (environmental/surveillance swabs) never echo a raw code as an infection site', () => {
  it('siteLabel falls back to a generic translated label instead of the raw value for an unmapped sample_type', () => {
    expect(page).toContain("function siteLabel(value,tx){const pair=SITE_LABELS[value];return pair?tx(pair[0],pair[1]):tx('Λοιπό δείγμα','Other sample')}")
  })

  it('SITE_LABELS also covers the known non-clinical sample types (environmental/surveillance) with dedicated labels', () => {
    expect(page).toContain('environmental:')
    expect(page).toContain('surveillance:')
    expect(page).toContain('surface:')
  })

  it('the organism-by-site and site-distribution cards are restricted to clinical sites only, so environmental/surveillance rows do not dilute them', () => {
    expect(page).toContain('const CLINICAL_SITES=')
    expect(page).toContain('if(!CLINICAL_SITES.includes(sampleType))continue')
    expect(page).toContain('(details?.bySite||[]).filter(([value])=>CLINICAL_SITES.includes(value))')
  })
})

describe('detailed microbiology line lists can be exported as CSV', () => {
  it('reuses the shared downloadCsv utility instead of a one-off implementation', () => {
    expect(page).toContain("import { downloadCsv } from '../../core/export/csvExport'")
    expect(page).toContain('function exportNationalRowsCsv(')
  })

  it('wires an export button into both the National and AMR detailed tables', () => {
    expect(page).toContain('<ExportCsvButton rows={nationalRows}')
    expect(page).toContain('<ExportCsvButton rows={resistantRows}')
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
    expect(tabsCss).toContain('.analysis-workspace>.analysis-tabs.entity-record-tabs{\n display:flex!important;flex-wrap:wrap!important;overflow:visible!important;')
    expect(tabsCss).toContain('text-overflow:clip!important;')
    expect(tabsCss).not.toContain('overflow-x:auto!important;overflow-y:hidden!important;\n scrollbar-width:thin')
  })

  it('tab buttons carry a title tooltip with the full label', () => {
    expect(page).toContain('title={en?enLabel:elLabel}')
  })
})
