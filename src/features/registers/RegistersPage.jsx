import { useState } from 'react'
import { ClipboardList, Plus, Stethoscope, Users } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Page } from '../../design-system/Page'
import { ActionButton } from '../../design-system/ActionButton'
import { ModeSwitch } from '../../design-system/ModeSwitch'
import { useLanguage } from '../../core/i18n/LanguageContext'
import { useContextualNavigation } from '../../core/navigation/useContextualNavigation'
import { RegistersPanel, useRegisterList } from './RegistersPanel'
import { useRegisterAccess } from './registerAccess'
import { MeetingsList, useMeetings } from '../quality/meetings/MeetingsPanel'
import { EquipmentList, useResources } from '../quality/resources/ResourcesPanel'
import { NO_EQUIPMENT_FILTERS } from '../quality/resources/resourceModel'

// The department's registers (NICU neonates, monthly procedure sheets) and its
// meetings and its equipment: what a department records, outside the Quality Center.
export function RegistersPage() {
  const { language } = useLanguage()
  const en = language === 'en'
  const navigate = useNavigate()
  const { goTo } = useContextualNavigation('/registers')
  const list = useRegisterList()
  const access = useRegisterAccess()
  const [view, setView] = useState('registers')
  const meetings = useMeetings(view === 'meetings')
  const [filters, setFilters] = useState({ query: '', department: 'all', status: 'all', quick: null })
  const equipment = useResources(view === 'equipment')
  const [equipmentFilters, setEquipmentFilters] = useState(NO_EQUIPMENT_FILTERS)
  const viewSwitch = <ModeSwitch ariaLabel={en ? 'View' : 'Προβολή'} value={view} onChange={setView} options={[{ value: 'registers', icon: ClipboardList, label: en ? 'Registers' : 'Μητρώα' }, { value: 'meetings', icon: Users, label: en ? 'Meetings' : 'Συναντήσεις' }, { value: 'equipment', icon: Stethoscope, label: en ? 'Equipment' : 'Εξοπλισμός' }]} />
  const action = view === 'equipment' ? null : view === 'meetings'
    ? <ActionButton tone="primary" label={en ? 'New meeting' : 'Νέα συνάντηση'} onClick={() => goTo('/meetings/new')}><Plus size={18} /><span>{en ? 'New meeting' : 'Νέα συνάντηση'}</span></ActionButton>
    : access.canDefine && <ActionButton tone="primary" label={en ? 'New register' : 'Νέο μητρώο'} onClick={() => navigate('/registers/new')}><Plus size={18} /><span>{en ? 'New register' : 'Νέο μητρώο'}</span></ActionButton>
  return <Page fill title={en ? 'Department registers' : 'Μητρώα τμήματος'} subtitle={en ? 'The cases and monthly sheets your department records, the indicators computed from them, and its meetings and its equipment.' : 'Τα περιστατικά και τα μηνιαία φύλλα που καταχωρεί το τμήμα σας, οι δείκτες που προκύπτουν από αυτά, οι συναντήσεις και ο εξοπλισμός του.'} actions={action}>
    <section className="surface registry-workspace workspace-column workspace-fill registers-workspace">
      {view === 'registers' && <RegistersPanel list={list} filterEnd={viewSwitch} />}
      {view === 'meetings' && <MeetingsList list={meetings} filters={filters} setFilters={setFilters} filterEnd={viewSwitch} onOpen={meeting => goTo(`/meetings/${meeting.id}`)} />}
      {view === 'equipment' && <EquipmentList list={equipment} filters={equipmentFilters} setFilters={setEquipmentFilters} filterEnd={viewSwitch} onOpen={row => goTo(`/quality/equipment/${row.id}`)} />}
    </section>
  </Page>
}
