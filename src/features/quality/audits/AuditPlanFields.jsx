import { useMemo } from 'react'
import { AlertTriangle, CalendarDays, ClipboardCheck, ShieldAlert, Trash2, Users } from 'lucide-react'
import { FormCard, FormGrid } from '../../../design-system/FormCard'
import { Field } from '../../../design-system/Field'
import { ChoiceField } from '../../../design-system/ChoiceField'
import { SearchableSelect } from '../../../design-system/SearchableSelect'
import { MultiSelect } from '../../../design-system/MultiSelect'
import { CheckboxField } from '../../../design-system/CheckboxField'
import { ManualDateField } from '../../../design-system/ManualDateField'
import { MonthField } from '../../../design-system/MonthField'
import { IconButton } from '../../../design-system/IconButton'
import { StatusBadge } from '../../../design-system/StatusBadge'
import { useEmployeesData } from '../../employees/useEmployeesData'
import { employeeName, employeeOptions } from '../../employees/peopleOptions'
import { QualityDepartmentField, departmentRef } from '../QualityFields'
import { AUDIT_BODIES, AUDIT_KINDS, AUDIT_STANDARDS, RISK_LEVELS, TEAM_ROLES, areaLabel, departmentArea, riskMonths, standardShort } from './auditStandards'
import { competenceWarnings, independenceIssues, templateChapters } from './auditModel'

const L = (en, el, english) => (en ? english : el)
const pick = (pair, en) => pair[en ? 1 : 0]
const select = en => ({ emptyLabel: L(en, 'Δεν βρέθηκε', 'No match'), clearLabel: L(en, 'Καθαρισμός', 'Clear') })

