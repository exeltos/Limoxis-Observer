// Builds the printable PDF manual (Greek and English) from the same content the in-app
// Help Center uses (src/core/help/helpGuide.js), so the two never disagree.
//
//   npm run manual:pdf                      # writes docs/manual/*.pdf (not served by the app: the PDFs are for the owner only)
//   node tools/build-manual-pdf.mjs --out some/dir [--lang el|en]
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'
import { guideContent, pickGuide } from '../src/core/help/helpGuide.js'
import { glossary } from '../src/core/help/helpContent.js'
import { ADDONS, ADDON_LABELS, CORE_MODULES, MODULES, OPERATING_PROFILES, OPTIONAL_MODULES, PROFILE_LABELS, profileModules } from '../src/core/organization/operatingProfile.js'
import { roleLabel } from '../src/core/permissions/roleLabels.js'
import { APP_VERSION } from '../src/core/version.js'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const args = process.argv.slice(2)
const argValue = name => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : null }
const outDir = path.resolve(root, argValue('--out') || 'docs/manual')
const languages = argValue('--lang') ? [argValue('--lang')] : ['el', 'en']

const esc = value => String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

const UI = {
  el: {
    cover: 'Εγχειρίδιο', version: 'Έκδοση εφαρμογής', date: 'Ημερομηνία έκδοσης εγχειριδίου', toc: 'Περιεχόμενα',
    intro: 'Εισαγωγή', purpose: 'Σκοπός', audience: 'Σε ποιον απευθύνεται', howToRead: 'Πώς να το διαβάσετε',
    c1: 'Το ταξίδι: από την πρώτη ημέρα μέχρι την καθημερινή χρήση', c2: 'Πού βρίσκομαι; Τι κάνω τώρα;',
    c3: 'Τι περιλαμβάνει κάθε πακέτο', c4: 'Βήματα ανά πακέτο', c5: 'Οι ενότητες μία-μία', c6: 'Ρόλοι', c7: 'Ορολογία', c8: 'Συχνά προβλήματα',
    stage: 'Στάδιο', who: 'Ποιος', where: 'Πού', doneWhen: 'Έχει ολοκληρωθεί όταν', situation: 'Αν…', action: 'Τότε…',
    matrixIntro: 'Τα πακέτα είναι έτοιμοι συνδυασμοί ενοτήτων και λειτουργούν ως συντόμευση: μετά την επιλογή πακέτου μπορείτε να ξεκλειδώσετε ή να κλειδώσετε οποιαδήποτε ενότητα ξεχωριστά (στάδιο 3). Οι Ασθενείς είναι πάντα ανοιχτοί.',
    module: 'Ενότητα', included: 'Περιλαμβάνεται', locked: 'Κλειδωμένη (ξεκλειδώνεται ξεχωριστά)', optional: 'Πρόσθετο: ανοίγει ανεξάρτητα από το πακέτο',
    addons: 'Πρόσθετα', packageLabel: 'Πακέτο', forWhom: 'Για ποιον', goal: 'Στόχος', stepsTitle: 'Βήματα με τη σειρά', firstWeek: 'Έλεγχος πρώτης εβδομάδας', success: 'Πώς καταλαβαίνετε ότι πετύχατε',
    recipe: 'Συνηθισμένος συνδυασμός', when: 'Πότε',
    what: 'Τι είναι', users: 'Ποιοι την χρησιμοποιούν', needs: 'Χρειάζεται και', analysis: 'Ανάλυση και report', start: 'Πρώτο βήμα', availableFrom: 'Περιλαμβάνεται από', addonKind: 'Πρόσθετο',
    always: 'Πάντα ανοιχτή', role: 'Ρόλος', does: 'Τι κάνει', term: 'Όρος', def: 'Σημασία', platformTerms: 'Όροι της πλατφόρμας', clinicalTerms: 'Κλινικοί όροι',
    footer: 'Limoxis Observer — Εγχειρίδιο', page: 'Σελίδα', of: 'από', lock: 'κλειδί', tick: 'τικ', noneNeeded: '—',
  },
  en: {
    cover: 'Manual', version: 'Application version', date: 'Manual issue date', toc: 'Contents',
    intro: 'Introduction', purpose: 'Purpose', audience: 'Who it is for', howToRead: 'How to read it',
    c1: 'The journey: from day one to everyday use', c2: 'Where am I? What do I do now?',
    c3: 'What each package contains', c4: 'Steps per package', c5: 'The modules one by one', c6: 'Roles', c7: 'Terminology', c8: 'Common problems',
    stage: 'Stage', who: 'Who', where: 'Where', doneWhen: 'It is done when', situation: 'If…', action: 'Then…',
    matrixIntro: 'Packages are ready-made combinations of modules and work as a shortcut: after choosing a package you can unlock or lock any module separately (stage 3). Patients is always on.',
    module: 'Module', included: 'Included', locked: 'Locked (unlocked separately)', optional: 'Add-on: switched on independently of the package',
    addons: 'Add-ons', packageLabel: 'Package', forWhom: 'Who it is for', goal: 'Goal', stepsTitle: 'Steps in order', firstWeek: 'First-week check', success: 'How you know it worked',
    recipe: 'Common combination', when: 'When',
    what: 'What it is', users: 'Who uses it', needs: 'Also needs', analysis: 'Analysis and report', start: 'First step', availableFrom: 'Included from', addonKind: 'Add-on',
    always: 'Always on', role: 'Role', does: 'What it does', term: 'Term', def: 'Meaning', platformTerms: 'Platform terms', clinicalTerms: 'Clinical terms',
    footer: 'Limoxis Observer — Manual', page: 'Page', of: 'of', lock: 'lock', tick: 'tick', noneNeeded: '—',
  },
}

