// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from 'vitest'

const addImageCalls = []
const saveCalls = []

vi.mock('html2canvas', () => ({
  default: vi.fn(async () => ({
    width: 2000,
    height: 5000,
    toDataURL: () => 'data:image/png;base64,fake',
  })),
}))

vi.mock('jspdf', () => ({
  jsPDF: function FakeJsPdf() {
    return {
      internal: { pageSize: { getWidth: () => 297, getHeight: () => 210 } },
      addImage: (...args) => addImageCalls.push(args),
      addPage: vi.fn(),
      save: (...args) => saveCalls.push(args),
    }
  },
}))

const { exportElementAsPdf } = await import('../src/core/export/pdfReportExport')

describe('exportElementAsPdf', () => {
  beforeEach(() => {
    addImageCalls.length = 0
    saveCalls.length = 0
  })

  it('throws without an element instead of silently no-op-ing', async () => {
    await expect(exportElementAsPdf({ filename: 'x' })).rejects.toThrow('PDF_EXPORT_NO_ELEMENT')
  })

  it('renders the element and saves a sanitized .pdf filename', async () => {
    const element = document.createElement('div')
    await exportElementAsPdf({ element, filename: 'Ανάλυση / Overview 2026' })
    expect(saveCalls).toHaveLength(1)
    expect(saveCalls[0][0]).toBe('Ανάλυση_Overview_2026.pdf')
  })

  it('tiles a tall canvas across multiple pages', async () => {
    const element = document.createElement('div')
    await exportElementAsPdf({ element, filename: 'tall-report' })
    // 2000x5000 canvas scaled to a 297mm-wide page is far taller than the
    // 210mm page height, so more than one addImage call is expected.
    expect(addImageCalls.length).toBeGreaterThan(1)
  })
})
