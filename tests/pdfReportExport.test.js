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
      setDrawColor: vi.fn(),
      setLineWidth: vi.fn(),
      line: vi.fn(),
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

describe('exportElementAsPdf with the hospital header', () => {
  beforeEach(() => {
    addImageCalls.length = 0
    saveCalls.length = 0
    const context = { drawImage: vi.fn(), scale: vi.fn(), fillText: vi.fn(), set fillStyle(v) {}, set font(v) {}, set textBaseline(v) {} }
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context)
    vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/png;base64,slice')
  })

  it('puts the header on every page and the content below it', async () => {
    const element = document.createElement('div')
    await exportElementAsPdf({ element, filename: 'r', branding: { name: 'General Hospital', reportHeader: 'IPC committee', logo: '' } })
    expect(saveCalls).toHaveLength(1)
    // Content slices sit below the 16mm header band; each page also gets the header text image.
    const content = addImageCalls.filter(args => args[2] === 0)
    const header = addImageCalls.filter(args => args[2] !== 0)
    expect(content.length).toBeGreaterThan(1)
    expect(content.every(args => args[3] === 16)).toBe(true)
    expect(header).toHaveLength(content.length)
  })

  it('leaves the header out when asked (certificates)', async () => {
    const element = document.createElement('div')
    await exportElementAsPdf({ element, filename: 'c', header: false, branding: { name: 'General Hospital' } })
    expect(addImageCalls.every(args => args[3] === 0)).toBe(true)
  })
})
