import { describe, expect, it } from 'vitest'
import { readSource } from './helpers/readSource'

const read = (path) => readSource(path)

const productionPage = read('src/features/training/TrainingProductionPage.jsx')
const resultsReview = read('src/features/training/TrainingResultsReview.jsx')
const certificate = read('src/features/training/trainingCertificate.js')

describe('training program record: scrolls like other record pages instead of clipping', () => {
  it('no longer wraps the EntityRecordShell or its tab content in the workspace-fill/workspace-column pair', () => {
    expect(productionPage).not.toContain('<EntityRecordShell className="workspace-fill"')
    expect(productionPage).not.toContain('<div className="workspace-column workspace-fill">')
  })

  it('still lets Participants/Assessment/Results manage their own internal registry scroll', () => {
    expect(productionPage).toContain("tab==='participants'&&<Participants")
    // Material and the knowledge test are two tabs of their own; no tabs inside a tab.
    expect(productionPage).toContain("tab==='materials'&&<RecordTabPanel")
    expect(productionPage).toContain("tab==='assessment'&&<TrainingAssessmentEditor")
    expect(productionPage).toContain("tab==='results'&&<TrainingResultsReview")
    expect(productionPage).not.toContain('SubTabs')
  })
})

describe('training programs list: sortable columns', () => {
  it('sorts every column', () => {
    expect(productionPage).toContain('function toggleProgramSort(key: string)')
    expect(productionPage).toContain('function SortTh(')
    expect(productionPage).toContain('programSortAccessors')
  })

  it('wires the sort handlers into the Programs table headers', () => {
    expect(productionPage).toContain('<SortTh k="title"')
    expect(productionPage).toContain('<SortTh k="trainer"')
    expect(productionPage).toContain('<SortTh k="status"')
  })
})

describe('training certificates: earned certificates can be downloaded as a PDF', () => {
  it('prints the certificate on the shared document layout, with its number', () => {
    expect(certificate).toContain('export async function downloadCertificatePdf')
    expect(certificate).toContain("import { escapeHtml, printReport } from '../../core/export/reportDocument'")
    expect(certificate).toContain('Αρ. βεβαίωσης')
  })

  it('lets a manager download a participant certificate from the results review', () => {
    expect(resultsReview).toContain("import {downloadCertificatePdf} from './trainingCertificate'")
    expect(resultsReview).toContain('function downloadCertificateFor(row: AnyRecord,pdf=false)')
    expect(resultsReview).toContain('certificateFor(row)')
  })

  it('lets an employee download their own certificate from the assignments list', () => {
    expect(productionPage).toContain('async function downloadCertificate(row: AnyRecord,program: AnyRecord|null|undefined,pdf=false)')
    expect(productionPage).toContain("import { downloadCertificatePdf } from './trainingCertificate'")
  })
})