function buildHtml(language) {
  const g = pickGuide(guideContent, language)
  const t = UI[language]
  const lang = language === 'en' ? 'en' : 'el'
  const moduleName = id => (MODULES[id] ? MODULES[id][lang] : ADDON_LABELS[id][lang])
  const packageName = id => PROFILE_LABELS[id][lang]
  const hint = id => PROFILE_LABELS[id][lang === 'en' ? 'hintEn' : 'hintEl']
  const today = new Date().toLocaleDateString(language === 'en' ? 'en-GB' : 'el-GR', { year: 'numeric', month: 'long', day: 'numeric' })
  const list = items => `<ul>${items.map(item => `<li>${esc(item)}</li>`).join('')}</ul>`
  const ordered = items => `<ol class="steps">${items.map(item => `<li>${esc(item)}</li>`).join('')}</ol>`
  const checklist = items => `<ul class="check">${items.map(item => `<li>${esc(item)}</li>`).join('')}</ul>`
  const chapters = [t.c1, t.c2, t.c3, t.c4, t.c5, t.c6, t.c7, t.c8]

  const journey = g.journey.map((stage, index) => `
    <section class="card">
      <h3><span class="num">${index + 1}</span>${esc(stage.title)}</h3>
      <div class="meta"><span><b>${t.who}:</b> ${esc(stage.who)}</span><span><b>${t.where}:</b> ${esc(stage.where)}</span></div>
      ${ordered(stage.steps)}
      <p class="done"><b>${t.doneWhen}:</b> ${esc(stage.done)}</p>
    </section>`).join('')

  const whereAmI = `<table class="grid"><thead><tr><th>${t.situation}</th><th>${t.action}</th></tr></thead><tbody>${g.whereAmI.map(([a, b]) => `<tr><td>${esc(a)}</td><td>${esc(b)}</td></tr>`).join('')}</tbody></table>`

  const matrixRows = [...CORE_MODULES, ...OPTIONAL_MODULES].map(id => `<tr><td>${esc(moduleName(id))}</td>${OPERATING_PROFILES.map(pid => `<td class="c">${profileModules(pid).includes(id) ? '✓' : '—'}</td>`).join('')}</tr>`).join('')
  const addonRows = ADDONS.map(id => `<tr><td>${esc(moduleName(id))}</td><td class="c" colspan="${OPERATING_PROFILES.length}">${esc(t.optional)}</td></tr>`).join('')
  const matrix = `<p>${esc(t.matrixIntro)}</p>
    ${OPERATING_PROFILES.map(pid => `<p class="hint"><b>${esc(packageName(pid))}.</b> ${esc(hint(pid))}</p>`).join('')}
    <table class="grid matrix"><thead><tr><th>${t.module}</th>${OPERATING_PROFILES.map(pid => `<th class="c">${esc(packageName(pid))}</th>`).join('')}</tr></thead>
    <tbody>${matrixRows}<tr class="sep"><td colspan="${OPERATING_PROFILES.length + 1}">${t.addons}</td></tr>${addonRows}</tbody></table>
    <p class="legend">✓ ${t.included} &nbsp;&nbsp; — ${t.locked}</p>`

  const packages = g.packages.map(pkg => `
    <section class="package">
      <h3 class="pkg">${t.packageLabel}: ${esc(packageName(pkg.id))}</h3>
      <p><b>${t.forWhom}:</b> ${esc(pkg.forWhom)}</p>
      <p><b>${t.goal}:</b> ${esc(pkg.goal)}</p>
      <h4>${t.stepsTitle}</h4>
      <ol class="pkgsteps">${pkg.steps.map(step => `<li><div><b>${esc(step.title)}</b> <span class="who">${esc(step.who)}</span></div><div>${esc(step.text)}</div></li>`).join('')}</ol>
      <h4>${t.firstWeek}</h4>${checklist(pkg.firstWeek)}
      <p class="done"><b>${t.success}:</b> ${esc(pkg.success)}</p>
    </section>`).join('')
  const recipes = g.recipes.map(recipe => `
    <section class="package recipe">
      <h3 class="pkg">${t.recipe}: ${esc(recipe.title)}</h3>
      <p><b>${t.when}:</b> ${esc(recipe.when)}</p>${ordered(recipe.steps)}
    </section>`).join('')

  const modules = [...CORE_MODULES, ...OPTIONAL_MODULES, ...ADDONS].map(id => {
    const m = g.modules[id]
    const from = MODULES[id] ? (CORE_MODULES.includes(id) ? t.always : `${t.availableFrom}: ${packageName(MODULES[id].from)}`) : t.addonKind
    const needs = m.needs ? m.needs.map(moduleName).join(', ') : t.noneNeeded
    return `<section class="card module"><h3>${esc(moduleName(id))}<span class="tag">${esc(from)}</span></h3>
      <dl><dt>${t.what}</dt><dd>${esc(m.what)}</dd><dt>${t.users}</dt><dd>${esc(m.users)}</dd><dt>${t.needs}</dt><dd>${esc(needs)}</dd><dt>${t.analysis}</dt><dd>${esc(m.analysis)}</dd><dt>${t.start}</dt><dd>${esc(m.start)}</dd></dl></section>`
  }).join('')

  const roles = `<table class="grid"><thead><tr><th>${t.role}</th><th>${t.does}</th></tr></thead><tbody>${g.roles.map(([id, text]) => `<tr><td><b>${esc(roleLabel(id, lang))}</b></td><td>${esc(text)}</td></tr>`).join('')}</tbody></table><p>${esc(g.rolesNote)}</p>`

  const terms = `<h3>${t.platformTerms}</h3><table class="grid"><thead><tr><th>${t.term}</th><th>${t.def}</th></tr></thead><tbody>${g.terms.map(x => `<tr><td><b>${esc(x.term)}</b></td><td>${esc(x.def)}</td></tr>`).join('')}</tbody></table>
    <h3>${t.clinicalTerms}</h3><table class="grid"><thead><tr><th>${t.term}</th><th>${t.def}</th></tr></thead><tbody>${glossary.map(x => `<tr><td><b>${esc(x.term)}</b></td><td>${esc(x[lang])}</td></tr>`).join('')}</tbody></table>`

  const faq = g.faq.map(item => `<section class="card"><h3 class="q">${esc(item.q)}</h3>${list(item.a)}</section>`).join('')

  return `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><title>${esc(g.title)}</title><style>
  @page { size: A4; margin: 20mm 17mm 20mm 17mm; }
  :root { --brand:#1f5f93; --ink:#16212c; --muted:#5b6b7b; --line:#d6dee6; --soft:#f2f6fa; --ok:#1d6b3a; --warn:#9a4a00; }
  * { box-sizing:border-box; }
  body { margin:0; font-family:'Inter','DejaVu Sans',Arial,sans-serif; color:var(--ink); font-size:10.5pt; line-height:1.5; }
  h1,h2,h3,h4 { line-height:1.25; margin:0; }
  h2 { font-size:19pt; color:var(--brand); margin:0 0 6mm; padding-bottom:3mm; border-bottom:2px solid var(--brand); break-after:avoid; }
  h3 { font-size:12.5pt; margin:5mm 0 2.5mm; break-after:avoid; }
  h4 { font-size:10.5pt; color:var(--brand); margin:4mm 0 1.5mm; text-transform:uppercase; letter-spacing:.03em; break-after:avoid; }
  p { margin:0 0 2.5mm; }
  ul,ol { margin:0 0 3mm; padding-left:6mm; }
  li { margin-bottom:1.2mm; }
  .chapter { break-before:page; }
  .cover { height:250mm; display:flex; flex-direction:column; justify-content:center; padding:0 6mm; }
  .cover .logo { width:20mm; height:20mm; border-radius:5mm; background:var(--brand); color:#fff; font-size:30pt; font-weight:800; display:grid; place-items:center; margin-bottom:12mm; }
  .cover .eyebrow { color:var(--brand); font-weight:800; letter-spacing:.12em; text-transform:uppercase; font-size:11pt; margin-bottom:4mm; }
  .cover h1 { font-size:34pt; margin-bottom:5mm; }
  .cover .sub { font-size:15pt; color:var(--muted); margin-bottom:22mm; max-width:140mm; }
  .cover .info { border-top:1px solid var(--line); padding-top:5mm; color:var(--muted); font-size:10pt; }
  .toc { break-before:page; } .tocl { list-style:none; padding:0; font-size:12pt; line-height:2.1; } .tocl b { display:inline-block; width:8mm; color:var(--brand); }
  .card { border:1px solid var(--line); border-radius:3mm; padding:4mm 5mm; margin:0 0 4mm; background:#fff; break-inside:avoid; }
  .card h3 { margin:0 0 2.5mm; display:flex; align-items:center; gap:3mm; }
  .num { display:inline-grid; place-items:center; flex:none; width:7mm; height:7mm; border-radius:50%; background:var(--brand); color:#fff; font-size:10pt; font-weight:800; }
  .meta { display:flex; gap:8mm; flex-wrap:wrap; color:var(--muted); font-size:9.5pt; margin-bottom:2.5mm; }
  .done { background:var(--soft); border-left:3px solid var(--ok); padding:2mm 3mm; margin:2mm 0 0; border-radius:0 2mm 2mm 0; }
  .steps { padding-left:6mm; } .steps li::marker { font-weight:800; color:var(--brand); }
  table.grid { width:100%; border-collapse:collapse; margin:0 0 4mm; font-size:9.8pt; }
  table.grid th { background:var(--brand); color:#fff; text-align:left; padding:2mm 3mm; }
  table.grid td { border-bottom:1px solid var(--line); padding:2mm 3mm; vertical-align:top; }
  table.grid tr { break-inside:avoid; }
  table.matrix td { padding:1.4mm 3mm; } .hint { margin-bottom:1.5mm; }
  table.matrix td.c, table.matrix th.c { text-align:center; } table.matrix td.c { color:var(--ok); font-weight:800; }
  table.matrix tr.sep td { background:var(--soft); font-weight:800; color:var(--brand); }
  .legend { color:var(--muted); font-size:9.5pt; }
  .package { margin-bottom:6mm; } .package + .package { break-before:page; }
  h3.pkg { font-size:15pt; color:var(--brand); border-bottom:1px solid var(--line); padding-bottom:2mm; margin-top:0; }
  .pkgsteps { list-style:none; padding:0; counter-reset:s; }
  .pkgsteps li { counter-increment:s; position:relative; padding:2mm 3mm 2mm 12mm; border:1px solid var(--line); border-radius:2.5mm; margin-bottom:2mm; break-inside:avoid; }
  .pkgsteps li::before { content:counter(s); position:absolute; left:3mm; top:2.5mm; width:6mm; height:6mm; border-radius:50%; background:var(--brand); color:#fff; font-size:9pt; font-weight:800; display:grid; place-items:center; }
  .who { color:var(--muted); font-size:9pt; margin-left:2mm; }
  ul.check { list-style:none; padding-left:0; } ul.check li::before { content:'☐'; margin-right:2.5mm; color:var(--brand); }
  .module h3 { justify-content:space-between; } .tag { font-size:8.5pt; font-weight:600; color:var(--brand); background:var(--soft); padding:1mm 3mm; border-radius:99mm; }
  dl { margin:0; } dt { font-size:9pt; font-weight:800; color:var(--brand); text-transform:uppercase; letter-spacing:.03em; margin-top:2mm; } dd { margin:0.5mm 0 0; }
  h3.q { color:var(--warn); }
  </style></head><body>
  <section class="cover"><div class="logo">L</div><div class="eyebrow">${t.cover}</div><h1>${esc(g.title)}</h1><div class="sub">${esc(g.subtitle)}</div>
    <div class="info">${t.version}: v${esc(APP_VERSION)}<br>${t.date}: ${esc(today)}</div></section>
  <section class="toc"><h2>${t.toc}</h2><ul class="tocl"><li>${t.intro}</li>${chapters.map((c, i) => `<li><b>${i + 1}.</b> ${esc(c)}</li>`).join('')}</ul></section>
  <section class="chapter"><h2>${t.intro}</h2><h3>${t.purpose}</h3><p>${esc(g.intro.purpose)}</p><h3>${t.audience}</h3><p>${esc(g.intro.audience)}</p><h3>${t.howToRead}</h3><p>${esc(g.intro.howToRead)}</p></section>
  <section class="chapter"><h2>1. ${esc(t.c1)}</h2>${journey}</section>
  <section class="chapter"><h2>2. ${esc(t.c2)}</h2>${whereAmI}</section>
  <section class="chapter"><h2>3. ${esc(t.c3)}</h2>${matrix}</section>
  <section class="chapter"><h2>4. ${esc(t.c4)}</h2>${packages}${recipes}</section>
  <section class="chapter"><h2>5. ${esc(t.c5)}</h2>${modules}</section>
  <section class="chapter"><h2>6. ${esc(t.c6)}</h2>${roles}</section>
  <section class="chapter"><h2>7. ${esc(t.c7)}</h2>${terms}</section>
  <section class="chapter"><h2>8. ${esc(t.c8)}</h2>${faq}</section>
  </body></html>`
}

