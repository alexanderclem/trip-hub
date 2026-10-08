// Shared UI primitives, styled to match the adapted shadcn collection.
import type { ComponentProps, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react'
import { Link } from 'react-router'
import { ChevronLeft } from 'lucide-react'
import { m, type HTMLMotionProps } from 'motion/react'
import { useMotionPreference } from './MotionProvider'
import { motionTiming } from './motion'

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ')
const MotionLink = m.create(Link)

export function Button({
  variant = 'primary',
  className,
  ...props
}: HTMLMotionProps<'button'> & { variant?: 'primary' | 'secondary' | 'danger' | 'ghost' }) {
  const reducedMotion = useMotionPreference()
  return (
    <m.button
      whileHover={!reducedMotion && !props.disabled ? { y: -1 } : undefined}
      whileTap={!reducedMotion && !props.disabled ? { scale: 0.98 } : undefined}
      transition={motionTiming.feedback}
      {...props}
      className={cx(
        'ui-button', `ui-button-${variant}`,
        className,
      )}
    />
  )
}

export function LinkButton({ variant = 'primary', className, ...props }: ComponentProps<typeof MotionLink> & { variant?: 'primary' | 'secondary' | 'ghost' }) {
  const reducedMotion = useMotionPreference()
  return <MotionLink whileHover={reducedMotion ? undefined : { y: -1 }} whileTap={reducedMotion ? undefined : { scale: 0.98 }} transition={motionTiming.feedback} {...props} className={cx('ui-button', `ui-button-${variant}`, className)} />
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-stone-700">{label}</span>
      <div className="mt-1">{children}</div>
      {hint && <span className="mt-1 block text-xs text-stone-500">{hint}</span>}
    </label>
  )
}

// Full width by default; a caller's own width (w-20, w-28, …) replaces it instead of fighting it
// in the stylesheet, where w-full would win.
const fieldCls = (className?: string) => cx(/(^|\s)w-/.test(className ?? '') ? '' : 'w-full', inputCls, className)
const inputCls =
  'rounded-xl border border-stone-300 bg-white px-3 py-2.5 text-base outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100 disabled:cursor-not-allowed disabled:bg-stone-100 disabled:opacity-60 aria-invalid:border-red-500'

export const Input = (props: InputHTMLAttributes<HTMLInputElement>) => (
  <input {...props} className={fieldCls(props.className)} />
)
export const Select = (props: SelectHTMLAttributes<HTMLSelectElement>) => (
  <select {...props} className={fieldCls(props.className)} />
)
export const Textarea = (props: TextareaHTMLAttributes<HTMLTextAreaElement>) => (
  <textarea rows={3} {...props} className={fieldCls(props.className)} />
)

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <section className={cx('ui-card', className)}>{children}</section>
}

export function PageHeader({ title, back, action }: { title: string; back?: string; action?: ReactNode }) {
  return (
    <header className="pt-safe sticky top-0 z-10 border-b border-stone-200 bg-canvas">
      <div className="flex min-h-14 flex-wrap items-center gap-2 px-3 py-2 lg:px-6">
        {back ? (
          <Link to={back} className="ui-icon-button shrink-0" aria-label="Back">
            <ChevronLeft aria-hidden="true" className="size-6" />
          </Link>
        ) : (
          <span className="w-2" />
        )}
        <h1 className="min-w-0 flex-1 break-words text-xl font-semibold text-brand-900">{title}</h1>
        {action}
      </div>
    </header>
  )
}

export function ErrorNote({ error }: { error: string | null }) {
  if (!error) return null
  return <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>
}

export function Avatar({ name, color, size = 'md' }: { name: string; color: string | null; size?: 'sm' | 'md' }) {
  const initials = name.trim().split(/\s+/).map((p) => p[0]).slice(0, 2).join('').toUpperCase()
  return (
    <span
      className={cx(
        'inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white',
        size === 'md' ? 'size-10 text-sm' : 'size-7 text-xs',
      )}
      style={{ background: color ?? '#78716c' }}
    >
      {initials}
    </span>
  )
}
