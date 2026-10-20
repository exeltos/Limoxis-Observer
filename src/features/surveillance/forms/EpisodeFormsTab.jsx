import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { RecordTabPanel } from '../../../design-system/RecordTabPanel'
import { EmptyState } from '../../../design-system/EmptyState'
import { useLanguage } from '../../../core/i18n/LanguageContext'
import { FormsTabContext } from './FormSection'
import { visibleEpisodeFormSections } from './formsRegistry'
import './episodeForms.css'

// «Φόρμες & ερωτηματολόγια»: every form connected to the episode in one tab of collapsible
// sections. The sections come from the registry (formsRegistry.js); this component only
// owns which are open. `openRequest` ({ id, nonce }) opens one from outside, e.g. the NEWS2
// chip of the record header opens «Κλίμακες».
// `withoutAdmission` renders only the sections that make sense for a patient with no admission,
// as plain sections of the page (no panel title of their own).
export function EpisodeFormsTab({ ctx, forms, openRequest = null, withoutAdmission = false }) {
  const { t } = useLanguage()
  const [open, setOpen] = useState({})
  const touched = useRef(new Set())
  const sections = useMemo(
    () => visibleEpisodeFormSections(ctx).filter(section => !withoutAdmission || section.withoutAdmission),
    [ctx, withoutAdmission],
  )
  const toggle = useCallback(id => {
    touched.current.add(id)
    setOpen(current => ({ ...current, [id]: !current[id] }))
  }, [])
  const offer = useCallback((id, wantOpen, attentionNow) => {
    setOpen(current => {
      if (!(id in current)) return { ...current, [id]: wantOpen }
      if (attentionNow && !touched.current.has(id) && !current[id]) return { ...current, [id]: true }
      return current
    })
  }, [])
  const openSection = useCallback(id => {
    touched.current.add(id)
    setOpen(current => ({ ...current, [id]: true }))
  }, [])
  const handled = useRef(null)
  useEffect(() => {
    if (!openRequest?.id || handled.current === openRequest.nonce) return
    handled.current = openRequest.nonce
    openSection(openRequest.id)
    // The section is on screen after the next paint; bring it into view.
    requestAnimationFrame(() => {
      document.querySelector(`.episode-forms [data-section="${openRequest.id}"]`)?.scrollIntoView?.({ block: 'start' })
    })
  }, [openRequest, openSection])
  const value = useMemo(() => ({ isOpen: id => Boolean(open[id]), toggle, offer }), [open, toggle, offer])
  const content =
    sections.length === 0 ? null : (
      <FormsTabContext.Provider value={value}>
        <div className="episode-forms">
          {sections.map(section => (
            <section.Component
              key={section.id}
              ctx={ctx}
              section={forms?.data?.[section.id] || { loading: false, value: undefined }}
              reload={() => forms?.reload?.(section.id)}
              openSection={openSection}
            />
          ))}
        </div>
      </FormsTabContext.Provider>
    )
  if (withoutAdmission) return content
  return (
    <RecordTabPanel className="episode-forms-panel" title={t('episodeForms.title')} subtitle={t('episodeForms.subtitle')}>
      {content || <EmptyState title={t('episodeForms.noSectionsTitle')} description={t('episodeForms.noSectionsText')} />}
    </RecordTabPanel>
  )
}
