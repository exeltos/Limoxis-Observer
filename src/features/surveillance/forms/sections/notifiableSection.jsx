import { useMemo, useState } from 'react'
import { ExternalLink, Megaphone, Plus } from 'lucide-react'
import { Button } from '../../../../design-system/Button'
import { ObserverDialog, DialogActions } from '../../../../design-system/ObserverDialog'
import { Field } from '../../../../design-system/Field'
import { ManualDateField } from '../../../../design-system/ManualDateField'
import { SearchableSelect } from '../../../../design-system/SearchableSelect'
import { DocumentsWorkspace } from '../../../../design-system/DocumentsWorkspace'
import { useLanguage } from '../../../../core/i18n/LanguageContext'
import { useFeedback } from '../../../../core/feedback/FeedbackContext'
import { CAPABILITIES, isProfileDisabled } from '../../../../core/permissions/roles'
import { ROLES } from '../../../../core/permissions/systemRoleMatrix'
import { notifiableFindings } from '../../../reporting/notifiableFindings'
import { loadRecordNotificationReports, removeDemoNotificationReport, saveNotificationReport, updateNotificationReport, createClinicalNotificationReport } from '../../../reporting/notificationReportsService'
import { binMemoryRow } from '../../../../core/recycleBin/recycleBinService'
import { deadlineStatusText, deadlineWords, eodyEntry, eodyEntryByName } from '../../../reporting/eodyCatalogue'
import { NewNotificationDialog } from './notifiablePicker'
import { FormEmpty, FormRow, FormRows } from '../FormRow'
import { FormSection } from '../FormSection'
import { PrefilledList } from '../PrefilledList'
import { FORM_STATUS } from '../formStatus'
import { episodeContext } from '../formPrefill'

// The roles the database lets read and write notifiable disease reports (RLS of
// notifiable_disease_reports). Everyone else does not even learn that a report exists.
export const NOTIFIABLE_ROLES = Object.freeze([ROLES.PLATFORM_OWNER, ROLES.HOSPITAL_ADMIN, ROLES.INFECTION_CONTROL_LEAD, ROLES.INFECTION_CONTROL_MEMBER, ROLES.LABORATORY])
// The EODY page that lists the blank notification forms (Word), per disease.
export const EODY_FORMS_URL = 'https://www.eody.gov.gr/el/symvanta-dimosias-ygeias/epidimiologiki-epitirisi/systimata-epitirisis/systima-ypoxreotikis-dilosis.html'
export const canSeeNotifiable = ctx =>
  NOTIFIABLE_ROLES.includes(ctx.role) && (!isProfileDisabled(CAPABILITIES.VIEW_LAB) || !isProfileDisabled(CAPABILITIES.VIEW_SURVEILLANCE))

// One row per notifiable laboratory finding of the record's samples, and one per clinical
// notification that carries no finding. Pure: the screen and the printed report share it.
export function notifiableRows(ctx, reports = []) {
  const en = ctx.language === 'en'
  const findings = notifiableFindings(ctx.samples || [], reports)
  const seen = new Set(findings.map(finding => finding.findingKey))
  const rows = findings.map(finding => ({
    key: finding.findingKey,
    finding,
    report: finding.report,
    title: en ? finding.rule.en : finding.rule.el,
    sample: finding.sample.sampleCode || finding.sample.id,
    organism: finding.organism,
    date: finding.date,
    start: finding.date,
    entry: finding.entry,
    status: finding.report?.status || 'pending',
  }))
  for (const report of reports)
    if (!seen.has(report.findingKey) && report.patientRecordId)
      rows.push({ key: report.id || report.findingKey, finding: null, report, title: report.disease || ctx.t('episodeForms.notifiable.title'), sample: '', organism: '', date: String(report.createdAt || '').slice(0, 10), start: report.createdAt, entry: eodyEntry(report.diseaseCode) || eodyEntryByName(report.disease), status: report.status || 'pending' })
  return rows
}

// «Διαγραφή» of a saved notification (to the recycle bin). A laboratory finding that has no report
// yet is only a signal derived from a validated result: it has nothing to delete (it can be set to
// «Δεν απαιτείται»). null when the person may not delete it.
export function notifiableDeleteItem(ctx, row, t, onDone) {
  if (!row?.report) return null
  return ctx.deleteItem?.({
    createdBy: row.report.updatedBy,
    table: 'notifiable_disease_reports',
    id: row.report.id,
    label: row.title,
    detail: t('episodeForms.notifiable.title'),
    demo: async () => {
      const removed = removeDemoNotificationReport(row.report.findingKey || row.report.id)
      if (removed) await binMemoryRow(null, { module: 'clinical', kind: 'notifiable_disease_reports', label: row.title, detail: t('episodeForms.notifiable.title'), store: 'notification_reports', row: removed })
    },
    onDone,
  }) || null
}