// The audit's place in the programme: what is audited (department, standard,
// questionnaire, chapters in scope), when (a day, or a month still to fix),
// how often (by risk) and by whom (the team, with the independence and
// competence checks). The new-audit form and the planning dialog share it.
export function AuditPlanFields({ draft, setDraft, templates = [], competence, language, titleField = true }) {
  const en = language === 'en'
  const patch = next => setDraft(current => ({ ...current, ...next }))
  const forStandard = templates.filter(item => item.active !== false && (!draft.standard || item.standard === draft.standard))
  const questionnaire = templates.find(item => item.id === draft.templateId) || null
  const chapters = useMemo(() => templateChapters(questionnaire), [questionnaire])
  const chooseTemplate = id => {
    const chosen = templates.find(item => item.id === id)
    if (!chosen) return patch({ templateId: null, templateTitle: '', templateVersion: null, clausesScope: [] })
    patch({ templateId: chosen.id, templateTitle: chosen.title, templateVersion: chosen.version, standard: chosen.standard, clausesScope: [], scope: draft.scope || chosen.scope, checklistSource: `template:${chosen.id}`,
      title: draft.title || `${L(en, 'Επιθεώρηση', 'Audit')} ${standardShort(chosen.standard)}${draft.department ? ` — ${draft.department}` : ''}` })
  }
  const month = String(draft.plannedDate || '').slice(0, 7)
  return <>
    <FormCard title={L(en, 'Επιθεώρηση', 'Audit')} icon={ClipboardCheck}>
      <FormGrid columns={3}>
        {titleField && <Field label={L(en, 'Τίτλος *', 'Title *')}><input value={en ? draft.titleEn || draft.title : draft.title} onChange={event => patch(en ? { titleEn: event.target.value } : { title: event.target.value })} /></Field>}
        <QualityDepartmentField value={departmentRef(draft)} onChange={patch} />
        <ChoiceField label={L(en, 'Είδος επιθεώρησης', 'Kind of audit')} value={draft.auditType || 'internal'} options={AUDIT_KINDS.map(item => ({ value: item.value, label: pick(item.label, en) }))} onChange={value => patch({ auditType: value })} />
      </FormGrid>
    </FormCard>
    <FormCard title={L(en, 'Πρότυπο και ερωτηματολόγιο', 'Standard and questionnaire')} icon={ShieldAlert} hint={questionnaire ? L(en, `${questionnaire.questions.length} ερωτήσεις · περιοχή τμήματος: ${areaLabel(draft.department ? departmentArea(draft.department) : '', language) || 'όλες'}`, `${questionnaire.questions.length} questions · department area: ${areaLabel(draft.department ? departmentArea(draft.department) : '', language) || 'all'}`) : undefined}>
      <FormGrid columns={3}>
        <ChoiceField label={L(en, 'Πρότυπο', 'Standard')} value={draft.standard || ''} options={AUDIT_STANDARDS.map(item => ({ value: item.value, label: pick(item.label, en) }))} onChange={value => patch({ standard: value, ...(questionnaire && questionnaire.standard !== value ? { templateId: null, templateTitle: '', templateVersion: null, clausesScope: [] } : {}) })} />
        <SearchableSelect label={L(en, 'Ερωτηματολόγιο', 'Questionnaire')} value={draft.templateId || ''} onChange={chooseTemplate} placeholder={forStandard.length ? L(en, 'Επιλέξτε ερωτηματολόγιο', 'Choose a questionnaire') : L(en, 'Κανένα για αυτό το πρότυπο', 'None for this standard')}
          options={forStandard.map(item => ({ value: item.id, label: item.title, description: `${item.isSystem ? L(en, 'Βιβλιοθήκη πλατφόρμας', 'Platform library') : L(en, 'Του νοσοκομείου', 'Hospital copy')} · ${L(en, 'έκδοση', 'version')} ${item.version} · ${item.questions.length} ${L(en, 'ερωτήσεις', 'questions')}` }))} {...select(en)} />
        <MultiSelect label={L(en, 'Κεφάλαια / άρθρα στο πεδίο', 'Chapters / clauses in scope')} disabled={!chapters.length} tags options={chapters.map(chapter => ({ value: chapter.ref, label: `${chapter.ref} · ${chapter.title}` }))} selected={draft.clausesScope || []} onChange={value => patch({ clausesScope: value })}
          placeholder={L(en, 'Όλο το ερωτηματολόγιο', 'The whole questionnaire')} searchPlaceholder={L(en, 'Αναζήτηση κεφαλαίου', 'Search chapter')} emptyLabel={L(en, 'Δεν βρέθηκε', 'No match')} selectAllLabel={L(en, 'Επιλογή όλων', 'Select all')} clearAllLabel={L(en, 'Καθαρισμός', 'Clear')} countLabel={count => L(en, `${count} κεφάλαια`, `${count} chapters`)} />
        <MultiSelect label={L(en, 'Και άλλα πρότυπα στην ίδια επιθεώρηση', 'Other standards in the same audit')} tags options={AUDIT_STANDARDS.filter(item => item.value !== draft.standard && item.value !== 'other').map(item => ({ value: item.value, label: pick(item.label, en) }))} selected={(draft.standards || []).filter(value => value !== draft.standard)} onChange={value => patch({ standards: value })}
          placeholder={L(en, 'Μόνο το κύριο πρότυπο', 'The main standard only')} searchPlaceholder={L(en, 'Αναζήτηση προτύπου', 'Search standard')} emptyLabel={L(en, 'Δεν βρέθηκε', 'No match')} selectAllLabel={L(en, 'Επιλογή όλων', 'Select all')} clearAllLabel={L(en, 'Καθαρισμός', 'Clear')} countLabel={count => L(en, `${count} πρότυπα`, `${count} standards`)} />
      </FormGrid>
    </FormCard>
    <FormCard title={L(en, 'Προγραμματισμός', 'Planning')} icon={CalendarDays} hint={L(en, `Συχνότητα κατά τον κίνδυνο: κάθε ${riskMonths(draft.riskLevel || 'medium')} μήνες`, `Frequency by risk: every ${riskMonths(draft.riskLevel || 'medium')} months`)}>
      <FormGrid columns={3}>
        {draft.plannedMonthOnly
          ? <MonthField label={L(en, 'Προγραμματισμένος μήνας', 'Planned month')} value={month} years={3} onChange={value => patch({ plannedDate: value ? `${value}-01` : '' })} />
          : <ManualDateField label={L(en, 'Προγραμματισμένη ημερομηνία', 'Planned date')} value={draft.plannedDate || ''} onChange={value => patch({ plannedDate: value })} />}
        <ChoiceField label={L(en, 'Κίνδυνος (συχνότητα)', 'Risk (frequency)')} value={draft.riskLevel || 'medium'} options={RISK_LEVELS.map(item => ({ value: item.value, label: `${pick(item.label, en)} · ${L(en, `κάθε ${item.months} μήνες`, `every ${item.months} months`)}` }))} onChange={value => patch({ riskLevel: value, frequencyMonths: riskMonths(value) })} />
        <CheckboxField label={L(en, 'Μόνο μήνας (η ημέρα ορίζεται αργότερα)', 'Month only (day fixed later)')} checked={Boolean(draft.plannedMonthOnly)} onChange={value => patch({ plannedMonthOnly: value, plannedDate: value && draft.plannedDate ? `${String(draft.plannedDate).slice(0, 7)}-01` : draft.plannedDate })} />
      </FormGrid>
    </FormCard>
    <FormCard title={L(en, 'Εκτέλεση και αναφορά', 'Execution and report')} icon={ClipboardCheck}>
      <FormGrid columns={3}>
        <ChoiceField label={L(en, 'Φορέας', 'Carried out by')} value={draft.auditBody || ''} placeholder={L(en, 'Επιλέξτε', 'Choose')} options={AUDIT_BODIES.map(item => ({ value: item.value, label: pick(item.label, en) }))} onChange={value => patch({ auditBody: value })} />
        <Field label={L(en, 'Διάρκεια (ημέρες)', 'Duration (days)')}><input type="number" min="0" max="60" value={draft.durationDays ?? ''} onChange={event => patch({ durationDays: event.target.value === '' ? null : Number(event.target.value) })} /></Field>
        <ManualDateField label={L(en, 'Η αναφορά στάλθηκε στο τμήμα', 'Report sent to the department')} value={draft.reportSentOn || ''} onChange={value => patch({ reportSentOn: value })} />
        <ManualDateField label={L(en, 'Προθεσμία διορθώσεων', 'Deadline for corrections')} value={draft.correctionsDueOn || ''} onChange={value => patch({ correctionsDueOn: value })} />
        <Field label={L(en, 'Σημειώσεις', 'Notes')}><textarea rows={2} value={draft.notes || ''} onChange={event => patch({ notes: event.target.value })} /></Field>
      </FormGrid>
    </FormCard>
    <AuditTeamField team={draft.team || []} department={{ id: draft.departmentId, name: draft.department }} competence={competence} language={language} onChange={team => patch({ team, leadAuditor: team.find(member => member.role === 'lead')?.name || '' })} />
  </>
}

