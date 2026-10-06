/**
 * Shared, offline-ready Stowaway lockup. The mark is also the app icon source.
 * The wordmark is drawn, not typed: its path is the one in public/brand/stowaway-type.svg.
 */
export function Brand({ className = '' }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2.5 text-brand-900 ${className}`}>
      <img src="/brand/stowaway-mark.svg" alt="" width="44" height="44" className="size-11 shrink-0" />
      <span className="brand-wordmark inline-flex">
        <span className="sr-only">Stowaway</span>
        <svg viewBox="0 40 834 180" fill="none" aria-hidden="true" className="h-[0.9em] w-auto">
          <path
            d="M56 101 C45 88 12 87 12 110 C12 131 58 125 58 146 C58 169 25 168 14 155 M109 54 V145 A20 20 0 0 0 129 165 H137 M93 91 H135 M171 128 A37 37 0 1 0 245 128 A37 37 0 1 0 171 128 Z M281 91 L300 165 L319 107 L338 165 L357 91 M391 128 A37 37 0 1 0 465 128 A37 37 0 1 0 391 128 Z M465 91 V165 M511 91 L530 165 L549 107 L568 165 L587 91 M621 128 A37 37 0 1 0 695 128 A37 37 0 1 0 621 128 Z M695 91 V165 M739 91 L765 161 M791 91 L751 205"
            stroke="currentColor"
            strokeWidth="22"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx="820" cy="163" r="13" className="fill-brand-accent" />
        </svg>
      </span>
    </span>
  )
}
