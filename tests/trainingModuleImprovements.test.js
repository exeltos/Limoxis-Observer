import { describe, expect, it } from 'vitest'
import fs from 'node:fs'

const read = (path) => fs.readFileSync(path, 'utf8')

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
    expect(productionPage).toContain("tab==='assessment'&&<TrainingAssessmentEditor")
    expect(productionPage).toContain("tab==='results'&&<TrainingResultsReview")
  })
})

describe('training programs list: sortable columns', () => {
  it('sorts every column', () => {
    expect(productionPage).toContain('function toggleProgramSort(key)')
    expect(productionPage).toContain('function programSortIndicator(key)')
    expect(productionPage).toContain('programSortAccessors')
  })

  it('wires the sort handlers into the Programs table headers', () => {
    expect(productionPage).toContain("onClick={()=>toggleSort('title')}")
    expect(productionPage).toContain("onClick={()=>toggleSort('trainer')}")
    expect(productionPage).toContain("onClick={()=>toggleSort('status')}")
  })
})

describe('training certificates: earned certificates can be downloaded as a PDF', () => {
  it('renders a printable certificate element and exports it through the shared PDF utility', () => {
    expect(certificate).toContain('export async function downloadCertificatePdf')
    expect(certificate).toContain("import { exportElementAsPdf } from '../../core/export/pdfReportExport'")
  })

  it('lets a manager download a participant certificate from the results review', () => {
    expect(resultsReview).toContain("import {downloadCertificatePdf} from './trainingCertificate'")
    expect(resultsReview).toContain('function downloadCertificateFor(row)')
    expect(resultsReview).toContain('certificateFor(row)')
  })

  it('lets an employee download their own certificate from the assignments list', () => {
    expect(productionPage).toContain('async function downloadCertificate(row,program)')
    expect(productionPage).toContain("import { downloadCertificatePdf } from './trainingCertificate'")
  })
})
