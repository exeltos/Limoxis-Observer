import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Building2, Inbox, Pencil, Plus, Trash2, UserSearch } from 'lucide-react'
import { Page } from '../../design-system/Page'
import { RecordTabPanel } from '../../design-system/RecordTabPanel'
import { EntityRecordShell } from '../../design-system/EntityRecordShell'
import { RecordDetailsGrid } from '../../design-system/RecordDetailsGrid'
import { RegistryTable } from '../../design-system/RegistryTable'
import { SectionHeader } from '../../design-system/SectionHeader'
import { Button } from '../../design-system/Button'
import { OverflowMenu } from '../../design-system/OverflowMenu'
import { Field } from '../../design-system/Field'
import { ChoiceChips } from '../../design-system/ChoiceChips'
import { useLanguage } from '../../core/i18n/LanguageContext'
import { useFeedback } from '../../core/feedback/FeedbackContext'
import { useTenant } from '../../core/tenant/TenantContext'
import { useContextualNavigation } from '../../core/navigation/useContextualNavigation'
import { CandidateStatusBadge } from './InterviewsShared'
import { PROFESSIONAL_CATEGORIES, categoryLabel, employmentLabel, fmtDay, languageLabel, levelLabel } from './interviewsModel'
import { interviewsErrorMessage, loadDivisionCandidates, loadDivisionDirectors, loadDivisions, removeDivision, saveDivision } from './interviewsService'
import { TableSkeleton } from '../../design-system/LoadingSkeleton'

// --- For the HR Office / Hospital Admin: which professional category belongs to which division, and who directs it ---

export function DivisionsPanel({ organizationId, onBack }) {
  const { language } = useLanguage()
  const en = language === 'en'
  const { notify, confirm } = useFeedback()
  const [divisions, setDivisions] = useState(null)
  const [directors, setDirectors] = useState([])
  const [draft, setDraft] = useState(null)
  const [saving, setSaving] = useState(false)
  const reload = () => loadDivisions(organizationId).then(data => setDivisions(data.divisions)).catch(error => { console.error(error); setDivisions([]) })
  useEffect(() => { void reload(); loadDivisionDirectors(organizationId).then(setDirectors).catch(() => setDirectors([])) }, [organizationId]) // eslint-disable-line react-hooks/exhaustive-deps
  const nameOf = userId => directors.find(item => item.userId === userId)?.name || '—'
  async function save() {
    setSaving(true)
    try { await saveDivision(organizationId, draft); notify(en ? 'Saved.' : 'Αποθηκεύτηκε.', 'success'); setDraft(null); await reload() } catch (error) { console.error(error); notify(interviewsErrorMessage(error, language), 'error') } finally { setSaving(false) }
  }
  async function remove(item) {
    if (!await confirm({ title: en ? 'Delete division' : 'Διαγραφή διεύθυνσης', message: en ? 'Its directors lose access to the candidates; no application is deleted.' : 'Οι διευθυντές της χάνουν την πρόσβαση στους υποψηφίους· καμία αίτηση δεν διαγράφεται.', confirmLabel: en ? 'Delete' : 'Διαγραφή', danger: true })) return
    try { await removeDivision(organizationId, item.id); await reload() } catch (error) { notify(interviewsErrorMessage(error, language), 'error') }
  }
  if (draft) {
    const options = Object.entries(PROFESSIONAL_CATEGORIES).map(([value, labels]) => ({ value, label: labels[en ? 1 : 0] }))
    const toggle = (key, value) => setDraft(current => ({ ...current, [key]: current[key].includes(value) ? current[key].filter(item => item !== value) : [...current[key], value] }))
    return <RecordTabPanel title={draft.id ? (en ? 'Edit division' : 'Επεξεργασία διεύθυνσης') : (en ? 'New division' : 'Νέα διεύθυνση')} subtitle={en ? 'The director of a division sees only the candidates of the categories below.' : 'Ο διευθυντής μιας διεύθυνσης βλέπει μόνο τους υποψηφίους των κατηγοριών που ορίζονται εδώ.'}
      footer={<div className="row-actions"><Button variant="secondary" onClick={() => setDraft(null)}>{en ? 'Cancel' : 'Ακύρωση'}</Button><Button disabled={saving || !draft.name.trim()} onClick={save}>{en ? 'Save' : 'Αποθήκευση'}</Button></div>}>
      <div className="interviews-division-form">
        <Field label={en ? 'Division' : 'Διεύθυνση'}><input value={draft.name} placeholder={en ? 'e.g. Nursing Directorate' : 'π.χ. Νοσηλευτική Υπηρεσία'} onChange={event => setDraft({ ...draft, name: event.target.value })} /></Field>
        <ChoiceChips className="interviews-span-3" label={en ? 'Professional categories of the division' : 'Επαγγελματικές κατηγορίες της διεύθυνσης'} options={options} selected={draft.categories} onToggle={value => toggle('categories', value)} />
        <ChoiceChips className="interviews-span-3" label={en ? 'Directors (users with the role «Division Director»)' : 'Διευθυντές (χρήστες με ρόλο «Διευθυντής Διεύθυνσης»)'} options={directors.map(item => ({ value: item.userId, label: item.name }))} selected={draft.members} onToggle={value => toggle('members', value)}
          hint={directors.length ? '' : (en ? 'No user has the role yet: create one in Management › Users.' : 'Κανένας χρήστης δεν έχει ακόμα τον ρόλο: δημιουργήστε στη Διαχείριση › Χρήστες.')} />
      </div>
    </RecordTabPanel>
  }
  return <RecordTabPanel title={en ? 'Divisions' : 'Διευθύνσεις'} subtitle={en ? 'Which professional category belongs to which division, and who directs it.' : 'Ποια επαγγελματική κατηγορία ανήκει σε ποια διεύθυνση και ποιος τη διευθύνει.'}
    actions={<><Button variant="secondary" onClick={onBack}><ArrowLeft size={15} />{en ? 'Back to applications' : 'Πίσω στις αιτήσεις'}</Button><Button onClick={() => { setDraft({ id: '', name: '', categories: [], members: [] }) }}><Plus size={15} />{en ? 'Division' : 'Διεύθυνση'}</Button></>}>
    <RegistryTable sortable={false} rows={divisions || []} rowKey={item => item.id} columns={[{ key: 'name', label: en ? 'Division' : 'Διεύθυνση' }, { key: 'categories', label: en ? 'Categories' : 'Κατηγορίες' }, { key: 'members', label: en ? 'Directors' : 'Διευθυντές' }, { key: 'actions', label: '' }]}
      empty={divisions != null && !divisions.length} emptyIcon={Building2} emptyTitle={en ? 'No divisions yet' : 'Δεν υπάρχουν διευθύνσεις'}
      emptyText={en ? 'Add the divisions, e.g. the Nursing Directorate, and the categories it covers.' : 'Προσθέστε τις διευθύνσεις, π.χ. Νοσηλευτική Υπηρεσία, και τις κατηγορίες που καλύπτουν.'}
      renderRow={item => <>
        <td><strong>{item.name}</strong></td>
        <td>{item.categories.map(value => categoryLabel(value, language)).join(', ') || '—'}</td>
        <td>{item.members.map(nameOf).join(', ') || '—'}</td>
        <td className="nowrap-cell"><OverflowMenu label={en ? 'Actions' : 'Ενέργειες'} items={[
          { id: 'edit', label: en ? 'Edit' : 'Επεξεργασία', icon: Pencil, onClick: () => setDraft({ ...item }) },
          { id: 'delete', label: en ? 'Delete' : 'Διαγραφή', icon: Trash2, danger: true, onClick: () => remove(item) },
        ]} /></td>
      </>} />
  </RecordTabPanel>
}

