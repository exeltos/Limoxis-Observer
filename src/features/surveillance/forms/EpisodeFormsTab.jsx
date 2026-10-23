import { useEffect, useMemo, useRef, useState } from 'react'
import { EmptyState } from '../../../design-system/EmptyState'
import { useLanguage } from '../../../core/i18n/LanguageContext'
import { FormsTabContext, useFormsTabState } from './FormSection'
import { visibleEpisodeFormSections } from './formsRegistry'
import './episodeForms.css'

const SECTION_LABEL_KEYS = {
  bundles: 'episodeForms.bundles.title',
  scales: 'episodeForms.scales.title',
  notifiable: 'episodeForms.notifiable.title',
  incidents: 'episodeForms.incidents.title',
  epiQuestionnaire: 'epiQuestionnaire.sectionTitle',
}
const sectionLabel = (section, t) =>
  section.navLabel?.(t) ||
  section.title?.(t) ||
  t(SECTION_LABEL_KEYS[section.id] || `episodeForms.${section.id}.title`)

// «Φόρμες & ερωτηματολόγια»: every form connected to the episode in one tab of collapsible
// sections. The sections come from the registry (formsRegistry.js); this component only
// owns which are open. `openRequest` ({ id, nonce }) opens one from outside, e.g. the NEWS2
// chip of the record header opens «Κλίμακες».
// `withoutAdmission` renders only the sections that make sense for a patient with no admission,
// as plain sections of the page (no panel title of their own).
export function EpisodeFormsTab({ ctx, forms, openRequest = null, withoutAdmission = false }) {
  const { t } = useLanguage()
  const sections = useMemo(
    () => visibleEpisodeFormSections(ctx).filter(section => !withoutAdmission || section.withoutAdmission),
    [ctx, withoutAdmission],
  )
  // Outbreak/source-exposure are contextual read-only notices, not collapsible form sections.
  // Keep them in the content flow but out of the form navigation strip.
  const navigableSections = useMemo(
    () => sections.filter(section => SECTION_LABEL_KEYS[section.id]),
    [sections],
  )
  const { value, openSection } = useFormsTabState()
  const handled = useRef(null)
  const [activeSection, setActiveSection] = useState(navigableSections[0]?.id || '')

  useEffect(() => {
    if (!navigableSections.some(section => section.id === activeSection))
      setActiveSection(navigableSections[0]?.id || '')
  }, [navigableSections, activeSection])

  const revealSection = id => {
    openSection(id)
    setActiveSection(id)
    requestAnimationFrame(() => {
      document
        .querySelector(`.episode-forms [data-section="${id}"]`)
        ?.scrollIntoView?.({ block: 'start', behavior: 'smooth' })
    })
  }

  useEffect(() => {
    if (!openRequest?.id || handled.current === openRequest.nonce) return
    handled.current = openRequest.nonce
    revealSection(openRequest.id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openRequest])

  useEffect(() => {
    if (withoutAdmission || typeof IntersectionObserver === 'undefined' || !navigableSections.length)
      return
    const nodes = navigableSections
      .map(section => document.querySelector(`.episode-forms [data-section="${section.id}"]`))
      .filter(Boolean)
    if (!nodes.length) return
    const observer = new IntersectionObserver(
      entries => {
        const visible = entries
          .filter(entry => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0]
        if (visible?.target?.dataset?.section) setActiveSection(visible.target.dataset.section)
      },
      { rootMargin: '-18% 0px -68% 0px', threshold: [0, 0.25, 0.5] },
    )
    nodes.forEach(node => observer.observe(node))
    return () => observer.disconnect()
  }, [navigableSections, withoutAdmission])

  const content =
    sections.length === 0 ? null : (
      <FormsTabContext.Provider value={value}>
        {!withoutAdmission && navigableSections.length > 1 && (
          <div className="episode-forms-nav-shell">
            <nav className="episode-forms-nav" aria-label={t('episodeForms.title')}>
              {navigableSections.map(section => {
                const active = section.id === activeSection
                return (
                  <button
                    key={section.id}
                    type="button"
                    className={`episode-forms-nav-item${active ? ' is-active' : ''}`}
                    aria-current={active ? 'location' : undefined}
                    onClick={() => revealSection(section.id)}
                  >
                    <span>{sectionLabel(section, t)}</span>
                  </button>
                )
              })}
            </nav>
          </div>
        )}
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
      <div className="record-tab-panel-body episode-forms-panel-body">
        {content || <EmptyState title={t('episodeForms.noSectionsTitle')} description={t('episodeForms.noSectionsText')} />}
      </div>
    </section>
  )
}
