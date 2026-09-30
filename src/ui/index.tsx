// Shared UI primitives, styled to match the adapted shadcn collection.
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react'
import { Link } from 'react-router'
import { ChevronLeft } from 'lucide-react'

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ')

export function Button({
  variant = 'primary',
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'danger' | 'ghost' }) {
  return (
    <button
      {...props}
      className={cx(
        'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 py-2.5 font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40',
        variant === 'primary' && 'bg-brand-700 text-white shadow-sm hover:bg-brand-900 active:bg-brand-900',
        variant === 'secondary' && 'border border-stone-300 bg-white text-stone-800 hover:bg-stone-50 active:bg-stone-100',
        variant === 'danger' && 'border border-red-200 bg-white text-red-700 hover:bg-red-50 active:bg-red-100',
        variant === 'ghost' && 'text-brand-700 hover:bg-brand-50 active:bg-brand-100',
        className,
      )}
    />
  )
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

const inputCls =
  'w-full rounded-xl border border-stone-300 bg-white px-3 py-2.5 text-base outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100 disabled:cursor-not-allowed disabled:bg-stone-100 disabled:opacity-60 aria-invalid:border-red-500'

export const Input = (props: InputHTMLAttributes<HTMLInputElement>) => (
  <input {...props} className={cx(inputCls, props.className)} />
)
export const Select = (props: SelectHTMLAttributes<HTMLSelectElement>) => (
  <select {...props} className={cx(inputCls, props.className)} />
)
export const Textarea = (props: TextareaHTMLAttributes<HTMLTextAreaElement>) => (
  <textarea rows={3} {...props} className={cx(inputCls, props.className)} />
)

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <section className={cx('rounded-2xl border border-stone-200 bg-white p-4 shadow-sm', className)}>{children}</section>
}

export function PageHeader({ title, back, action }: { title: string; back?: string; action?: ReactNode }) {
  return (
    <header className="pt-safe sticky top-0 z-10 border-b border-stone-200 bg-stone-50/95 backdrop-blur">
      <div className="flex h-12 items-center gap-1 px-2">
        {back ? (
          <Link to={back} className="flex size-10 items-center justify-center rounded-full active:bg-stone-200" aria-label="Back">
            <ChevronLeft className="size-6" />
          </Link>
        ) : (
          <span className="w-2" />
        )}
        <h1 className="min-w-0 flex-1 truncate text-lg font-semibold">{title}</h1>
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