// --- For the Division Director: the candidates of the own division (professional data and CV only) ---

export function DivisionInterviewsPage() {
  const { language } = useLanguage()
  const en = language === 'en'
  const navigate = useNavigate()
  const { tenant } = useTenant()
  const [rows, setRows] = useState(null)
  useEffect(() => { loadDivisionCandidates(tenant?.id).then(setRows).catch(error => { console.error(error); setRows([]) }) }, [tenant?.id])
  return <Page fill className="registry-fill-page interviews-page" title={en ? 'Interviews' : 'Συνεντεύξεις'} subtitle={en ? 'The candidates for the positions of your division: give your opinion on each.' : 'Οι υποψήφιοι για τις θέσεις της διεύθυνσής σας: δώστε τη γνώμη σας για καθέναν.'}>
    <section className="surface registry-workspace workspace-column workspace-fill">
      <div className="scroll-table">
        <RegistryTable sortable={false} bare rows={rows || []} rowKey={item => item.id} columns={[{ key: 'name', label: en ? 'Candidate' : 'Υποψήφιος' }, { key: 'position', label: en ? 'Position' : 'Θέση' }, { key: 'applied', label: en ? 'Applied' : 'Αίτηση' }, { key: 'status', label: en ? 'Status' : 'Κατάσταση' }]}
          rowProps={item => ({ onClick: () => navigate(`/interviews/${encodeURIComponent(item.id)}`), onKeyDown: event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); navigate(`/interviews/${encodeURIComponent(item.id)}`) } } })}
          empty={rows != null && !rows.length} emptyIcon={Inbox} emptyTitle={en ? 'No candidates for your division' : 'Δεν υπάρχουν υποψήφιοι για τη διεύθυνσή σας'}
          emptyText={en ? 'When the HR Office receives an application for one of your positions, it appears here.' : 'Όταν το Γραφείο Προσωπικού λάβει αίτηση για θέση της διεύθυνσής σας, εμφανίζεται εδώ.'}
          renderRow={item => <>
            <td><strong>{item.fullName}</strong><small>{item.code}</small></td>
            <td>{item.requestedPosition || '—'}{item.employmentType && <small>{employmentLabel(item.employmentType, language)}</small>}</td>
            <td className="nowrap-cell">{fmtDay(item.appliedOn)}</td>
            <td><CandidateStatusBadge status={item.status} language={language} /></td>
          </>} />
      </div>
    </section>
  </Page>
}

