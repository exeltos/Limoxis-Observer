import { ArrowDown, ArrowUp, ClipboardList, LayoutTemplate, Plus, Settings2, Trash2 } from 'lucide-react'
import { FormCard, FormGrid } from '../../../design-system/FormCard'
import { Field } from '../../../design-system/Field'
import { ManualDateField } from '../../../design-system/ManualDateField'
import { MultiSelect } from '../../../design-system/MultiSelect'
import { IconButton } from '../../../design-system/IconButton'
import { Button } from '../../../design-system/Button'
import { SearchableSelect } from '../../../design-system/SearchableSelect'
import { ChoiceField } from '../../../design-system/ChoiceField'
import '../../registers/registers.css'
import { QUESTION_TYPES, SURVEY_AUDIENCES, SURVEY_TEMPLATES, sectionLabel } from './surveyModel'

const selectText = en => ({ emptyLabel: en ? 'No match' : 'Δεν βρέθηκε', clearLabel: en ? 'Clear' : 'Καθαρισμός' })
const newId = () => `q-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`

// The questionnaire and its settings. A new survey starts from a template.
export function SurveyEditor({ survey, onChange, onTemplate, isNew, locked, hasResponses, departments = [], language = 'el' }) {
  const en = language === 'en'
  const set = next => onChange({ ...survey, ...next })
  const questions = survey.questions || []
  const setQuestion = (index, next) => set({ questions: questions.map((item, position) => (position === index ? { ...item, ...next } : item)) })
  const move = (index, delta) => { const target = index + delta; if (target < 0 || target >= questions.length) return; const next = [...questions]; [next[index], next[target]] = [next[target], next[index]]; set({ questions: next }) }
  const sections = [...new Set(SURVEY_TEMPLATES.flatMap(item => item.questions.map(question => question.section)).filter(Boolean))]
  const departmentOptions = departments.map(item => ({ value: item.id || item.name, label: en ? item.nameEn || item.name : item.name }))
  return <div className="lo-form-cards">
    {isNew && <FormCard wide title={en ? 'Template' : 'Πρότυπο'} icon={LayoutTemplate} hint={en ? 'Every question can be changed afterwards.' : 'Κάθε ερώτηση αλλάζει και αργότερα.'}>
      <div className="register-templates" role="radiogroup" aria-label={en ? 'Template' : 'Πρότυπο'}>
        {SURVEY_TEMPLATES.map(item => <button key={item.key} type="button" role="radio" aria-checked={survey.templateKey === item.key} className={survey.templateKey === item.key ? 'active' : ''} onClick={() => onTemplate(item.key)}>
          <span className="register-template-kind"><ClipboardList size={15} />{SURVEY_AUDIENCES.find(audience => audience.value === item.audience)?.label[en ? 1 : 0]}</span>
          <strong>{en ? item.titleEn : item.title}</strong>
          <small>{en ? item.descriptionEn : item.description}</small>
          <em>{item.questions.length} {en ? 'questions' : 'ερωτήσεις'}</em>
        </button>)}
      </div>
    </FormCard>}
    <FormCard wide title={en ? 'Survey' : 'Έρευνα'} icon={Settings2}>
      <FormGrid columns={2}>
        <Field label={`${en ? 'Title' : 'Τίτλος'} *`}><input value={survey.title} disabled={locked} onChange={event => set({ title: event.target.value })} /></Field>
        <Field label={en ? 'Title in English' : 'Τίτλος στα αγγλικά'}><input value={survey.titleEn || ''} disabled={locked} onChange={event => set({ titleEn: event.target.value })} /></Field>
        <Field label={en ? 'Introduction shown to respondents' : 'Εισαγωγή προς τους ερωτώμενους'}><textarea rows={2} value={survey.description || ''} disabled={locked} onChange={event => set({ description: event.target.value })} /></Field>
        <Field label={en ? 'Introduction in English' : 'Εισαγωγή στα αγγλικά'}><textarea rows={2} value={survey.descriptionEn || ''} disabled={locked} onChange={event => set({ descriptionEn: event.target.value })} /></Field>
        <SearchableSelect label={en ? 'Asks' : 'Απευθύνεται σε'} value={survey.audience} disabled={locked} options={SURVEY_AUDIENCES.map(item => ({ value: item.value, label: item.label[en ? 1 : 0] }))} onChange={value => value && set({ audience: value })} {...selectText(en)} />
        <MultiSelect label={en ? 'Departments (none = whole hospital)' : 'Τμήματα (κανένα = όλο το νοσοκομείο)'} options={departmentOptions} selected={survey.departmentIds || []} disabled={locked} onChange={value => set({ departmentIds: value })} placeholder={en ? 'Whole hospital' : 'Όλο το νοσοκομείο'} searchPlaceholder={en ? 'Search department…' : 'Αναζήτηση τμήματος…'} emptyLabel={en ? 'No match' : 'Δεν βρέθηκε'} selectAllLabel={en ? 'All' : 'Όλα'} clearAllLabel={en ? 'None' : 'Κανένα'} countLabel={count => (en ? `${count} departments` : `${count} τμήματα`)} />
        <ManualDateField label={en ? 'Opens on' : 'Έναρξη'} value={survey.opensOn || ''} disabled={locked} onChange={value => set({ opensOn: value })} optional />
        <ManualDateField label={en ? 'Closes on' : 'Λήξη'} value={survey.closesOn || ''} disabled={locked} onChange={value => set({ closesOn: value })} optional />
        <Field label={en ? 'Responses aimed at' : 'Στόχος απαντήσεων'} hint={en ? 'For a reliable result, usually 100 or more.' : 'Για αξιόπιστο αποτέλεσμα, συνήθως 100 και πάνω.'}><input inputMode="numeric" value={survey.targetResponses ?? ''} disabled={locked} onChange={event => set({ targetResponses: event.target.value.replace(/\D/g, '') })} /></Field>
        <Field label={en ? 'Satisfied target (%)' : 'Στόχος ικανοποίησης (%)'} hint={en ? 'Share answering 4 or 5. A question below it is flagged.' : 'Ποσοστό που απαντά 4 ή 5. Ερώτηση κάτω από αυτό επισημαίνεται.'}><input inputMode="numeric" value={survey.satisfiedTarget ?? ''} disabled={locked} onChange={event => set({ satisfiedTarget: Math.min(100, Number(event.target.value.replace(/\D/g, '')) || 0) })} /></Field>
      </FormGrid>
    </FormCard>
    <FormCard wide title={en ? `Questions ${questions.length}` : `Ερωτήσεις ${questions.length}`} icon={ClipboardList} hint={hasResponses ? (en ? 'The survey has answers: change the wording only if the meaning stays the same, so results remain comparable.' : 'Η έρευνα έχει απαντήσεις: αλλάξτε τη διατύπωση μόνο αν το νόημα μένει ίδιο, ώστε τα αποτελέσματα να συγκρίνονται.') : (en ? 'Shown in this order, grouped by section.' : 'Εμφανίζονται με αυτή τη σειρά, ανά ενότητα.')}>
      <ol className="survey-editor-list">
        {questions.map((question, index) => <li key={question.id}>
          <div className="survey-editor-head">
            <strong>{index + 1}</strong>
            <SearchableSelect hideLabel className="survey-editor-select" label={en ? 'Kind' : 'Είδος'} value={question.type} disabled={locked} options={QUESTION_TYPES.map(item => ({ value: item.value, label: item.label[en ? 1 : 0] }))} onChange={type => type && setQuestion(index, { type, options: ['single', 'multiple'].includes(type) ? (question.options?.length ? question.options : [{ value: 'a', label: '', labelEn: '' }, { value: 'b', label: '', labelEn: '' }]) : [] })} {...selectText(en)} />
            <SearchableSelect hideLabel className="survey-editor-select" label={en ? 'Section' : 'Ενότητα'} value={question.section || ''} disabled={locked} options={sections.map(key => ({ value: key, label: sectionLabel(key, language) }))} onChange={section => setQuestion(index, { section: section || '' })} placeholder={en ? 'No section' : 'Χωρίς ενότητα'} {...selectText(en)} />
            <ChoiceField className="survey-editor-required" label={en ? 'Required' : 'Υποχρεωτική'} value={question.required ? 'yes' : 'no'} options={[{ value: 'yes', label: en ? 'Yes' : 'Ναι' }, { value: 'no', label: en ? 'No' : 'Όχι' }]} onChange={value => !locked && setQuestion(index, { required: value === 'yes' })} />
            {!locked && <span className="row-actions"><IconButton size="sm" label={en ? 'Up' : 'Πάνω'} onClick={() => move(index, -1)} disabled={!index}><ArrowUp size={14} /></IconButton><IconButton size="sm" label={en ? 'Down' : 'Κάτω'} onClick={() => move(index, 1)} disabled={index === questions.length - 1}><ArrowDown size={14} /></IconButton><IconButton size="sm" tone="danger" label={en ? 'Remove question' : 'Αφαίρεση ερώτησης'} onClick={() => set({ questions: questions.filter((_, position) => position !== index) })}><Trash2 size={14} /></IconButton></span>}
          </div>
          <FormGrid columns={2}>
            <Field label={en ? 'Question' : 'Ερώτηση'}><input value={question.label} disabled={locked} onChange={event => setQuestion(index, { label: event.target.value })} /></Field>
            <Field label={en ? 'In English' : 'Στα αγγλικά'}><input value={question.labelEn || ''} disabled={locked} onChange={event => setQuestion(index, { labelEn: event.target.value })} /></Field>
          </FormGrid>
          {['single', 'multiple'].includes(question.type) && <div className="survey-editor-options">
            {(question.options || []).map((option, position) => <div key={option.value} className="survey-editor-option">
              <input aria-label={en ? 'Option' : 'Επιλογή'} placeholder={en ? 'Option' : 'Επιλογή'} value={option.label} disabled={locked} onChange={event => setQuestion(index, { options: question.options.map((item, at) => (at === position ? { ...item, label: event.target.value } : item)) })} />
              <input aria-label={en ? 'In English' : 'Στα αγγλικά'} placeholder={en ? 'In English' : 'Στα αγγλικά'} value={option.labelEn || ''} disabled={locked} onChange={event => setQuestion(index, { options: question.options.map((item, at) => (at === position ? { ...item, labelEn: event.target.value } : item)) })} />
              {!locked && <IconButton size="sm" tone="danger" label={en ? 'Remove option' : 'Αφαίρεση επιλογής'} onClick={() => setQuestion(index, { options: question.options.filter((_, at) => at !== position) })}><Trash2 size={13} /></IconButton>}
            </div>)}
            {!locked && <button type="button" className="quality-panel-all" onClick={() => setQuestion(index, { options: [...(question.options || []), { value: `o${Date.now().toString(36)}`, label: '', labelEn: '' }] })}><Plus size={12} /> {en ? 'Option' : 'Επιλογή'}</button>}
          </div>}
        </li>)}
      </ol>
      {!locked && <Button variant="secondary" onClick={() => set({ questions: [...questions, { id: newId(), section: questions.at(-1)?.section || '', type: 'rating', label: '', labelEn: '', required: true, options: [] }] })}><Plus size={15} />{en ? 'Question' : 'Ερώτηση'}</Button>}
    </FormCard>
  </div>
}
