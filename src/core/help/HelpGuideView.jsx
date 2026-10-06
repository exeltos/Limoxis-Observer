import { useMemo, useState } from 'react'
import { Check, Lock } from 'lucide-react'
import { guideContent, pickGuide } from './helpGuide'
import { ADDONS, ADDON_LABELS, CORE_MODULES, MODULES, OPERATING_PROFILES, OPTIONAL_MODULES, PROFILE_LABELS } from '../organization/operatingProfile'
import { roleLabel } from '../permissions/roleLabels'
import './helpGuide.css'

const ui = {
  el: {
    eyebrow: 'ΟΔΗΓΟΣ ΕΝΑΡΞΗΣ', tabs: { journey: 'Το ταξίδι', where: 'Πού βρίσκομαι;', packages: 'Πακέτα & βήματα', modules: 'Ενότητες', roles: 'Ρόλοι', faq: 'Συχνά προβλήματα' },
    who: 'Ποιος', place: 'Πού', done: 'Έχει ολοκληρωθεί όταν', situation: 'Αν…', action: 'Τότε…', stage: 'Στάδιο',
    forWhom: 'Για ποιον', goal: 'Στόχος', steps: 'Βήματα με τη σειρά', firstWeek: 'Έλεγχος πρώτης εβδομάδας', success: 'Πώς καταλαβαίνετε ότι πετύχατε', recipe: 'Συνηθισμένος συνδυασμός',
    what: 'Τι είναι', users: 'Ποιοι την χρησιμοποιούν', needs: 'Χρειάζεται και', analysis: 'Ανάλυση και report', first: 'Πρώτο βήμα',
    current: 'Τρέχον πακέτο του νοσοκομείου', on: 'Ανοιχτή στο νοσοκομείο σας', off: 'Κλειδωμένη στο νοσοκομείο σας', always: 'Πάντα ανοιχτή', addon: 'Πρόσθετο', offHint: 'Αν τη χρειάζεστε, ζητήστε από τον Platform Owner να την ξεκλειδώσει.',
    included: 'Περιλαμβάνεται από', role: 'Ρόλος', does: 'Τι κάνει',
  },
  en: {
    eyebrow: 'GETTING STARTED', tabs: { journey: 'The journey', where: 'Where am I?', packages: 'Packages & steps', modules: 'Modules', roles: 'Roles', faq: 'Common problems' },
    who: 'Who', place: 'Where', done: 'It is done when', situation: 'If…', action: 'Then…', stage: 'Stage',
    forWhom: 'Who it is for', goal: 'Goal', steps: 'Steps in order', firstWeek: 'First-week check', success: 'How you know it worked', recipe: 'Common combination',
    what: 'What it is', users: 'Who uses it', needs: 'Also needs', analysis: 'Analysis and report', first: 'First step',
    current: 'Hospital’s current package', on: 'On for your hospital', off: 'Locked for your hospital', always: 'Always on', addon: 'Add-on', offHint: 'If you need it, ask the Platform Owner to unlock it.',
    included: 'Included from', role: 'Role', does: 'What it does',
  },
}