export function DivisionCandidatePage() {
  const { candidateId } = useParams()
  const { goBack } = useContextualNavigation('/interviews')
  const { language } = useLanguage()
  const en = language === 'en'
  const { tenant } = useTenant()
  const [rows, setRows] = useState(null)
  useEffect(() => { loadDivisionCandidates(tenant?.id).then(setRows).catch(error => { console.error(error); setRows([]) }) }, [tenant?.id])
  if (!rows) return <Page fill><TableSkeleton/></Page>
  const candidate = rows.find(item => item.id === candidateId)
  if (!candidate) return <Page fill><div className="registry-empty-state"><strong>{en ? 'Application not found' : 'Η αίτηση δεν βρέθηκε'}</strong></div></Page>
  return <Page fill><EntityRecordShell className="interviews-record-shell workspace-fill" avatar={<UserSearch size={19} />} eyebrow={candidate.code} title={candidate.fullName}
    subtitle={[candidate.requestedPosition, employmentLabel(candidate.employmentType, language), `${en ? 'Applied' : 'Αίτηση'} ${fmtDay(candidate.appliedOn)}`].filter(Boolean).join(' · ')}
    status={<CandidateStatusBadge status={candidate.status} language={language} />} onBack={goBack}>
    <RecordTabPanel title={en ? 'CV' : 'Βιογραφικό'} subtitle={en ? 'Professional data only.' : 'Μόνο επαγγελματικά στοιχεία.'}>
      <div className="record-view-stack">
        <RecordDetailsGrid fields={[{ label: en ? 'Position applied for' : 'Αιτούμενη θέση', value: candidate.requestedPosition, hidden: !candidate.requestedPosition }, { label: en ? 'Area / category' : 'Χώρος / κατηγορία', value: categoryLabel(candidate.professionalCategory, language), hidden: !candidate.professionalCategory },
          { label: en ? 'Education level' : 'Βασική εκπαίδευση', value: candidate.educationLevel, hidden: !candidate.educationLevel }, { label: en ? 'IT skills' : 'Γνώσεις πληροφορικής', value: candidate.itSkills, hidden: !candidate.itSkills }, { label: en ? 'Why us' : 'Γιατί εμάς', value: candidate.whyUs, hidden: !candidate.whyUs, className: 'interviews-span-3' }]} />
        <SectionHeader title={en ? 'Education' : 'Εκπαίδευση'} />
        <RegistryTable sortable={false} rows={(candidate.education || []).map((row, index) => ({ ...row, id: index }))} columns={[{ key: 'level', label: en ? 'Level' : 'Επίπεδο' }, { key: 'school', label: en ? 'School / department' : 'Σχολή / τμήμα' }, { key: 'title', label: en ? 'Degree' : 'Τίτλος' }, { key: 'year', label: en ? 'Year' : 'Έτος' }]}
          emptyTitle={en ? 'No degrees recorded' : 'Δεν καταγράφηκαν πτυχία'} renderRow={row => <><td>{row.level || '—'}</td><td><strong>{row.school || '—'}</strong></td><td>{row.title || '—'}</td><td>{row.year || '—'}</td></>} />
        <SectionHeader title={en ? 'Languages' : 'Γλώσσες'} />
        <RegistryTable sortable={false} rows={(candidate.languages || []).map((row, index) => ({ ...row, id: index }))} columns={[{ key: 'language', label: en ? 'Language' : 'Γλώσσα' }, { key: 'speaking', label: en ? 'Speaking' : 'Ομιλία' }, { key: 'reading', label: en ? 'Reading' : 'Ανάγνωση' }, { key: 'writing', label: en ? 'Writing' : 'Γραφή' }]}
          emptyTitle={en ? 'No languages recorded' : 'Δεν καταγράφηκαν γλώσσες'} renderRow={row => <><td><strong>{languageLabel(row.language, language)}</strong></td><td>{levelLabel(row.speaking, language) || '—'}</td><td>{levelLabel(row.reading, language) || '—'}</td><td>{levelLabel(row.writing, language) || '—'}</td></>} />
        <SectionHeader title={en ? 'Previous employers' : 'Προϋπηρεσία'} />
        <RegistryTable sortable={false} rows={(candidate.employers || []).map((row, index) => ({ ...row, id: index }))} columns={[{ key: 'employer', label: en ? 'Employer' : 'Εργοδότης' }, { key: 'period', label: en ? 'Period' : 'Περίοδος' }, { key: 'job', label: en ? 'Position' : 'Θέση' }]}
          emptyTitle={en ? 'No previous employers' : 'Χωρίς προϋπηρεσία'} renderRow={row => <><td><strong>{row.employer}</strong></td><td className="nowrap-cell">{fmtDay(row.fromOn)} – {row.toOn ? fmtDay(row.toOn) : (en ? 'today' : 'σήμερα')}</td><td>{row.jobTitle || '—'}</td></>} />
      </div>
    </RecordTabPanel>
  </EntityRecordShell></Page>
}
