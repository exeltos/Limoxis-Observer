import { useState } from 'react'
import { CalendarDays, ChevronRight } from 'lucide-react'
import { Button } from '../../../design-system/Button'
import { ObserverDialog, DialogActions } from '../../../design-system/ObserverDialog'
import { RecordDetailsGrid } from '../../../design-system/RecordDetailsGrid'
import { SectionHeader } from '../../../design-system/SectionHeader'
import { StatusBadge } from '../../../design-system/StatusBadge'
import { formatDay } from '../../../core/i18n/formatDay'
import { useContextualNavigation } from '../../../core/navigation/useContextualNavigation'
import { saveQualityRecord } from '../qualityService'
import { AUDIT_KINDS, RISK_LEVELS, TEAM_ROLES, standardLabel } from './auditStandards'
import { competenceWarnings, independenceBlocks, independenceIssues, nextAuditDate } from './auditModel'
import { AuditPlanFields } from './AuditPlanFields'
import { useAuditTemplates, useAuditorCompetence } from './useAuditTemplates'
import './audits.css'

const L = (en, el, english) => (en ? english : el)
const label = (list, value, en) => list.find(item => item.value === value)?.label[en ? 1 : 0] || ''
const monthText = (value, language) => (value ? new Intl.DateTimeFormat(language === 'en' ? 'en-GB' : 'el-GR', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${String(value).slice(0, 7)}-15T12:00:00Z`)) : '')

// The audit's planning on its record: standard and questionnaire, the chapters
// in scope, kind, date (or month), risk and frequency, the team with its
// independence and competence checks, and the audit it follows up. «Planning»
// edits it in a dialog; an audit whose lead auditor audits their own department
// is not saved.
export function AuditPlanPanel({ record, setRecord, organizationId, canManage, finalized, language, notify, actor }) {
  const en = language === 'en'
  const { goTo } = useContextualNavigation('/quality')
  const { templates } = useAuditTemplates(organizationId)
  const competence = useAuditorCompetence(organizationId)
  const [draft, setDraft] = useState(null)
  const [saving, setSaving] = useState(false)
  const department = { id: record.departmentId, name: record.department }
  const issues = independenceIssues(record.team || [], department)
  const untrained = competenceWarnings(record.team || [], competence)
  async function save() {
    if (independenceBlocks(draft.team || [], { id: draft.departmentId, name: draft.department })) { notify?.(L(en, 'Ο επικεφαλής επιθεωρητής δεν μπορεί να επιθεωρήσει το δικό του τμήμα.', 'The lead auditor cannot audit their own department.'), 'error'); return }
    setSaving(true)
    try {
      const saved = await saveQualityRecord('audits', organizationId, { ...draft, history: [{ at: new Date().toISOString(), action: 'recordUpdated', actor: actor?.name || '' }, ...(record.history || [])] })
      setRecord(saved)
      setDraft(null)
      notify?.(L(en, 'Ο σχεδιασμός αποθηκεύτηκε.', 'Planning saved.'), 'success')
    } catch (error) {
      console.error(error)
      notify?.(L(en, 'Δεν ήταν δυνατή η αποθήκευση.', 'The planning could not be saved.'), 'error')
    } finally { setSaving(false) }
  }
  const team = record.team || []
  const next = record.status === 'completed' ? nextAuditDate(record.completedDate, record.riskLevel) : ''
  return <section className="audit-plan-panel">
    <SectionHeader title={L(en, 'Σχεδιασμός επιθεώρησης', 'Audit planning')} actions={canManage && !finalized && <Button variant="secondary" onClick={() => setDraft(structuredClone(record))}><CalendarDays size={15} /> {L(en, 'Σχεδιασμός', 'Planning')}</Button>} />
    <RecordDetailsGrid fields={[
      { id: 'standard', label: L(en, 'Πρότυπο', 'Standard'), value: standardLabel(record.standard, language) },
      { id: 'template', label: L(en, 'Ερωτηματολόγιο', 'Questionnaire'), value: record.templateTitle, meta: record.templateVersion ? `${L(en, 'έκδοση', 'version')} ${record.templateVersion}` : undefined },
      { id: 'scope', label: L(en, 'Κεφάλαια στο πεδίο', 'Chapters in scope'), value: record.clausesScope?.length ? record.clausesScope.join(', ') : L(en, 'Όλο το ερωτηματολόγιο', 'The whole questionnaire') },
      { id: 'kind', label: L(en, 'Είδος', 'Kind'), value: label(AUDIT_KINDS, record.auditType || 'internal', en) },
      { id: 'planned', label: L(en, 'Προγραμματισμός', 'Planned'), value: record.plannedMonthOnly ? monthText(record.plannedDate, language) : formatDay(record.plannedDate, language), meta: record.plannedMonthOnly ? L(en, 'η ημέρα θα οριστεί', 'day to be fixed') : undefined },
      { id: 'risk', label: L(en, 'Κίνδυνος / συχνότητα', 'Risk / frequency'), value: record.riskLevel ? label(RISK_LEVELS, record.riskLevel, en) : '', meta: next ? `${L(en, 'Επόμενη', 'Next')}: ${formatDay(next, language)}` : undefined },
    ]} />
    <div className="audit-plan-team">
      <span className="lo-field-label">{L(en, 'Ομάδα επιθεώρησης', 'Audit team')}</span>
      {team.length ? <ul className="audit-team-list is-read">{team.map(member => <li key={member.id || member.name}>
        <span className="audit-team-name"><strong>{member.name}</strong><small>{[label(TEAM_ROLES, member.role, en), member.external ? [L(en, 'Εξωτερικός', 'External'), member.affiliation].filter(Boolean).join(' · ') : member.department].filter(Boolean).join(' · ')}</small></span>
        <span className="audit-team-flags">
          {issues.find(issue => issue.member === member) && <StatusBadge tone={issues.find(issue => issue.member === member).level === 'block' ? 'danger' : 'warning'}>{L(en, 'Ίδιο τμήμα', 'Own department')}</StatusBadge>}
          {untrained.includes(member) && <StatusBadge tone="warning">{L(en, 'Χωρίς πιστοποίηση επιθεωρητή', 'No auditor certificate')}</StatusBadge>}
        </span>
      </li>)}</ul> : <strong>{record.leadAuditor || '—'}</strong>}
    </div>
    {record.followUpOf && <button type="button" className="quality-audit-finding-link" onClick={() => goTo(`/quality/audits/${record.followUpOf}`, { tab: 'details' })}>{L(en, 'Επαναληπτική της', 'Follow-up of')} {record.followUpOf}<ChevronRight size={13} /></button>}
    {draft && <ObserverDialog width="wide" fixedHeight title={L(en, 'Σχεδιασμός επιθεώρησης', 'Audit planning')} subtitle={record.displayId || record.id} onClose={() => setDraft(null)}
      footer={<DialogActions onSave={save} disabled={saving || independenceBlocks(draft.team || [], { id: draft.departmentId, name: draft.department })} />}>
      <div className="lo-form-cards audit-plan-form"><AuditPlanFields draft={draft} setDraft={setDraft} templates={templates} competence={competence} language={language} /></div>
    </ObserverDialog>}
  </section>
}