// Getting-started guide inside the Help Center. Same content as the PDF manual (helpGuide.js).
export function HelpGuideView({ language = 'el', hospitalMode = false, moduleEnabled = () => true, currentProfile = null }) {
  const lang = language === 'en' ? 'en' : 'el'
  const t = ui[lang]
  const g = useMemo(() => pickGuide(guideContent, lang), [lang])
  const [tab, setTab] = useState('journey')
  const [pkg, setPkg] = useState(OPERATING_PROFILES.includes(currentProfile) ? currentProfile : 'basic')
  const name = id => (MODULES[id] ? MODULES[id][lang] : ADDON_LABELS[id][lang])
  const selected = g.packages.find(item => item.id === pkg) || g.packages[0]

  const status = id => {
    if (!hospitalMode) return null
    if (CORE_MODULES.includes(id)) return { tone: 'on', text: t.always }
    return moduleEnabled(id) ? { tone: 'on', text: t.on } : { tone: 'off', text: t.off }
  }

  return <main className="manual-special manual-start">
    <span className="manual-step-label">{t.eyebrow}</span>
    <h1>{g.title}</h1>
    <p>{g.subtitle}</p>

    <div className="manual-chapter-tabs" role="tablist" aria-label={g.title}>
      {Object.keys(t.tabs).map((id, i) => <button key={id} role="tab" aria-selected={tab === id} className={tab === id ? 'active' : ''} onClick={() => setTab(id)}><span>{i + 1}</span>{t.tabs[id]}</button>)}
    </div>

    {tab === 'journey' && <div className="manual-start-list">
      <p className="manual-start-lead">{g.intro.purpose}</p>
      {g.journey.map((stage, index) => <section key={stage.id} className="manual-start-card">
        <h3><span>{index + 1}</span>{stage.title}</h3>
        <div className="manual-start-meta"><span><b>{t.who}:</b> {stage.who}</span><span><b>{t.place}:</b> {stage.where}</span></div>
        <ol>{stage.steps.map(step => <li key={step}>{step}</li>)}</ol>
        <p className="manual-start-done"><Check size={14} /><span><b>{t.done}:</b> {stage.done}</span></p>
      </section>)}
    </div>}

    {tab === 'where' && <table className="manual-start-table">
      <thead><tr><th>{t.situation}</th><th>{t.action}</th></tr></thead>
      <tbody>{g.whereAmI.map(([a, b]) => <tr key={a}><td>{a}</td><td>{b}</td></tr>)}</tbody>
    </table>}

    {tab === 'packages' && <div className="manual-start-list">
      <div className="manual-start-pkgs" role="tablist" aria-label={t.tabs.packages}>
        {OPERATING_PROFILES.map(id => <button key={id} role="tab" aria-selected={pkg === id} className={pkg === id ? 'active' : ''} onClick={() => setPkg(id)}>{PROFILE_LABELS[id][lang]}{currentProfile === id && <em>{t.current}</em>}</button>)}
      </div>
      <p><b>{t.forWhom}:</b> {selected.forWhom}</p>
      <p><b>{t.goal}:</b> {selected.goal}</p>
      <h4>{t.steps}</h4>
      <ol className="manual-start-steps">{selected.steps.map(step => <li key={step.title}><b>{step.title}</b><small>{step.who}</small><span>{step.text}</span></li>)}</ol>
      <h4>{t.firstWeek}</h4>
      <ul className="manual-start-checks">{selected.firstWeek.map(item => <li key={item}><Check size={13} />{item}</li>)}</ul>
      <p className="manual-start-done"><Check size={14} /><span><b>{t.success}:</b> {selected.success}</span></p>
      {g.recipes.map(recipe => <section key={recipe.id} className="manual-start-card">
        <h3>{t.recipe}: {recipe.title}</h3>
        <p>{recipe.when}</p>
        <ol>{recipe.steps.map(step => <li key={step}>{step}</li>)}</ol>
      </section>)}
    </div>}

    {tab === 'modules' && <div className="manual-start-list">
      {[...CORE_MODULES, ...OPTIONAL_MODULES, ...ADDONS].map(id => {
        const m = g.modules[id], state = status(id)
        return <section key={id} className="manual-start-card">
          <h3>{name(id)}{state && <em className={`manual-start-state ${state.tone}`}>{state.tone === 'off' ? <Lock size={11} /> : <Check size={11} />}{state.text}</em>}{!state && !MODULES[id] && <em className="manual-start-state">{t.addon}</em>}{!state && MODULES[id] && !CORE_MODULES.includes(id) && <em className="manual-start-state">{t.included}: {PROFILE_LABELS[MODULES[id].from][lang]}</em>}</h3>
          <dl>
            <dt>{t.what}</dt><dd>{m.what}</dd>
            <dt>{t.users}</dt><dd>{m.users}</dd>
            {m.needs && <><dt>{t.needs}</dt><dd>{m.needs.map(name).join(', ')}</dd></>}
            <dt>{t.analysis}</dt><dd>{m.analysis}</dd>
            <dt>{t.first}</dt><dd>{m.start}</dd>
          </dl>
          {state?.tone === 'off' && <p className="manual-start-hint">{t.offHint}</p>}
        </section>
      })}
    </div>}

    {tab === 'roles' && <>
      <table className="manual-start-table">
        <thead><tr><th>{t.role}</th><th>{t.does}</th></tr></thead>
        <tbody>{g.roles.map(([id, text]) => <tr key={id}><td><b>{roleLabel(id, lang)}</b></td><td>{text}</td></tr>)}</tbody>
      </table>
      <p className="manual-start-lead">{g.rolesNote}</p>
    </>}

    {tab === 'faq' && <div className="manual-start-list">
      {g.faq.map(item => <section key={item.q} className="manual-start-card">
        <h3>{item.q}</h3>
        <ul>{item.a.map(line => <li key={line}>{line}</li>)}</ul>
      </section>)}
    </div>}
  </main>
}
