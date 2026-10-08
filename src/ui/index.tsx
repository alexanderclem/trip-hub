// Shared UI primitives, styled to match the adapted shadcn collection.
import { useEffect, useRef, useState } from 'react'
import type { ComponentProps, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react'
import { Link } from 'react-router'
import { CalendarDays, ChevronLeft } from 'lucide-react'
import { dateOrder, formatTypedDate, parseTypedDate } from '@/lib/time'
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
const DATE_HINT = { MDY: 'MM/DD/YYYY', DMY: 'DD/MM/YYYY', YMD: 'YYYY-MM-DD' }

type DateInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'value' | 'onChange' | 'min' | 'max'> & {
  /** 'yyyy-MM-dd', or '' for no date. */
  value: string
  onValue: (date: string) => void
  min?: string
  max?: string
}

/**
 * A date field. With a mouse and keyboard the date can be typed or pasted (06/04/2027,
 * 2027-06-04, Jun 4 2027) and the calendar is a button beside it. Phones keep their own date
 * wheel, which is quicker there than a keyboard.
 */
export function DateInput({ value, onValue, min, max, className, ...props }: DateInputProps) {
  const [touch] = useState(() => typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches)
  const [order] = useState(() => dateOrder())
  const [text, setText] = useState(() => formatTypedDate(value, order))
  const [flagged, setFlagged] = useState(false)
  const field = useRef<HTMLInputElement>(null)
  const picker = useRef<HTMLInputElement>(null)
  const typed = parseTypedDate(text, order)

  // Follow the form when it changes the date itself, without rewriting what's being typed.
  useEffect(() => {
    setText((cur) => ((parseTypedDate(cur, order) ?? '') === value ? cur : formatTypedDate(value, order)))
  }, [value, order])
  // Text that isn't a date blocks the form with a message, instead of the old date being saved quietly.
  useEffect(() => {
    const show = (date: string) => formatTypedDate(date, order)
    field.current?.setCustomValidity(
      !text.trim() ? ''
        : !typed ? `Enter a date like ${show('2027-06-04')}.`
        : min && typed < min ? `Choose ${show(min)} or later.`
        : max && typed > max ? `Choose ${show(max)} or earlier.`
        : '',
    )
  }, [text, typed, min, max, order])

  if (touch) return <input {...props} type="date" value={value} min={min} max={max} onChange={(e) => onValue(e.target.value)} className={fieldCls(className)} />
  return (
    <div className="relative">
      <input
        placeholder={DATE_HINT[order]}
        {...props}
        ref={field}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        value={text}
        aria-invalid={flagged || props['aria-invalid']}
        onChange={(e) => {
          setText(e.target.value)
          setFlagged(false)
          const date = parseTypedDate(e.target.value, order)
          if (date) onValue(date)
          else if (!e.target.value.trim()) onValue('')
        }}
        onBlur={(e) => {
          if (typed) setText(formatTypedDate(typed, order))
          setFlagged(!!text.trim() && !typed)
          props.onBlur?.(e)
        }}
        className={cx(fieldCls(className), 'pr-11')}
      />
      {/* The browser's calendar, opened from the button. It belongs to no form (form=""), so it is never validated or submitted. */}
      <input ref={picker} type="date" form="" tabIndex={-1} aria-hidden="true" value={value} min={min} max={max} disabled={props.disabled} onChange={(e) => onValue(e.target.value)} className="pointer-events-none absolute bottom-0 right-0 size-0 opacity-0" />
      <button type="button" aria-label="Choose from a calendar" disabled={props.disabled} onClick={() => picker.current?.showPicker()} className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-xl text-stone-500 hover:text-brand-700 disabled:opacity-60">
        <CalendarDays aria-hidden="true" className="size-5" />
      </button>
    </div>
  )
}

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
