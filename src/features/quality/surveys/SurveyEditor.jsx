import { useState } from 'react'
import { ArrowDown, ArrowUp, ClipboardList, Eye, LayoutTemplate, Pencil, Plus, Settings2, Trash2 } from 'lucide-react'
import { FormCard, FormGrid } from '../../../design-system/FormCard'
import { Field } from '../../../design-system/Field'
import { ManualDateField } from '../../../design-system/ManualDateField'
import { MultiSelect } from '../../../design-system/MultiSelect'
import { SearchableSelect } from '../../../design-system/SearchableSelect'
import { YesNoField } from '../../../design-system/YesNoField'
import { ObserverDialog, DialogActions } from '../../../design-system/ObserverDialog'
import { IconButton } from '../../../design-system/IconButton'
import { Button } from '../../../design-system/Button'
import { QUESTION_TYPES, SCALES, SURVEY_AUDIENCES, SURVEY_TEMPLATES, questionTypeLabel, sectionsOf, textOf } from './surveyModel'
import { SurveyQuestion } from './SurveyForm'
import '../../registers/registers.css'

const selectText = en => ({ emptyLabel: en ? 'No match' : 'Δεν βρέθηκε', clearLabel: en ? 'Clear' : 'Καθαρισμός' })
const uid = prefix => `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`
const move = (list, index, step) => { const target = index + step; if (target < 0 || target >= list.length) return list; const next = [...list]; [next[index], next[target]] = [next[target], next[index]]; return next }
const audienceOptions = en => SURVEY_AUDIENCES.map(item => ({ value: item.value, label: item.label[en ? 1 : 0] }))