async function launch() {
  try { return await chromium.launch() } catch (error) {
    const fallback = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium'
    if (fs.existsSync(fallback)) return chromium.launch({ executablePath: fallback })
    throw error
  }
}

fs.mkdirSync(outDir, { recursive: true })
const browser = await launch()
for (const language of languages) {
  const page = await browser.newPage()
  await page.setContent(buildHtml(language), { waitUntil: 'load' })
  const t = UI[language]
  const file = path.join(outDir, language === 'en' ? 'Limoxis-Observer-Guide-EN.pdf' : 'Limoxis-Observer-Odigos-EL.pdf')
  await page.pdf({
    path: file, format: 'A4', printBackground: true,
    displayHeaderFooter: true,
    headerTemplate: '<span></span>',
    footerTemplate: `<div style="width:100%;font-size:8px;color:#5b6b7b;padding:0 17mm;display:flex;justify-content:space-between;font-family:Inter,DejaVu Sans,Arial,sans-serif"><span>${esc(t.footer)}</span><span>${t.page} <span class="pageNumber"></span> ${t.of} <span class="totalPages"></span></span></div>`,
    margin: { top: '20mm', bottom: '20mm', left: '17mm', right: '17mm' },
  })
  console.log(`Wrote ${path.relative(root, file)} (${Math.round(fs.statSync(file).size / 1024)} KB)`)
  await page.close()
}
await browser.close()
