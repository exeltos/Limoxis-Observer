import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BookMarked, BookOpen, FilePlus2, Library, PencilLine, Plus } from 'lucide-react'
import { Page } from '../../design-system/Page'
import { Button } from '../../design-system/Button'
import { ObserverDialog, DialogActions } from '../../design-system/ObserverDialog'
import { Field } from '../../design-system/Field'
import { SearchableSelect } from '../../design-system/SearchableSelect'
import { StatusBadge } from '../../design-system/StatusBadge'
import { RouteLoading } from '../../design-system/RouteLoading'
import { useLanguage } from '../../core/i18n/LanguageContext'
import { useFeedback } from '../../core/feedback/FeedbackContext'
import { useTenant } from '../../core/tenant/TenantContext'
import { formatDay } from '../../core/i18n/formatDay'
import { REGULATION_CATEGORIES, categoryLabel, regulationStatus, statusLabel, statusTone } from './regulationModel'
import { createRegulation, loadRegulations, loadTemplates } from './regulationService'
import { useRegulationAccess } from './regulationAccess'
import './regulations.css'

// The hospital's regulations as a shelf of books: each with its cover, edition
// and state; the template it follows says when a newer version is out. Those
// who edit start a new regulation from a template; the platform owner keeps the
// templates themselves.
export function RegulationsPage() {
  const navigate = useNavigate()
  const { language } = useLanguage()
  const en = language === 'en'
  const { notify } = useFeedback()
  const { tenant } = useTenant()
  const { canManage, isPlatformOwner } = useRegulationAccess()
  const [state, setState] = useState({ loading: true, regulations: [], templates: [], error: null })
  const [creating, setCreating] = useState(null)

  const reload = useCallback(async () => {
    try {
      const [regulations, templates] = await Promise.all([loadRegulations(tenant?.id), loadTemplates()])
      setState({ loading: false, regulations, templates, error: null })
    } catch (error) { setState(current => ({ ...current, loading: false, error })) }
  }, [tenant?.id])
  useEffect(() => { void reload() }, [reload])

  const templates = useMemo(() => new Map(state.templates.map(item => [item.key, item])), [state.templates])
  const shelf = state.regulations.filter(item => !item.archived && (canManage || item.edition > 0))
  const archived = state.regulations.filter(item => item.archived)

  async function create() {
    const template = templates.get(creating.templateKey) || null
    if (!String(creating.title || '').trim()) return
    try {
      const id = await createRegulation(tenant?.id, { title: creating.title.trim(), category: creating.category, template, hospital: tenant?.name || '', codes: state.regulations.map(item => item.code) })
      setCreating(null)
      notify(en ? 'The regulation was created as a draft.' : 'Ο κανονισμός δημιουργήθηκε ως προσχέδιο.', 'success')
      navigate(`/regulations/${id}`, { state: { tab: 'edit' } })
    } catch { notify(en ? 'The regulation could not be created.' : 'Ο κανονισμός δεν δημιουργήθηκε.', 'error') }
  }

  if (state.loading) return <RouteLoading />
  return <Page fill title={en ? 'Regulations' : 'Κανονισμοί'} subtitle={en ? 'The hospital’s regulations, read as books. Every edition approved and kept.' : 'Οι κανονισμοί του νοσοκομείου, σαν βιβλία. Κάθε έκδοση εγκρίνεται και φυλάσσεται.'}
    actions={canManage && <Button onClick={() => setCreating({ templateKey: state.templates[0]?.key || '', title: state.templates[0]?.title || '', category: state.templates[0]?.category || 'infection' })}><Plus size={15} />{en ? 'New regulation' : 'Νέος κανονισμός'}</Button>}>
    {state.error && <div className="data-access-state error" role="alert"><span>{en ? 'Could not load the regulations.' : 'Δεν ήταν δυνατή η φόρτωση των κανονισμών.'}</span><Button variant="secondary" onClick={reload}>{en ? 'Retry' : 'Επανάληψη'}</Button></div>}
    <section className="surface reg-library">
      {shelf.length ? <div className="reg-shelf">{shelf.map(item => {
        const status = regulationStatus(item)
        const template = templates.get(item.templateKey)
        const newer = template && item.templateVersion && template.version > item.templateVersion
        return <button type="button" key={item.id} className="reg-shelf-item" onClick={() => navigate(`/regulations/${item.id}`)}>
          <span className={`reg-mini-cover is-${item.category}`}>
            <i />
            <small>{categoryLabel(item.category, language)}</small>
            <strong>{item.title}</strong>
            <em>{tenant?.name}</em>
          </span>
          <span className="reg-shelf-meta">
            <span className="reg-shelf-line"><b>{item.code}</b><StatusBadge tone={statusTone(status)}>{statusLabel(status, language)}</StatusBadge></span>
            <span>{item.edition ? `${en ? 'Edition' : 'Έκδοση'} ${item.edition} · ${formatDay(item.issuedOn, language)}` : (en ? 'Not approved yet' : 'Δεν έχει εγκριθεί ακόμη')}</span>
            {newer && canManage && <span className="reg-shelf-update">{en ? `Template v${template.version} available` : `Νέα έκδοση προτύπου v${template.version}`}</span>}
          </span>
        </button>
      })}</div> : <div className="reg-empty">
        <BookMarked size={30} />
        <strong>{canManage ? (en ? 'No regulations yet' : 'Δεν υπάρχουν ακόμη κανονισμοί') : (en ? 'No regulation is in force yet' : 'Δεν υπάρχει ακόμη κανονισμός σε ισχύ')}</strong>
        <span>{canManage ? (en ? 'Start one from a template: it becomes your draft to adapt and approve.' : 'Ξεκινήστε από ένα πρότυπο: γίνεται το προσχέδιό σας, για προσαρμογή και έγκριση.') : (en ? 'Approved regulations appear here.' : 'Οι εγκεκριμένοι κανονισμοί θα εμφανίζονται εδώ.')}</span>
      </div>}
      {archived.length > 0 && canManage && <details className="reg-archived"><summary>{en ? `Archived (${archived.length})` : `Αρχειοθετημένοι (${archived.length})`}</summary>
        <ul>{archived.map(item => <li key={item.id}><button type="button" className="reg-link" onClick={() => navigate(`/regulations/${item.id}`)}><BookOpen size={13} /> {item.code} · {item.title}</button></li>)}</ul>
      </details>}
    </section>
    {isPlatformOwner && <section className="surface reg-templates">
      <header><div><h2><Library size={16} />{en ? 'Platform templates' : 'Πρότυπα της πλατφόρμας'}</h2><p>{en ? 'What every hospital starts from. A new version shows to each hospital as an update to review; nothing changes in their regulations by itself.' : 'Από αυτά ξεκινά κάθε νοσοκομείο. Μια νέα έκδοση εμφανίζεται σε κάθε νοσοκομείο ως ενημέρωση για έλεγχο· τίποτα δεν αλλάζει μόνο του στους κανονισμούς τους.'}</p></div></header>
      <ul>{state.templates.map(item => <li key={item.key}>
        <div><strong>{item.title}</strong><span>{categoryLabel(item.category, language)} · v{item.version}{item.publishedAt ? ` · ${formatDay(item.publishedAt, language)}` : ''}</span></div>
        <button type="button" className="reg-link" onClick={() => navigate(`/regulations/templates/${item.key}`)}><PencilLine size={13} /> {en ? 'Edit' : 'Επεξεργασία'}</button>
      </li>)}</ul>
    </section>}
    {creating && <ObserverDialog title={en ? 'New regulation' : 'Νέος κανονισμός'} subtitle={en ? 'From a template, or a blank one.' : 'Από πρότυπο ή κενός.'} width="wide" onClose={() => setCreating(null)}
      footer={<DialogActions onCancel={() => setCreating(null)} onSave={create} saveLabel={en ? 'Create the draft' : 'Δημιουργία προσχεδίου'} disabled={!String(creating.title || '').trim()} />}>
      <div className="reg-create">
        <div className="reg-create-templates" role="radiogroup" aria-label={en ? 'Template' : 'Πρότυπο'}>
          {[...state.templates, { key: '', title: en ? 'Blank regulation' : 'Κενός κανονισμός', description: en ? 'Chapters and sections of your own.' : 'Δικά σας κεφάλαια και ενότητες.', category: 'other' }].map(item => <button type="button" key={item.key || 'blank'} role="radio" aria-checked={creating.templateKey === item.key} className={creating.templateKey === item.key ? 'active' : ''}
            onClick={() => setCreating(current => ({ ...current, templateKey: item.key, title: item.key ? item.title : '', category: item.category }))}>
            {item.key ? <BookOpen size={16} /> : <FilePlus2 size={16} />}
            <strong>{item.title}</strong>
            <small>{item.description}</small>
            {item.key && <em>{item.content?.chapters?.length || 0} {en ? 'chapters' : 'κεφάλαια'} · v{item.version}</em>}
          </button>)}
        </div>
        <div className="reg-create-fields">
          <Field label={`${en ? 'Title' : 'Τίτλος'} *`}><input value={creating.title} onChange={event => setCreating(current => ({ ...current, title: event.target.value }))} /></Field>
          <SearchableSelect label={en ? 'Category' : 'Κατηγορία'} value={creating.category} options={REGULATION_CATEGORIES.map(item => ({ value: item.value, label: item.label[en ? 1 : 0] }))} onChange={value => value && setCreating(current => ({ ...current, category: value }))} placeholder="" emptyLabel={en ? 'No match' : 'Δεν βρέθηκε'} clearLabel="" />
        </div>
      </div>
    </ObserverDialog>}
  </Page>
}
