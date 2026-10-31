import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { IconButton } from '../../design-system/IconButton'
import { ExportMenu } from '../../design-system/ExportMenu'
import { RegistryEmptyState } from '../../design-system/RegistryEmptyState'
import { TableSkeleton } from '../../design-system/LoadingSkeleton'
import { useLanguage } from '../../core/i18n/LanguageContext'
import { useTenant } from '../../core/tenant/TenantContext'
import { useFeedback } from '../../core/feedback/FeedbackContext'
import { ControlCalendarPanel, useControlCalendarReport } from '../controls/ControlCalendarPanel'
import { controlsText } from '../controls/controlsText'
import { controlTypeCode } from '../controls/controlVocabulary'
import { loadControlProgramme } from '../controls/controlCloudService'

// The annual plan of the environmental cultures: the culture programme (one control per department sampled) month by month for the
// year: what was sampled, what was missed, what is planned. It is not part of the Controls: it has its own page (Quality › Culture plan).
export function EnvironmentalAnnualPlan() {
  const { language } = useLanguage()
  const en = language === 'en'
  const navigate = useNavigate()
  const { tenant, canAccessRecord } = useTenant()
  const { notifyError } = useFeedback()
  const [state, setState] = useState({ loading: true, programme: [], failed: false })
  const load = useCallback(async () => {
    if (!tenant?.id) { setState({ loading: false, programme: [], failed: false }); return }
    try { setState({ loading: false, programme: await loadControlProgramme(tenant.id), failed: false }) }
    catch (error) { notifyError(error, 'load', { operation: 'environmental_annual_plan' }); setState({ loading: false, programme: [], failed: true }) }
  }, [tenant?.id, notifyError])
  useEffect(() => { void load() }, [load])
  const rows = useMemo(() => state.programme
    .filter(item => controlTypeCode(item.category) === 'CTRL-ENV')
    .map(item => ({ item, departments: item.departments.filter(dep => canAccessRecord({ department: dep, departmentId: item.departmentIdByName?.[dep] || null })) }))
    .filter(row => row.departments.length > 0), [state.programme, canAccessRecord])
  const tx = controlsText[en ? 'en' : 'el']
  const labels = useMemo(() => ({ kind: en ? 'Environmental surveillance' : 'Περιβαλλοντική επιτήρηση', title: year => (en ? `Annual culture plan ${year}` : `Ετήσιο πλάνο καλλιεργειών ${year}`), file: en ? 'culture-plan' : 'plano-kalliergeion' }), [en])
  const report = useControlCalendarReport(rows, tx, language, tenant?.id, 0, labels)
  if (state.loading) return <TableSkeleton />
  if (state.failed) return <RegistryEmptyState error onRetry={load} />
  return <section className="environmental-annual-plan workspace-fill">
    <div className="row-actions environmental-plan-bar">
      <IconButton label={tx.previousYear} onClick={() => report.setYear(year => year - 1)}><ChevronLeft size={16} /></IconButton>
      <strong>{report.year}</strong>
      <IconButton label={tx.nextYear} onClick={() => report.setYear(year => year + 1)}><ChevronRight size={16} /></IconButton>
      <ExportMenu disabled={!rows.length} onPrint={() => report.exportPdf(false)} onPdf={() => report.exportPdf(true)} onExcel={report.exportCsv} />
    </div>
    <ControlCalendarPanel report={report} language={language} onOpen={item => navigate(`/controls/${item.id}`)} />
  </section>
}
