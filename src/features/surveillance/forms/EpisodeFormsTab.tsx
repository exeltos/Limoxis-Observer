import { useEffect, useMemo, useRef } from 'react'
import { EmptyState } from '../../../design-system/EmptyState'
import { useLanguage } from '../../../core/i18n/LanguageContext'
import { FormsTabContext, useFormsTabState } from './FormSection'
import { visibleEpisodeFormSections } from './formsRegistry'
import './episodeForms.css'
import type { AnyRecord } from '../../../types/featureTypes'
import type { Handler } from '../surveillanceTypes'

// «Φόρμες & ερωτηματολόγια»: every form connected to the episode in one tab of collapsible
// sections. The sections come from the registry (formsRegistry.js); this component only
// owns which are open. `openRequest` ({ id, nonce }) opens one from outside, e.g. the NEWS2
// chip of the record header opens «Κλίμακες».
// `withoutAdmission` renders only the sections that make sense for a patient with no admission,
// as plain sections of the page (no panel title of their own).
const SHEET_SECTIONS = new Set(['bundles', 'epiQuestionnaire'])

interface EpisodeFormsTabProps {
  ctx: AnyRecord
  forms: AnyRecord
  openRequest?: { id: string, nonce: unknown } | null
  withoutAdmission?: boolean
}
export function EpisodeFormsTab({ ctx, forms, openRequest = null, withoutAdmission = false }: EpisodeFormsTabProps) {
  const { t } = useLanguage()
  const sections = useMemo(
    () =>
      visibleEpisodeFormSections(ctx)
        .filter(section => !withoutAdmission || section.withoutAdmission)
        // The device bundles and the epidemiological history are steps of the surveillance sheet; the tab does not
        // repeat them (owner, 8/11/2026). The printed record still lists them.
        .filter(section => !SHEET_SECTIONS.has(section.id)),
    [ctx, withoutAdmission],
  )
  const { value, openSection } = useFormsTabState()
  // The tab shows every section open, its actions in a «⋯» (owner, 8/11/2026).
  const flatValue = useMemo(() => ({ ...value, flat: true }), [value])
  const handled = useRef<unknown>(null)
  useEffect(() => {
    if (!openRequest?.id || handled.current === openRequest.nonce) return
    handled.current = openRequest.nonce
    openSection(openRequest.id)
    // The section is on screen after the next paint; bring it into view.
    requestAnimationFrame(() => {
      document.querySelector(`.episode-forms [data-section="${openRequest.id}"]`)?.scrollIntoView?.({ block: 'start' })
    })
  }, [openRequest, openSection])
  const content =
    sections.length === 0 ? null : (
      <FormsTabContext.Provider value={flatValue}>
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
  // No title of its own: the tab already says «Φόρμες & ερωτηματολόγια».
  return (
    <section className="record-tab-panel episode-forms-panel" aria-label={t('episodeForms.title')}>
      <div className="record-tab-panel-body">
        {content || <EmptyState title={t('episodeForms.noSectionsTitle')} description={t('episodeForms.noSectionsText')} />}
      </div>
    </section>
  )
}