export function NotifiableDialog({ ctx, row, onClose, onSaved }) {
  const { t } = useLanguage()
  const { notify } = useFeedback()
  const [draft, setDraft] = useState({ status: row.status, notifiedAt: row.report?.notifiedAt || '', reference: row.report?.reference || '' })
  const [busy, setBusy] = useState(false)
  const [demoForms, setDemoForms] = useState([])
  const base = episodeContext(ctx)
  const removeItem = notifiableDeleteItem(ctx, row, t, onSaved)
  // The completed form hangs on the saved report (its id); the demo keeps it on the screen only.
  const reportId = row.report?.id
  async function save() {
    setBusy(true)
    try {
      const options = { isDemo: ctx.isDemo }
      if (row.finding) await saveNotificationReport(ctx.organizationId, { ...row.finding, patientRecordId: base.patientRecordId }, draft, options)
      else await updateNotificationReport(ctx.organizationId, row.report.id, draft, options)
      notify(t('episodeForms.notifiable.saved'), 'success')
      onSaved()
    } catch (error) {
      notify(error?.message || t('episodeForms.notifiable.saveFailed'), 'danger')
    } finally {
      setBusy(false)
    }
  }
  return (
    <ObserverDialog
      width="standard"
      title={row.title}
      subtitle={t('episodeForms.notifiable.title')}
      onClose={onClose}
      footer={
        <DialogActions onSave={save} disabled={busy}>
          {removeItem && (
            <Button variant="secondary" disabled={busy} onClick={removeItem.onClick}>
              {removeItem.label}
            </Button>
          )}
        </DialogActions>
      }
    >
      <PrefilledList
        items={[
          { label: t('episodeForms.prefill.patient'), value: base.patientLabel },
          { label: t('episodeForms.prefill.admission'), value: base.admissionLabel },
          { label: t('episodeForms.prefill.episode'), value: base.episodeLabel },
          { label: t('episodeForms.notifiable.sample'), value: row.sample },
          { label: t('episodeForms.notifiable.finding'), value: row.organism },
        ]}
      />
      <div className="episode-form-fields">
        <SearchableSelect
          label={t('episodeForms.notifiable.status')}
          value={draft.status}
          clearLabel=""
          options={[
            { value: 'pending', label: t('episodeForms.notifiable.pending') },
            { value: 'notified', label: t('episodeForms.notifiable.notified') },
            { value: 'not_required', label: t('episodeForms.notifiable.notRequired') },
          ]}
          onChange={value => value && setDraft(current => ({ ...current, status: value }))}
        />
        {draft.status === 'notified' && (
          <ManualDateField label={t('episodeForms.notifiable.notifiedOn')} value={draft.notifiedAt} onChange={value => setDraft(current => ({ ...current, notifiedAt: value }))} />
        )}
        <Field label={t('episodeForms.notifiable.reference')}>
          <input value={draft.reference} onChange={event => setDraft(current => ({ ...current, reference: event.target.value }))} />
        </Field>
      </div>
      {reportId || ctx.isDemo ? (
        <DocumentsWorkspace
          title={t('episodeForms.notifiable.formTitle')}
          subtitle={t('episodeForms.notifiable.formSubtitle')}
          {...(ctx.isDemo ? { value: demoForms, onChange: setDemoForms } : { organizationId: ctx.organizationId, entityType: 'notifiable_disease_report', entityId: reportId })}
        />
      ) : (
        <p className="field-hint">{t('episodeForms.notifiable.formAfterSave')}</p>
      )}
      <p className="notifiable-forms-link">
        <a href={EODY_FORMS_URL} target="_blank" rel="noreferrer">
          <ExternalLink size={14} aria-hidden="true" />
          {t('episodeForms.notifiable.eodyForms')}
        </a>
      </p>
    </ObserverDialog>
  )
}

