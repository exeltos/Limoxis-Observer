// Replays supabase/migrations to work out which SECURITY DEFINER functions in
// the public schema signed-in users (authenticated) or anonymous visitors
// (anon) can call through /rest/v1/rpc. A SECURITY DEFINER function bypasses
// RLS, so every exposed one must be declared in
// supabase/security-definer-manifest.json with its purpose, and an RPC must
// check the caller itself (auth.uid(), a current_user_* / is_org_* helper or a
// one-time access token). CI fails when:
//   - an exposed SECURITY DEFINER function is missing from the manifest;
//   - its exposure (anon / authenticated) differs from the manifest;
//   - an RPC body has no caller check;
//   - a trigger function is callable at all;
//   - the manifest lists a function that no longer exists or is not exposed.
//
// Privilege rules replayed (PostgreSQL + Supabase defaults):
//   - a new function is executable by PUBLIC and, through Supabase default
//     privileges, by anon and authenticated (anon stops being granted after
//     the "revoke execute on functions from anon" default-privileges change);
//   - CREATE OR REPLACE keeps existing privileges; DROP FUNCTION resets them;
//   - anon/authenticated can execute when granted directly or via PUBLIC.
import fs from 'node:fs'
import path from 'node:path'

const MIGRATIONS = 'supabase/migrations'
const MANIFEST = 'supabase/security-definer-manifest.json'
const CATEGORIES = new Set(['rls-helper', 'rpc', 'public-token'])
const CALLER_CHECK = /auth\.uid\(\)|current_user_[a-z_]+\(|is_org_(member|admin)\(|has_org_role\(|p_token/i

export function splitStatements(sql) {
  const out = []
  let start = 0, i = 0, dollar = null
  while (i < sql.length) {
    if (dollar) {
      if (sql.startsWith(dollar, i)) { i += dollar.length; dollar = null } else i += 1
      continue
    }
    const ch = sql[i]
    if (ch === '-' && sql[i + 1] === '-') { const end = sql.indexOf('\n', i); i = end < 0 ? sql.length : end; continue }
    if (ch === '/' && sql[i + 1] === '*') { const end = sql.indexOf('*/', i + 2); i = end < 0 ? sql.length : end + 2; continue }
    if (ch === "'") { i += 1; while (i < sql.length && !(sql[i] === "'" && sql[i + 1] !== "'")) i += sql[i] === "'" ? 2 : 1; i += 1; continue }
    if (ch === '$') { const m = /^\$[A-Za-z0-9_]*\$/.exec(sql.slice(i)); if (m) { dollar = m[0]; i += dollar.length; continue } }
    if (ch === ';') { out.push(sql.slice(start, i)); start = i + 1 }
    i += 1
  }
  if (sql.slice(start).trim()) out.push(sql.slice(start))
  return out.map(s => s.replace(/^\s*(--[^\n]*\n\s*)*/, '').trim()).filter(Boolean)
}

const fnName = raw => raw.replace(/"/g, '').toLowerCase()
const ROLE_LIST = list => list.toLowerCase().split(',').map(r => r.trim().replace(/"/g, ''))

export function replayMigrations(files) {
  const fns = new Map()
  let anonDefault = true
  for (const { name, sql } of files) {
    for (const stmt of splitStatements(sql)) {
      const s = stmt.replace(/\s+/g, ' ')
      if (/^alter default privileges .*in schema public revoke (execute|all) on functions from [^;]*\banon\b/i.test(s)) { anonDefault = false; continue }
      let m = /^create (or replace )?function (?:public\.)?("?[a-z0-9_]+"?)\s*\(/i.exec(s)
      if (m) {
        if (/^create (or replace )?function (?!public\.)[a-z0-9_]+\./i.test(s)) continue
        const key = fnName(m[2])
        const definer = /\bsecurity definer\b/i.test(s)
        const trigger = /\breturns trigger\b/i.test(s)
        const prev = fns.get(key)
        const grants = prev?.grants || { public: true, anon: anonDefault, authenticated: true }
        fns.set(key, { name: key, definer, trigger, body: stmt, grants, file: name })
        continue
      }
      m = /^drop function (if exists )?(?:public\.)?("?[a-z0-9_]+"?)/i.exec(s)
      if (m) { fns.delete(fnName(m[2])); continue }
      m = /^alter function (?:public\.)?("?[a-z0-9_]+"?)\s*\([^)]*\)\s*(security (definer|invoker))/i.exec(s)
      if (m) { const fn = fns.get(fnName(m[1])); if (fn) fn.definer = m[3].toLowerCase() === 'definer'; continue }
      m = /^(grant|revoke) (?:all(?: privileges)?|execute) on function (?:public\.)?("?[a-z0-9_]+"?)\s*\([^)]*\)\s*(?:to|from) ([^;]+)$/i.exec(s)
      if (m) {
        const fn = fns.get(fnName(m[2])); if (!fn) continue
        const value = m[1].toLowerCase() === 'grant'
        for (const role of ROLE_LIST(m[3].replace(/\bcascade\b|\brestrict\b/gi, ''))) if (role in fn.grants) fn.grants[role] = value
      }
    }
  }
  return fns
}

export function exposure(fn) {
  return { anon: fn.grants.anon || fn.grants.public, authenticated: fn.grants.authenticated || fn.grants.public }
}

export function auditSecurityDefiner(fns, manifest) {
  const problems = []
  const exposed = [...fns.values()].filter(fn => fn.definer).map(fn => ({ fn, ...exposure(fn) })).filter(item => item.anon || item.authenticated)
  for (const { fn, anon, authenticated } of exposed) {
    if (fn.trigger) { problems.push(`${fn.name}: trigger function is executable by ${anon ? 'anon' : 'authenticated'}; revoke execute from public, anon, authenticated (${fn.file})`); continue }
    const entry = manifest[fn.name]
    if (!entry) { problems.push(`${fn.name}: SECURITY DEFINER function executable by ${[anon && 'anon', authenticated && 'authenticated'].filter(Boolean).join(' and ')} is not declared in ${MANIFEST} (${fn.file})`); continue }
    if (!CATEGORIES.has(entry.category)) problems.push(`${fn.name}: unknown category "${entry.category}"`)
    if (!entry.reason) problems.push(`${fn.name}: manifest entry needs a reason`)
    if (Boolean(entry.anon) !== anon || Boolean(entry.authenticated) !== authenticated) problems.push(`${fn.name}: exposure is anon=${anon}, authenticated=${authenticated} but the manifest says anon=${Boolean(entry.anon)}, authenticated=${Boolean(entry.authenticated)}`)
    if (anon && entry.category !== 'public-token') problems.push(`${fn.name}: only public-token functions may be callable by anon`)
    if (entry.category !== 'rls-helper' && !entry.noCallerCheck && !CALLER_CHECK.test(fn.body)) problems.push(`${fn.name}: ${entry.category} has no caller check (auth.uid(), current_user_*, is_org_*, has_org_role or p_token)`)
  }
  const exposedNames = new Set(exposed.map(item => item.fn.name))
  for (const name of Object.keys(manifest)) if (!exposedNames.has(name)) problems.push(`${name}: listed in ${MANIFEST} but not an exposed SECURITY DEFINER function; remove the entry`)
  return { problems, exposed }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const files = fs.readdirSync(MIGRATIONS).filter(name => name.endsWith('.sql')).sort().map(name => ({ name, sql: fs.readFileSync(path.join(MIGRATIONS, name), 'utf8') }))
  const manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8')).functions
  const { problems, exposed } = auditSecurityDefiner(replayMigrations(files), manifest)
  if (process.argv.includes('--list')) for (const { fn, anon, authenticated } of exposed) console.log(`${fn.name}\tanon=${anon}\tauth=${authenticated}\ttrigger=${fn.trigger}`)
  if (problems.length) { console.error(`Security definer audit failed (${problems.length}):\n- ${problems.join('\n- ')}`); process.exit(1) }
  console.log(`Security definer audit passed: ${exposed.length} exposed SECURITY DEFINER functions, all declared and guarded.`)
}
