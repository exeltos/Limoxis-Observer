// The answer to a participation request (owner, 21/11/2026): the requester's notice in the bell, written by the decision
// itself (supabase/migrations/20261231607000_training_request_decision_notice.sql), shown in the user's language, and the
// requester's «Ακύρωση αίτησης» / «Νέα αίτηση» in the «Εγώ» column.
import { describe, expect, it } from 'vitest'
import { readSource } from './helpers/readSource'
import { localizeTrainingDecisionNotice, trainingDecisionNoticeLink, trainingDecisionNoticeText } from '../src/features/training/trainingDecisionNotice'

const sql = readSource('supabase/migrations/20261231607000_training_request_decision_notice.sql')
const code = sql.replace(/--[^\n]*/g, '')
const original = readSource('supabase/migrations/20261231606000_training_participation_requests.sql')
const originalDecide = original.slice(original.indexOf('create or replace function private.training_decide_participation'), original.indexOf('create or replace function public.training_decide_participation'))

describe('the migration', () => {
  it('only replaces the private decision function, as SECURITY DEFINER with an empty search_path', () => {
    expect(code.match(/create or replace function [a-z_.]+/g)).toEqual(['create or replace function private.training_decide_participation'])
    expect(code).toContain('security definer')
    expect(code).toContain("set search_path to ''")
    expect(code).not.toMatch(/\b(drop|revoke|alter|truncate|grant)\b|\bdelete\b/i)
  })

  it('keeps every check and write of the original decision', () => {
    for (const line of originalDecide.split('\n').map(text => text.trim()).filter(Boolean)) expect(sql).toContain(line)
  })

  it('notifies only the requester, on acceptance and on rejection, with a link to Training', () => {
    const inserts = code.match(/insert into public\.management_announcements[\s\S]*?;/g) || []
    expect(inserts).toHaveLength(2)
    for (const insert of inserts) {
      expect(insert).toContain("'user', jsonb_build_array(v_request.requester_user_id::text)")
      expect(insert).toContain("'/training?request=' || v_request.id::text || '&decision=")
      expect(insert).toContain("now() + interval '30 days'")
    }
    expect(inserts[0]).toContain("'» απορρίφθηκε'")
    expect(inserts[0]).toContain("'Αιτιολογία: ' || left(btrim(p_reason), 1000)")
    expect(inserts[0]).toContain("&decision=rejected'")
    expect(inserts[1]).toContain("'» εγκρίθηκε'")
    expect(inserts[1]).toContain("&decision=accepted'")
    // The notice is written after the request changes and before the function returns.
    expect(code.indexOf("set status = 'rejected'")).toBeLessThan(code.indexOf(inserts[0]))
    expect(code.indexOf("set status = 'accepted'")).toBeLessThan(code.indexOf(inserts[1]))
    expect(code).not.toContain('notification_outbox')
  })
})

describe('the notice text', () => {
  it('reads the database’s Greek notice in English', () => {
    const rejected = { title: 'Η αίτησή σας για «Υγιεινή χεριών» απορρίφθηκε', message: 'Αιτιολογία: Δεν υπάρχουν θέσεις', linkPath: trainingDecisionNoticeLink('r1', 'rejected') }
    expect(localizeTrainingDecisionNotice(rejected, 'en')).toEqual({ title: 'Your request for “Υγιεινή χεριών” was rejected', message: 'Reason: Δεν υπάρχουν θέσεις' })
    expect(localizeTrainingDecisionNotice(rejected, 'el')).toEqual({ title: rejected.title, message: rejected.message })
    const accepted = { ...trainingDecisionNoticeText('accepted', 'ΜΕΘ «βασικά»', '', 'el'), linkPath: trainingDecisionNoticeLink('r2', 'accepted') }
    expect(localizeTrainingDecisionNotice(accepted, 'en')?.title).toBe('Your request for “ΜΕΘ «βασικά»” was accepted')
    expect(localizeTrainingDecisionNotice({ title: 'Ανακοίνωση', message: 'x', linkPath: '/documents/1' }, 'en')).toBeNull()
  })

  it('matches the text the database writes', () => {
    expect(sql).toContain("'Η αίτησή σας για «'")
    expect(sql).toContain(`'${trainingDecisionNoticeText('accepted', '', '', 'el').message}'`)
  })

  it('is localized in the bell and added to the Demo’s announcements on a decision', () => {
    expect(readSource('src/core/notifications/NotificationContext.tsx')).toContain('localizeTrainingDecisionNotice(a,language)')
    const page = readSource('src/features/training/TrainingProductionPage.tsx')
    expect(page).toContain('if(isDemo){const program=state.programs.find(item=>item.id===request.programId);notifications.addAnnouncement({...trainingDecisionNoticeText(')
  })
})

describe('the requester’s actions', () => {
  const view = readSource('src/features/training/useTrainingOwnActions.tsx')
  it('cancels a waiting request after a confirmation, through the service', () => {
    expect(view).toContain("label={tr('Ακύρωση αίτησης','Cancel request')}")
    expect(view).toContain("if(!await confirm({title:tr('Ακύρωση αίτησης','Cancel request'),")
    expect(view).toContain("confirmLabel:tr('Απόσυρση αίτησης','Withdraw request'),danger:true}))return")
    expect(view).toContain('setRequests(await cancelTrainingRequestAsync(organizationId,request.id))')
    expect(view).toContain("if(!request||request.status!=='pending'||cancelBusyId)return")
  })
  it('offers «Νέα αίτηση» after a rejection while the programme is open', () => {
    expect(view).toContain("{row.state!=='completed'&&<Button variant=\"secondary\" className=\"training-my-open\" onClick={event=>{event.stopPropagation();setRequesting(row);setRequestNote('')}}><Send size={14}/>{tr('Νέα αίτηση','New request')}</Button>}")
  })
})
