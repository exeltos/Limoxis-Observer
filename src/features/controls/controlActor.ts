import type { ControlActor } from './controlTypes'

export function controlActorFromAuth({profile,user}:{profile?:{id?:string|null,fullName?:string|null,email?:string|null}|null,user?:{id?:string|null,email?:string|null}|null}={}):ControlActor{
 return {
  id: profile?.id || user?.id || 'unknown',
  name: profile?.fullName || user?.email || 'Άγνωστος χρήστης',
  email: profile?.email || user?.email || '',
 }
}
