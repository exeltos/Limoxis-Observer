import { useMemo } from 'react'
import { SearchableSelect } from '../../design-system/SearchableSelect'
import { useLanguage } from '../../core/i18n/LanguageContext'
import { useDepartments, useLibraries } from '../management/useLibraries'
import type { AnyRecord } from '../../types/featureTypes'
import type { PreventionDepartment } from './preventionCloud'

// The shared pieces of the Prevention editors: the department pick and the
// lists (waste categories, antiseptics, vaccines) read from the central
// libraries (Management > Libraries).

// Texts every Prevention SearchableSelect shares.
export function selectTexts(en: boolean, { clear = false }: { clear?: boolean } = {}) {
  return { emptyLabel: en ? 'No match' : 'Καμία αντιστοιχία', clearLabel: clear ? (en ? 'Clear' : 'Καθαρισμός') : '', customLabel: (text: string) => (en ? `Use «${text}»` : `Χρήση «${text}»`) }
}

// Departments in one shape ({id,el,en}). The options come from the central
// departments; the list the screen loaded (with the ids the cloud services and
// the patient-days lookup use) fills in while they load. A record stores the
// department's Greek name, so a name the library no longer has stays shown.
export function usePreventionDepartments(fallback: PreventionDepartment[] = [], current = ''): PreventionDepartment[] {
  // The central departments (useLibraries, JavaScript): {id, name, nameEn}.
  const departments: AnyRecord[] = useDepartments().departments
  return useMemo(() => {
    const known = new Map(fallback.map(item => [item.el, item]))
    const rows = departments.length ? departments.map(dep => ({ ...known.get(dep.name), id: known.get(dep.name)?.id || dep.id, el: dep.name, en: dep.nameEn || known.get(dep.name)?.en || dep.name })) : fallback
    return current && !rows.some(item => item.el === current) ? [...rows, { id: '', el: current, en: known.get(current)?.en || current }] : rows
  }, [departments, fallback, current])
}

// One department pick for every Prevention editor; extra options (the whole
// hospital scope of antiseptics) come first.
interface PreventionDepartmentFieldProps { label?: string; value?: string; onChange: (value: string) => void; departments?: PreventionDepartment[]; fixed?: boolean; extraOptions?: { value: string; label: string; description?: string }[]; placeholder?: string; clearable?: boolean }
export function PreventionDepartmentField({ label, value, onChange, departments = [], fixed = false, extraOptions = [], placeholder, clearable = true }: PreventionDepartmentFieldProps) {
  const { language } = useLanguage()
  const en = language === 'en'
  const rows = usePreventionDepartments(departments, value)
  const options = [...extraOptions, ...rows.map(item => ({ value: item.el, label: en ? item.en || item.el : item.el, description: en ? undefined : item.en && item.en !== item.el ? item.en : undefined }))]
  return <SearchableSelect className="prevention-department-field" label={label || (en ? 'Department *' : 'Τμήμα *')} value={value || ''} options={options} onChange={(next: string) => onChange(next || '')} disabled={fixed} placeholder={placeholder || (en ? 'Select department' : 'Επιλέξτε τμήμα')} {...selectTexts(en, { clear: clearable && !fixed })} />
}

// A central library's items as {id,code,el,en,metadata}. Items the screen
// already loaded (the cloud rows with their ids and metadata, or the demo's own
// list) keep their id, so stored records still match; the local list is used
// only while the library is empty.
export function usePreventionLibrary(key: string, fallback: AnyRecord[] = []): AnyRecord[] {
  const { libraries } = useLibraries()
  const central: AnyRecord[] | undefined = (libraries as Record<string, AnyRecord[]> | undefined)?.[key]
  return useMemo(() => {
    if (!central?.length) return fallback
    return central.map(item => {
      const known = fallback.find(x => x.el === item.value || (item.code && x.code === item.code))
      return known ? { ...known, el: item.el, en: item.en || item.el } : { id: item.meta?.id || item.code || item.value, code: item.code || '', el: item.el, en: item.en || item.el, metadata: item.meta || {} }
    })
  }, [central, fallback])
}