// The questionnaire and its settings, laid out like a register's definition:
// the survey's details, then its sections with their questions; a question
// opens in its own window, with a preview of how it is answered.
export function SurveyEditor({ survey, onChange, onTemplate, isNew, locked, hasResponses, departments = [], language = 'el' }) {
  const en = language === 'en'
  const [editing, setEditing] = useState(null)
  const set = next => onChange({ ...survey, ...next })
  const questions = survey.questions || []
  const sections = sectionsOf(survey)
  const setSections = next => set({ sections: next })
  const departmentOptions = departments.map(item => ({ value: item.id || item.name, label: en ? item.nameEn || item.name : item.name }))

  function saveQuestion(question, previousId) {
    const exists = questions.some(item => item.id === previousId)
    set({ sections, questions: exists ? questions.map(item => (item.id === previousId ? question : item)) : [...questions, question] })
    setEditing(null)
  }
  function moveQuestion(question, step) {
    // Within its section: swap with the neighbour of the same section.
    const same = questions.filter(item => (item.section || '') === (question.section || ''))
    const at = same.indexOf(question), other = same[at + step]
    if (!other) return
    const a = questions.indexOf(question), b = questions.indexOf(other)
    const next = [...questions]; [next[a], next[b]] = [next[b], next[a]]
    set({ questions: next })
  }
  const addSection = () => { const key = uid('s'); setSections([...sections, { key, label: en ? 'New section' : 'Νέα ενότητα', labelEn: 'New section' }]) }
  const unsectioned = questions.filter(question => !sections.some(section => section.key === question.section))
  const groups = [...sections.map(section => ({ section, items: questions.filter(question => question.section === section.key) })), ...(unsectioned.length ? [{ section: null, items: unsectioned }] : [])]
  const numberOf = question => questions.indexOf(question) + 1

  return <div className="lo-form-cards survey-editor">
    {isNew && <FormCard wide title={en ? 'Template' : 'Πρότυπο'} icon={LayoutTemplate} hint={en ? 'Start from a questionnaire and change any question afterwards.' : 'Ξεκινήστε από ένα ερωτηματολόγιο και αλλάξτε όποια ερώτηση θέλετε.'}>
      <div className="register-templates" role="radiogroup" aria-label={en ? 'Template' : 'Πρότυπο'}>
        {SURVEY_TEMPLATES.map(item => <button key={item.key} type="button" role="radio" aria-checked={survey.templateKey === item.key} className={survey.templateKey === item.key ? 'active' : ''} onClick={() => onTemplate(item.key)}>
          <span className="register-template-kind"><ClipboardList size={15} />{SURVEY_AUDIENCES.find(audience => audience.value === item.audience)?.label[en ? 1 : 0]}</span>
          <strong>{en ? item.titleEn : item.title}</strong>
          {(en ? item.descriptionEn : item.description) && <small>{en ? item.descriptionEn : item.description}</small>}
          <em>{item.questions.length} {en ? 'questions' : 'ερωτήσεις'}{item.sections?.length ? ` · ${item.sections.length} ${en ? 'sections' : 'ενότητες'}` : ''}</em>
        </button>)}
      </div>
    </FormCard>}

    <FormCard wide title={en ? 'Survey' : 'Έρευνα'} icon={Settings2} hint={en ? 'Satisfied = answers of 4 or 5 on a 1–5 scale; a question below the target is flagged. For a reliable result aim at 100 responses or more.' : 'Ικανοποιημένοι = απαντήσεις 4 ή 5 σε κλίμακα 1–5· ερώτηση κάτω από τον στόχο επισημαίνεται. Για αξιόπιστο αποτέλεσμα, στόχος 100 απαντήσεις και πάνω.'}>
      <FormGrid columns={2}>
        <Field label={`${en ? 'Title' : 'Τίτλος'} *`}><input value={survey.title} disabled={locked} onChange={event => set({ title: event.target.value })} /></Field>
        <Field label={en ? 'Introduction to respondents' : 'Εισαγωγή προς τους ερωτώμενους'}><textarea rows={2} value={survey.description || ''} disabled={locked} onChange={event => set({ description: event.target.value })} /></Field>
        <SearchableSelect label={en ? 'Asks' : 'Απευθύνεται σε'} value={survey.audience} disabled={locked} options={audienceOptions(en)} onChange={value => value && set({ audience: value })} {...selectText(en)} clearLabel="" />
        <MultiSelect label={`${en ? 'Department it is about' : 'Τμήμα που αφορά'} *`} options={departmentOptions} selected={survey.departmentIds || []} disabled={locked} onChange={value => set({ departmentIds: value })} placeholder={en ? 'Choose the department…' : 'Επιλέξτε το τμήμα…'} searchPlaceholder={en ? 'Search department…' : 'Αναζήτηση τμήματος…'} emptyLabel={en ? 'No match' : 'Δεν βρέθηκε'} selectAllLabel={en ? 'All' : 'Όλα'} clearAllLabel={en ? 'None' : 'Κανένα'} countLabel={count => (en ? `${count} departments` : `${count} τμήματα`)} />
      </FormGrid>
      <FormGrid columns={4}>
        <ManualDateField label={en ? 'Opens on' : 'Έναρξη'} value={survey.opensOn || ''} disabled={locked} onChange={value => set({ opensOn: value })} optional />
        <ManualDateField label={en ? 'Closes on' : 'Λήξη'} value={survey.closesOn || ''} disabled={locked} onChange={value => set({ closesOn: value })} optional />
        <Field label={en ? 'Responses aimed at' : 'Στόχος απαντήσεων'}><input inputMode="numeric" value={survey.targetResponses ?? ''} disabled={locked} onChange={event => set({ targetResponses: event.target.value.replace(/\D/g, '') })} /></Field>
        <Field label={en ? 'Satisfied target %' : 'Στόχος ικανοποίησης %'}><input inputMode="numeric" value={survey.satisfiedTarget ?? ''} disabled={locked} onChange={event => set({ satisfiedTarget: Math.min(100, Number(event.target.value.replace(/\D/g, '')) || 0) })} /></Field>
      </FormGrid>
    </FormCard>

    <FormCard wide title={en ? `Questions ${questions.length}` : `Ερωτήσεις ${questions.length}`} icon={ClipboardList} hint={hasResponses ? (en ? 'The survey has answers: change a wording only if its meaning stays, so results remain comparable.' : 'Η έρευνα έχει απαντήσεις: αλλάξτε μια διατύπωση μόνο αν το νόημα μένει ίδιο, ώστε τα αποτελέσματα να συγκρίνονται.') : (en ? 'Respondents answer one section at a time, in this order.' : 'Οι ερωτώμενοι απαντούν μία ενότητα τη φορά, με αυτή τη σειρά.')}>
      {groups.map(({ section, items }) => {
        const index = section ? sections.indexOf(section) : -1
        return <div key={section?.key || 'none'} className="register-builder-section survey-editor-section">
          <div className="register-builder-section-head">
            {section ? <span className="survey-editor-section-name">
              <input aria-label={en ? 'Section' : 'Ενότητα'} value={section.label} disabled={locked} onChange={event => setSections(sections.map(item => (item.key === section.key ? { ...item, label: event.target.value } : item)))} />
            </span> : <strong>{en ? 'Without a section' : 'Χωρίς ενότητα'}</strong>}
            {!locked && <span className="register-builder-tools">
              {section && <><IconButton size="sm" label={en ? 'Section up' : 'Ενότητα πάνω'} disabled={index <= 0} onClick={() => setSections(move(sections, index, -1))}><ArrowUp size={14} /></IconButton><IconButton size="sm" label={en ? 'Section down' : 'Ενότητα κάτω'} disabled={index >= sections.length - 1} onClick={() => setSections(move(sections, index, 1))}><ArrowDown size={14} /></IconButton></>}
              {section && !items.length && <IconButton size="sm" tone="danger" label={en ? 'Remove section' : 'Αφαίρεση ενότητας'} onClick={() => setSections(sections.filter(item => item.key !== section.key))}><Trash2 size={14} /></IconButton>}
              <Button variant="secondary" onClick={() => setEditing({ question: { id: '', section: section?.key || '', type: 'rating', scale: 'rating', label: '', labelEn: '', required: true, options: [] }, previousId: null })}><Plus size={14} />{en ? 'Question' : 'Ερώτηση'}</Button>
            </span>}
          </div>
          {items.length ? <ul className="register-builder-list survey-editor-list">{items.map((question, position) => <li key={question.id}>
            <span className="survey-editor-number">{numberOf(question)}</span>
            <span className="survey-editor-text"><strong>{textOf(question, language) || (en ? 'No text yet' : 'Χωρίς κείμενο')}</strong><small>{questionMeta(question, questions, language)}</small></span>
            <span className="register-builder-tools">
              {!locked && <><IconButton size="sm" label={en ? 'Up' : 'Πάνω'} disabled={!position} onClick={() => moveQuestion(question, -1)}><ArrowUp size={14} /></IconButton><IconButton size="sm" label={en ? 'Down' : 'Κάτω'} disabled={position === items.length - 1} onClick={() => moveQuestion(question, 1)}><ArrowDown size={14} /></IconButton></>}
              <IconButton size="sm" label={locked ? (en ? 'View' : 'Προβολή') : (en ? 'Edit' : 'Επεξεργασία')} onClick={() => setEditing({ question, previousId: question.id })}>{locked ? <Eye size={14} /> : <Pencil size={14} />}</IconButton>
              {!locked && <IconButton size="sm" tone="danger" label={en ? 'Remove question' : 'Αφαίρεση ερώτησης'} onClick={() => set({ questions: questions.filter(item => item.id !== question.id) })}><Trash2 size={14} /></IconButton>}
            </span>
          </li>)}</ul> : <p className="survey-editor-empty">{en ? 'No questions in this section yet.' : 'Δεν υπάρχουν ακόμη ερωτήσεις σε αυτή την ενότητα.'}</p>}
        </div>
      })}
      {!locked && <div className="survey-editor-footer"><Button variant="secondary" onClick={addSection}><Plus size={15} />{en ? 'Section' : 'Ενότητα'}</Button></div>}
    </FormCard>
    {editing && <QuestionDialog question={editing.question} survey={{ ...survey, sections }} locked={locked} language={language} onCancel={() => setEditing(null)} onSave={question => saveQuestion(question, editing.previousId)} />}
  </div>
}

