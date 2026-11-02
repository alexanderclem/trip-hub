// Apply the saved choice before the stylesheet paints. A blocked store falls back to the system.
(() => {
  let appearance = 'system'
  try { appearance = localStorage.getItem('stowaway-appearance') || 'system' } catch { /* Storage is optional. */ }
  const dark = appearance === 'dark' || (appearance !== 'light' && matchMedia('(prefers-color-scheme: dark)').matches)
  document.documentElement.dataset.theme = dark ? 'stowaway-dark' : 'stowaway-light'
})()
