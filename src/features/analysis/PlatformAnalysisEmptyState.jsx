import { BarChart3, Building2, FlaskConical } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Button } from '../../design-system/Button'
import { useTenant } from '../../core/tenant/TenantContext'

export function PlatformAnalysisEmptyState() {
  const navigate = useNavigate()
  const { enterPlatformDemo } = useTenant()

  const openDemo = () => {
    enterPlatformDemo()
    navigate('/')
  }

  return <div className="analysis-workspace">
    <div className="analysis-header">
      <div>
        <span className="eyebrow">ANALYTICS & REPORTING</span>
        <h1>Ανάλυση</h1>
        <p>Συγκεντρωτική και συγκριτική εικόνα πλατφόρμας.</p>
      </div>
    </div>
    <div className="empty-state platform-empty analysis-platform-empty">
      <BarChart3 size={28}/>
      <strong>Δεν υπάρχουν ακόμη δεδομένα για ανάλυση</strong>
      <span>Δεν έχει δημιουργηθεί οργανισμός στην παραγωγική πλατφόρμα. Οι δείκτες και τα γραφήματα θα εμφανιστούν μόνο από πραγματικά δεδομένα οργανισμών.</span>
      <div className="platform-demo-actions">
        <Button onClick={()=>navigate('/platform#organizations')}><Building2 size={15}/> Δημιουργία οργανισμού</Button>
        <Button variant="secondary" onClick={openDemo}><FlaskConical size={15}/> Άνοιγμα Demo</Button>
      </div>
    </div>
  </div>
}
