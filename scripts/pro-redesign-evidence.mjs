import { readdir, readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

// Generates the review artifact from actual local captures; no product source or remote access.
const folder = new URL('../.design/pro-redesign/', import.meta.url)
const screenshots = new URL('screenshots/', folder)
const files = (await readdir(screenshots)).filter(name => name.endsWith('.png')).sort()
const escape = text => text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;')
const annotations = {
  'home-planning-390.png': 'UX-01 HIGH: the task title and due date are white on white. CTA is visible; its purpose is missing.',
  'adapt-home-320-dark.png': 'UX-01: inverse foreground remains near the dark surface; reduced motion and 320px do not fix the contrast.',
  'plan-390.png': 'Keep: chronology, real confirmation, tentative state, explicit overlap. UX-03: Agenda measures only 40px high.',
  'money-390.png': 'UX-04: seven group settlements precede history. Preserve €10 owed and all arithmetic; reorder personal information.',
  'state-traveling-390.png': 'Keep: the next event and its real local ticket/map actions are prominent. No route estimate is invented.',
  'poll-closed-390.png': 'Keep explicit scheduling and booking semantics. UX-07: disclose optional linking and later steps.',
  'landing-390.png': 'UX-05: labeled example and Replay exist; score-shaped spans are an illustration, not visitor-controlled voting.',
  'offline-preparation-failed-390.png': 'Keep: partial preparation visibly fails and never claims Ready. Error recovery can become more concise.',
  'ticket-local-390.png': 'Synthetic PNG actually exists in IndexedDB and opens. This is not a real admission document.',
  'ticket-missing-390.png': 'Keep the distinction: the ticket record exists, but its file is not on this phone.',
  'paris-join-welcome-390.png': 'UX-02: installation copy implies map/ticket readiness without the separate per-phone downloads.',
  'group-roster-destination-390.png': 'UX-08: record the actual outcome of Home → 8 travelers. See roster-destination.json.',
}
const rows = files.map(name => `| [${name}](screenshots/${name}) | ${annotations[name] ?? 'Fresh Phase 01 baseline; compare identical fixture/clock/viewport after implementation.'} |`).join('\n')
await writeFile(new URL('SCREENSHOT_INDEX.md', folder), `# Actual Phase 01 screenshots\n\n${files.length} fresh PNG captures. All are BEFORE captures of the existing product. There is no redesigned AFTER state in Phase 01.\n\nClocks and fixture conditions: [BASELINE_TEST_MATRIX](BASELINE_TEST_MATRIX.md). All people and documents are synthetic. CSS pixels are encoded in filenames; screenshots use CSS scale.\n\n| Capture | Review note |\n| --- | --- |\n${rows}\n\nMachine observations: [phone metrics](screenshots/metrics-390.json), [desktop metrics](screenshots/metrics-1440.json), [control dimensions](screenshots/control-measurements.json), [group destination](screenshots/roster-destination.json).\n`)
const cards = files.map(name => `<article data-name="${escape(name)}"><a href="screenshots/${name}"><img src="screenshots/${name}" alt="${escape(name.replace('.png', '').replaceAll('-', ' '))}" loading="lazy"></a><h2>${escape(name)}</h2><p>${escape(annotations[name] ?? 'Current product baseline. Keep viewport, fixture and clock identical for the later comparison.')}</p></article>`).join('\n')
const html = `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Stowaway — Phase 01 baseline contact sheet</title><style>
*{box-sizing:border-box}body{margin:0;background:#f1f4f5;color:#17343f;font:16px/1.5 system-ui,sans-serif}header,main{max-width:1500px;margin:auto;padding:24px}header{border-bottom:1px solid #aab9bd}h1{font-size:clamp(1.7rem,4vw,2.6rem);line-height:1.15;margin:0 0 12px}header p{max-width:80ch}a{color:inherit}label{display:block;font-weight:600}input{display:block;width:min(100%,600px);min-height:44px;border:1px solid #6a7f87;border-radius:6px;margin:8px 0;padding:10px;font:inherit}a:focus-visible,input:focus-visible{outline:3px solid #17343f;outline-offset:3px}#gallery{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,260px),1fr));gap:24px}article{min-width:0;background:white;border:1px solid #cbd5d9;padding:12px;border-radius:8px}article img{width:100%;height:360px;object-fit:contain;object-position:top;background:#e8eef0}article h2{font-size:14px;overflow-wrap:anywhere}article p{font-size:14px}article[hidden]{display:none}.status{font-size:14px;color:#425f69}nav{display:flex;flex-wrap:wrap;gap:20px;margin:16px 0}</style>
<header><h1>Stowaway baseline contact sheet</h1><p>November 10, 2026 · source 69ea398 · ${files.length} fresh captures. <strong>Existing product, before redesign.</strong> The eight travelers and all documents are examples. Phase 01 changes no product UI; later phases must add matched before/after comparisons.</p><nav><a href="CURRENT_STATE.md">Findings</a><a href="TARGET_EXPERIENCE.md">Target architecture</a><a href="IMPLEMENTATION_PLAN.md">Implementation plan</a><a href="BASELINE_TEST_MATRIX.md">Tests and gaps</a></nav><label for="filter">Filter captures by screen, width or theme</label><input id="filter" type="search" placeholder="For example: money, 320, dark, ticket"><p id="count" role="status" class="status">${files.length} captures</p></header><main><div id="gallery">${cards}</div></main><script>
const field=document.querySelector('#filter'),cards=[...document.querySelectorAll('article')],status=document.querySelector('#count');field.addEventListener('input',()=>{let count=0;for(const card of cards){card.hidden=!card.dataset.name.includes(field.value.toLowerCase().trim());if(!card.hidden)count++}status.textContent=count+' captures'});
</script></html>`
await writeFile(new URL('BASELINE_GALLERY.html', folder), html)
const metrics = JSON.parse(await readFile(new URL('metrics-390.json', screenshots), 'utf8'))
console.log(JSON.stringify({ captures: files.length, gallery: fileURLToPath(new URL('BASELINE_GALLERY.html', folder)), priority: metrics.find(row => row.name === 'home-priority-color') }, null, 2))
