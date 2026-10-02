/** Shared, offline-ready Stowaway lockup. The SVG is also the app icon source. */
export function Brand({ className = '' }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2.5 text-brand-900 ${className}`}>
      <img src="/brand/stowaway-mark.svg" alt="" width="44" height="44" className="size-11 shrink-0" />
      <span className="brand-wordmark">stowaway<span className="text-brand-accent">.</span></span>
    </span>
  )
}
