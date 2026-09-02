import { BarChart3 } from 'lucide-react'
import { useTenant } from '../../core/tenant/TenantContext'
import { AnalysisPage } from './AnalysisPage'

export function ProductionAnalysisPage() {
  const { tenant, isDemo } = useTenant()

  if (isDemo) return <AnalysisPage />

  return <div className="analysis-workspace">
    <div className="analysis-header">
      <div>
        <span className="eyebrow">ANALYTICS & REPORTING</span>
        <h1>Ανάλυση</h1>
        <p>{tenant?.name || 'Οργανισμός'} · πραγματικά δεδομένα οργανισμού.</p>
      </div>
    </div>
    <div className="empty-state platform-empty analysis-platform-empty">
      <BarChart3 size={28}/>
      <strong>Δεν υπάρχουν ακόμη διαθέσιμα δεδομένα ανάλυσης</strong>
      <span>Τα Demo KPIs δεν εμφανίζονται σε production οργανισμούς. Οι δείκτες και τα γραφήματα θα εμφανίζονται εδώ μόνο από πραγματικές καταγραφές του οργανισμού.</span>
    </div>
  </div>
}
