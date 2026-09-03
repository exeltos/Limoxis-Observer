import { useEffect, useMemo, useState } from 'react'
import {
  Building2,
  Clock3,
  FlaskConical,
  LogIn,
  ShieldCheck,
  Trash2,
} from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Page } from '../../design-system/Page'
import { BackButton } from '../../design-system/BackButton'
import { FilterBar } from '../../design-system/FilterBar'
import { ObserverDialog } from '../../design-system/ObserverDialog'
import { Button } from '../../design-system/Button'
import { SaveButton } from '../../design-system/SaveButton'
import { ManualDateField } from '../../design-system/ManualDateField'
import { LocationAutocompleteField } from '../../design-system/LocationAutocompleteField'
import { CITY_OPTIONS,COUNTRY_OPTIONS } from '../../core/reference/locationOptions'
import { useTenant } from '../../core/tenant/TenantContext'
import { useLanguage } from '../../core/i18n/LanguageContext'
import { useFeedback } from '../../core/feedback/FeedbackContext'
import {
  createOrganizationUser,
  createPlatformDemoEntitlement,
  createPlatformOrganization,
  listPlatformDemos,
  listPlatformOrganizationMembers,
  purgePlatformOrganization,
} from '../../core/tenant/tenantService'
import { AnalysisPage } from '../analysis/AnalysisPage'
import { PlatformDemoRecord } from '../platform/PlatformDemoRecord'
import { PlatformOrganizationRecord } from '../platform/PlatformOrganizationRecord'

const GREEK_REGIONS = [
  'Ανατολική Μακεδονία και Θράκη',
  'Κεντρική Μακεδονία',
  'Δυτική Μακεδονία',
  'Ήπειρος',
  'Θεσσαλία',
  'Ιόνια Νησιά',
  'Δυτική Ελλάδα',
  'Στερεά Ελλάδα',
  'Αττική',
  'Πελοπόννησος',
  'Βόρειο Αιγαίο',
  'Νότιο Αιγαίο',
  'Κρήτη',
]

const HEALTH_REGIONS = [
  '1η ΥΠΕ Αττικής',
  '2η ΥΠΕ Πειραιώς και Αιγαίου',
  '3η ΥΠΕ Μακεδονίας',
  '4η ΥΠΕ Μακεδονίας και Θράκης',
  '5η ΥΠΕ Θεσσαλίας και Στερεάς Ελλάδας',
  '6η ΥΠΕ Πελοποννήσου, Ιονίων Νήσων, Ηπείρου και Δυτικής Ελλάδας',
  '7η ΥΠΕ Κρήτης',
]

const emptyOrganization = {
  name: '',
  code: '',
  type: 'hospital',
  status: 'active',
  region: '',
  healthRegion: '',
  city: '',
  country: '',
  contactEmail: '',
  contactPhone: '',
  bedCapacity: '',
  adminFullName: '',
  adminEmail: '',
}

function daysBetween(a, b) {
  return Math.max(0, Math.ceil((new Date(b) - new Date(a)) / 86400000))
}

function demoProgress(item) {
  const total = Math.max(1, daysBetween(item.valid_from, item.valid_until))
  const remaining = daysBetween(new Date().toISOString().slice(0, 10), item.valid_until)
  return {
    remaining,
    pct: Math.max(0, Math.min(100, Math.round((remaining / total) * 100))),
  }
}

