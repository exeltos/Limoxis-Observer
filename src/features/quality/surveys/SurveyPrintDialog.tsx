import { useState } from 'react'
import { ObserverDialog, DialogActions } from '../../../design-system/ObserverDialog'
import { Button } from '../../../design-system/Button'
import { ChoiceField } from '../../../design-system/ChoiceField'
import { ManualDateField } from '../../../design-system/ManualDateField'
import { REPORT_COMPARES, REPORT_DETAILS, compareLabel, detailLabel } from '../../registers/registerReport'
import type { ReportCompare, ReportDetail } from '../../registers/registerReport'

const COMPARE_KEY = 'limoxis.survey.print.compare'
const DETAIL_KEY = 'limoxis.survey.print.detail'
const readCompare = (): ReportCompare => { try { const value = window.localStorage.getItem(COMPARE_KEY) as ReportCompare | null; return value && REPORT_COMPARES.includes(value) && value !== 'custom' ? value : 'none' } catch { return 'none' } }
const readDetail = (): ReportDetail => { try { return window.localStorage.getItem(DETAIL_KEY) === 'full' ? 'full' : 'summary' } catch { return 'summary' } }
const remember = (compare: ReportCompare, detail: ReportDetail) => { try { window.localStorage.setItem(COMPARE_KEY, compare); window.localStorage.setItem(DETAIL_KEY, detail) } catch { /* only a convenience */ } }

export type SurveyPrintChoice = { detail: ReportDetail, from: string, to: string, compare: ReportCompare, compareFrom: string, compareTo: string, word: boolean }

// «Εκτύπωση / PDF» of a questionnaire's results (owner, 18/11/2026): the layout (summary or detailed), the period of
// the responses (all, or two dates; the dates of the screen's filter come in already), and the period to compare with,
// as the registers print. The layout and the comparison are remembered.
export function SurveyPrintDialog({ language, from: initialFrom = '', to: initialTo = '', onPrint, onClose }: { language: string, from?: string, to?: string, onPrint: (choice: SurveyPrintChoice) => void, onClose: () => void }) {
  const en = language === 'en'
  const [detail, setDetail] = useState<ReportDetail>(readDetail)
  const [range, setRange] = useState<'all' | 'custom'>(initialFrom || initialTo ? 'custom' : 'all')
  const [from, setFrom] = useState(initialFrom)
  const [to, setTo] = useState(initialTo)
  const [compare, setCompare] = useState<ReportCompare>(readCompare)
  const [compareFrom, setCompareFrom] = useState('')
  const [compareTo, setCompareTo] = useState('')
  const reversed = (a: string, b: string) => Boolean(a && b && a > b)
  const periodMissing = range === 'custom' && (!from || !to || reversed(from, to))
  const compareMissing = compare === 'custom' && (!compareFrom || !compareTo || reversed(compareFrom, compareTo))
  const blocked = periodMissing || compareMissing
  const endError = (a: string, b: string) => (reversed(a, b) ? (en ? 'The end is before the start.' : 'Η λήξη είναι πριν την έναρξη.') : '')
  const go = (word: boolean) => {
    if (blocked) return
    remember(compare, detail)
    onPrint({ detail, from: range === 'custom' ? from : '', to: range === 'custom' ? to : '', compare, compareFrom: compare === 'custom' ? compareFrom : '', compareTo: compare === 'custom' ? compareTo : '', word })
  }
  return <ObserverDialog width="compact" title={en ? 'Print the results' : 'Εκτύπωση αποτελεσμάτων'} onClose={onClose}
    footer={<DialogActions>
      <Button variant="secondary" disabled={blocked} onClick={() => go(true)}>Word</Button>
      <Button disabled={blocked} onClick={() => go(false)}>{en ? 'Print / PDF' : 'Εκτύπωση / PDF'}</Button>
    </DialogActions>}>
    <div className="print-options">
      <ChoiceField label={en ? 'Layout' : 'Μορφή'} value={detail} onChange={value => setDetail(value as ReportDetail)} options={REPORT_DETAILS.map(value => ({ value, label: `${detailLabel(value, language)}${value === 'summary' ? (en ? ': satisfaction of each question with its bar' : ': ικανοποίηση κάθε ερώτησης με τη μπάρα της') : (en ? ': also the answers 1–5, by department, by month and the comments' : ': και απαντήσεις 1–5, ανά τμήμα, ανά μήνα και σχόλια')}` }))} />
      <ChoiceField label={en ? 'Period' : 'Περίοδος'} value={range} onChange={value => setRange(value as 'all' | 'custom')} options={[{ value: 'all', label: en ? 'All responses' : 'Όλες οι απαντήσεις' }, { value: 'custom', label: en ? 'From – to' : 'Από – έως' }]} />
      {range === 'custom' && <div className="survey-print-dates">
        <ManualDateField label={en ? 'From' : 'Από'} value={from} onChange={setFrom} required />
        <ManualDateField label={en ? 'To' : 'Έως'} value={to} onChange={setTo} required error={endError(from, to)} />
      </div>}
      <ChoiceField label={en ? 'Compare with' : 'Σύγκριση'} value={compare} onChange={value => setCompare(value as ReportCompare)} options={REPORT_COMPARES.map(value => ({ value, label: compareLabel(value, language) }))} />
      {compare === 'custom' && <div className="survey-print-dates">
        <ManualDateField label={en ? 'Compare from' : 'Σύγκριση από'} value={compareFrom} onChange={setCompareFrom} required />
        <ManualDateField label={en ? 'Compare to' : 'Σύγκριση έως'} value={compareTo} onChange={setCompareTo} required error={endError(compareFrom, compareTo)} />
      </div>}
    </div>
  </ObserverDialog>
}
