import { BedDouble, Building2, KeyRound, Pencil, Save, Send, Users, X } from 'lucide-react'
import { Button } from '../../design-system/Button'
import { LocationAutocompleteField } from '../../design-system/LocationAutocompleteField'
import { CITY_OPTIONS, COUNTRY_OPTIONS } from '../../core/reference/locationOptions'
import { OperatingProfileSection } from './OperatingProfileSection'
import { OrganizationIdentitySection } from './OrganizationIdentitySection'
import { MetricCard } from '../../design-system/MetricCard'
import { FormSection, GREEK_REGIONS, HEALTH_REGIONS, organizationTypeLabel, toDraft } from './platformOrganizationShared'

// «Details & Settings» of an organization record: identity, location, contact, the Hospital Admin
// and the supplier e-mail sender. The state and the actions stay in PlatformOrganizationRecord (ctx).
export function PlatformOrganizationDetailsTab({ ctx }) {
  const { admins, canSave, draft, editing, inviteAdmin, language, loadingUsers, newAdmin, onChanged, record, saveOrganization, saving, setDraft, setEditing, setNewAdmin, setRecord, tx, users, working } = ctx
  return (
          <div className="platform-owner-details platform-organization-record-form">
            <div className="module-summary-strip">
              <MetricCard
                icon={Building2}
                value={organizationTypeLabel(record.type, language)}
                label={tx('Τύπος', 'Type')}
              />
              <MetricCard
                icon={Users}
                value={loadingUsers ? '…' : users.length}
                label={tx('Χρήστες', 'Users')}
              />
              <MetricCard
                icon={KeyRound}
                value={loadingUsers ? '…' : admins.length}
                label={tx('Διαχειριστές Νοσοκομείου', 'Hospital admins')}
              />
              <MetricCard
                icon={BedDouble}
                value={record.bed_capacity ?? '—'}
                label={tx('Κλίνες', 'Beds')}
              />
            </div>
            <div
              className={`platform-record-edit-fieldset ${editing ? 'is-editing' : 'is-locked'}`}
            >
              <div className="platform-form-shell">
                <FormSection
                  title={tx('Ταυτότητα οργανισμού', 'Organization identity')}
                  actions={
                    editing ? (
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
                    ) : (
                      <Button variant="secondary" onClick={() => setEditing(true)}>
                        <Pencil size={15} />
                        {tx('Επεξεργασία', 'Edit')}
                      </Button>
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
                <OperatingProfileSection
                  organization={record}
                  language={language}
                  onSaved={saved => {
                    setRecord(r => ({ ...r, ...saved }))
                    onChanged?.({ ...record, ...saved })
                  }}
                />
                <OrganizationIdentitySection
                  organization={record}
                  language={language}
                  onSaved={saved => {
                    setRecord(r => ({ ...r, ...saved }))
                    onChanged?.({ ...record, ...saved })
                  }}
                />
                <FormSection
                  title="Hospital Admin"
                  subtitle={tx(
                    'Ο Διαχειριστής Νοσοκομείου μπορεί να οριστεί ή να αλλάξει και από την καρτέλα Χρήστες & Ρόλοι.',
                    'The Hospital Admin can also be assigned or changed from Users & Roles.',
                  )}
                >
                  {loadingUsers ? (
                    <div className="inline-empty">{tx('Φόρτωση…', 'Loading…')}</div>
                  ) : admins.length ? (
                    <div className="platform-admin-summary">
                      {admins.map(admin => (
                        <div key={admin.userId} className="platform-admin-summary-row">
                          <div>
                            <strong>{admin.name}</strong>
                            <span>
                              {admin.email || '—'} · {admin.username}
                            </span>
                          </div>
                          <span
                            className={`status-badge ${admin.status === 'active' ? 'active' : admin.status === 'disabled' ? 'danger' : 'temporary'}`}
                          >
                            {admin.status === 'active'
                              ? tx('Ενεργός', 'Active')
                              : admin.status === 'disabled'
                                ? tx('Σε παύση', 'Suspended')
                                : tx('Εκκρεμής', 'Pending')}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
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
                  )}
                </FormSection>
              </div>
            </div>
          </div>
  )
}
