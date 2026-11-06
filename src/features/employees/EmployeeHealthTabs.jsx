import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FilterBar, FilterSelect } from '../../design-system/FilterBar'
import { ObserverDialog } from '../../design-system/ObserverDialog'
import { useEmployeeSubRecords } from './useEmployeeSubRecords'
import { useRecordTabExport } from './employeeTabExport'
import {
  loadOccupationalVisitsAsync,
  loadVaccinationsAsync,
  loadExposureIncidentsAsync,
} from './employeeSubRecordsService'
import {
  SectionTitle,
  Empty,
  State,
  Pager,
  RegistryFilter,
  useRegistryRows,
  statusClass,
  label,
} from './employeeRecordShared'

// Occupational-health tabs of the employee record: health overview, visits,
// vaccinations and exposure incidents.

// Occupational health, vaccinations and exposure incidents share one tab (same permission) and one list, with a
// «Kind» filter: a visit opens its own page, the others their details.
const EXPOSURE_TYPES = { needlestick: ['Τρύπημα βελόνας', 'Needlestick'], sharps_object: ['Άλλο αιχμηρό αντικείμενο', 'Other sharps object'], mucocutaneous: ['Έκθεση βλεννογόνου', 'Mucocutaneous exposure'], non_intact_skin: ['Έκθεση μη ακέραιου δέρματος', 'Non-intact skin exposure'], other: ['Άλλο', 'Other'] }
const FOLLOW_UPS = { pending: ['Εκκρεμεί', 'Pending'], scheduled: ['Προγραμματισμένη', 'Scheduled'], completed: ['Ολοκληρώθηκε', 'Completed'], closed: ['Έκλεισε', 'Closed'] }
const KIND_FOR_SECTION = { visits: 'all', vaccinations: 'vaccination', exposures: 'exposure' }
export function EmployeeHealthTab({
  employee,
  t,
  language,
  fmt,
  organizationId,
  initialSection = 'visits',
  onExportItems,
}) {
  const en = language === 'en'
  const navigate = useNavigate()
  const visits = useEmployeeSubRecords(loadOccupationalVisitsAsync, organizationId, employee.dbId, employee.id)
  const vaccinations = useEmployeeSubRecords(loadVaccinationsAsync, organizationId, employee.dbId, employee.id)
  const exposures = useEmployeeSubRecords(loadExposureIncidentsAsync, organizationId, employee.dbId, employee.id)
  const [kind, setKind] = useState(KIND_FOR_SECTION[initialSection] || 'all')
  const [selected, setSelected] = useState(null)
  const pick = (map, value) => map[value]?.[en ? 1 : 0] || value || '—'
  // Imported visits carry no fitness («pending» on a completed visit says nothing) and repeat the person's next
  // follow-up on every visit: the follow-up is shown on the latest visit only.
  const latestVisitId = useMemo(() => [...visits.data].sort((x, y) => String(y.date || '').localeCompare(String(x.date || '')))[0]?.id, [visits.data])
  const visitDetail = row => [row.fitStatus && !(row.fitStatus === 'pending' && row.status === 'completed') ? label(row.fitStatus, t) : '', row.followUpDate && row.id === latestVisitId && `${en ? 'Next check' : 'Επόμενος έλεγχος'} ${fmt(row.followUpDate)}`].filter(Boolean).join(' · ')
  const all = useMemo(() => [
    ...visits.data.map(row => ({ kind: 'visit', id: `v-${row.id}`, date: row.date, title: label(row.type, t), detail: visitDetail(row), status: label(row.status, t), tone: statusClass(row.status), raw: row })),
    ...vaccinations.data.map(row => ({ kind: 'vaccination', id: `x-${row.id}`, date: row.date, title: row.vaccine || '—', detail: [row.dose, row.validUntil && `${en ? 'Valid until' : 'Ισχύει έως'} ${fmt(row.validUntil)}`].filter(Boolean).join(' · '), status: label(row.status, t), tone: statusClass(row.status), raw: row })),
    ...exposures.data.map(row => ({ kind: 'exposure', id: `e-${row.id}`, date: row.incidentDate, title: pick(EXPOSURE_TYPES, row.exposureType), detail: pick(FOLLOW_UPS, row.followUpStatus), status: row.status === 'open' ? (en ? 'Open' : 'Ανοικτό') : (en ? 'Closed' : 'Κλειστό'), tone: row.status === 'open' ? 'temporary' : '', raw: row })),
  ].sort((a, b) => String(b.date || '').localeCompare(String(a.date || ''))), [visits.data, vaccinations.data, exposures.data, en, fmt, t, latestVisitId]) // eslint-disable-line react-hooks/exhaustive-deps
  const byKind = useMemo(() => (kind === 'all' ? all : all.filter(row => row.kind === kind)), [all, kind])
  const registry = useRegistryRows(byKind)
  const kindLabel = value => ({ visit: en ? 'Visit' : 'Επίσκεψη', vaccination: en ? 'Vaccination' : 'Εμβολιασμός', exposure: en ? 'Exposure' : 'Έκθεση' })[value]
  const loading = visits.loading || vaccinations.loading || exposures.loading
  const failed = visits.error || vaccinations.error || exposures.error
  const exportDialog = useRecordTabExport({
    onExportItems, id: 'occupational', label: { el: 'Ιατρός Εργασίας', en: 'Occupational health' }, employee, language, count: registry.filtered.length,
    table: () => ({ headers: en ? ['Date', 'Kind', 'Description', 'Details', 'Status'] : ['Ημερομηνία', 'Είδος', 'Περιγραφή', 'Λεπτομέρειες', 'Κατάσταση'], rows: registry.filtered.map(row => [fmt(row.date), kindLabel(row.kind), row.title, row.detail, row.status]) }),
  })
  const open = row => { if (row.kind === 'visit') navigate(`/occupational-health/visits/${encodeURIComponent(row.raw.id)}`); else setSelected(row) }
  return (
    <section className="record-section record-secondary-registry employee-health-tab">
      {exportDialog}
      <SectionTitle
        title={en ? 'Occupational health' : 'Ιατρός Εργασίας'}
        subtitle={en ? 'Visits, vaccinations and exposure incidents of the employee, newest first.' : 'Επισκέψεις, εμβολιασμοί και περιστατικά έκθεσης του εργαζομένου, τα νεότερα πρώτα.'}
      />
      <State loading={loading} error={failed} language={language} onRetry={() => { void visits.reload(); void vaccinations.reload(); void exposures.reload() }} />
      {!loading && !failed && (
        <FilterBar
          query={registry.query}
          onQueryChange={registry.setQuery}
          placeholder={en ? 'Search records...' : 'Αναζήτηση εγγραφών...'}
          activeAdvancedCount={kind !== 'all' ? 1 : 0}
          onClear={() => { registry.setQuery(''); setKind('all') }}
          resultCount={registry.filtered.length}
        >
          <FilterSelect label={en ? 'Kind' : 'Είδος'} value={kind} onChange={setKind}>
            <option value="all">{en ? 'All' : 'Όλα'}</option>
            <option value="visit">{en ? 'Visits' : 'Επισκέψεις'}</option>
            <option value="vaccination">{en ? 'Vaccinations' : 'Εμβολιασμοί'}</option>
            <option value="exposure">{en ? 'Exposure incidents' : 'Περιστατικά έκθεσης'}</option>
          </FilterSelect>
        </FilterBar>
      )}
      {!loading && !failed && (registry.filtered.length ? (
        <>
          <div className="scroll-table">
            <table className="data-table sticky-table record-table-clickable">
              <thead>
                <tr>
                  <th>{en ? 'Date' : 'Ημερομηνία'}</th>
                  <th>{en ? 'Kind' : 'Είδος'}</th>
                  <th>{en ? 'Description' : 'Περιγραφή'}</th>
                  <th>{en ? 'Details' : 'Λεπτομέρειες'}</th>
                  <th>{en ? 'Status' : 'Κατάσταση'}</th>
                </tr>
              </thead>
              <tbody>
                {registry.paging.paged.map(row => (
                  <tr key={row.id} tabIndex={0} onClick={() => open(row)} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); open(row) } }}>
                    <td>{fmt(row.date)}</td>
                    <td>{kindLabel(row.kind)}</td>
                    <td><strong>{row.title}</strong></td>
                    <td>{row.detail || '—'}</td>
                    <td><span className={`status-badge ${row.tone}`}>{row.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pager paging={registry.paging} total={registry.filtered.length} language={language} />
        </>
      ) : (
        <Empty language={language} title={en ? 'No records' : 'Δεν υπάρχουν εγγραφές'} />
      ))}
      {selected && (
        <ObserverDialog width="wide" eyebrow={kindLabel(selected.kind)} title={selected.title} subtitle={fmt(selected.date)} onClose={() => setSelected(null)}>
          <div className="detail-grid">
            {(selected.kind === 'vaccination'
              ? [[en ? 'Dose' : 'Δόση', selected.raw.dose], [en ? 'Lot number' : 'Αριθμός παρτίδας', selected.raw.lotNumber], [en ? 'Valid until' : 'Ισχύει έως', fmt(selected.raw.validUntil)], [en ? 'Status' : 'Κατάσταση', selected.status]]
              : [[en ? 'Device / source' : 'Συσκευή / πηγή', selected.raw.deviceOrSource], [en ? 'Body site' : 'Σημείο έκθεσης', selected.raw.bodySite], [en ? 'Follow-up status' : 'Κατάσταση παρακολούθησης', selected.detail], [en ? 'Follow-up due' : 'Επόμενος επανέλεγχος', fmt(selected.raw.followUpDueAt)]]
            ).map(([name, value]) => (
              <div className="detail-item" key={name}><span>{name}</span><strong>{value || '—'}</strong></div>
            ))}
          </div>
          {(selected.raw.clinicalNotes || selected.raw.notes) && (
            <div className="source-truth-note"><div><strong>{en ? 'Notes' : 'Σημειώσεις'}</strong><span>{selected.raw.clinicalNotes || selected.raw.notes}</span></div></div>
          )}
        </ObserverDialog>
      )}
    </section>
  )
}

