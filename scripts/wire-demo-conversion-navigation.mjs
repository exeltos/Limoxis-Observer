import fs from 'node:fs'
const path='src/features/workspaces/PlatformCenterPage.jsx'
let s=fs.readFileSync(path,'utf8')
const old=`          onChanged={updated =>
            setDemos(current => current.map(item => (item.id === updated.id ? updated : item)))
          }
          onDeleted={id => {
            setDemos(current => current.filter(item => item.id !== id))
            nav('/platform#demo')
          }}`
const next=`          onChanged={updated =>
            setDemos(current => current.map(item => (item.id === updated.id ? updated : item)))
          }
          onConverted={async organization => {
            setDemos(current => current.filter(item => item.id !== selectedDemo.id))
            await reloadMemberships()
            await refreshPlatformData()
            nav(\`/platform#organizations?organization=\${organization.id}&tab=details\`, {
              state: { returnTo: '/platform#organizations' },
            })
          }}
          onDeleted={id => {
            setDemos(current => current.filter(item => item.id !== id))
            nav('/platform#demo')
          }}`
if(!s.includes(old)) throw new Error('Demo callback block not found')
s=s.replace(old,next)
fs.writeFileSync(path,s)
