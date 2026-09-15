from pathlib import Path

p=Path('src/features/surveillance/NewSurveillanceFlow.jsx')
s=p.read_text(encoding='utf-8')

# A new surveillance must always start clean. Do not resurrect a recently-created episode
# merely because the creation dialog was reopened; persistence begins only after saveStart.
start=s.index("  useEffect(()=>{\n    function restoreCreated(event){")
end=s.index("\n\n  function chooseExistingPatient", start)
s=s[:start]+"  useEffect(()=>{\n    try{sessionStorage.removeItem(FLOW_RECOVERY_KEY)}catch{/* noop */}\n  },[])"+s[end:]

# The local state update is sufficient after the explicit first-step save; avoid a global
# creation event that can make another/reopened flow look persisted before user action.
s=s.replace("        window.dispatchEvent(new CustomEvent(FLOW_CREATED_EVENT,{detail:{record:created}}))\n","")
s=s.replace("const FLOW_CREATED_EVENT='limoxis-surveillance-flow-created'\n","")

# Give the flow a dedicated class for restrained visual polish.
s=s.replace('className="flow-step-card">','className="flow-step-card surveillance-flow-step-card">')

p.write_text(s,encoding='utf-8')
