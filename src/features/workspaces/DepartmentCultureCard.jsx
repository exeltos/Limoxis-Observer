import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Microscope } from 'lucide-react'
import { Card, CardHeader } from '../../design-system/Card'
import { useLanguage } from '../../core/i18n/LanguageContext'
import { useTenant } from '../../core/tenant/TenantContext'
import { CAPABILITIES, can } from '../../core/permissions/roles'
import { formatDay } from '../../core/i18n/formatDay'
import { loadControlProgramme } from '../controls/controlCloudService'
import { controlTypeCode } from '../controls/controlVocabulary'

// «Cultures» of a department's home: when its surfaces and air were last sampled and when the next sampling is due,
// from the culture programme of the Quality team (one control per department sampled).
export function DepartmentCultureCard() {
  const { language } = useLanguage()
  const en = language === 'en'
  const navigate = useNavigate()
  const { tenant, role, membership, canAccessRecord } = useTenant()
  const [programme, setProgramme] = useState([])
  useEffect(() => {
    if (!tenant?.id) return undefined
    let live = true
    loadControlProgramme(tenant.id).then(list => { if (live) setProgramme(list || []) }).catch(() => { if (live) setProgramme([]) })
    return () => { live = false }
  }, [tenant?.id])
  const rows = useMemo(() => programme
    .filter(item => controlTypeCode(item.category) === 'CTRL-ENV')
    .flatMap(item => item.departments
      .filter(department => canAccessRecord({ department, departmentId: item.departmentIdByName?.[department] || null }))
      .map(department => { const assignment = item.assignments?.[department] || {}; return { id: `${item.id}:${department}`, title: en ? item.titleEn || item.title : item.title, department, last: assignment.lastCompletedAt || null, next: assignment.nextDueAt || null } }))
    .sort((a, b) => String(a.next || '9').localeCompare(String(b.next || '9'))), [programme, canAccessRecord, en])
  if (!rows.length) return null
  const now = Date.now()
  const canPlan = can(role, CAPABILITIES.VIEW_QUALITY, membership?.capabilities ?? [], membership?.customCapabilities ?? [])
  return <Card className="dashboard-card dashboard-cultures">
    <CardHeader icon={Microscope} title={en ? 'Cultures' : 'Καλλιέργειες'} subtitle={en ? 'When the department was last sampled and when the next sampling is due.' : 'Πότε έγινε η τελευταία δειγματοληψία του τμήματος και πότε είναι η επόμενη.'} />
    <div className="task-list">{rows.map(row => {
      const late = row.next && new Date(row.next).getTime() < now
      return <button type="button" className="task-row" key={row.id} onClick={() => navigate(canPlan ? '/quality/culture-plan' : '/calendar')}>
        <span className={`priority ${late ? 'high' : 'low'}`} />
        <span className="task-copy"><strong>{[row.department, row.last ? `${en ? 'last' : 'τελευταία'} ${formatDay(row.last, language)}` : (en ? 'not sampled yet' : 'δεν έχει γίνει ακόμη')].join(' · ')}</strong></span>
        <span className={`status-badge ${late ? 'danger' : ''}`}>{row.next ? `${late ? (en ? 'Overdue' : 'Εκπρόθεσμη') : (en ? 'Next' : 'Επόμενη')} ${formatDay(row.next, language)}` : (en ? 'No date' : 'Χωρίς ημερομηνία')}</span>
      </button>
    })}</div>
  </Card>
}
