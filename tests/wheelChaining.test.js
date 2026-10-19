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

describe('wheel over a scroll area with nothing left to scroll', () => {
  const wheel = (target, deltaY) => {
    const event = new WheelEvent('wheel', { deltaY, bubbles: true, cancelable: true })
    Object.defineProperty(event, 'target', { value: target })
    handleWheel(event)
    return event
  }

  it('scrolls the area around a list that is already at its end', () => {
    const page = box({ overflowY: 'auto' }, { scrollHeight: 900, clientHeight: 400, scrollWidth: 800, clientWidth: 800 })
    const list = box({ overflowY: 'auto' }, { scrollHeight: 600, clientHeight: 300, scrollWidth: 800, clientWidth: 800 })
    list.scrollTop = 300
    const row = document.createElement('span')
    list.append(row); page.append(list); document.body.append(page)
    const event = wheel(row, 100)
    expect(page.scrollTop).toBe(100)
    expect(list.scrollTop).toBe(300)
    expect(event.defaultPrevented).toBe(true)
  })

  it('leaves the list to the browser while it can still move that way', () => {
    const page = box({ overflowY: 'auto' }, { scrollHeight: 900, clientHeight: 400, scrollWidth: 800, clientWidth: 800 })
    const list = box({ overflowY: 'auto' }, { scrollHeight: 600, clientHeight: 300, scrollWidth: 800, clientWidth: 800 })
    list.scrollTop = 300
    const row = document.createElement('span')
    list.append(row); page.append(list); document.body.append(page)
    const event = wheel(row, -100)
    expect(page.scrollTop).toBe(0)
    expect(event.defaultPrevented).toBe(false)
  })

  it('passes a box that fits its content to the page around it', () => {
    const page = box({ overflowY: 'auto' }, { scrollHeight: 900, clientHeight: 400, scrollWidth: 800, clientWidth: 800 })
    const table = box({ overflowY: 'auto' }, { scrollHeight: 300, clientHeight: 300, scrollWidth: 800, clientWidth: 800 })
    const cell = document.createElement('span')
    table.append(cell); page.append(table); document.body.append(page)
    wheel(cell, 120)
    expect(page.scrollTop).toBe(120)
  })

  it('never passes the wheel from a dialog to the page behind it', () => {
    const page = box({ overflowY: 'auto' }, { scrollHeight: 900, clientHeight: 400, scrollWidth: 800, clientWidth: 800 })
    const dialog = box({ overflowY: 'auto' }, { scrollHeight: 300, clientHeight: 300, scrollWidth: 800, clientWidth: 800 })
    dialog.setAttribute('role', 'dialog')
    const field = document.createElement('span')
    dialog.append(field); page.append(dialog); document.body.append(page)
    const event = wheel(field, 120)
    expect(page.scrollTop).toBe(0)
    expect(event.defaultPrevented).toBe(false)
  })
})