// What a question is, in one line: kind, scale, required, the answer it waits for.
function questionMeta(question, questions, language) {
  const en = language === 'en'
  const scale = question.type === 'rating' ? SCALES.find(item => item.value === (question.scale || 'quality'))?.label[en ? 1 : 0] : ''
  const options = ['single', 'multiple'].includes(question.type) ? `${(question.options || []).length} ${en ? 'options' : 'επιλογές'}` : ''
  const parent = question.showWhen?.question ? questions.find(item => item.id === question.showWhen.question) : null
  const when = parent ? `${en ? 'when' : 'όταν'} «${textOf(parent, language).slice(0, 40)}» = ${answerText(parent, question.showWhen.value, language)}` : ''
  return [questionTypeLabel(question.type, language), scale, options, question.required ? (en ? 'required' : 'υποχρεωτική') : (en ? 'optional' : 'προαιρετική'), when].filter(Boolean).join(' · ')
}
const answerText = (question, value, language) => (question?.type === 'yesno' ? (value ? (language === 'en' ? 'Yes' : 'Ναι') : (language === 'en' ? 'No' : 'Όχι')) : textOf((question?.options || []).find(item => item.value === value), language) || String(value ?? ''))

function QuestionDialog({ question: initial, survey, locked, language, onCancel, onSave }) {
  const en = language === 'en'
  const [question, setQuestion] = useState(() => structuredClone(initial))
  const [preview, setPreview] = useState(undefined)
  const set = next => setQuestion(current => ({ ...current, ...next }))
  const isChoice = ['single', 'multiple'].includes(question.type)
  // A question can follow a Yes/No or single-choice question asked before it.
  const before = (survey.questions || []).filter(item => item.id !== initial.id && ['yesno', 'single'].includes(item.type))
  const parent = before.find(item => item.id === question.showWhen?.question)
  const options = (question.options || [])
  const valid = Boolean(String(question.label).trim()) && (!isChoice || options.filter(item => String(item.label).trim()).length >= 2)
  function finish() {
    const others = (survey.questions || []).map(item => item.id).filter(id => id !== initial.id)
    const id = initial.id || uid('q')
    const clean = {
      ...question, id: others.includes(id) ? uid('q') : id, label: question.label.trim(), labelEn: String(question.labelEn || '').trim(),
      options: isChoice ? options.filter(item => String(item.label).trim()).map(item => ({ ...item, value: item.value || uid('o'), label: item.label.trim(), labelEn: String(item.labelEn || '').trim() })) : [],
      // A question that appears on a condition cannot be required: the database would refuse the answers without it.
      required: question.showWhen?.question ? false : Boolean(question.required),
    }
    if (clean.type !== 'rating') delete clean.scale
    if (!clean.showWhen?.question) delete clean.showWhen
    onSave(clean)
  }
  return <ObserverDialog width="wide" title={initial.id ? (en ? 'Question' : 'Ερώτηση') : (en ? 'New question' : 'Νέα ερώτηση')} subtitle={textOf(survey, language)} onClose={onCancel}
    footer={!locked && <DialogActions onCancel={onCancel} onSave={finish} disabled={!valid} saveLabel={en ? 'Keep the question' : 'Αποθήκευση ερώτησης'} />}>
    <div className="survey-question-dialog">
      <div className="lo-form-cards">
        <FormCard wide title={en ? 'Question' : 'Ερώτηση'}>
          <Field label={`${en ? 'Question' : 'Ερώτηση'} *`}><textarea rows={2} value={question.label} disabled={locked} onChange={event => set({ label: event.target.value })} /></Field>
          <FormGrid columns={2}>
            <SearchableSelect label={en ? 'Kind of answer' : 'Είδος απάντησης'} value={question.type} disabled={locked} options={QUESTION_TYPES.map(item => ({ value: item.value, label: item.label[en ? 1 : 0] }))} onChange={type => type && set({ type, ...(type === 'rating' && !question.scale ? { scale: 'rating' } : {}), options: ['single', 'multiple'].includes(type) && !options.length ? [{ value: '', label: '', labelEn: '' }, { value: '', label: '', labelEn: '' }] : options })} {...selectText(en)} clearLabel="" />
            <SearchableSelect label={en ? 'Section' : 'Ενότητα'} value={question.section || ''} disabled={locked} options={(survey.sections || []).map(item => ({ value: item.key, label: textOf(item, language) }))} onChange={section => set({ section: section || '' })} placeholder={en ? 'No section' : 'Χωρίς ενότητα'} {...selectText(en)} />
            {question.type === 'rating' && <SearchableSelect label={en ? 'Scale words' : 'Λέξεις κλίμακας'} value={question.scale || 'quality'} disabled={locked} options={SCALES.map(item => ({ value: item.value, label: item.label[en ? 1 : 0] }))} onChange={scale => scale && set({ scale })} {...selectText(en)} clearLabel="" />}
            <YesNoField label={en ? 'Required' : 'Υποχρεωτική'} value={question.showWhen?.question ? false : Boolean(question.required)} onChange={value => !locked && !question.showWhen?.question && set({ required: value })} hint={question.showWhen?.question ? (en ? 'A question shown on a condition is optional.' : 'Ερώτηση υπό όρο είναι πάντα προαιρετική.') : ''} />
          </FormGrid>
        </FormCard>
        {isChoice && <FormCard wide title={en ? 'Options' : 'Επιλογές'} hint={en ? 'At least two.' : 'Τουλάχιστον δύο.'}>
          <ul className="register-builder-list">{options.map((option, index) => <li key={option.value || `new-${index}`}><span className="register-axis-fields">
            <input aria-label={en ? 'Option' : 'Επιλογή'} placeholder={en ? 'Option' : 'Επιλογή'} value={option.label} disabled={locked} onChange={event => set({ options: options.map((item, at) => (at === index ? { ...item, label: event.target.value } : item)) })} />
          </span>{!locked && <span className="register-builder-tools"><IconButton size="sm" label={en ? 'Up' : 'Πάνω'} disabled={!index} onClick={() => set({ options: move(options, index, -1) })}><ArrowUp size={14} /></IconButton><IconButton size="sm" tone="danger" label={en ? 'Remove option' : 'Αφαίρεση επιλογής'} onClick={() => set({ options: options.filter((_, at) => at !== index) })}><Trash2 size={14} /></IconButton></span>}</li>)}</ul>
          {!locked && <Button variant="secondary" onClick={() => set({ options: [...options, { value: '', label: '', labelEn: '' }] })}><Plus size={15} />{en ? 'Option' : 'Επιλογή'}</Button>}
        </FormCard>}
        <FormCard wide title={en ? 'Shown when' : 'Εμφανίζεται όταν'} hint={en ? 'Leave empty for a question everyone answers.' : 'Αφήστε κενό για ερώτηση που απαντούν όλοι.'}>
          <FormGrid columns={2}>
            <SearchableSelect label={en ? 'Another question' : 'Άλλη ερώτηση'} value={question.showWhen?.question || ''} disabled={locked} options={before.map(item => ({ value: item.id, label: textOf(item, language) }))} onChange={id => set({ showWhen: id ? { question: id, value: before.find(item => item.id === id)?.type === 'yesno' ? true : before.find(item => item.id === id)?.options?.[0]?.value } : null })} placeholder={en ? 'Always shown' : 'Εμφανίζεται πάντα'} {...selectText(en)} />
            {parent && <SearchableSelect label={en ? 'Is answered' : 'Έχει απάντηση'} value={String(question.showWhen.value)} disabled={locked} options={parent.type === 'yesno' ? [{ value: 'true', label: en ? 'Yes' : 'Ναι' }, { value: 'false', label: en ? 'No' : 'Όχι' }] : (parent.options || []).map(item => ({ value: item.value, label: textOf(item, language) }))} onChange={value => value && set({ showWhen: { question: parent.id, value: parent.type === 'yesno' ? value === 'true' : value } })} {...selectText(en)} clearLabel="" />}
          </FormGrid>
        </FormCard>
      </div>
      <aside className="survey-question-preview" aria-label={en ? 'Preview' : 'Προεπισκόπηση'}>
        <span className="eyebrow"><Eye size={13} />{en ? 'As the respondent sees it' : 'Όπως το βλέπει ο ερωτώμενος'}</span>
        <SurveyQuestion question={{ ...question, label: question.label || (en ? 'Your question' : 'Η ερώτησή σας'), labelEn: question.labelEn || question.label || 'Your question', options: options.filter(item => String(item.label).trim()).map((item, index) => ({ ...item, value: item.value || `p${index}` })), required: question.showWhen?.question ? false : question.required }} value={preview} onChange={setPreview} language={language} />
      </aside>
    </div>
  </ObserverDialog>
}
