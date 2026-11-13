import { useEffect, useState, type MouseEvent } from 'react'
import { Link } from 'react-router-dom'
import { Activity, ArrowRight, BadgeCheck, Building2, CalendarDays, ChartColumn, ClipboardCheck, FlaskConical, Globe, HandHeart, Languages, LogIn, Mail, PenLine, Phone, Settings2, ShieldCheck, Sparkles, type LucideIcon } from 'lucide-react'
import { useLanguage } from '../../core/i18n/LanguageContext'
import { BrandMark } from '../../design-system/BrandMark'
import { DEFAULT_PUBLIC_CONTACT, loadPublicContact, type PublicContact } from './publicContactService'
import './landing.css'

// Η δημόσια «Σελίδα παρουσίασης» (διαδρομή «/» για όποιον δεν έχει συνδεθεί): τι κάνει το Limoxis Observer και
// πώς επικοινωνεί κανείς με την εταιρεία. Το «Σύνδεση» ανοίγει το /login· ο συνδεδεμένος χρήστης δεν τη βλέπει.
const copy = {
  el: {
    nav: { features: 'Λειτουργίες', how: 'Πώς δουλεύει', contact: 'Επικοινωνία' },
    sections: 'Ενότητες',
    tagline: 'Πλατφόρμα λειτουργίας νοσοκομείου',
    signIn: 'Σύνδεση',
    eyebrow: 'Ενιαία πλατφόρμα νοσοκομείου',
    headline: 'Ασφαλής επιτήρηση και καθημερινή λειτουργία,',
    headlineAccent: 'χωρίς περιττή πολυπλοκότητα.',
    lead: 'Επιτήρηση λοιμώξεων, εργαστήριο, πρόληψη, ποιότητα και προσωπικό σε ένα ενιαίο κλινικό περιβάλλον, με δείκτες που υπολογίζονται από τα ίδια τα δεδομένα.',
    cta: 'Ζητήστε παρουσίαση',
    points: ['Χωρίς εγκατάσταση', 'Πρόσβαση ανά ρόλο', 'Πλήρης ιχνηλασιμότητα'],
    previewLabel: 'Παράδειγμα από την εφαρμογή',
    previewTitle: 'Πίνακας ελέγχου · σήμερα',
    kpis: [['Λοιμώξεις ‰ ημέρες νοσηλείας', '1,8', '−12%'], ['Υγιεινή χεριών', '92%', '+4%'], ['Έλεγχοι σήμερα', '7 / 9', '']],
    rows: [
      ['Νέο θετικό δείγμα · Παθολογική', 'Προς έλεγχο', 'warn'],
      ['Παρατήρηση υγιεινής χεριών · ΜΕΘ', 'Ολοκληρώθηκε', 'ok'],
      ['Έλεγχος καθαριότητας · Χειρουργεία', 'Σε εξέλιξη', 'info'],
    ],
    featuresTitle: 'Όλη η καθημερινή δουλειά, σε ένα σημείο',
    featuresLead: 'Κάθε ενότητα ανοίγει ανάλογα με τον ρόλο και το πακέτο του νοσοκομείου.',
    features: [
      ['Επιτήρηση λοιμώξεων', 'Τα νέα θετικά δείγματα περιμένουν αξιολόγηση. Κάθε επεισόδιο έχει ταξινόμηση, αγωγή, απομόνωση, συσκευές και έκβαση σε ενιαίο χρονολόγιο.'],
      ['Εργαστήριο και αντοχή', 'Δείγματα, καλλιέργειες, αντιβιόγραμμα και κρίσιμα αποτελέσματα, δηλωτέα νοσήματα και περιβαλλοντική δειγματοληψία.'],
      ['Πρόληψη', 'Παρατηρήσεις υγιεινής χεριών κατά τον ΠΟΥ, δέσμες μέτρων πρόληψης, αντισηπτικά και απόβλητα.'],
      ['Ποιότητα', 'Αναφορές συμβάντων, διορθωτικές και προληπτικές ενέργειες, επιθεωρήσεις, κίνδυνοι και στόχοι.'],
      ['Προσωπικό και βάρδιες', 'Φάκελος εργαζομένου, εκπαιδεύσεις, εμβολιασμοί και πρόγραμμα βαρδιών ανά τμήμα.'],
      ['Δείκτες και αναφορές με τη LIRA', 'Δείκτες με αριθμητή και παρονομαστή, αναλύσεις ανά τμήμα και μήνα, και ο βοηθός LIRA για συρροές και εξάρσεις.'],
    ],
    howTitle: 'Πώς δουλεύει',
    steps: [
      ['Ρύθμιση νοσοκομείου', 'Τμήματα, χρήστες και ρόλοι, και οι ενότητες που χρειάζεστε.'],
      ['Καταγραφή', 'Κάθε ομάδα καταχωρεί στη δική της οθόνη, από υπολογιστή ή ταμπλέτα.'],
      ['Παρακολούθηση', 'Εκκρεμότητες, ειδοποιήσεις και έλεγχοι της ημέρας σε μία ματιά.'],
      ['Αναφορές', 'Δείκτες και εκτυπώσιμες αναφορές, με το ιστορικό κάθε αλλαγής.'],
    ],
    contactTitle: 'Ας μιλήσουμε',
    contactLead: 'Θέλετε να δείτε το Limoxis Observer στο νοσοκομείο σας; Επικοινωνήστε μαζί μας για παρουσίαση ή για οποιαδήποτε ερώτηση.',
    company: 'Εταιρεία',
    email: 'Email',
    phone: 'Τηλέφωνο',
    website: 'Ιστοσελίδα',
    sendEmail: 'Στείλτε email',
    call: 'Καλέστε μας',
    mailSubject: 'Limoxis Observer: αίτημα παρουσίασης',
    privacy: 'Πολιτική απορρήτου',
    terms: 'Όροι χρήσης',
    legal: 'Νομικά',
    by: 'από την',
  },
  en: {
    nav: { features: 'Features', how: 'How it works', contact: 'Contact' },
    sections: 'Sections',
    tagline: 'Hospital Operations Platform',
    signIn: 'Sign in',
    eyebrow: 'Unified hospital platform',
    headline: 'Secure surveillance and daily operations,',
    headlineAccent: 'without unnecessary complexity.',
    lead: 'Infection surveillance, laboratory, prevention, quality and staff in one clinical workspace, with indicators computed from the data itself.',
    cta: 'Request a demo',
    points: ['Nothing to install', 'Role-based access', 'Full traceability'],
    previewLabel: 'An example from the app',
    previewTitle: 'Dashboard · today',
    kpis: [['Infections per 1,000 patient-days', '1.8', '−12%'], ['Hand hygiene', '92%', '+4%'], ['Checks today', '7 / 9', '']],
    rows: [
      ['New positive sample · Internal Medicine', 'To review', 'warn'],
      ['Hand hygiene observation · ICU', 'Completed', 'ok'],
      ['Cleaning check · Operating theatres', 'In progress', 'info'],
    ],
    featuresTitle: 'All the daily work, in one place',
    featuresLead: 'Each module opens according to the role and the hospital’s package.',
    features: [
      ['Infection surveillance', 'New positive samples wait for review. Each episode keeps classification, therapy, isolation, devices and outcome in one timeline.'],
      ['Laboratory and resistance', 'Samples, cultures, susceptibility and critical results, notifiable diseases and environmental sampling.'],
      ['Prevention', 'Hand hygiene observations following the WHO, prevention bundles, antiseptics and waste.'],
      ['Quality', 'Incident reports, corrective and preventive actions, audits, risks and objectives.'],
      ['Staff and shifts', 'Employee record, training, vaccinations and shift rosters per department.'],
      ['Indicators and reports with LIRA', 'Indicators with numerator and denominator, analysis by department and month, and the LIRA assistant for clusters and outbreaks.'],
    ],
    howTitle: 'How it works',
    steps: [
      ['Hospital setup', 'Departments, users and roles, and the modules you need.'],
      ['Recording', 'Each team records on its own screen, from a computer or a tablet.'],
      ['Follow-up', 'Pending items, alerts and the day’s checks at a glance.'],
      ['Reports', 'Indicators and printable reports, with the history of every change.'],
    ],
    contactTitle: 'Let’s talk',
    contactLead: 'Would you like to see Limoxis Observer in your hospital? Contact us for a demo or any question.',
    company: 'Company',
    email: 'Email',
    phone: 'Phone',
    website: 'Website',
    sendEmail: 'Send an email',
    call: 'Call us',
    mailSubject: 'Limoxis Observer: demo request',
    privacy: 'Privacy policy',
    terms: 'Terms of use',
    legal: 'Legal',
    by: 'by',
  },
} as const

