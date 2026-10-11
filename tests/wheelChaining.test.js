// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { handleWheel } from '../src/app/wheelChaining'

const box = (style, sizes) => {
  const el = document.createElement('div')
  Object.assign(el.style, style)
  for (const [key, value] of Object.entries(sizes)) Object.defineProperty(el, key, { value, configurable: true })
  return el
}

describe('wheel over a sideways-scrolling table', () => {
  it('scrolls the vertical scroll area around it', () => {
    const page = box({ overflowY: 'auto' }, { scrollHeight: 900, clientHeight: 400, scrollWidth: 800, clientWidth: 800 })
    const table = box({ overflowX: 'auto', overflowY: 'auto' }, { scrollHeight: 300, clientHeight: 300, scrollWidth: 1300, clientWidth: 1000 })
    const cell = document.createElement('span')
    table.append(cell); page.append(table); document.body.append(page)
    const event = new WheelEvent('wheel', { deltaY: 120, bubbles: true, cancelable: true })
    Object.defineProperty(event, 'target', { value: cell })
    handleWheel(event)
    expect(page.scrollTop).toBe(120)
    expect(event.defaultPrevented).toBe(true)
  })

  it('leaves an ordinary vertical scroller to the browser', () => {
    const list = box({ overflowY: 'auto' }, { scrollHeight: 900, clientHeight: 400, scrollWidth: 800, clientWidth: 800 })
    const row = document.createElement('span')
    list.append(row); document.body.append(list)
    const event = new WheelEvent('wheel', { deltaY: 120, bubbles: true, cancelable: true })
    Object.defineProperty(event, 'target', { value: row })
    handleWheel(event)
    expect(event.defaultPrevented).toBe(false)
  })
})
