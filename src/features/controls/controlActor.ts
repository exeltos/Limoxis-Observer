import type { AnyRecord } from '../../types/featureTypes'

export function controlActorFromAuth({profile,user}:{profile?:AnyRecord|null,user?:AnyRecord|null}={}){
 return {
  id: profile?.id || user?.id || 'unknown',
  name: profile?.fullName || user?.email || 'Άγνωστος χρήστης',
  email: profile?.email || user?.email || '',
 }
}