const FEATURE_ICONS: LucideIcon[] = [Activity, FlaskConical, HandHeart, ClipboardCheck, CalendarDays, Sparkles]
const STEP_ICONS: LucideIcon[] = [Settings2, PenLine, ShieldCheck, ChartColumn]

export function LandingPage() {
  const { language, setLanguage } = useLanguage()
  const t = copy[language === 'en' ? 'en' : 'el']
  // Τα στοιχεία από την κονσόλα ιδιοκτήτη· οι αρχικές τιμές μέχρι να έρθουν (ή αν δεν έρθουν).
  const [contact, setContact] = useState<PublicContact>(DEFAULT_PUBLIC_CONTACT)
  useEffect(() => { let live = true; loadPublicContact().then(value => { if (live) setContact(value) }).catch(() => {}); return () => { live = false } }, [])
  const phoneDigits = contact.phone.replace(/[^\d+]/g, '')
  const phoneHref = `tel:${phoneDigits.startsWith('+') ? phoneDigits : `+30${phoneDigits}`}`
  const website = /^https?:\/\//.test(contact.website) ? contact.website : `https://${contact.website}`
  const mailHref = `mailto:${contact.email}?subject=${encodeURIComponent(t.mailSubject)}`
  const toSection = (id: string) => (event: MouseEvent) => {
    event.preventDefault()
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div className="landing">
      <header className="landing-bar">
        <div className="landing-wrap landing-bar-inner">
          <Link className="landing-brand" to="/" aria-label="Limoxis Observer">
            <BrandMark size={38} tone="light" className="landing-brand-mark"/>
            <span><strong>Limoxis Observer</strong><small>{t.tagline}</small></span>
          </Link>
          <nav className="landing-nav" aria-label={t.sections}>
            <a href="#features" onClick={toSection('features')}>{t.nav.features}</a>
            <a href="#how" onClick={toSection('how')}>{t.nav.how}</a>
            <a href="#contact" onClick={toSection('contact')}>{t.nav.contact}</a>
          </nav>
          <div className="landing-bar-actions">
            <button type="button" className="landing-lang" onClick={() => setLanguage(language === 'en' ? 'el' : 'en')} aria-label={language === 'en' ? 'Αλλαγή σε Ελληνικά' : 'Switch to English'}>
              <Languages size={16} aria-hidden="true"/>{language === 'en' ? 'EL' : 'EN'}
            </button>
            <Link className="landing-signin" to="/login"><LogIn size={16} aria-hidden="true"/>{t.signIn}</Link>
          </div>
        </div>
      </header>

      <main>
        <section className="landing-hero">
          <div className="landing-wrap landing-hero-inner">
            <div className="landing-hero-text">
              <span className="landing-eyebrow">{t.eyebrow}</span>
              <h1>{t.headline} <em>{t.headlineAccent}</em></h1>
              <p className="landing-lead">{t.lead}</p>
              <div className="landing-cta">
                <a className="landing-btn landing-btn-solid" href={mailHref}>{t.cta}<ArrowRight size={18} aria-hidden="true"/></a>
              </div>
              <ul className="landing-points">
                {t.points.map(point => <li key={point}><BadgeCheck size={16} aria-hidden="true"/>{point}</li>)}
              </ul>
            </div>
            <figure className="landing-preview" aria-label={t.previewLabel}>
              <figcaption><span>{t.previewLabel}</span><b>{t.previewTitle}</b></figcaption>
              <div className="landing-kpis">
                {t.kpis.map(([label, value, change]) => <div key={label}><small>{label}</small><b>{value}</b>{change && <em>{change}</em>}</div>)}
              </div>
              <ul className="landing-rows">
                {t.rows.map(([name, state, tone]) => <li key={name}><span>{name}</span><span className={`landing-badge ${tone}`}>{state}</span></li>)}
              </ul>
            </figure>
          </div>
        </section>

        <section className="landing-section" id="features">
          <div className="landing-wrap">
            <h2>{t.featuresTitle}</h2>
            <p className="landing-section-lead">{t.featuresLead}</p>
            <div className="landing-features">
              {t.features.map(([title, text], index) => {
                const Icon = FEATURE_ICONS[index]
                return <article key={title} className="landing-feature"><span className="landing-icon" aria-hidden="true"><Icon size={20}/></span><h3>{title}</h3><p>{text}</p></article>
              })}
            </div>
          </div>
        </section>

        <section className="landing-section alt" id="how">
          <div className="landing-wrap">
            <h2>{t.howTitle}</h2>
            <ol className="landing-steps">
              {t.steps.map(([title, text], index) => {
                const Icon = STEP_ICONS[index]
                return <li key={title}><span className="landing-icon" aria-hidden="true"><Icon size={20}/></span><b>{index + 1}. {title}</b><p>{text}</p></li>
              })}
            </ol>
          </div>
        </section>

        <section className="landing-section" id="contact">
          <div className="landing-wrap landing-contact">
            <div>
              <h2>{t.contactTitle}</h2>
              <p className="landing-section-lead">{t.contactLead}</p>
              <div className="landing-cta">
                <a className="landing-btn landing-btn-solid" href={mailHref}><Mail size={18} aria-hidden="true"/>{t.sendEmail}</a>
                <a className="landing-btn landing-btn-outline" href={phoneHref}><Phone size={18} aria-hidden="true"/>{t.call}</a>
              </div>
            </div>
            <dl className="landing-contact-card">
              <div><dt><Building2 size={16} aria-hidden="true"/>{t.company}</dt><dd>{contact.name}</dd></div>
              <div><dt><Mail size={16} aria-hidden="true"/>{t.email}</dt><dd><a href={mailHref}>{contact.email}</a></dd></div>
              <div><dt><Phone size={16} aria-hidden="true"/>{t.phone}</dt><dd><a href={phoneHref}>{contact.phone}</a></dd></div>
              <div><dt><Globe size={16} aria-hidden="true"/>{t.website}</dt><dd><a href={website} target="_blank" rel="noopener noreferrer">{contact.website.replace(/^https?:\/\//, '').replace(/\/$/, '')}</a></dd></div>
            </dl>
          </div>
        </section>
      </main>

      <footer className="landing-foot">
        <div className="landing-wrap landing-foot-inner">
          <span>© {new Date().getFullYear()} Limoxis Observer · {t.by} <a href={website} target="_blank" rel="noopener noreferrer">{contact.name}</a></span>
          <nav aria-label={t.legal}><Link to="/privacy">{t.privacy}</Link><Link to="/terms">{t.terms}</Link></nav>
        </div>
      </footer>
    </div>
  )
}
