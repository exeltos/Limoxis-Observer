import { Pencil, Save, Send, X } from 'lucide-react'
import { Button } from '../../design-system/Button'
import { LocationAutocompleteField } from '../../design-system/LocationAutocompleteField'
import { CITY_OPTIONS, COUNTRY_OPTIONS } from '../../core/reference/locationOptions'
import { OrganizationIdentitySection } from './OrganizationIdentitySection'
import { DetailList } from '../../design-system/DetailList'
import { StatusBadge } from '../../design-system/StatusBadge'
import { FormSection, GREEK_REGIONS, HEALTH_REGIONS, organizationTypeLabel, toDraft } from './platformOrganizationShared'

// «Στοιχεία» of an organization record (owner, 9/11/2026): one totals line, then identity, location and contact
// in one read-only card (Επεξεργασία opens the form), the screen lock and identity, and the Hospital Admin
// invitation when there is none. The package lives in its own tab. The state and the actions stay in
// PlatformOrganizationRecord (ctx).
export function PlatformOrganizationDetailsTab({ ctx }) {
  const { admins, canSave, draft, editing, inviteAdmin, language, loadingUsers, newAdmin, onChanged, record, saveOrganization, saving, setDraft, setEditing, setNewAdmin, setRecord, tx, users, working } = ctx
  const activeUsers = users.filter(user => user.status === 'active').length
  const adminStatus = admin => admin.status === 'active' ? ['success', tx('Ενεργός', 'Active')] : admin.status === 'disabled' ? ['danger', tx('Σε παύση', 'Suspended')] : ['warning', tx('Εκκρεμής', 'Pending')]
  const country = record.country === 'GR' ? tx('Ελλάδα', 'Greece') : record.country
  const totals = [
    organizationTypeLabel(record.type, language),
    loadingUsers ? '…' : tx(`${activeUsers} / ${users.length} ενεργοί χρήστες`, `${activeUsers} / ${users.length} active users`),
    loadingUsers ? null : admins.length === 1 ? tx('1 Διαχειριστής Νοσοκομείου', '1 Hospital Admin') : tx(`${admins.length} Διαχειριστές Νοσοκομείου`, `${admins.length} Hospital Admins`),
    record.bed_capacity != null && record.bed_capacity !== '' ? tx(`${record.bed_capacity} κλίνες`, `${record.bed_capacity} beds`) : null,
  ].filter(Boolean)
  const adminValue = loadingUsers ? '…' : admins.length ? admins.map(admin => { const [tone, label] = adminStatus(admin); return <span key={admin.userId} className="platform-org-admin">{admin.name}<StatusBadge tone={tone}>{label}</StatusBadge><small>{admin.email || admin.username || '—'}</small></span> }) : null
  return (
          <div className="platform-owner-details platform-organization-record-form">
            <p className="platform-org-totals">{totals.map((item, index) => <span key={index}>{item}</span>)}</p>
            <div
              className={`platform-record-edit-fieldset ${editing ? 'is-editing' : 'is-locked'}`}
            >
              <div className="platform-form-shell">
                {!editing && (
                  <section className="platform-form-section platform-org-details-card">
                    <header>
                      <div><strong>{tx('Στοιχεία οργανισμού', 'Organization details')}</strong></div>
                      <div className="platform-form-section-actions">
                        <Button variant="secondary" onClick={() => setEditing(true)}>
                          <Pencil size={15} />
                          {tx('Επεξεργασία', 'Edit')}
                        </Button>
                      </div>
                    </header>
                    <DetailList className="platform-org-details" sections={[{ key: 'details', items: [
                      { key: 'name', label: tx('Επωνυμία', 'Name'), value: record.name },
                      { key: 'code', label: tx('Κωδικός / πρόθεμα', 'Code / Hospital Prefix'), value: record.code },
                      { key: 'type', label: tx('Τύπος', 'Type'), value: organizationTypeLabel(record.type, language) },
                      { key: 'region', label: tx('Περιφέρεια', 'Region'), value: record.region },
                      { key: 'health', label: tx('Υγειονομική Περιφέρεια (ΥΠΕ)', 'Health Region'), value: record.health_region },
                      { key: 'city', label: tx('Πόλη / χώρα', 'City / country'), value: [record.city, country].filter(Boolean).join(', ') },
                      { key: 'email', label: 'Email', value: record.contact_email },
                      { key: 'phone', label: tx('Τηλέφωνο', 'Phone'), value: record.contact_phone },
                      { key: 'beds', label: tx('Δυναμικότητα κλινών', 'Bed capacity'), value: record.bed_capacity ?? '' },
                      { key: 'admin', label: tx('Διαχειριστής Νοσοκομείου', 'Hospital Admin'), value: adminValue, wide: true },
                    ] }]} />
                  </section>
                )}
                {editing && <>
                <FormSection
                  title={tx('Ταυτότητα οργανισμού', 'Organization identity')}
                  actions={
                    (
                      <>
                        <Button
                          variant="secondary"
                          onClick={() => {
                            setDraft(toDraft(record))
                            setEditing(false)
                          }}
                          disabled={saving}
                        >
                          <X size={15} />
                          {tx('Ακύρωση', 'Cancel')}
                        </Button>
                        <Button onClick={saveOrganization} disabled={!canSave || saving || working}>
                          <Save size={15} />
                          {saving ? tx('Αποθήκευση…', 'Saving…') : tx('Αποθήκευση', 'Save')}
                        </Button>
                      </>
                    )
                  }
                >
                  <div className="platform-form-grid">
                    <label className="field field-wide">
                      <span>{tx('Επωνυμία', 'Name')} *</span>
                      <input
                        value={draft.name}
                        readOnly={!editing}
                        onChange={e => setDraft(x => ({ ...x, name: e.target.value }))}
                      />
                    </label>
                    <label className="field">
                      <span>{tx('Κωδικός / πρόθεμα', 'Code / Hospital Prefix')}</span>
                      <input value={draft.code} readOnly />
                    </label>
                    <label className="field">
                      <span>{tx('Τύπος', 'Type')}</span>
                      <select
                        value={draft.type}
                        disabled={!editing}
                        onChange={e => setDraft(x => ({ ...x, type: e.target.value }))}
                      >
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
                      <span>{tx('Περιφέρεια', 'Region')}</span>
                      <select
                        value={draft.region}
                        disabled={!editing}
                        onChange={e => setDraft(x => ({ ...x, region: e.target.value }))}
                      >
                        <option value="">—</option>
                        {GREEK_REGIONS.map(item => (
                          <option key={item}>{item}</option>
                        ))}
                      </select>
                    </label>
                    <label className="field field-wide">
                      <span>{tx('Υγειονομική Περιφέρεια (ΥΠΕ)', 'Health Region')}</span>
                      <select
                        value={draft.healthRegion}
                        disabled={!editing}
                        onChange={e => setDraft(x => ({ ...x, healthRegion: e.target.value }))}
                      >
                        <option value="">—</option>
                        {HEALTH_REGIONS.map(item => (
                          <option key={item}>{item}</option>
                        ))}
                      </select>
                    </label>
                    <LocationAutocompleteField
                      label={tx('Πόλη', 'City')}
                      value={draft.city}
                      onChange={value => setDraft(x => ({ ...x, city: value }))}
                      options={CITY_OPTIONS}
                      disabled={!editing}
                    />
                    <LocationAutocompleteField
                      label={tx('Χώρα', 'Country')}
                      value={draft.country}
                      onChange={value => setDraft(x => ({ ...x, country: value }))}
                      options={COUNTRY_OPTIONS}
                      disabled={!editing}
                    />
                    <label className="field">
                      <span>{tx('Δυναμικότητα κλινών', 'Bed capacity')}</span>
                      <input
                        type="number"
                        min="0"
                        value={draft.bedCapacity}
                        readOnly={!editing}
                        onChange={e => setDraft(x => ({ ...x, bedCapacity: e.target.value }))}
                      />
                    </label>
                  </div>
                </FormSection>
                <FormSection title={tx('Στοιχεία επικοινωνίας', 'Contact details')}>
                  <div className="platform-form-grid">
                    <label className="field field-wide">
                      <span>Email</span>
                      <input
                        type="email"
                        value={draft.contactEmail}
                        readOnly={!editing}
                        onChange={e => setDraft(x => ({ ...x, contactEmail: e.target.value }))}
                      />
                    </label>
                    <label className="field">
                      <span>{tx('Τηλέφωνο', 'Phone')}</span>
                      <input
                        value={draft.contactPhone}
                        readOnly={!editing}
                        onChange={e => setDraft(x => ({ ...x, contactPhone: e.target.value }))}
                      />
                    </label>
                  </div>
                </FormSection>
                </>}
                <OrganizationIdentitySection
                  organization={record}
                  language={language}
                  onSaved={saved => {
                    setRecord(r => ({ ...r, ...saved }))
                    onChanged?.({ ...record, ...saved })
                  }}
                />
                {!loadingUsers && !admins.length && (
                <FormSection title={tx('Διαχειριστής Νοσοκομείου', 'Hospital Admin')}>
                    <div className="platform-admin-create">
                      <div className="platform-form-grid">
                        <label className="field">
                          <span>
                            {tx(
                              'Ονοματεπώνυμο νέου Διαχειριστή Νοσοκομείου',
                              'New Hospital Admin full name',
                            )}
                          </span>
                          <input
                            value={newAdmin.name}
                            onChange={e => setNewAdmin(x => ({ ...x, name: e.target.value }))}
                          />
                        </label>
                        <label className="field field-wide">
                          <span>{tx('Email πρόσκλησης', 'Invitation email')}</span>
                          <input
                            type="email"
                            value={newAdmin.email}
                            onChange={e => setNewAdmin(x => ({ ...x, email: e.target.value }))}
                          />
                        </label>
                      </div>
                      <Button
                        variant="secondary"
                        disabled={
                          working ||
                          newAdmin.name.trim().length < 2 ||
                          !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newAdmin.email.trim())
                        }
                        onClick={inviteAdmin}
                      >
                        <Send size={15} />
                        {tx(
                          'Ορισμός Διαχειριστή Νοσοκομείου & πρόσκληση',
                          'Assign Hospital Admin & invite',
                        )}
                      </Button>
                    </div>
                </FormSection>
                )}
              </div>
            </div>
          </div>
  )
}
