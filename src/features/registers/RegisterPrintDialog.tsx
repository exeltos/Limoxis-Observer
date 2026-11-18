import { useState } from 'react'
import { ObserverDialog, DialogActions } from '../../design-system/ObserverDialog'
import { Button } from '../../design-system/Button'
import { ChoiceField } from '../../design-system/ChoiceField'
import { ManualDateField } from '../../design-system/ManualDateField'
import { REPORT_COMPARES, REPORT_DETAILS, compareLabel, detailLabel } from './registerReport'
import type { ReportCompare, ReportDetail } from './registerReport'

const STORAGE_KEY = 'limoxis.register.print.compare'
const readChoice = (): ReportCompare => { try { const value = window.localStorage.getItem(STORAGE_KEY) as ReportCompare | null; return value && REPORT_COMPARES.includes(value) ? value : 'previous' } catch { return 'previous' } }
const writeChoice = (value: ReportCompare) => { try { window.localStorage.setItem(STORAGE_KEY, value) } catch { /* only a convenience */ } }
const DETAIL_KEY = 'limoxis.register.print.detail'
const readDetail = (): ReportDetail => { try { return window.localStorage.getItem(DETAIL_KEY) === 'full' ? 'full' : 'summary' } catch { return 'summary' } }
const writeDetail = (value: ReportDetail) => { try { window.localStorage.setItem(DETAIL_KEY, value) } catch { /* only a convenience */ } }

export type RegisterPrintChoice = { compare: ReportCompare, detail: ReportDetail, from: string, to: string, word: boolean }

// «Εκτύπωση / PDF» of a register's indicators (owner, 18/11/2026): before printing, the period to compare with —
// none, the previous one, the same one last year, or any period by its dates. The last choice is remembered.
// mode «entries»: the entries (or the months of a sheet) instead of the indicators: the period is «all» or two dates.
export function RegisterPrintDialog({ language, onPrint, onClose, mode = 'indicators' }: { language: string, onPrint: (choice: RegisterPrintChoice) => void, onClose: () => void, mode?: 'indicators' | 'entries' }) {
  const entriesMode = mode === 'entries'
  const [range, setRange] = useState<'all' | 'custom'>('all')
  const en = language === 'en'
  const [compare, setCompare] = useState<ReportCompare>(readChoice)
  const [detail, setDetail] = useState<ReportDetail>(readDetail)
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const needsDates = entriesMode ? range === 'custom' : compare === 'custom'
  const customMissing = needsDates && (!from || !to || from > to)
  const go = (word: boolean) => { if (customMissing) return; if (!entriesMode) writeChoice(compare); writeDetail(detail); onPrint({ compare: entriesMode ? 'none' : compare, detail, from: needsDates ? from : '', to: needsDates ? to : '', word }) }
  return <ObserverDialog width="compact" title={entriesMode ? (en ? 'Print the entries' : 'Εκτύπωση εγγραφών') : (en ? 'Print the indicators' : 'Εκτύπωση δεικτών')} onClose={onClose}
    footer={<DialogActions>
      <Button variant="secondary" disabled={customMissing} onClick={() => go(true)}>Word</Button>
      <Button disabled={customMissing} onClick={() => go(false)}>{en ? 'Print / PDF' : 'Εκτύπωση / PDF'}</Button>
    </DialogActions>}>
    <div className="print-options">
      <ChoiceField label={en ? 'Layout' : 'Μορφή'} value={detail} onChange={value => setDetail(value as ReportDetail)} options={REPORT_DETAILS.map(value => ({ value, label: `${detailLabel(value, language)}${entriesMode ? (value === 'summary' ? (en ? ': the columns of the list' : ': οι στήλες της λίστας') : (en ? ': every field' : ': όλα τα πεδία')) : value === 'summary' ? (en ? ': indicator and value' : ': δείκτης και τιμή') : (en ? ': also numerator, target and assessment' : ': και αριθμητής, στόχος, αξιολόγηση')}` }))} />
      {entriesMode
        ? <ChoiceField label={en ? 'Period' : 'Περίοδος'} value={range} onChange={value => setRange(value as 'all' | 'custom')} options={[{ value: 'all', label: en ? 'All entries' : 'Όλες οι εγγραφές' }, { value: 'custom', label: en ? 'From – to' : 'Από – έως' }]} />
        : <ChoiceField label={en ? 'Compare with' : 'Σύγκριση'} value={compare} onChange={value => setCompare(value as ReportCompare)} options={REPORT_COMPARES.map(value => ({ value, label: compareLabel(value, language) }))} />}
      {needsDates && <div className="register-print-dates">
        <ManualDateField label={en ? 'From' : 'Από'} value={from} onChange={setFrom} required />
        <ManualDateField label={en ? 'To' : 'Έως'} value={to} onChange={setTo} required error={from && to && from > to ? (en ? 'The end is before the start.' : 'Η λήξη είναι πριν την έναρξη.') : ''} />
      </div>}
    </div>
  </ObserverDialog>
}
