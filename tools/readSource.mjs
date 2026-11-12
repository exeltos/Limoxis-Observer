import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// Οι έλεγχοι διαβάζουν αρχεία του src με το όνομά τους. Στη μετάβαση σε
// TypeScript ένα αρχείο αλλάζει κατάληξη (.js → .ts, .jsx → .tsx): ο έλεγχος
// γράφει τη διαδρομή όπως ήταν και εδώ βρίσκεται το αρχείο όπως είναι τώρα.
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const ALTERNATES = { '.js': ['.ts'], '.jsx': ['.tsx'], '.ts': ['.js'], '.tsx': ['.jsx'] }

export function resolveSource(file) {
  const raw = file instanceof URL ? fileURLToPath(file) : String(file)
  const full = path.isAbsolute(raw) ? raw : path.join(ROOT, raw)
  if (fs.existsSync(full)) return full
  const ext = path.extname(full)
  for (const alt of ALTERNATES[ext] || []) {
    const candidate = full.slice(0, -ext.length) + alt
    if (fs.existsSync(candidate)) return candidate
  }
  return full
}

export const readSource = file => fs.readFileSync(resolveSource(file), 'utf8')

// Πηγαίος κώδικας της εφαρμογής, JavaScript ή TypeScript.
export const SOURCE_FILE = /\.(js|jsx|ts|tsx)$/
