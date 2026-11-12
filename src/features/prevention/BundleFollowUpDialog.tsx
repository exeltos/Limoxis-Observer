import { useMemo, useState } from 'react'
import { ObserverDialog, DialogActions } from '../../design-system/ObserverDialog'
import { ManualDateField } from '../../design-system/ManualDateField'
import { ModeSwitch } from '../../design-system/ModeSwitch'
import { useLanguage } from '../../core/i18n/LanguageContext'
import { useAuth } from '../../core/auth/AuthContext'
import { controlActorFromAuth } from '../controls/controlActor'

export function BundleFollowUpDialog({ item, value, onClose, onSave }) {
  const { language } = useLanguage()
  const en = language === 'en'
  const { profile, user } = useAuth()
  const actor = useMemo(() => controlActorFromAuth({ profile, user }), [profile, user])
  const [draft, setDraft] = useState(() => ({
    status: value?.status || '',
    date: value?.date || '',
    comment: value?.comment || '',
  }))
  const valid = Boolean(draft.status && draft.date)
  const save = () =>
    onSave?.({
      ...draft,
      reviewedBy: actor.name,
      reviewedById: actor.id,
      reviewedAt: new Date().toISOString(),
    })
  return (
    <ObserverDialog
      width="standard"
      eyebrow={en ? 'Bundle follow-up' : 'Επανέλεγχος δέσμης μέτρων'}
      title={item?.label || ''}
      subtitle={
        item?.note ||
        (en
          ? 'Record the result of the follow-up review.'
          : 'Καταγράψτε το αποτέλεσμα του επανελέγχου.')
      }
      onClose={onClose}
      footer={
        <DialogActions
          onSave={save}
          disabled={!valid}
          saveLabel={en ? 'Save follow-up' : 'Αποθήκευση επανελέγχου'}
        />
      }
    >
      <div className="bundle-followup-form">
        <div className="field bundle-followup-status-field">
          <span className="lo-field-label">{en ? 'Status *' : 'Κατάσταση *'}</span>
          <ModeSwitch
            ariaLabel={en ? 'Status' : 'Κατάσταση'}
            value={draft.status}
            onChange={status => setDraft(current => ({ ...current, status }))}
            options={[
              { value: 'resolved', label: en ? 'Corrected' : 'Διορθώθηκε' },
              { value: 'open', label: en ? 'Still pending' : 'Παραμένει' },
              { value: 'not_applicable', label: en ? 'No longer applicable' : 'Δεν εφαρμόζεται πλέον' },
            ]}
          />
        </div>
        <ManualDateField
          label={en ? 'Follow-up date *' : 'Ημερομηνία επανελέγχου *'}
          value={draft.date}
          onChange={date => setDraft(current => ({ ...current, date }))}
        />
        <label className="field bundle-followup-comment">
          <span className="lo-field-label">{en ? 'Comment / action' : 'Σχόλιο / ενέργεια'}</span>
          <textarea
            rows="4"
            value={draft.comment}
            onChange={e => setDraft(current => ({ ...current, comment: e.target.value }))}
            placeholder={
              en
                ? 'Optional note about the corrective action or current situation'
                : 'Προαιρετική σημείωση για τη διορθωτική ενέργεια ή την τρέχουσα κατάσταση'
            }
          />
        </label>
      </div>
    </ObserverDialog>
  )
}
