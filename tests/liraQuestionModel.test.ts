import { describe, expect, it } from 'vitest'
import { interpretLiraQuestion, LIRA_INTENTS, LIRA_TOPICS } from '../src/features/lira/liraQuestionModel'

describe('LIRA infection-quality question understanding', () => {
  it('understands AMR trend questions with inferred scope', () => {
    const plan=interpretLiraQuestion('Υπάρχει αύξηση MDR/XDR στη ΜΕΘ τις τελευταίες 30 ημέρες;', {scope:{department:'ΜΕΘ',periodDays:30}})
    expect(plan.intent).toBe(LIRA_INTENTS.TREND)
    expect(plan.topic).toBe(LIRA_TOPICS.AMR)
    expect(plan.department).toBe('ΜΕΘ')
    expect(plan.periodDays).toBe(30)
  })

  it('recognizes cluster questions without declaring an outbreak', () => {
    const plan=interpretLiraQuestion('Υπάρχει πιθανή συρροή Klebsiella στη ΜΕΘ;', {scope:{department:'ΜΕΘ',periodDays:0}})
    expect(plan.intent).toBe(LIRA_INTENTS.CLUSTER)
    expect(plan.topic).toBe(LIRA_TOPICS.INFECTIONS)
    expect(plan.entity).toBe('klebsiella')
  })

  it('recognizes infection-control and quality workflows', () => {
    expect(interpretLiraQuestion('Ποιες CAPA είναι εκπρόθεσμες;').topic).toBe(LIRA_TOPICS.CAPA)
    expect(interpretLiraQuestion('Πού έχουμε χαμηλή συμμόρφωση στην υγιεινή χεριών;').topic).toBe(LIRA_TOPICS.HAND_HYGIENE)
    expect(interpretLiraQuestion('Έχουμε κρίσιμα εργαστηριακά αποτελέσματα;').topic).toBe(LIRA_TOPICS.LABORATORY)
    expect(interpretLiraQuestion('Ποιο τμήμα έχει τα περισσότερα συμβάντα;').intent).toBe(LIRA_INTENTS.RANKING)
  })

  it('carries subject context into short follow-up questions', () => {
    const first=interpretLiraQuestion('Έχουμε αύξηση Klebsiella;', {scope:{department:'all',periodDays:30}})
    const follow=interpretLiraQuestion('Και στη ΜΕΘ;', {scope:{department:'ΜΕΘ',periodDays:0},previousPlan:first})
    expect(follow.entity).toBe('klebsiella')
    expect(follow.topic).toBe(LIRA_TOPICS.INFECTIONS)
    expect(follow.department).toBe('ΜΕΘ')
    expect(follow.periodDays).toBe(30)
  })

  it('detects explanation and comparison intents', () => {
    expect(interpretLiraQuestion('Γιατί μου δείχνεις αυξημένο κίνδυνο στη ΜΕΘ;').intent).toBe(LIRA_INTENTS.EXPLANATION)
    expect(interpretLiraQuestion('Πώς είμαστε σε σχέση με τον προηγούμενο μήνα;').intent).toBe(LIRA_INTENTS.COMPARISON)
  })

  it('treats what changed or worsened as a cross-domain operational question',()=>{
    const changed=interpretLiraQuestion('Τι άλλαξε στη ΜΕΘ σε σχέση με τον προηγούμενο μήνα;',{scope:{department:'ΜΕΘ',periodDays:0}})
    expect(changed.topic).toBe(LIRA_TOPICS.GENERAL)
    expect(changed.operationalChange).toBe(true)
    expect(changed.intent).toBe(LIRA_INTENTS.COMPARISON)
    const worsened=interpretLiraQuestion('Τι χειροτέρεψε περισσότερο στη ΜΕΘ;',{scope:{department:'ΜΕΘ',periodDays:0},previousPlan:changed})
    expect(worsened.topic).toBe(LIRA_TOPICS.GENERAL)
    expect(worsened.entity).toBeNull()
    expect(worsened.operationalChange).toBe(true)
  })
})
