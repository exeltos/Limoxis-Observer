import { ObserverDialog } from '../../design-system/ObserverDialog'
import { ActionButton } from '../../design-system/ActionButton'
import { formatDay } from '../../core/i18n/formatDay'
import { ITEM_CATEGORIES, noteText, prefilledExpiryRows, quantityShort } from './controlExpiry'
import { categoryLabel } from './ControlExpiryEntry'

// A department's list of medicines and supplies, to read without opening the
// editor: what should be there, what the latest check found and when it expires.
// The same rows the next check opens with (prefilledExpiryRows).
export function ControlDepartmentListDialog({ record, department, language = 'el', onClose }) {
  const en = language === 'en'
  const rows = prefilledExpiryRows(record, department)
  const order = [...ITEM_CATEGORIES.map(([key]) => key), '']
  const groups = order.map((key) => [key, rows.filter((row) => (ITEM_CATEGORIES.some(([k]) => k === row.category) ? row.category : '') === key)]).filter(([, entries]) => entries.length)
  const count = (key) => rows.filter((row) => row.category === key).length
  const subtitle = [record.title && (en ? record.titleEn || record.title : record.title), count('medicine') && `${count('medicine')} ${en ? 'medicines' : 'φάρμακα'}`, count('supply') && `${count('supply')} ${en ? 'supplies' : 'υλικά'}`].filter(Boolean).join(' · ')
  return <ObserverDialog eyebrow={en ? 'Department list' : 'Λίστα τμήματος'} title={department} subtitle={subtitle} width="wide" onClose={onClose} footer={<ActionButton label={en ? 'Close' : 'Κλείσιμο'} tone="neutral" onClick={onClose}>{en ? 'Close' : 'Κλείσιμο'}</ActionButton>}>
    {!rows.length ? <div className="inline-empty">{en ? 'This department has no list yet.' : 'Το τμήμα δεν έχει ακόμη λίστα.'}</div>
      : <div className="control-department-list">{groups.map(([key, entries]) => <section key={key || 'other'}>
        {groups.length > 1 && <h4 className="control-expiry-group-title">{categoryLabel(key, language)} <small>{entries.length}</small></h4>}
        <table className="data-table control-department-list-table">
          <thead><tr><th>{en ? 'Medicine / supply' : 'Φάρμακο / υλικό'}</th><th>{en ? 'Expected' : 'Προβλεπόμενα'}</th><th>{en ? 'Found' : 'Βρέθηκαν'}</th><th>{en ? 'Expiry' : 'Λήξη'}</th><th>{en ? 'Note' : 'Σημείωση'}</th></tr></thead>
          <tbody>{entries.map((row, index) => <tr key={`${row.item}-${index}`}>
            <td><strong>{row.item}</strong>{row.ingredient && <small>{row.ingredient}</small>}</td>
            <td>{row.expected || '—'}</td>
            <td className={quantityShort(row) ? 'control-department-list-short' : ''}>{row.quantity || '—'}</td>
            <td>{row.expiry ? formatDay(row.expiry, language) : '—'}</td>
            <td>{noteText(row, language) || ''}</td>
          </tr>)}</tbody>
        </table>
      </section>)}</div>}
  </ObserverDialog>
}