function parsePlatformHash(hash = '') {
  const raw = hash.replace(/^#/, '')
  const [key = '', query = ''] = raw.split('?')
  return { key, params: new URLSearchParams(query) }
}

function generateOrganizationCode() {
  return `HOSP-${Date.now().toString(36).slice(-6).toUpperCase()}`
}

function FormSection({ title, subtitle, children }) {
  return (
    <section className="platform-form-section">
      <header>
        <strong>{title}</strong>
        {subtitle && <span>{subtitle}</span>}
      </header>
      {children}
    </section>
  )
}

export function PlatformCenterPage() {
  const { memberships, setTenantByMembership, reloadMemberships, enterPlatformDemo } = useTenant()
  const { language } = useLanguage()
  const { notify, notifyError } = useFeedback()
  const nav = useNavigate()
  const location = useLocation()
  const en = language === 'en'
  const tx = (elText, enText) => (en ? enText : elText)
  const { key: activeKey, params: hashParams } = parsePlatformHash(location.hash)

  const [createOpen, setCreateOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [draft, setDraft] = useState(emptyOrganization)
  const [formError, setFormError] = useState('')
  const [members, setMembers] = useState([])
  const [demos, setDemos] = useState([])
  const [loadingStats, setLoadingStats] = useState(true)
  const [deleteOrg, setDeleteOrg] = useState(null)
  const [deletePassword, setDeletePassword] = useState('')
  const [deleteConfirm, setDeleteConfirm] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [demoOpen, setDemoOpen] = useState(false)
  const [demoDraft, setDemoDraft] = useState({
    label: '',
    type: 'hospital',
    region: '',
    healthRegion: '',
    city: '',
    country: '',
    contactPhone: '',
    bedCapacity: '',
    contactName: '',
    contactEmail: '',
    validFrom: new Date().toISOString().slice(0, 10),
    validUntil: '',
  })
  const [demoSaving, setDemoSaving] = useState(false)
  const [organizationQuery, setOrganizationQuery] = useState('')
  const [demoQuery, setDemoQuery] = useState('')

  const organizations = memberships.map(membership => membership.organization).filter(Boolean)
  const selectedOrgId = hashParams.get('organization') || ''
  const selectedOrg = organizations.find(org => org.id === selectedOrgId) || null
  const selectedDemoId = hashParams.get('demo') || ''
  const selectedDemo = demos.find(item => item.id === selectedDemoId) || null
  const orgDetailTab = hashParams.get('tab') || 'details'
  const activeOrganizations = organizations.filter(org => org.status === 'active').length
  const activeDemos = demos.filter(
    demo =>
      demo.status === 'active' &&
      daysBetween(new Date().toISOString().slice(0, 10), demo.valid_until) > 0
  )
  const expiringDemos = activeDemos.filter(demo => demoProgress(demo).remaining <= 14)

  const filteredOrganizations = useMemo(() => {
    const locale = language === 'el' ? 'el-GR' : 'en-US'
    const query = organizationQuery.trim().toLocaleLowerCase(locale)
    if (!query) return organizations
    return organizations.filter(org =>
      [org.name, org.code, org.city, org.region, org.health_region].some(value =>
        String(value || '')
          .toLocaleLowerCase(locale)
          .includes(query)
      )
    )
  }, [organizations, organizationQuery, language])

  const filteredDemos = useMemo(() => {
    const locale = language === 'el' ? 'el-GR' : 'en-US'
    const query = demoQuery.trim().toLocaleLowerCase(locale)
    if (!query) return demos
    return demos.filter(item =>
      [
        item.organization?.name,
        item.organization?.code,
        item.label,
        item.contact_name,
        item.contact_email,
      ].some(value =>
        String(value || '')
          .toLocaleLowerCase(locale)
          .includes(query)
      )
    )
  }, [demos, demoQuery, language])

  const memberCountByOrg = useMemo(
    () =>
      members.reduce((acc, member) => {
        acc[member.organization_id] = (acc[member.organization_id] || 0) + 1
        return acc
      }, {}),
    [members]
  )

  const hospitalAdminStatusByOrg = useMemo(
    () =>
      members.reduce((acc, member) => {
        if (member.role === 'hospital_admin') acc[member.organization_id] = member.status
        return acc
      }, {}),
    [members]
  )

  async function refreshPlatformData() {
    setLoadingStats(true)
    try {
      const [nextMembers, nextDemos] = await Promise.all([
        listPlatformOrganizationMembers(),
        listPlatformDemos(),
      ])
      setMembers(nextMembers)
      setDemos(nextDemos)
    } catch (error) {
      console.warn(error)
    } finally {
      setLoadingStats(false)
    }
  }

  useEffect(() => {
    void refreshPlatformData()
  }, [memberships.length])


  const setField = (key, value) => setDraft(current => ({ ...current, [key]: value }))
  const codeValid = /^[A-Z0-9_-]{2,24}$/.test(draft.code.trim().toUpperCase())
  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.adminEmail.trim())
  const formValid = Boolean(
    draft.name.trim() &&
      codeValid &&
      draft.region &&
      draft.healthRegion &&
      draft.city.trim() &&
      draft.adminFullName.trim() &&
      emailValid
  )

  function openCreate() {
    setDraft({ ...emptyOrganization, code: generateOrganizationCode() })
    setFormError('')
    setCreateOpen(true)
  }

  function openOrganization(org) {
    nav(`/platform#organizations?organization=${org.id}&tab=details`, {
      state: { returnTo: '/platform#organizations' },
    })
  }

  function changeOrgTab(tab) {
    nav(`/platform#organizations?organization=${selectedOrg.id}&tab=${tab}`, {
      replace: true,
      state: location.state,
    })
  }

  function returnFromRecord() {
    nav(location.state?.returnTo || '/platform#organizations')
  }

  function openOrganizationAnalysis() {
    nav(`/platform#reports?organization=${selectedOrg.id}`, {
      state: {
        returnTo: `/platform#organizations?organization=${selectedOrg.id}&tab=analysis`,
      },
    })
  }

  function openDemoRecord(demo) {
    nav(`/platform#demo?demo=${demo.id}`, { state: { returnTo: '/platform#demo' } })
  }

  function returnFromDemoRecord() {
    nav(location.state?.returnTo || '/platform#demo')
  }

  function enterOrganization(org) {
    const membership = memberships.find(item => item.organization?.id === org.id)
    if (membership) {
      setTenantByMembership(membership.id)
      nav('/')
    }
  }

  async function submitOrganization() {
    if (!formValid || saving) return
    setSaving(true)
    setFormError('')
    try {
      const created = await createPlatformOrganization(draft)
      await reloadMemberships()
      await refreshPlatformData()
      setCreateOpen(false)
      notify(tx('Ο οργανισμός αποθηκεύτηκε.', 'Organization saved.'), 'success', {
        operation: 'platform_organization_create',
      })
      try {
        const invitation = await createOrganizationUser({
          organizationId: created.id,
          fullName: draft.adminFullName,
          role: 'hospital_admin',
          email: draft.adminEmail,
        })
        if (invitation?.reused) {
          notify(
            tx(
              'Ο χρήστης υπήρχε ήδη και προστέθηκε ως Hospital Admin στον οργανισμό.',
              'This account already existed and was assigned as Hospital Admin.'
            ),
            'success',
            { operation: 'platform_admin_assign' }
          )
        } else {
          notify(
            invitation?.emailSent
              ? tx('Η πρόσκληση του Hospital Admin στάλθηκε.', 'Hospital Admin invitation sent.')
              : tx(
                  'Ο Hospital Admin δημιουργήθηκε, αλλά η πρόσκληση δεν μπόρεσε να αποσταλεί.',
                  'Hospital Admin was created, but the invitation could not be delivered.'
                ),
            invitation?.emailSent ? 'success' : 'warning',
            { operation: 'platform_admin_invite' }
          )
        }
      } catch (inviteError) {
        notifyError(inviteError, 'action', { operation: 'platform_admin_invite' })
      }
    } catch (error) {
      const duplicate = /duplicate|unique/i.test(String(error?.message || error || ''))
      const friendly = duplicate
        ? tx('Ο κωδικός οργανισμού χρησιμοποιείται ήδη.', 'This organization code already exists.')
        : tx(
            'Δεν ήταν δυνατή η αποθήκευση του οργανισμού. Δοκιμάστε ξανά.',
            'The organization could not be saved. Please try again.'
          )
      setFormError(friendly)
      notifyError(error, 'save', { operation: 'platform_organization_create' })
    } finally {
      setSaving(false)
    }
  }

  function requestRemoveOrganization(org) {
    setDeleteOrg(org)
    setDeletePassword('')
    setDeleteConfirm('')
  }

  async function confirmRemoveOrganization() {
    if (!deleteOrg || deleting) return
    if (deleteConfirm.trim().toUpperCase() !== deleteOrg.code?.toUpperCase()) {
      notify(
        tx(
          'Πληκτρολόγησε ακριβώς τον κωδικό του οργανισμού για επιβεβαίωση.',
          'Type the organization code exactly to confirm.'
        ),
        'warning',
        { operation: 'platform_organization_delete' }
      )
      return
    }
    if (!deletePassword) {
      notify(
        tx(
          'Απαιτείται ο κωδικός πρόσβασης του Platform Owner για επαναταυτοποίηση.',
          'Platform Owner password is required for re-authentication.'
        ),
        'warning',
        { operation: 'platform_organization_delete' }
      )
      return
    }
    setDeleting(true)
    try {
      await purgePlatformOrganization({
        organizationId: deleteOrg.id,
        password: deletePassword,
        confirmation: deleteConfirm.trim(),
      })
      await reloadMemberships()
      await refreshPlatformData()
      setDeleteOrg(null)
      nav('/platform#organizations')
      notify(
        tx(
          'Ο οργανισμός και τα σχετικά δεδομένα διαγράφηκαν οριστικά.',
          'The organization and related data were permanently deleted.'
        ),
        'success',
        { operation: 'platform_organization_delete' }
      )
    } catch (error) {
      notifyError(error, 'delete', { operation: 'platform_organization_delete' })
    } finally {
      setDeleting(false)
    }
  }

  async function createDemo() {
    if (!demoDraft.label.trim() || !demoDraft.validUntil) return
    setDemoSaving(true)
    try {
      await createPlatformDemoEntitlement(demoDraft)
      await refreshPlatformData()
      setDemoOpen(false)
      setDemoDraft({ label:'', type:'hospital', region:'', healthRegion:'', city:'', country:'', contactPhone:'', bedCapacity:'', contactName:'', contactEmail:'', validFrom:new Date().toISOString().slice(0,10), validUntil:'' })
      notify(tx('Το Demo ενεργοποιήθηκε.', 'Demo access enabled.'), 'success', {
        operation: 'platform_demo_create',
      })
    } catch (error) {
      notifyError(error, 'save', { operation: 'platform_demo_create' })
    } finally {
      setDemoSaving(false)
    }
  }

  const createDialog = createOpen ? (
    <ObserverDialog
      width="wide"
      eyebrow="Platform Owner"
      title={tx('Νέος οργανισμός', 'New organization')}
      subtitle={tx(
        'Στοιχεία οργανισμού και πρόσκληση αρχικού Hospital Admin.',
        'Organization identity and initial Hospital Admin invitation.'
      )}
      onClose={() => !saving && setCreateOpen(false)}
      footer={
        <SaveButton
          loading={saving}
          savingLabel={tx('Αποθήκευση…', 'Saving…')}
          disabled={!formValid}
          onClick={submitOrganization}
        >
          {tx('Αποθήκευση & αποστολή πρόσκλησης', 'Save & send invitation')}
        </SaveButton>
      }
    >
      <div className="platform-form-shell">
        <FormSection title={tx('Ταυτότητα οργανισμού', 'Organization identity')}>
          <div className="platform-form-grid">
            <label className="field field-wide">
              <span>{tx('Επωνυμία', 'Name')} *</span>
              <input autoFocus value={draft.name} onChange={event => setField('name', event.target.value)} />
            </label>
            <label className="field">
              <span>{tx('Κωδικός / Hospital Prefix', 'Code / Hospital Prefix')}</span>
              <input value={draft.code} readOnly />
            </label>
            <label className="field">
              <span>{tx('Τύπος', 'Type')}</span>
              <select value={draft.type} onChange={event => setField('type', event.target.value)}>
                <option value="hospital">{tx('Νοσοκομείο', 'Hospital')}</option>
                <option value="clinic">{tx('Κλινική', 'Clinic')}</option>
                <option value="group">{tx('Όμιλος', 'Group')}</option>
                <option value="other">{tx('Άλλο', 'Other')}</option>
              </select>
            </label>
          </div>
        </FormSection>
        <FormSection title={tx('Τοποθεσία & λειτουργία', 'Location & operations')}>
          <div className="platform-form-grid">
            <label className="field">
              <span>{tx('Περιφέρεια', 'Region')} *</span>
              <select value={draft.region} onChange={event => setField('region', event.target.value)}>
                <option value="">{tx('Επιλογή…', 'Select…')}</option>
                {GREEK_REGIONS.map(region => (
                  <option key={region}>{region}</option>
                ))}
              </select>
            </label>
            <label className="field field-wide">
              <span>{tx('Υγειονομική Περιφέρεια (ΥΠΕ)', 'Health Region')} *</span>
              <select
                value={draft.healthRegion}
                onChange={event => setField('healthRegion', event.target.value)}
              >
                <option value="">{tx('Επιλογή…', 'Select…')}</option>
                {HEALTH_REGIONS.map(region => (
                  <option key={region}>{region}</option>
                ))}
              </select>
            </label>
            <LocationAutocompleteField label={tx('Πόλη','City')} required value={draft.city} onChange={value=>setField('city',value)} options={CITY_OPTIONS} />
            <LocationAutocompleteField label={tx('Χώρα','Country')} value={draft.country} onChange={value=>setField('country',value)} options={COUNTRY_OPTIONS} />
            <label className="field">
              <span>{tx('Κεντρικό email', 'Main email')}</span>
              <input
                type="email"
                value={draft.contactEmail}
                onChange={event => setField('contactEmail', event.target.value)}
              />
            </label>
            <label className="field">
              <span>{tx('Τηλέφωνο', 'Phone')}</span>
              <input
                value={draft.contactPhone}
                onChange={event => setField('contactPhone', event.target.value)}
              />
            </label>
            <label className="field">
              <span>{tx('Δυναμικότητα κλινών', 'Bed capacity')}</span>
              <input
                type="number"
                min="0"
                value={draft.bedCapacity}
                onChange={event => setField('bedCapacity', event.target.value)}
              />
            </label>
          </div>
        </FormSection>
        <FormSection title={tx('Αρχικός Hospital Admin', 'Initial Hospital Admin')}>
          <div className="platform-form-grid">
            <label className="field field-wide">
              <span>{tx('Ονοματεπώνυμο', 'Full name')} *</span>
              <input
                value={draft.adminFullName}
                onChange={event => setField('adminFullName', event.target.value)}
              />
            </label>
            <label className="field field-wide">
              <span>{tx('Email πρόσκλησης', 'Invitation email')} *</span>
              <input
                type="email"
                value={draft.adminEmail}
                onChange={event => setField('adminEmail', event.target.value)}
              />
              <small className={draft.adminEmail && !emailValid ? 'field-error' : 'field-hint'}>
                {tx('Χρησιμοποιείται μόνο για ασφαλή ενεργοποίηση.', 'Used only for secure activation.')}
              </small>
            </label>
          </div>
        </FormSection>
      </div>
      {formError && (
        <div className="platform-form-error" role="alert">
          {formError}
        </div>
      )}
    </ObserverDialog>
  ) : null

  const deleteDialog = deleteOrg ? (
    <ObserverDialog
      width="wide"
      eyebrow={tx('Κρίσιμη ενέργεια · Επαναταυτοποίηση', 'Critical action · Re-authentication')}
      title={tx('Οριστική διαγραφή οργανισμού', 'Delete organization permanently')}
      subtitle={tx('Η ενέργεια δεν αναιρείται.', 'This action cannot be undone.')}
      onClose={() => !deleting && setDeleteOrg(null)}
      footer={
        <Button
          className="button-destructive"
          loading={deleting}
          disabled={!deletePassword || deleteConfirm.trim().toUpperCase() !== deleteOrg.code?.toUpperCase()}
          onClick={confirmRemoveOrganization}
        >
          <Trash2 size={15} />
          {tx('Οριστική διαγραφή', 'Delete permanently')}
        </Button>
      }
    >
      <div className="destructive-warning">
        <Trash2 size={20} />
        <div>
          <strong>{tx('Θα διαγραφούν ο οργανισμός και όλα τα δεδομένα του.', 'The organization and all of its data will be deleted.')}</strong>
          <span>{tx('Η ενέργεια είναι οριστική.', 'This action is permanent.')}</span>
        </div>
      </div>
      <div className="platform-form-grid">
        <label className="field">
          <span>
            {tx('Πληκτρολόγησε τον κωδικό', 'Type the code')}: <b>{deleteOrg.code}</b>
          </span>
          <input value={deleteConfirm} onChange={event => setDeleteConfirm(event.target.value)} autoComplete="off" />
        </label>
        <label className="field">
          <span>{tx('Κωδικός Platform Owner', 'Platform Owner password')}</span>
          <input type="password" value={deletePassword} onChange={event => setDeletePassword(event.target.value)} autoComplete="new-password" />
        </label>
      </div>
    </ObserverDialog>
  ) : null

  if (!activeKey) {
    return (
      <Page
        title={tx('Dashboard Πλατφόρμας', 'Platform Dashboard')}
        subtitle={tx('Συνολική εικόνα του Limoxis Observer και των οργανισμών του.', 'Overview of Limoxis Observer and its organizations.')}
      >
        <div className="kpi-grid platform-kpi-grid">
          <article className="kpi-card">
            <span>{tx('Σύνολο οργανισμών', 'Organizations')}</span>
            <strong>{organizations.length}</strong>
            <small>{activeOrganizations} {tx('ενεργοί', 'active')}</small>
          </article>
          <article className="kpi-card">
            <span>{tx('Σύνολο χρηστών', 'Users')}</span>
            <strong>{loadingStats ? '—' : members.length}</strong>
            <small>{tx('σε όλους τους οργανισμούς', 'across all organizations')}</small>
          </article>
          <article className="kpi-card">
            <span>{tx('Ενεργά Demo', 'Active demos')}</span>
            <strong>{loadingStats ? '—' : activeDemos.length}</strong>
            <small>{expiringDemos.length} {tx('λήγουν ≤14 ημέρες', 'expire within 14 days')}</small>
          </article>
        </div>
        <section className="platform-center-section">
          <div className="platform-section-heading">
            <div>
              <h2>{tx('Demo που βρίσκονται σε εξέλιξη', 'Active demos')}</h2>
              <p>{tx('Παρακολούθηση διάρκειας και έγκαιρη ειδοποίηση πριν τη λήξη.', 'Track duration and upcoming expiry.')}</p>
            </div>
          </div>
          {activeDemos.length ? (
            <div className="platform-demo-list">
              {activeDemos.map(demo => {
                const progress = demoProgress(demo)
                return (
                  <button
                    type="button"
                    className="platform-demo-row platform-owner-clickable-row"
                    key={demo.id}
                    onClick={() => openDemoRecord(demo)}
                  >
                    <div>
                      <strong>{demo.organization?.name || demo.label}</strong>
                      <small>
                        {demo.contact_name || demo.contact_email || 'Demo access'} · {tx('έως', 'until')}{' '}
                        {new Date(demo.valid_until).toLocaleDateString(en ? 'en-GB' : 'el-GR')}
                      </small>
                    </div>
                    <div className="platform-demo-progress">
                      <div><span style={{ width: `${progress.pct}%` }} /></div>
                      <small className={progress.remaining <= 14 ? 'warning' : ''}>
                        {progress.remaining} {tx('ημέρες υπόλοιπο', 'days remaining')}
                      </small>
                    </div>
                  </button>
                )
              })}
            </div>
          ) : (
            <div className="empty-state platform-empty">
              <Clock3 size={22} />
              <strong>{tx('Δεν υπάρχουν ενεργά Demo', 'No active demos')}</strong>
            </div>
          )}
        </section>
      </Page>
    )
  }

  if (activeKey === 'organizations') {
    if (selectedOrg) {
      return (
        <>
          <PlatformOrganizationRecord
            organization={selectedOrg}
            language={language}
            initialTab={orgDetailTab}
            onTabChange={changeOrgTab}
            onBack={returnFromRecord}
            onEnter={() => enterOrganization(selectedOrg)}
            onDelete={() => requestRemoveOrganization(selectedOrg)}
            onChanged={async () => {
              await reloadMemberships()
              await refreshPlatformData()
            }}
            onOpenAnalysis={openOrganizationAnalysis}
          />
          {deleteDialog}
        </>
      )
    }

    return (
      <>
        <Page
          title={tx('Οργανισμοί', 'Organizations')}
          subtitle={tx('Διαχείριση οργανισμών, χρηστών, πρόσβασης και ανάλυσης.', 'Manage organizations, users, access and analytics.')}
          actions={<Button onClick={openCreate}>+ {tx('Νέος οργανισμός', 'New organization')}</Button>}
        >
          <div className="platform-registry-shell">
            <div className="platform-registry-navigation">
              <BackButton onClick={() => nav('/platform')} label={tx('Dashboard', 'Dashboard')} />
            </div>
            <FilterBar
              query={organizationQuery}
              onQueryChange={setOrganizationQuery}
              placeholder={tx('Αναζήτηση οργανισμού…', 'Search organization…')}
            />
            <div className="platform-center-section platform-registry-card">
              {filteredOrganizations.length ? (
                <div className="scroll-table">
                  <table className="data-table sticky-table">
                    <thead>
                      <tr>
                        <th>{tx('Οργανισμός', 'Organization')}</th>
                        <th>{tx('Κωδικός', 'Code')}</th>
                        <th>{tx('Πόλη / Περιφέρεια', 'City / Region')}</th>
                        <th>{tx('Χρήστες', 'Users')}</th>
                        <th>Hospital Admin</th>
                        <th>{tx('Κατάσταση', 'Status')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredOrganizations.map(org => (
                        <tr
                          key={org.id}
                          tabIndex={0}
                          className="platform-owner-clickable-row"
                          onClick={() => openOrganization(org)}
                          onKeyDown={event => {
                            if (event.key === 'Enter' || event.key === ' ') {
                              event.preventDefault()
                              openOrganization(org)
                            }
                          }}
                        >
                          <td><strong>{org.name}</strong></td>
                          <td>{org.code}</td>
                          <td>{org.city || '—'} · {org.region || '—'}</td>
                          <td>{memberCountByOrg[org.id] || 0}</td>
                          <td>
                            {hospitalAdminStatusByOrg[org.id] === 'active' ? (
                              <span className="status-badge active">{tx('Ενεργός', 'Active')}</span>
                            ) : hospitalAdminStatusByOrg[org.id] === 'disabled' ? (
                              <span className="status-badge danger">{tx('Σε παύση', 'Suspended')}</span>
                            ) : hospitalAdminStatusByOrg[org.id] === 'invited' ? (
                              <span className="status-badge temporary">{tx('Εκκρεμής', 'Pending')}</span>
                            ) : (
                              '—'
                            )}
                          </td>
                          <td>
                            <span className={`status-badge ${org.status === 'active' ? 'active' : 'danger'}`}>
                              {org.status === 'active' ? tx('Ενεργός', 'Active') : tx('Σε παύση', 'Suspended')}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="empty-state platform-empty">
                  <Building2 size={22} />
                  <strong>{tx('Δεν υπάρχουν οργανισμοί', 'No organizations')}</strong>
                  <span>{tx('Δεν βρέθηκαν οργανισμοί για τα επιλεγμένα φίλτρα.', 'No organizations match the selected filters.')}</span>
                </div>
              )}
            </div>
          </div>
        </Page>
        {createDialog}
      </>
    )
  }

  if (activeKey === 'demo') {
    if (selectedDemo) {
      return (
        <PlatformDemoRecord
          demo={selectedDemo}
          language={language}
          onBack={returnFromDemoRecord}
          onOpenDemo={() => {
            enterPlatformDemo()
            nav('/')
          }}
          onChanged={updated =>
            setDemos(current => current.map(item => (item.id === updated.id ? updated : item)))
          }
          onConverted={async organization => {
            setDemos(current => current.filter(item => item.id !== selectedDemo.id))
            await reloadMemberships()
            await refreshPlatformData()
            nav(`/platform#organizations?organization=${organization.id}&tab=details`, {
              state: { returnTo: '/platform#organizations' },
            })
          }}
          onDeleted={id => {
            setDemos(current => current.filter(item => item.id !== id))
            nav('/platform#demo')
          }}
        />
      )
    }

    return (
      <>
        <Page
          title="Demo"
          subtitle={tx('Απομονωμένο περιβάλλον παρουσίασης. Τα demo δεδομένα υπάρχουν μόνο εδώ και δεν αναμειγνύονται με πραγματικούς οργανισμούς.', 'Isolated presentation environment. Demo data exists only here and never mixes with production organizations.')}
          actions={
            <>
              <Button variant="secondary" className="platform-demo-enter-action" onClick={() => { enterPlatformDemo(); nav('/') }}>
                <LogIn size={15} />
                {tx('Είσοδος Demo', 'Enter Demo')}
              </Button>
              <Button onClick={() => setDemoOpen(true)}>+ {tx('Νέο Demo', 'New Demo')}</Button>
            </>
          }
        >
          <div className="platform-registry-shell">
            <div className="platform-registry-navigation">
              <BackButton onClick={() => nav('/platform')} label={tx('Dashboard', 'Dashboard')} />
            </div>
            <div className="platform-governance">
              <ShieldCheck size={17} />
              {tx('Τα Demo είναι πλήρως απομονωμένα από τα production δεδομένα.', 'Demo environments are fully isolated from production data.')}
            </div>
            <FilterBar query={demoQuery} onQueryChange={setDemoQuery} placeholder={tx('Αναζήτηση Demo…', 'Search demo…')} />
            <div className="platform-center-section platform-registry-card">
              {filteredDemos.length ? (
                <div className="scroll-table">
                  <table className="data-table sticky-table">
                    <thead>
                      <tr>
                        <th>{tx('Demo οργανισμός', 'Demo organization')}</th>
                        <th>{tx('Επικοινωνία', 'Contact')}</th>
                        <th>{tx('Έναρξη', 'Start')}</th>
                        <th>{tx('Λήξη', 'End')}</th>
                        <th>{tx('Κατάσταση', 'Status')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredDemos.map(demo => (
                        <tr
                          key={demo.id}
                          tabIndex={0}
                          className="platform-owner-clickable-row"
                          onClick={() => openDemoRecord(demo)}
                          onKeyDown={event => {
                            if (event.key === 'Enter' || event.key === ' ') {
                              event.preventDefault()
                              openDemoRecord(demo)
                            }
                          }}
                        >
                          <td>
                            <strong>{demo.organization?.name || demo.label}</strong>
                            <small>{demo.organization?.code || 'DEMO'}</small>
                          </td>
                          <td>{demo.contact_name || demo.contact_email || '—'}</td>
                          <td>{demo.valid_from || '—'}</td>
                          <td>{demo.valid_until || '—'}</td>
                          <td>
                            <span className={`status-badge ${demo.status === 'active' ? 'active' : demo.status === 'paused' ? 'temporary' : 'danger'}`}>
                              {demo.status === 'active' ? tx('Ενεργό', 'Active') : demo.status === 'paused' ? tx('Σε παύση', 'Paused') : tx('Ανενεργό', 'Inactive')}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="empty-state platform-empty">
                  <FlaskConical size={24} />
                  <strong>{tx('Δεν υπάρχουν Demo προσβάσεις', 'No demo access records')}</strong>
                  <span>{tx('Δεν βρέθηκαν Demo για τα επιλεγμένα φίλτρα.', 'No demos match the selected filters.')}</span>
                </div>
              )}
            </div>
          </div>
        </Page>
        {demoOpen && (
          <ObserverDialog
            width="wide"
            eyebrow="Platform Owner"
            title={tx('Νέο Demo', 'New Demo')}
            subtitle={tx('Χρονικά περιορισμένη πρόσβαση σε αποκλειστικά synthetic demo δεδομένα.', 'Time-limited access to synthetic demo data only.')}
            onClose={() => setDemoOpen(false)}
            footer={
              <SaveButton
                loading={demoSaving}
                disabled={!demoDraft.label.trim() || !demoDraft.contactEmail.trim() || !demoDraft.validUntil}
                onClick={createDemo}
              >
                {tx('Ενεργοποίηση Demo', 'Enable Demo')}
              </SaveButton>
            }
          >
            <div className="platform-form-shell">
              <FormSection title={tx('Ταυτότητα Demo οργανισμού', 'Demo organization identity')} subtitle={tx('Τα βασικά στοιχεία αποθηκεύονται στον απομονωμένο Demo οργανισμό.', 'Core details are stored on the isolated Demo organization.')}>
                <div className="platform-form-grid">
                  <label className="field field-wide">
                    <span>{tx('Επωνυμία οργανισμού / Prospect', 'Organization / Prospect name')} *</span>
                    <input autoFocus value={demoDraft.label} onChange={event => setDemoDraft(current => ({ ...current, label: event.target.value }))} />
                  </label>
                  <label className="field">
                    <span>{tx('Τύπος', 'Type')}</span>
                    <select value={demoDraft.type} onChange={event => setDemoDraft(current => ({ ...current, type: event.target.value }))}>
                      <option value="hospital">{tx('Νοσοκομείο', 'Hospital')}</option>
                      <option value="clinic">{tx('Κλινική', 'Clinic')}</option>
                      <option value="group">{tx('Όμιλος', 'Group')}</option>
                      <option value="other">{tx('Άλλο', 'Other')}</option>
                    </select>
                  </label>
                </div>
              </FormSection>
              <FormSection title={tx('Τοποθεσία & λειτουργία', 'Location & operations')}>
                <div className="platform-form-grid">
                  <label className="field"><span>{tx('Περιφέρεια', 'Region')}</span><select value={demoDraft.region} onChange={event => setDemoDraft(current => ({ ...current, region: event.target.value }))}><option value="">{tx('Επιλογή…', 'Select…')}</option>{GREEK_REGIONS.map(region => <option key={region}>{region}</option>)}</select></label>
                  <label className="field field-wide"><span>{tx('Υγειονομική Περιφέρεια (ΥΠΕ)', 'Health Region')}</span><select value={demoDraft.healthRegion} onChange={event => setDemoDraft(current => ({ ...current, healthRegion: event.target.value }))}><option value="">{tx('Επιλογή…', 'Select…')}</option>{HEALTH_REGIONS.map(region => <option key={region}>{region}</option>)}</select></label>
                  <LocationAutocompleteField label={tx('Πόλη','City')} value={demoDraft.city} onChange={value=>setDemoDraft(current=>({...current,city:value}))} options={CITY_OPTIONS} />
                  <LocationAutocompleteField label={tx('Χώρα','Country')} value={demoDraft.country} onChange={value=>setDemoDraft(current=>({...current,country:value}))} options={COUNTRY_OPTIONS} />
                  <label className="field"><span>{tx('Τηλέφωνο', 'Phone')}</span><input value={demoDraft.contactPhone} onChange={event => setDemoDraft(current => ({ ...current, contactPhone: event.target.value }))} /></label>
                  <label className="field"><span>{tx('Δυναμικότητα κλινών', 'Bed capacity')}</span><input type="number" min="0" value={demoDraft.bedCapacity} onChange={event => setDemoDraft(current => ({ ...current, bedCapacity: event.target.value }))} /></label>
                </div>
              </FormSection>
              <FormSection title={tx('Υπεύθυνος Demo & πρόσβαση', 'Demo contact & access')}>
                <div className="platform-form-grid platform-demo-contact-grid">
                  <label className="field field-wide"><span>{tx('Υπεύθυνος επικοινωνίας', 'Contact person')}</span><input value={demoDraft.contactName} onChange={event => setDemoDraft(current => ({ ...current, contactName: event.target.value }))} /></label>
                  <label className="field field-wide"><span>{tx('Email πρόσκλησης', 'Invitation email')} *</span><input type="email" value={demoDraft.contactEmail} onChange={event => setDemoDraft(current => ({ ...current, contactEmail: event.target.value }))} /></label>
                  <ManualDateField label={tx('Έναρξη', 'Start')} value={demoDraft.validFrom} onChange={value => setDemoDraft(current => ({ ...current, validFrom: value }))} />
                  <ManualDateField label={`${tx('Λήξη', 'End')} *`} value={demoDraft.validUntil} onChange={value => setDemoDraft(current => ({ ...current, validUntil: value }))} />
                </div>
              </FormSection>
            </div>
          </ObserverDialog>
        )}
      </>
    )
  }

  return <AnalysisPage platform organizations={organizations} />
}
