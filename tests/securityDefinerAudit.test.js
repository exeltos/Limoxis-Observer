import { describe, expect, it } from 'vitest'
import { auditSecurityDefiner, exposure, replayMigrations, splitStatements } from '../tools/check-security-definer.mjs'

const fnSql = (name, { definer = true, trigger = false, body = 'select auth.uid() is not null' } = {}) => `
create or replace function public.${name}(p_org uuid) returns ${trigger ? 'trigger' : 'boolean'}
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
    expect(exposure(fns.get('a'))).toEqual({ anon: true, authenticated: true })
    fns = replay(fnSql('a'), 'revoke execute on function public.a(uuid) from public, anon; grant execute on function public.a(uuid) to authenticated;')
    expect(exposure(fns.get('a'))).toEqual({ anon: false, authenticated: true })
    fns = replay(fnSql('a'), 'revoke all on function public.a(uuid) from public, anon, authenticated;', fnSql('a'))
    expect(exposure(fns.get('a'))).toEqual({ anon: false, authenticated: false })
    fns = replay(fnSql('a'), 'revoke all on function public.a(uuid) from public, anon, authenticated;', 'drop function if exists public.a(uuid);', fnSql('a'))
    expect(exposure(fns.get('a'))).toEqual({ anon: true, authenticated: true })
    fns = replay('alter default privileges for role postgres in schema public revoke execute on functions from anon;', fnSql('a'), 'revoke execute on function public.a(uuid) from public;')
    expect(exposure(fns.get('a'))).toEqual({ anon: false, authenticated: true })
  })

  it('fails on undeclared, mismatched, unguarded or callable trigger functions', () => {
    const locked = name => `revoke execute on function public.${name}(uuid) from public, anon; grant execute on function public.${name}(uuid) to authenticated;`
    const fns = replay(fnSql('declared'), locked('declared'), fnSql('undeclared'), locked('undeclared'), fnSql('unguarded', { body: 'select true' }), locked('unguarded'), fnSql('trg', { trigger: true }), fnSql('invoker', { definer: false }))
    const { problems } = auditSecurityDefiner(fns, {
      declared: { category: 'rpc', authenticated: true, reason: 'ok' },
      unguarded: { category: 'rpc', authenticated: true, reason: 'ok' },
      gone: { category: 'rpc', authenticated: true, reason: 'ok' },
    })
    expect(problems.join('\n')).toMatch(/undeclared: .*not declared/)
    expect(problems.join('\n')).toMatch(/unguarded: rpc has no caller check/)
    expect(problems.join('\n')).toMatch(/trg: trigger function is executable/)
    expect(problems.join('\n')).toMatch(/gone: listed .* remove the entry/)
    expect(problems.join('\n')).not.toMatch(/declared: .*exposure|invoker/)
  })

  it('only lets public-token functions reach anon', () => {
    const fns = replay(fnSql('open'))
    const { problems } = auditSecurityDefiner(fns, { open: { category: 'rpc', anon: true, authenticated: true, reason: 'x' } })
    expect(problems.join('\n')).toMatch(/only public-token functions may be callable by anon/)
  })
})