// The team: employees (picked from the staff) or external auditors (a typed
// name), each with a role; one lead. Under it, the independence and competence checks.
export function AuditTeamField({ team = [], department = {}, competence, language, onChange }) {
  const en = language === 'en'
  const { data: staff = [] } = useEmployeesData()
  const { options, near } = useMemo(() => employeeOptions(staff, language, [department.name].filter(Boolean)), [staff, language, department.name])
  const taken = new Set(team.map(member => String(member.employeeId || '')))
  const add = value => {
    if (!value) return
    const employee = staff.find(item => String(item.dbId || item.id) === String(value))
    const role = team.some(member => member.role === 'lead') ? 'member' : 'lead'
    const member = employee
      ? { id: null, role, employeeId: String(employee.dbId || employee.id), name: employeeName(employee), external: false, department: employee.department || '', departmentId: employee.departmentId || null }
      : { id: null, role, employeeId: null, name: String(value).trim(), external: true, affiliation: '' }
    if (member.name) onChange([...team, member])
  }
  const set = (index, next) => onChange(team.map((member, at) => (at === index ? { ...member, ...next } : next.role === 'lead' && member.role === 'lead' ? { ...member, role: 'member' } : member)))
  const issues = independenceIssues(team, department)
  const untrained = competence ? competenceWarnings(team, competence) : []
  return <FormCard wide title={L(en, 'Ομάδα επιθεώρησης', 'Audit team')} icon={Users} hint={L(en, 'Εργαζόμενοι ή εξωτερικοί επιθεωρητές (πληκτρολογήστε το όνομα).', 'Employees, or external auditors (type the name).')}>
    {team.length > 0 && <ul className="audit-team-list">
      {team.map((member, index) => <li key={member.id || `${member.name}-${index}`}>
        <span className="audit-team-name"><strong>{member.name}</strong><small>{member.external ? [L(en, 'Εξωτερικός', 'External'), member.affiliation].filter(Boolean).join(' · ') : member.department || ''}</small></span>
        <ChoiceField label={L(en, 'Ρόλος', 'Role')} value={member.role || 'member'} options={TEAM_ROLES.map(item => ({ value: item.value, label: pick(item.label, en) }))} onChange={role => set(index, { role })} />
        {member.external ? <Field label={L(en, 'Φορέας / ιδιότητα', 'Organisation / capacity')}><input value={member.affiliation || ''} onChange={event => set(index, { affiliation: event.target.value })} /></Field> : <span className="audit-team-flags">
          {issues.find(issue => issue.member === member) && <StatusBadge tone={issues.find(issue => issue.member === member).level === 'block' ? 'danger' : 'warning'}>{L(en, 'Ίδιο τμήμα', 'Own department')}</StatusBadge>}
          {untrained.includes(member) && <StatusBadge tone="warning">{L(en, 'Χωρίς πιστοποίηση επιθεωρητή', 'No auditor certificate')}</StatusBadge>}
        </span>}
        <IconButton size="sm" tone="danger" label={L(en, `Αφαίρεση: ${member.name}`, `Remove: ${member.name}`)} onClick={() => onChange(team.filter((_, at) => at !== index))}><Trash2 size={14} /></IconButton>
      </li>)}
    </ul>}
    <FormGrid columns={3}>
      <SearchableSelect label={L(en, 'Προσθήκη επιθεωρητή', 'Add an auditor')} value="" options={options.filter(option => !taken.has(String(option.value)))} recentValues={near} onChange={add} allowCustom customLabel={text => L(en, `Εξωτερικός επιθεωρητής «${text}»`, `External auditor «${text}»`)} placeholder={L(en, 'Αναζήτηση προσωπικού ή όνομα εξωτερικού', 'Search staff or type an external name')} {...select(en)} />
    </FormGrid>
    {issues.length > 0 && <div className={`governance-banner ${issues.some(issue => issue.level === 'block') ? 'danger' : 'warning'} audit-team-banner`}><AlertTriangle size={16} aria-hidden="true" /><span>{issues.some(issue => issue.level === 'block')
      ? L(en, 'Ανεξαρτησία: ο επικεφαλής επιθεωρητής ανήκει στο τμήμα που επιθεωρείται. Ορίστε άλλον επικεφαλής για να αποθηκευτεί η επιθεώρηση.', 'Independence: the lead auditor belongs to the audited department. Choose another lead to save the audit.')
      : L(en, `Ανεξαρτησία: ${issues.map(issue => issue.member.name).join(', ')} ανήκει στο τμήμα που επιθεωρείται· μην επιθεωρήσει τις δικές του εργασίες.`, `Independence: ${issues.map(issue => issue.member.name).join(', ')} belongs to the audited department; they must not audit their own work.`)}</span></div>}
    {untrained.length > 0 && <div className="governance-banner warning audit-team-banner"><AlertTriangle size={16} aria-hidden="true" /><span>{L(en, `Επάρκεια: ${untrained.map(member => member.name).join(', ')} δεν έχει πιστοποιητικό ή εκπαίδευση «Επιθεωρητής» σε ισχύ.`, `Competence: ${untrained.map(member => member.name).join(', ')} has no valid «Auditor» certificate or training.`)}</span></div>}
  </FormCard>
}
