// @vitest-environment jsdom
// Operations (Controls, Kitchen): only a safety signal is a coloured chip.
import { readFileSync, readdirSync } from 'node:fs'
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import { SignalBadge } from '../src/design-system/StatusBadge'
import { LimitBadge } from '../src/features/kitchen/KitchenShared'

afterEach(cleanup)

describe('Operations colours (finding Ο4)', () => {
  it('SignalBadge: a chip only for danger, every other tone is plain text', () => {
    const { container } = render(<>{['danger', 'warning', 'success', 'info', 'neutral'].map(tone => <SignalBadge key={tone} tone={tone}>{tone}</SignalBadge>)}</>)
    expect(container.querySelectorAll('.status-badge')).toHaveLength(1)
    expect(container.querySelector('.status-badge').textContent).toBe('danger')
    expect(container.querySelector('.status-plain.is-strong').textContent).toBe('warning')
    expect(container.querySelectorAll('.status-plain')).toHaveLength(4)
  })

  it('a measurement within limits shows nothing in a list, out of limits is the red chip', () => {
    const { container, rerender } = render(<LimitBadge status="in" language="el" />)
    expect(container.textContent).toBe('')
    rerender(<LimitBadge status="out" language="el" />)
    expect(container.querySelector('.status-badge.lo-tone-danger').textContent).toBe('Εκτός ορίων')
    rerender(<LimitBadge status="in" language="el" live />)
    expect(container.querySelector('.status-badge')).toBeNull()
    expect(container.textContent).toBe('Εντός ορίων')
  })

  it('the two sections do not use the coloured StatusBadge directly', () => {
    for (const dir of ['src/features/controls', 'src/features/kitchen']) {
      for (const file of readdirSync(dir).filter(name => name.endsWith('.jsx'))) {
        expect(readFileSync(`${dir}/${file}`, 'utf8'), `${dir}/${file}`).not.toMatch(/<StatusBadge\b/)
      }
    }
  })

  it('the controls list marks criticality and expiring as text, only expired as a chip', () => {
    const css = readFileSync('src/features/controls/controlEvidence.css', 'utf8')
    expect(css).not.toMatch(/control-criticality-badge\.(high|medium)/)
    expect(css).toMatch(/control-criticality-badge\.signal/)
  })
})
