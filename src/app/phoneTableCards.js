// On phones the registry tables of the content area are shown as cards
// (responsive.css, table.data-table). Each cell needs its column name for that:
// copy it from the table header into data-label whenever the content changes.
const TABLES = '.content table.data-table'

export function labelTableCells(root) {
  for (const table of root.querySelectorAll(TABLES)) {
    const labels = [...table.querySelectorAll(':scope>thead>tr>th')].map(th => th.textContent.trim())
    for (const tr of table.querySelectorAll(':scope>tbody>tr')) {
      let index = 0
      for (const td of tr.children) {
        const label = labels[index] || ''
        if (td.getAttribute('data-label') !== label) td.setAttribute('data-label', label)
        index += Number(td.getAttribute('colspan') || 1)
      }
    }
  }
}

export function watchTableCells(root = document.body) {
  let queued = false
  const run = () => { queued = false; labelTableCells(root) }
  const observer = new MutationObserver(() => { if (!queued) { queued = true; requestAnimationFrame(run) } })
  observer.observe(root, { childList: true, subtree: true, characterData: true })
  run()
  return () => observer.disconnect()
}
