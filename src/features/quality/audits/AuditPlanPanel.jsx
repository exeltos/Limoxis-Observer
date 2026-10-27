import { useEffect, useState } from 'react'
import { CalendarDays, ChevronRight } from 'lucide-react'
import { Button } from '../../../design-system/Button'
import { ObserverDialog, DialogActions } from '../../../design-system/ObserverDialog'
import { DetailList } from '../../../design-system/DetailList'
import { StatusBadge } from '../../../design-system/StatusBadge'
import { formatDay } from '../../../core/i18n/formatDay'
import { useContextualNavigation } from '../../../core/navigation/useContextualNavigation'
import { loadQualityRecords, saveQualityRecord } from '../qualityService'
import { AUDIT_BODIES, AUDIT_KINDS, RISK_LEVELS, TEAM_ROLES, standardLabel } from './auditStandards'
import { competenceWarnings, independenceBlocks, independenceIssues, followingAuditDate } from './auditModel'
import { roleTitleText } from '../../../core/i18n/roleTitles'
import { AuditPlanFields } from './AuditPlanFields'
import { useAuditTemplates, useAuditorCompetence } from './useAuditTemplates'
import './audits.css'

const L = (en, el, english) => (en ? english : el)
const label = (list, value, en) => list.find(item => item.value === value)?.label[en ? 1 : 0] || ''
const monthText = (value, language) => (value ? new Intl.DateTimeFormat(language === 'en' ? 'en-GB' : 'el-GR', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${String(value).slice(0, 7)}-15T12:00:00Z`)) : '')

// The department's next audit for the same standard: the earliest one still open after this audit.
function useNextAudit(record, organizationId) {
  const [next, setNext] = useState(null)
  useEffect(() => {
    let active = true
    loadQualityRecords('audits', organizationId).then(list => {
      if (!active) return
      const after = String(record.completedDate || record.plannedDate || '')
      const found = list
        .filter(item => item.id !== record.id && item.department === record.department && (item.standard || '') === (record.standard || '') && ['planned', 'inProgress', 'in_progress'].includes(item.status) && item.lifecycleStatus !== 'voided' && String(item.plannedDate || '') >= after)
        .sort((a, b) => String(a.plannedDate).localeCompare(String(b.plannedDate)))[0]
      setNext(found || null)
    }).catch(() => { if (active) setNext(null) })
    return () => { active = false }
  }, [organizationId, record.id, record.department, record.standard, record.completedDate, record.plannedDate])
  return next
}

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
  const nextAudit = useNextAudit(record, organizationId)
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
  const next = followingAuditDate(record)
  const nextLink = nextAudit
    ? <button type="button" className="quality-audit-finding-link" onClick={() => goTo(`/quality/audits/${nextAudit.id}`, { tab: 'details' })}>{nextAudit.plannedMonthOnly ? monthText(nextAudit.plannedDate, language) : formatDay(nextAudit.plannedDate, language)} · {nextAudit.displayId || nextAudit.id}<ChevronRight size={13} /></button>
    : (next ? formatDay(next, language) : '')
  const items = [
    { label: (record.standards || []).length ? L(en, 'Πρότυπα', 'Standards') : L(en, 'Πρότυπο', 'Standard'), value: [record.standard, ...(record.standards || []).filter(value => value !== record.standard)].map(value => standardLabel(value, language)).filter(Boolean).join(' + ') },
    { label: L(en, 'Ερωτηματολόγιο', 'Questionnaire'), value: record.templateTitle ? `${record.templateTitle}${record.templateVersion ? ` · ${L(en, 'έκδοση', 'version')} ${record.templateVersion}` : ''}` : '' },
    { label: L(en, 'Κεφάλαια στο πεδίο', 'Chapters in scope'), value: record.clausesScope?.length ? record.clausesScope.join(', ') : L(en, 'Όλο το ερωτηματολόγιο', 'The whole questionnaire') },
    { label: L(en, 'Είδος', 'Kind'), value: label(AUDIT_KINDS, record.auditType || 'internal', en) },
    { label: L(en, 'Προγραμματισμός', 'Planned'), value: record.plannedMonthOnly ? `${monthText(record.plannedDate, language)} · ${L(en, 'η ημέρα θα οριστεί', 'day to be fixed')}` : formatDay(record.plannedDate, language) },
    { label: L(en, 'Κίνδυνος / συχνότητα', 'Risk / frequency'), value: record.riskLevel ? label(RISK_LEVELS, record.riskLevel, en) : '' },
    { label: L(en, 'Επόμενη επιθεώρηση', 'Next audit'), value: nextLink },
  ].filter(item => item.value)
  const executionItems = [
    { label: L(en, 'Φορέας', 'Carried out by'), value: label(AUDIT_BODIES, record.auditBody, en) },
    { label: L(en, 'Διάρκεια', 'Duration'), value: record.durationDays ? `${record.durationDays} ${record.durationDays === 1 ? L(en, 'ημέρα', 'day') : L(en, 'ημέρες', 'days')}` : '' },
    { label: L(en, 'Η αναφορά στάλθηκε', 'Report sent'), value: record.reportSentOn ? formatDay(record.reportSentOn, language) : '' },
    { label: L(en, 'Προθεσμία διορθώσεων', 'Corrections due'), value: record.correctionsDueOn ? formatDay(record.correctionsDueOn, language) : '' },
    { label: L(en, 'Σημειώσεις', 'Notes'), value: record.notes, wide: true },
  ].filter(item => item.value)
  return <section className="audit-plan-panel">
    <DetailList sections={[{ title: L(en, 'Σχεδιασμός επιθεώρησης', 'Audit planning'), items }, executionItems.length ? { title: L(en, 'Εκτέλεση και αναφορά', 'Execution and report'), items: executionItems } : null]} />
    <div className="audit-plan-team">
      <span className="lo-field-label">{L(en, 'Ομάδα επιθεώρησης', 'Audit team')}</span>
      {team.length ? <ul className="audit-team-list is-read">{team.map(member => <li key={member.id || member.name}>
        <span className="audit-team-name"><strong>{member.name}</strong><small>{[label(TEAM_ROLES, member.role, en), member.external ? [L(en, 'Εξωτερικός', 'External'), member.affiliation].filter(Boolean).join(' · ') : member.department].filter(Boolean).join(' · ')}</small></span>
        <span className="audit-team-flags">
          {issues.find(issue => issue.member === member) && <StatusBadge tone={issues.find(issue => issue.member === member).level === 'block' ? 'danger' : 'warning'}>{L(en, 'Ίδιο τμήμα', 'Own department')}</StatusBadge>}
          {untrained.includes(member) && <StatusBadge tone="warning">{L(en, 'Χωρίς πιστοποίηση επιθεωρητή', 'No auditor certificate')}</StatusBadge>}
        </span>
      </li>)}</ul> : <strong>{roleTitleText(record.leadAuditor, language) || '—'}</strong>}
    </div>
    {canManage && !finalized && <div className="audit-plan-actions"><Button variant="secondary" onClick={() => setDraft(structuredClone(record))}><CalendarDays size={15} /> {L(en, 'Σχεδιασμός', 'Planning')}</Button></div>}
    {record.followUpOf && <button type="button" className="quality-audit-finding-link" onClick={() => goTo(`/quality/audits/${record.followUpOf}`, { tab: 'details' })}>{L(en, 'Επαναληπτική της', 'Follow-up of')} {record.followUpOf}<ChevronRight size={13} /></button>}
    {draft && <ObserverDialog width="wide" fixedHeight title={L(en, 'Σχεδιασμός επιθεώρησης', 'Audit planning')} subtitle={record.displayId || record.id} onClose={() => setDraft(null)}
      footer={<DialogActions onSave={save} disabled={saving || independenceBlocks(draft.team || [], { id: draft.departmentId, name: draft.department })} />}>
      <div className="lo-form-cards audit-plan-form"><AuditPlanFields draft={draft} setDraft={setDraft} templates={templates} competence={competence} language={language} /></div>
    </ObserverDialog>}
  </section>
}
