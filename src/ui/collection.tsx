// Adapted from shadcn/ui, discovered via 21st.dev. See docs/UI_COMPONENTS.md.
import type { ComponentProps } from 'react'

export function Empty({ className = '', ...props }: ComponentProps<'div'>) {
  return <div data-slot="empty" className={`flex min-w-0 flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-stone-300 bg-white/60 px-6 py-10 text-center ${className}`} {...props} />
}

export function EmptyHeader({ className = '', ...props }: ComponentProps<'div'>) {
  return <div data-slot="empty-header" className={`flex max-w-sm flex-col items-center gap-2 ${className}`} {...props} />
}

export function EmptyTitle(props: ComponentProps<'h3'>) {
  return <h3 data-slot="empty-title" {...props} className={`text-lg font-semibold tracking-tight ${props.className ?? ''}`} />
}

export function EmptyDescription(props: ComponentProps<'p'>) {
  return <p data-slot="empty-description" {...props} className={`text-sm leading-relaxed text-stone-600 ${props.className ?? ''}`} />
}

export function Skeleton({ className = '', ...props }: ComponentProps<'div'>) {
  return <div data-slot="skeleton" className={`rounded-md bg-stone-200 motion-safe:animate-pulse ${className}`} {...props} />
}

/** Placeholder rows while a list loads from the phone, in place of a line of "Loading…" text. */
export function ListSkeleton({ label, rows = 3, className = '' }: { label: string; rows?: number; className?: string }) {
  return (
    <div role="status" className={className}>
      <span className="sr-only">{label}</span>
      <div aria-hidden="true" className="space-y-3">
        {Array.from({ length: rows }, (_, i) => <Skeleton key={i} className={`h-5 ${i % 2 ? 'w-1/2' : 'w-3/4'}`} />)}
      </div>
    </div>
  )
}

export function CardHeader(props: ComponentProps<'div'>) {
  return <div data-slot="card-header" {...props} className={`grid gap-2 ${props.className ?? ''}`} />
}

export function CardTitle(props: ComponentProps<'h2'>) {
  return <h2 data-slot="card-title" {...props} className={`text-lg font-semibold tracking-tight ${props.className ?? ''}`} />
}

export function CardDescription(props: ComponentProps<'p'>) {
  return <p data-slot="card-description" {...props} className={`text-sm leading-relaxed text-stone-600 ${props.className ?? ''}`} />
}
