import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { allowedOrigin, PRIMARY_ORIGIN } from '../supabase/functions/_shared/cors.ts'
import { APP_VERSION } from '../src/core/version.js'

const root = path.resolve(__dirname, '..')
const read = file => fs.readFileSync(path.join(root, file), 'utf8')
const functionsDir = path.join(root, 'supabase/functions')
const functionNames = fs.readdirSync(functionsDir).filter(name => !name.startsWith('_') && fs.existsSync(path.join(functionsDir, name, 'index.ts')))
// Called only by the scheduler with a service key, never from a browser.
const serverOnly = new Set(['platform-scheduled-tasks'])

function sourceFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) return sourceFiles(full)
    return /\.(js|jsx)$/.test(entry.name) ? [full] : []
  })
}

describe('hosting security headers', () => {
  const headers = read('public/_headers')
  const csp = headers.match(/Content-Security-Policy: (.*)/)?.[1] || ''

  it('sends a CSP that allows scripts only from the app itself', () => {
    expect(csp).toContain("script-src 'self';")
    expect(csp).toContain("object-src 'none'")
    expect(csp).toContain("frame-ancestors 'self'")
    expect(csp).not.toMatch(/script-src[^;]*unsafe-(inline|eval)/)
  })

  it('names the same Supabase project as the app configuration', () => {
    const supabaseHost = new URL(read('.env.example').match(/VITE_SUPABASE_URL=(.*)/)[1].trim()).host
    expect(csp).toContain(`https://${supabaseHost}`)
    expect(csp).toContain(`wss://${supabaseHost}`)
  })

  it('sends HSTS, nosniff and long caching for hashed assets', () => {
    expect(headers).toMatch(/Strict-Transport-Security: max-age=\d{8,}/)
    expect(headers).toContain('X-Content-Type-Options: nosniff')
    expect(headers).toMatch(/\/assets\/\*\n\s+Cache-Control: public, max-age=31536000, immutable/)
  })

  it('opens printable documents without inline scripts, which the CSP blocks', () => {
    const offenders = sourceFiles(path.join(root, 'src')).filter(file => /<script[\s>]/.test(fs.readFileSync(file, 'utf8')))
    expect(offenders.map(file => path.relative(root, file))).toEqual([])
  })
})

describe('edge function CORS', () => {
  it('answers only the app domains', () => {
    expect(allowedOrigin('https://www.limoxis.com')).toBe('https://www.limoxis.com')
    expect(allowedOrigin('https://limoxis-observer.netlify.app')).toBe('https://limoxis-observer.netlify.app')
    expect(allowedOrigin('https://deploy-preview-12--limoxis-observer.netlify.app')).toBe('https://deploy-preview-12--limoxis-observer.netlify.app')
    expect(allowedOrigin('https://evil.example')).toBe(PRIMARY_ORIGIN)
    expect(allowedOrigin('https://evil--limoxis-observer.netlify.app.example')).toBe(PRIMARY_ORIGIN)
    expect(allowedOrigin(null)).toBe(PRIMARY_ORIGIN)
  })

  it.each(functionNames)('%s does not allow every origin', name => {
    const source = read(`supabase/functions/${name}/index.ts`)
    expect(source).not.toMatch(/Access-Control-Allow-Origin['"]?\s*:\s*['"]\*['"]/)
    if (!serverOnly.has(name)) expect(source).toContain('serveWithCors(')
  })
})

describe('version', () => {
  it('is the same in package.json and in the app', () => {
    expect(JSON.parse(read('package.json')).version).toBe(APP_VERSION)
  })
})
