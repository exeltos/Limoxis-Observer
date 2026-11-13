import {describe,expect,it} from 'vitest'
import { readSource } from './helpers/readSource'
const service=readSource(new URL('../src/features/training/trainingInvitationService.js',import.meta.url))
describe('training invitation client',()=>{it('uses the authenticated training RPC workflow',()=>{expect(service).toContain("supabase.rpc('queue_training_invitation'");expect(service).toContain("supabase.rpc('training_email_access'");expect(service).toContain("supabase.rpc('training_submit_evaluation'")});it('processes queued invitations through the notification worker',()=>{expect(service).toContain("supabase.functions.invoke('process-notification-outbox'")})})
