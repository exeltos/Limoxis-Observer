import { bundlesSection } from './sections/bundlesSection'
import { scalesSection } from './sections/scalesSection'
import { notifiableSection } from './sections/notifiableSection'
import { incidentsSection } from './sections/incidentsSection'
import { outbreakSection } from './sections/outbreakSection'
import { exposureSourceSection } from './sections/exposureSourceSection'
import { epiQuestionnaireSection } from './sections/epiQuestionnaireSection'

// The registered sections of the «Φόρμες & ερωτηματολόγια» tab, in display order.
//
// A section is a plain object:
//   id            unique key (also the deep link: openSection('scales'))
//   order         position in the tab (10, 20 … leave gaps for later sections)
//   canSee(ctx)   whether this user / hospital sees the section at all (capability, module)
//   load(ctx)     optional, async: reads the section's data once per episode; the result is
//                 given back as `section.value` (reload with `reload()`); the tab loads it even
//                 while the section is collapsed, and the printed report reuses it
//   Component     ({ ctx, section, reload, openSection }) => <FormSection …/> | null
//   buildReport   optional, (ctx, section) => report section | null for the printed record
//
// A later builder (questionnaires) adds its object with registerEpisodeFormSection() or to the
// array below; nothing else in the tab changes. See docs/EPISODE_FORMS_TAB.md.
const REGISTERED = [bundlesSection, scalesSection, notifiableSection, incidentsSection, epiQuestionnaireSection, outbreakSection, exposureSourceSection]

export function registerEpisodeFormSection(definition) {
  if (!definition?.id || !definition.Component) throw new Error('A form section needs an id and a Component.')
  const index = REGISTERED.findIndex(item => item.id === definition.id)
  if (index >= 0) REGISTERED[index] = definition
  else REGISTERED.push(definition)
}

export const episodeFormSections = () => [...REGISTERED].sort((a, b) => (a.order ?? 100) - (b.order ?? 100))
export const visibleEpisodeFormSections = ctx => episodeFormSections().filter(section => !section.canSee || section.canSee(ctx))
