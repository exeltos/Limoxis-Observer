import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { readSource } from './helpers/readSource'

// A window closes from its ✕ only: never ✕ and a «Κλείσιμο / Close» button together.
const files = []
const walk = (dir) => { for (const entry of fs.readdirSync(dir, { withFileTypes: true })) { const full = path.join(dir, entry.name); if (entry.isDirectory()) walk(full); else if (/\.(jsx|tsx)$/.test(entry.name)) files.push(full) } }
walk('src')

describe('dialogs close from the ✕ only', () => {
  it('has no dialog footer that is just a close button', () => {
    const offenders = files.filter((file) => /footer=\{<(?:Button|ActionButton)[^>]*>\s*\{[^}]*(?:Κλείσιμο|'Close')[^}]*\}\s*<\/(?:Button|ActionButton)>\}/.test(readSource(file)))
    expect(offenders).toEqual([])
  })
})
