// Replays supabase/migrations to work out which SECURITY DEFINER functions in
// the public schema signed-in users (authenticated) or anonymous visitors
// (anon) can call through /rest/v1/rpc. A SECURITY DEFINER function bypasses
// RLS, so every exposed one must be declared in
// supabase/security-definer-manifest.json with its purpose. Functions are
// tracked by identity signature, so every overload is a separate endpoint. In
// the function body (never the parameter list) an RPC must check the caller
// (auth.uid(), a current_user_* / is_org_* helper) and a public-token function
// must compare p_token with stored data. CI fails when:
//   - an exposed SECURITY DEFINER function is missing from the manifest;
//   - its exposure (anon / authenticated) differs from the manifest;
//   - an RPC body has no caller check, or a public-token body never compares
//     its token;
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
// Checked against the function body only (not its parameter list): an RPC must
// consult the caller's identity, a public-token function must compare its
// token argument with stored data.
const CALLER_CHECK = /auth\.uid\(\)|current_user_[a-z_]+\(|is_org_(member|admin)\(|has_org_role\(/i
const TOKEN_CHECK = /(=|<>|!=)\s*p_token\b|\bp_token\s*(=|<>|!=)/i

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

function splitArgs(list) {
  const out = []; let depth = 0, cur = ''
  for (const ch of list) { if (ch === '(') depth++; if (ch === ')') depth--; if (ch === ',' && depth === 0) { out.push(cur); cur = '' } else cur += ch }
  if (cur.trim()) out.push(cur)
  return out.map(a => a.trim()).filter(Boolean)
}
// The argument list inside the first balanced parentheses after `start`.
function argList(s, start) {
  const open = s.indexOf('(', start); if (open < 0) return null
  let depth = 0
  for (let i = open; i < s.length; i++) { if (s[i] === '(') depth++; if (s[i] === ')') { depth--; if (!depth) return s.slice(open + 1, i) } }
  return null
}
const TYPE_ALIASES = { int: 'integer', int4: 'integer', int8: 'bigint', int2: 'smallint', bool: 'boolean', float8: 'double precision', float4: 'real', timestamptz: 'timestamp with time zone', timetz: 'time with time zone', varchar: 'character varying', 'character varying': 'character varying', decimal: 'numeric' }
const TYPE_START = /^(uuid|text|integer|int[248]?|bigint|smallint|boolean|bool|numeric|decimal|real|double|float[48]?|date|time|timestamp|timestamptz|interval|jsonb?|bytea|character|varchar|char|inet|oid|regclass|anyelement|anyarray|record|void|trigger|name|citext|app_role|public\.)/i
// Identity signature: input argument types only, normalised ("uuid,date").
export function signature(list) {
  if (list == null) return null
  return splitArgs(list).map(arg => {
    let a = arg.replace(/\s+/g, ' ').trim().replace(/\s+(default\s+|=\s*).*$/i, '')
    const mode = /^(in|out|inout|variadic)\s+/i.exec(a); if (mode) { if (/^out$/i.test(mode[1])) return null; a = a.slice(mode[0].length) }
    const words = a.split(' ')
    if (words.length > 1 && !TYPE_START.test(a)) a = words.slice(1).join(' ')
    a = a.toLowerCase().replace(/"/g, '').replace(/^public\./, '').replace(/\s*\[\s*\]/g, '[]')
    const base = a.replace(/\[\]$/, ''), arr = a.endsWith('[]') ? '[]' : ''
    return (TYPE_ALIASES[base] || base) + arr
  }).filter(Boolean).join(',')
}
// The executable body: the first dollar-quoted (or single-quoted) string after AS.
export function functionBody(stmt) {
  const as = /\bas\s+(\$[A-Za-z0-9_]*\$)/i.exec(stmt)
  if (as) { const start = as.index + as[0].length, end = stmt.indexOf(as[1], start); return stmt.slice(start, end < 0 ? undefined : end) }
  const quoted = /\bas\s+'((?:[^']|'')*)'/i.exec(stmt)
  return quoted ? quoted[1] : ''
}

export function replayMigrations(files) {
  const fns = new Map()
  const matching = (name, sig) => [...fns.values()].filter(fn => fn.name === name && (sig == null || fn.signature === sig))
  let anonDefault = true
  for (const { name, sql } of files) {
    for (const stmt of splitStatements(sql)) {
      const s = stmt.replace(/\s+/g, ' ')
      if (/^alter default privileges .*in schema public revoke (execute|all) on functions from [^;]*\banon\b/i.test(s)) { anonDefault = false; continue }
      let m = /^create (or replace )?function (?:public\.)?("?[a-z0-9_]+"?)\s*\(/i.exec(s)
      if (m) {
        if (/^create (or replace )?function (?!public\.)[a-z0-9_]+\./i.test(s)) continue
        const fn = fnName(m[2]), sig = signature(argList(s, m.index + m[0].length - 1)), key = `${fn}(${sig})`
        const prev = fns.get(key)
        const grants = prev?.grants || { public: true, anon: anonDefault, authenticated: true }
        fns.set(key, { name: fn, signature: sig, key, definer: /\bsecurity definer\b/i.test(s), trigger: /\breturns trigger\b/i.test(s), body: functionBody(stmt), grants, file: name })
        continue
      }
      m = /^drop function (if exists )?(?:public\.)?("?[a-z0-9_]+"?)/i.exec(s)
      if (m) { const rest = s.slice(m.index + m[0].length); const sig = /^\s*\(/.test(rest) ? signature(argList(rest, 0)) : null; for (const fn of matching(fnName(m[2]), sig)) fns.delete(fn.key); continue }
      m = /^alter function (?:public\.)?("?[a-z0-9_]+"?)\s*(\([^)]*\))?\s*(?:.*\s)?security (definer|invoker)/i.exec(s)
      if (m) { const sig = m[2] ? signature(m[2].slice(1, -1)) : null; for (const fn of matching(fnName(m[1]), sig)) fn.definer = m[3].toLowerCase() === 'definer'; continue }
      m = /^(grant|revoke) (?:all(?: privileges)?|execute) on function (.+?)\s+(?:to|from) ([^;]+)$/i.exec(s)
      if (m) {
        const value = m[1].toLowerCase() === 'grant'
        const roles = ROLE_LIST(m[3].replace(/\bcascade\b|\brestrict\b|\bgranted by .*$/gi, ''))
        // one statement may name several functions: f(a,b), g(c)
        for (const target of splitArgs(m[2])) {
          const t = /^(?:public\.)?("?[a-z0-9_]+"?)\s*(\(.*\))?$/i.exec(target.trim()); if (!t) continue
          const sig = t[2] ? signature(t[2].slice(1, -1)) : null
          for (const fn of matching(fnName(t[1]), sig)) for (const role of roles) if (role in fn.grants) fn.grants[role] = value
        }
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
    if (fn.trigger) { problems.push(`${fn.key}: trigger function is executable by ${anon ? 'anon' : 'authenticated'}; revoke execute from public, anon, authenticated (${fn.file})`); continue }
    const entry = manifest[fn.name]
    if (!entry) { problems.push(`${fn.key}: SECURITY DEFINER function executable by ${[anon && 'anon', authenticated && 'authenticated'].filter(Boolean).join(' and ')} is not declared in ${MANIFEST} (${fn.file})`); continue }
    if (!CATEGORIES.has(entry.category)) problems.push(`${fn.name}: unknown category "${entry.category}"`)
    if (!entry.reason) problems.push(`${fn.name}: manifest entry needs a reason`)
    if (Boolean(entry.anon) !== anon || Boolean(entry.authenticated) !== authenticated) problems.push(`${fn.key}: exposure is anon=${anon}, authenticated=${authenticated} but the manifest says anon=${Boolean(entry.anon)}, authenticated=${Boolean(entry.authenticated)}`)
    if (anon && entry.category !== 'public-token') problems.push(`${fn.name}: only public-token functions may be callable by anon`)
    if (entry.category === 'rpc' && !entry.noCallerCheck && !CALLER_CHECK.test(fn.body)) problems.push(`${fn.key}: rpc body has no caller check (auth.uid(), current_user_*, is_org_*, has_org_role)`)
    if (entry.category === 'public-token' && !entry.noCallerCheck && !TOKEN_CHECK.test(fn.body)) problems.push(`${fn.key}: public-token body never compares p_token with stored data`)
  }
  const exposedNames = new Set(exposed.map(item => item.fn.name))
  for (const name of Object.keys(manifest)) if (!exposedNames.has(name)) problems.push(`${name}: listed in ${MANIFEST} but not an exposed SECURITY DEFINER function; remove the entry`)
  return { problems, exposed }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const files = fs.readdirSync(MIGRATIONS).filter(name => name.endsWith('.sql')).sort().map(name => ({ name, sql: fs.readFileSync(path.join(MIGRATIONS, name), 'utf8') }))
  const manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8')).functions
  const { problems, exposed } = auditSecurityDefiner(replayMigrations(files), manifest)
  if (process.argv.includes('--list')) for (const { fn, anon, authenticated } of exposed) console.log(`${fn.key}\tanon=${anon}\tauth=${authenticated}\ttrigger=${fn.trigger}`)
  if (problems.length) { console.error(`Security definer audit failed (${problems.length}):\n- ${problems.join('\n- ')}`); process.exit(1) }
  console.log(`Security definer audit passed: ${exposed.length} exposed SECURITY DEFINER functions, all declared and guarded.`)
}
