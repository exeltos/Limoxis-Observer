import { useState } from 'react'
import { ObserverDialog, DialogActions } from '../../design-system/ObserverDialog'
import { Button } from '../../design-system/Button'
import { ChoiceField } from '../../design-system/ChoiceField'
import { ManualDateField } from '../../design-system/ManualDateField'
import { REPORT_COMPARES, compareLabel } from './registerReport'
import type { ReportCompare } from './registerReport'

const STORAGE_KEY = 'limoxis.register.print.compare'
const readChoice = (): ReportCompare => { try { const value = window.localStorage.getItem(STORAGE_KEY) as ReportCompare | null; return value && REPORT_COMPARES.includes(value) ? value : 'previous' } catch { return 'previous' } }
const writeChoice = (value: ReportCompare) => { try { window.localStorage.setItem(STORAGE_KEY, value) } catch { /* only a convenience */ } }

export type RegisterPrintChoice = { compare: ReportCompare, from: string, to: string, word: boolean }

// «Εκτύπωση / PDF» of a register's indicators (owner, 18/11/2026): before printing, the period to compare with —
// none, the previous one, the same one last year, or any period by its dates. The last choice is remembered.
export function RegisterPrintDialog({ language, onPrint, onClose }: { language: string, onPrint: (choice: RegisterPrintChoice) => void, onClose: () => void }) {
  const en = language === 'en'
  const [compare, setCompare] = useState<ReportCompare>(readChoice)
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const customMissing = compare === 'custom' && (!from || !to || from > to)
  const go = (word: boolean) => { if (customMissing) return; writeChoice(compare); onPrint({ compare, from, to, word }) }
  return <ObserverDialog width="compact" title={en ? 'Print the indicators' : 'Εκτύπωση δεικτών'} onClose={onClose}
    footer={<DialogActions>
      <Button variant="secondary" disabled={customMissing} onClick={() => go(true)}>Word</Button>
      <Button disabled={customMissing} onClick={() => go(false)}>{en ? 'Print / PDF' : 'Εκτύπωση / PDF'}</Button>
    </DialogActions>}>
    <div className="print-options">
      <ChoiceField label={en ? 'Compare with' : 'Σύγκριση'} value={compare} onChange={value => setCompare(value as ReportCompare)} options={REPORT_COMPARES.map(value => ({ value, label: compareLabel(value, language) }))} />
      {compare === 'custom' && <div className="register-print-dates">
        <ManualDateField label={en ? 'From' : 'Από'} value={from} onChange={setFrom} required />
        <ManualDateField label={en ? 'To' : 'Έως'} value={to} onChange={setTo} required error={from && to && from > to ? (en ? 'The end is before the start.' : 'Η λήξη είναι πριν την έναρξη.') : ''} />
      </div>}
    </div>
  </ObserverDialog>
}