function NotifiableSection({ ctx, section, reload }) {
  const { t, language } = useLanguage()
  const { fmtDate } = ctx
  const { notify } = useFeedback()
  const [openRow, setOpenRow] = useState(null)
  const [picking, setPicking] = useState(false)
  const [creating, setCreating] = useState(false)
  const base = episodeContext(ctx)
  async function createReport(entry) {
    setCreating(true)
    try {
      await createClinicalNotificationReport(ctx.organizationId, { patientRecordId: base.patientRecordId || (ctx.isDemo ? ctx.patient?.id : ''), departmentId: base.departmentId, entry }, { isDemo: ctx.isDemo })
      notify(t('episodeForms.notifiable.saved'), 'success')
      setPicking(false)
      reload()
    } catch (error) {
      notify(error?.message || t('episodeForms.notifiable.saveFailed'), 'danger')
    } finally {
      setCreating(false)
    }
  }
  const rows = useMemo(() => notifiableRows(ctx, section.value || []), [ctx, section.value])
  const pending = rows.filter(row => row.status === 'pending').length
  const summary = rows.length ? (pending ? `${pending} ${t('episodeForms.status.pending').toLowerCase()}` : t('episodeForms.status.done').toLowerCase()) : t('episodeForms.notifiable.none')
  return (
    <FormSection id="notifiable" title={t('episodeForms.notifiable.title')} icon={Megaphone} defaultOpen={rows.length > 0} summary={summary} needsAttention={pending > 0}
      actions={
        <Button variant="secondary" onClick={() => setPicking(true)}>
          <Plus size={14} aria-hidden="true" />
          {t('episodeForms.notifiable.new')}
        </Button>
      }
    >
      {rows.length === 0 ? (
        <FormEmpty>{t('episodeForms.notifiable.empty')}</FormEmpty>
      ) : (
        <FormRows label={t('episodeForms.notifiable.title')}>
          {rows.map(row => {
            const done = row.status !== 'pending'
            const waiting = row.status === 'pending' && row.entry ? deadlineStatusText(row.entry.deadline, row.start, { language }) : { overdue: false, text: '' }
            const statusDetail =
              row.status === 'notified'
                ? [t('episodeForms.notifiable.notified'), row.report?.notifiedAt && fmtDate(row.report.notifiedAt), row.report?.reference].filter(Boolean).join(' · ')
                : row.status === 'not_required'
                  ? t('episodeForms.notifiable.notRequired')
                  : [t('episodeForms.notifiable.notSubmitted'), waiting.text].filter(Boolean).join(' · ')
            return (
              <FormRow
                key={row.key}
                title={row.title}
                badge={row.status === 'pending' ? { label: t('episodeForms.notifiable.signal'), tone: 'danger' } : null}
                detail={[row.entry ? deadlineWords(row.entry.deadline, language) : row.finding?.rule.nationalPlan ? t('episodeForms.notifiable.nationalPlan') : '', row.sample && `${t('episodeForms.notifiable.sample')} ${row.sample}`, row.organism].filter(Boolean).join(' · ')}
                status={done ? FORM_STATUS.DONE : waiting.overdue ? FORM_STATUS.OVERDUE : FORM_STATUS.PENDING}
                statusDetail={statusDetail}
                date={row.date ? fmtDate(row.date) : ''}
                dateLabel={row.date ? t('episodeForms.notifiable.findingDate') : ''}
                action={{ label: row.report ? t('episodeForms.open') : t('episodeForms.notifiable.submit'), onClick: () => setOpenRow(row) }}
                menu={[
                  notifiableDeleteItem(ctx, row, t, reload),
                ]}
              />
            )
          })}
        </FormRows>
      )}
      {picking && <NewNotificationDialog busy={creating} onSave={({ entry }) => createReport(entry)} onClose={() => setPicking(false)} />}
      {openRow && (
        <NotifiableDialog
          ctx={ctx}
          row={openRow}
          onClose={() => setOpenRow(null)}
          onSaved={() => {
            setOpenRow(null)
            reload()
          }}
        />
      )}
    </FormSection>
  )
}

export const notifiableSection = {
  id: 'notifiable',
  order: 30,
  // Also shown for a patient without an admission (a notifiable report may be all there is).
  withoutAdmission: true,
  canSee: ctx => canSeeNotifiable(ctx) && Boolean(ctx.patient || ctx.record),
  load: ctx =>
    loadRecordNotificationReports(
      ctx.organizationId,
      // The demo has no record ids: its patients and samples are found by their codes.
      { sampleRecordIds: (ctx.samples || []).map(sample => sample.recordId || (ctx.isDemo ? sample.id : null)).filter(Boolean), patientRecordId: ctx.patient?.recordId || (ctx.isDemo ? ctx.patient?.id : null) || null },
      { isDemo: ctx.isDemo },
    ),
  Component: NotifiableSection,
  buildReport(ctx, section) {
    const rows = notifiableRows(ctx, section.value || [])
    if (!rows.length) return null
    return {
      id: 'notifiable',
      title: ctx.t('episodeForms.notifiable.title'),
      list: rows.map(row =>
        [
          row.title,
          row.entry && deadlineWords(row.entry.deadline, ctx.language),
          row.date && ctx.fmtDate(row.date),
          row.status === 'notified' ? ctx.t('episodeForms.notifiable.notified') : row.status === 'not_required' ? ctx.t('episodeForms.notifiable.notRequired') : ctx.t('episodeForms.status.pending'),
          row.report?.reference,
        ].filter(Boolean).join(' · '),
      ),
    }
  },
}
