import { describe, expect, it } from 'vitest'
import { auditSecurityDefiner, exposure, functionBody, replayMigrations, signature, splitStatements } from '../tools/check-security-definer.mjs'

const fnSql = (name, { definer = true, trigger = false, body = 'select auth.uid() is not null', args = 'p_org uuid' } = {}) => `
create or replace function public.${name}(${args}) returns ${trigger ? 'trigger' : 'boolean'}
language sql ${definer ? 'security definer' : ''} set search_path = '' as $$ ${body}; $$;`
const replay = (...sqls) => replayMigrations(sqls.map((sql, i) => ({ name: `${i}.sql`, sql })))

describe('security definer audit', () => {
  it('splits statements without breaking dollar-quoted bodies', () => {
    const parts = splitStatements(`${fnSql('a', { body: "select 1; select ';'" })}\n-- note; here\nrevoke all on function public.a(uuid) from public;`)
    expect(parts).toHaveLength(2)
    expect(parts[1]).toMatch(/^revoke/)
  })

  it('replays default grants, revokes, grants and drops', () => {
    let fns = replay(fnSql('a'))
    expect(exposure(fns.get('a(uuid)'))).toEqual({ anon: true, authenticated: true })
    fns = replay(fnSql('a'), 'revoke execute on function public.a(uuid) from public, anon; grant execute on function public.a(uuid) to authenticated;')
    expect(exposure(fns.get('a(uuid)'))).toEqual({ anon: false, authenticated: true })
    fns = replay(fnSql('a'), 'revoke all on function public.a(uuid) from public, anon, authenticated;', fnSql('a'))
    expect(exposure(fns.get('a(uuid)'))).toEqual({ anon: false, authenticated: false })
    fns = replay(fnSql('a'), 'revoke all on function public.a(uuid) from public, anon, authenticated;', 'drop function if exists public.a(uuid);', fnSql('a'))
    expect(exposure(fns.get('a(uuid)'))).toEqual({ anon: true, authenticated: true })
    fns = replay('alter default privileges for role postgres in schema public revoke execute on functions from anon;', fnSql('a'), 'revoke execute on function public.a(uuid) from public;')
    expect(exposure(fns.get('a(uuid)'))).toEqual({ anon: false, authenticated: true })
  })

  it('fails on undeclared, mismatched, unguarded or callable trigger functions', () => {
    const locked = name => `revoke execute on function public.${name}(uuid) from public, anon; grant execute on function public.${name}(uuid) to authenticated;`
    const fns = replay(fnSql('declared'), locked('declared'), fnSql('undeclared'), locked('undeclared'), fnSql('unguarded', { body: 'select true' }), locked('unguarded'), fnSql('trg', { trigger: true }), fnSql('invoker', { definer: false }))
    const { problems } = auditSecurityDefiner(fns, {
      declared: { category: 'rpc', authenticated: true, reason: 'ok' },
      unguarded: { category: 'rpc', authenticated: true, reason: 'ok' },
      gone: { category: 'rpc', authenticated: true, reason: 'ok' },
    })
    expect(problems.join('\n')).toMatch(/undeclared\(uuid\): .*not declared/)
    expect(problems.join('\n')).toMatch(/unguarded\(uuid\): rpc body has no caller check/)
    expect(problems.join('\n')).toMatch(/trg\(uuid\): trigger function is executable/)
    expect(problems.join('\n')).toMatch(/gone: listed .* remove the entry/)
    expect(problems.join('\n')).not.toMatch(/^declared|invoker/m)
  })

  it('only lets public-token functions reach anon', () => {
    const fns = replay(fnSql('open'))
    const { problems } = auditSecurityDefiner(fns, { open: { category: 'rpc', anon: true, authenticated: true, reason: 'x' } })
    expect(problems.join('\n')).toMatch(/only public-token functions may be callable by anon/)
  })

  it('normalises identity signatures and reads only the function body', () => {
    expect(signature('p_org uuid, p_from date default null, out total bigint, p_roles public.app_role[] = null')).toBe('uuid,date,app_role[]')
    expect(signature('timestamptz, int4, p_flag bool')).toBe('timestamp with time zone,integer,boolean')
    expect(functionBody("create function public.f(p_token text) returns int language sql as $body$ select 1 $body$")).toBe(' select 1 ')
  })

  it('tracks overloads separately', () => {
    const fns = replay(fnSql('f', { args: 'p_org uuid' }), fnSql('f', { args: 'p_org uuid, p_to date' }), 'revoke execute on function public.f(uuid, date) from public, anon, authenticated;')
    expect(exposure(fns.get('f(uuid)'))).toEqual({ anon: true, authenticated: true })
    expect(exposure(fns.get('f(uuid,date)'))).toEqual({ anon: false, authenticated: false })
    const { problems } = auditSecurityDefiner(fns, {})
    expect(problems.join('\n')).toMatch(/f\(uuid\): .*not declared/)
  })

  it('requires a public-token body to compare the token, not just declare it', () => {
    const manifest = { tok: { category: 'public-token', anon: true, authenticated: true, reason: 'x' } }
    let fns = replay(fnSql('tok', { args: 'p_token text', body: 'select true' }))
    expect(auditSecurityDefiner(fns, manifest).problems.join('\n')).toMatch(/never compares p_token/)
    fns = replay(fnSql('tok', { args: 'p_token text', body: "select exists(select 1 from t where payload->>'accessToken'=p_token)" }))
    expect(auditSecurityDefiner(fns, manifest).problems).toEqual([])
  })

  it('does not accept a caller check that only appears in the parameter list', () => {
    const fns = replay(fnSql('rpc', { args: 'p_uid uuid default auth.uid()', body: 'select true' }))
    expect(auditSecurityDefiner(fns, { rpc: { category: 'rpc', anon: true, authenticated: true, reason: 'x' } }).problems.join('\n')).toMatch(/rpc body has no caller check/)
  })
})
