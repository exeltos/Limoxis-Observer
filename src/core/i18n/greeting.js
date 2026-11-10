// The greeting by the time of day, with the first name (the Greek vocative of the
// common endings: Άρης → Άρη, Νίκος → Νίκο, Κώστας → Κώστα); a leading «Δρ.» is left out.
export function greetingOf(tx,fullName,now=new Date()){
  const hour=now.getHours()
  const hello=hour>=5&&hour<12?tx('Καλημέρα','Good morning'):hour>=12&&hour<18?tx('Καλησπέρα','Good afternoon'):tx('Καλησπέρα','Good evening')
  const first=String(fullName||'').trim().replace(/^(Δρ|Dr)\.?\s+/i,'').split(/\s+/)[0]||''
  if(!first||first.includes('@'))return hello
  const greek=/[Ͱ-Ͽἀ-῿]/.test(first)
  const name=!greek||tx('el','en')==='en'?first:first.replace(/ος$/,'ο').replace(/ός$/,'ό').replace(/(η|ή|α|ά|ου)ς$/,'$1')
  return `${hello}, ${name}`
}
