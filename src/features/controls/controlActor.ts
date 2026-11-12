export function controlActorFromAuth({profile,user}={}){
 return {
  id: profile?.id || user?.id || 'unknown',
  name: profile?.fullName || user?.email || 'Άγνωστος χρήστης',
  email: profile?.email || user?.email || '',
 }
}