export function EmployeeOccupationalTab({ employee, t, language, fmt, organizationId }) {
  const state = useEmployeeSubRecords(
    loadOccupationalVisitsAsync,
    organizationId,
    employee.dbId,
    employee.id,
  )
  const [selected, setSelected] = useState(null)
  const registry = useRegistryRows(state.data)
  const paging = registry.paging
  return (
    <section className="record-section record-secondary-registry">
      <SectionTitle
        title={language === 'en' ? 'Occupational Health' : 'Ιατρός Εργασίας'}
        subtitle={
          language === 'en'
            ? 'Visits are read from the Occupational Health clinical record.'
            : 'Οι επισκέψεις αντλούνται από το κλινικό αρχείο Ιατρού Εργασίας.'
        }
      />
      <State {...state} language={language} onRetry={state.reload} />
      {!state.loading && !state.error && (
        <RegistryFilter
          query={registry.query}
          setQuery={registry.setQuery}
          language={language}
          count={registry.filtered.length}
        />
      )}
      {!state.loading &&
        !state.error &&
        (registry.filtered.length ? (
          <>
            <div className="scroll-table">
              <table className="data-table sticky-table record-table-clickable">
                <thead>
                  <tr>
                    <th>{language === 'en' ? 'Visit date' : 'Ημερομηνία'}</th>
                    <th>{language === 'en' ? 'Visit type' : 'Τύπος επίσκεψης'}</th>
                    <th>{language === 'en' ? 'Fitness' : 'Καταλληλότητα'}</th>
                    <th>{language === 'en' ? 'Follow-up' : 'Επανέλεγχος'}</th>
                    <th>{language === 'en' ? 'Status' : 'Κατάσταση'}</th>
                  </tr>
                </thead>
                <tbody>
                  {paging.paged.map(row => (
                    <tr
                      key={row.id}
                      tabIndex={0}
                      onClick={() => setSelected(row)}
                      onKeyDown={e => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          setSelected(row)
                        }
                      }}
                    >
                      <td>{fmt(row.date)}</td>
                      <td>
                        <strong>{label(row.type, t)}</strong>
                      </td>
                      <td>{label(row.fitStatus, t)}</td>
                      <td>{fmt(row.followUpDate)}</td>
                      <td>
                        <span className={`status-badge ${statusClass(row.status)}`}>
                          {label(row.status, t)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pager paging={paging} total={registry.filtered.length} language={language} />
          </>
        ) : (
          <Empty
            language={language}
            title={
              language === 'en'
                ? 'No occupational-health visits'
                : 'Δεν υπάρχουν επισκέψεις Ιατρού Εργασίας'
            }
          />
        ))}
      {selected && (
        <ObserverDialog
          width="wide"
          eyebrow={language === 'en' ? 'Occupational Health' : 'Ιατρός Εργασίας'}
          title={`${fmt(selected.date)} · ${label(selected.type, t)}`}
          onClose={() => setSelected(null)}
        >
          <div className="detail-grid">
            <div className="detail-item">
              <span>{language === 'en' ? 'Status' : 'Κατάσταση'}</span>
              <strong>{label(selected.status, t)}</strong>
            </div>
            <div className="detail-item">
              <span>{language === 'en' ? 'Fitness status' : 'Καταλληλότητα'}</span>
              <strong>{label(selected.fitStatus, t)}</strong>
            </div>
            <div className="detail-item">
              <span>{language === 'en' ? 'Follow-up date' : 'Ημερομηνία επανελέγχου'}</span>
              <strong>{fmt(selected.followUpDate)}</strong>
            </div>
          </div>
          <div className="source-truth-note">
            <div>
              <strong>
                {language === 'en' ? 'Notes / treatment' : 'Σημειώσεις / αντιμετώπιση'}
              </strong>
              <span>{selected.clinicalNotes || '—'}</span>
            </div>
          </div>
        </ObserverDialog>
      )}
    </section>
  )
}

export function EmployeeVaccinationsTab({ employee, t, language, fmt, organizationId }) {
  const state = useEmployeeSubRecords(
    loadVaccinationsAsync,
    organizationId,
    employee.dbId,
    employee.id,
  )
  const [selected, setSelected] = useState(null)
  const registry = useRegistryRows(state.data)
  const paging = registry.paging
  return (
    <section className="record-section record-secondary-registry">
      <SectionTitle
        title={language === 'en' ? 'Vaccinations' : 'Εμβολιασμοί'}
        subtitle={
          language === 'en'
            ? 'Vaccination records come from the staff vaccination register.'
            : 'Τα στοιχεία αντλούνται από το μητρώο εμβολιασμών προσωπικού.'
        }
      />
      <State {...state} language={language} onRetry={state.reload} />
      {!state.loading && !state.error && (
        <RegistryFilter
          query={registry.query}
          setQuery={registry.setQuery}
          language={language}
          count={registry.filtered.length}
        />
      )}
      {!state.loading &&
        !state.error &&
        (registry.filtered.length ? (
          <>
            <div className="scroll-table">
              <table className="data-table sticky-table record-table-clickable">
                <thead>
                  <tr>
                    <th>{language === 'en' ? 'Vaccine' : 'Εμβόλιο'}</th>
                    <th>{language === 'en' ? 'Dose' : 'Δόση'}</th>
                    <th>{language === 'en' ? 'Date' : 'Ημερομηνία'}</th>
                    <th>{language === 'en' ? 'Valid until' : 'Ισχύει έως'}</th>
                    <th>{language === 'en' ? 'Status' : 'Κατάσταση'}</th>
                  </tr>
                </thead>
                <tbody>
                  {paging.paged.map(row => (
                    <tr
                      key={row.id}
                      tabIndex={0}
                      onClick={() => setSelected(row)}
                      onKeyDown={e => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          setSelected(row)
                        }
                      }}
                    >
                      <td>
                        <strong>{row.vaccine || '—'}</strong>
                      </td>
                      <td>{row.dose || '—'}</td>
                      <td>{fmt(row.date)}</td>
                      <td>{fmt(row.validUntil)}</td>
                      <td>
                        <span className={`status-badge ${statusClass(row.status)}`}>
                          {label(row.status, t)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pager paging={paging} total={registry.filtered.length} language={language} />
          </>
        ) : (
          <Empty
            language={language}
            title={language === 'en' ? 'No vaccination records' : 'Δεν υπάρχουν εμβολιασμοί'}
          />
        ))}
      {selected && (
        <ObserverDialog
          width="wide"
          eyebrow={language === 'en' ? 'Staff vaccination' : 'Εμβολιασμός προσωπικού'}
          title={selected.vaccine || '—'}
          subtitle={fmt(selected.date)}
          onClose={() => setSelected(null)}
        >
          <div className="detail-grid">
            <div className="detail-item">
              <span>{language === 'en' ? 'Dose' : 'Δόση'}</span>
              <strong>{selected.dose || '—'}</strong>
            </div>
            <div className="detail-item">
              <span>{language === 'en' ? 'Lot number' : 'Αριθμός παρτίδας'}</span>
              <strong>{selected.lotNumber || '—'}</strong>
            </div>
            <div className="detail-item">
              <span>{language === 'en' ? 'Valid until' : 'Ισχύει έως'}</span>
              <strong>{fmt(selected.validUntil)}</strong>
            </div>
            <div className="detail-item">
              <span>{language === 'en' ? 'Status' : 'Κατάσταση'}</span>
              <strong>{label(selected.status, t)}</strong>
            </div>
          </div>
          {selected.clinicalNotes && (
            <div className="source-truth-note">
              <div>
                <strong>{language === 'en' ? 'Notes' : 'Σημειώσεις'}</strong>
                <span>{selected.clinicalNotes}</span>
              </div>
            </div>
          )}
        </ObserverDialog>
      )}
    </section>
  )
}

export function EmployeeExposureIncidentsTab({ employee, language, fmt, organizationId }) {
  const en = language === 'en'
  const state = useEmployeeSubRecords(
    loadExposureIncidentsAsync,
    organizationId,
    employee.dbId,
    employee.id,
  )
  const [selected, setSelected] = useState(null)
  const registry = useRegistryRows(state.data)
  const paging = registry.paging
  const typeLabel = value =>
    ({
      needlestick: ['Τρύπημα βελόνας', 'Needlestick'],
      sharps_object: ['Άλλο αιχμηρό αντικείμενο', 'Other sharps object'],
      mucocutaneous: ['Έκθεση βλεννογόνου', 'Mucocutaneous exposure'],
      non_intact_skin: ['Έκθεση μη ακέραιου δέρματος', 'Non-intact skin exposure'],
      other: ['Άλλο', 'Other'],
    })[value]?.[en ? 1 : 0] ||
    value ||
    '—'
  const followUpLabel = value =>
    ({
      pending: ['Εκκρεμεί', 'Pending'],
      scheduled: ['Προγραμματισμένη', 'Scheduled'],
      completed: ['Ολοκληρώθηκε', 'Completed'],
      closed: ['Έκλεισε', 'Closed'],
    })[value]?.[en ? 1 : 0] ||
    value ||
    '—'
  return (
    <section className="record-section record-secondary-registry">
      <SectionTitle
        title={en ? 'Occupational exposure' : 'Επαγγελματική έκθεση'}
        subtitle={
          en
            ? 'Needlestick, sharps and mucocutaneous exposure incidents and their follow-up.'
            : 'Περιστατικά τρυπήματος βελόνας, αιχμηρών αντικειμένων και έκθεσης βλεννογόνου, με την παρακολούθησή τους.'
        }
      />
      <State {...state} language={language} onRetry={state.reload} />
      {!state.loading && !state.error && (
        <RegistryFilter
          query={registry.query}
          setQuery={registry.setQuery}
          language={language}
          count={registry.filtered.length}
        />
      )}
      {!state.loading &&
        !state.error &&
        (registry.filtered.length ? (
          <>
            <div className="scroll-table">
              <table className="data-table sticky-table record-table-clickable">
                <thead>
                  <tr>
                    <th>{en ? 'Date' : 'Ημερομηνία'}</th>
                    <th>{en ? 'Exposure type' : 'Τύπος έκθεσης'}</th>
                    <th>{en ? 'Follow-up' : 'Παρακολούθηση'}</th>
                    <th>{en ? 'Status' : 'Κατάσταση'}</th>
                  </tr>
                </thead>
                <tbody>
                  {paging.paged.map(row => (
                    <tr
                      key={row.id}
                      tabIndex={0}
                      onClick={() => setSelected(row)}
                      onKeyDown={e => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          setSelected(row)
                        }
                      }}
                    >
                      <td>{fmt(row.incidentDate)}</td>
                      <td>
                        <strong>{typeLabel(row.exposureType)}</strong>
                      </td>
                      <td>{followUpLabel(row.followUpStatus)}</td>
                      <td>
                        <span
                          className={`status-badge ${row.status === 'open' ? 'temporary' : ''}`}
                        >
                          {row.status === 'open'
                            ? en
                              ? 'Open'
                              : 'Ανοικτό'
                            : en
                              ? 'Closed'
                              : 'Κλειστό'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pager paging={paging} total={registry.filtered.length} language={language} />
          </>
        ) : (
          <Empty
            language={language}
            title={
              en ? 'No exposure incidents recorded' : 'Δεν έχουν καταγραφεί περιστατικά έκθεσης'
            }
          />
        ))}
      {selected && (
        <ObserverDialog
          width="wide"
          eyebrow={en ? 'Occupational exposure' : 'Επαγγελματική έκθεση'}
          title={`${fmt(selected.incidentDate)} · ${typeLabel(selected.exposureType)}`}
          onClose={() => setSelected(null)}
        >
          <div className="detail-grid">
            <div className="detail-item">
              <span>{en ? 'Device / source' : 'Συσκευή / πηγή'}</span>
              <strong>{selected.deviceOrSource || '—'}</strong>
            </div>
            <div className="detail-item">
              <span>{en ? 'Body site' : 'Σημείο έκθεσης'}</span>
              <strong>{selected.bodySite || '—'}</strong>
            </div>
            <div className="detail-item">
              <span>{en ? 'Follow-up status' : 'Κατάσταση παρακολούθησης'}</span>
              <strong>{followUpLabel(selected.followUpStatus)}</strong>
            </div>
            <div className="detail-item">
              <span>{en ? 'Follow-up due' : 'Επόμενος επανέλεγχος'}</span>
              <strong>{fmt(selected.followUpDueAt)}</strong>
            </div>
          </div>
          <div className="source-truth-note">
            <div>
              <strong>{en ? 'Notes' : 'Σημειώσεις'}</strong>
              <span>{selected.notes || '—'}</span>
            </div>
          </div>
        </ObserverDialog>
      )}
    </section>
  )
}
