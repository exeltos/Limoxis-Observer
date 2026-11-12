import { useMemo, useState } from 'react'
import { ObserverDialog, DialogActions } from '../../design-system/ObserverDialog'
import { Button } from '../../design-system/Button'
import { Field } from '../../design-system/Field'
import { YesNoField } from '../../design-system/YesNoField'
import { useLanguage } from '../../core/i18n/LanguageContext'
import { calculateClinicalScale } from '../clinical-scales/clinicalScaleEngine'
import { clinicalScaleFields } from '../clinical-scales/clinicalScaleForms'
import { ScaleLiveResult } from '../clinical-scales/ClinicalScaleViews'
import '../clinical-scales/clinicalScales.css'
import type { AnyRecord } from '../../types/featureTypes'

interface ApacheCalculatorDialogProps { age?: unknown, onUse: (score: number | null) => void, onClose: () => void }

// The APACHE II calculator of the clinical scales, inside a register entry: the registers do not depend on the
// patients of the surveillance, so the score is worked out here from the worst values of the first 24 hours.
export function ApacheCalculatorDialog({ age, onUse, onClose }: ApacheCalculatorDialogProps) {
  const { language } = useLanguage()
  const en = language === 'en'
  const [answers, setAnswers] = useState<AnyRecord>({ age: age ?? '', chronicHealthPoints: 0, acuteRenalFailure: false })
  const set = (key: string, value: unknown) => setAnswers(current => ({ ...current, [key]: value }))
  // A blank input would count as 0 in the engine, so the score is only accepted when every parameter is filled.
  const blank = ['age', 'chronicHealthPoints', ...clinicalScaleFields('apache-ii').map(([key]: string[]) => key)].some(key => answers[key] === '' || answers[key] == null)
  const result = useMemo(() => { const worked = calculateClinicalScale('apache-ii', answers); return blank ? { ...worked, score: null, complete: false } : worked }, [answers, blank])
  return <ObserverDialog width="large" title={en ? 'APACHE II calculator' : 'Υπολογισμός APACHE II'} subtitle={en ? 'Worst values of the first 24 hours in the ICU.' : 'Οι δυσμενέστερες τιμές των πρώτων 24 ωρών στη ΜΕΘ.'} onClose={onClose}
    footer={<DialogActions><Button variant="secondary" onClick={onClose}>{en ? 'Cancel' : 'Ακύρωση'}</Button><Button disabled={result.score == null} onClick={() => onUse(result.score)}>{en ? 'Use this score' : 'Χρήση του score'}</Button></DialogActions>}>
    <div className="record-section">
      <div className="cs-form-grid">
        <Field label={en ? 'Age (years)' : 'Ηλικία (έτη)'}><input type="number" step="any" value={answers.age ?? ''} onChange={event => set('age', event.target.value)} /></Field>
        <Field label={en ? 'Chronic health points' : 'Βαθμοί χρόνιας κατάστασης υγείας'}><input type="number" min="0" value={answers.chronicHealthPoints ?? 0} onChange={event => set('chronicHealthPoints', event.target.value)} /></Field>
        {clinicalScaleFields('apache-ii').map(([key, labelEl, labelEn]: string[]) => <Field key={key} label={en ? labelEn : labelEl}><input type="number" step="any" value={answers[key] ?? ''} onChange={event => set(key, event.target.value)} /></Field>)}
      </div>
      <YesNoField label={en ? 'Acute renal failure' : 'Οξεία νεφρική ανεπάρκεια'} value={Boolean(answers.acuteRenalFailure)} onChange={value => set('acuteRenalFailure', value)} />
      <ScaleLiveResult scale="apache-ii" result={result} en={en} />
    </div>
  </ObserverDialog>
}
