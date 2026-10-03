import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { ArrowLeft, ArrowRight, Check, Compass } from 'lucide-react'
import { useDevice } from '@/data/device'
import { classify, type Scores } from '@/features/discovery/model'
import { RadarChart } from '@/features/discovery/RadarChart'
import { Button, ErrorNote } from '@/ui'
import { Brand } from '@/ui/Brand'
import { QUESTIONS, safeNext, scoreQuiz, tripIdOf, type Answers } from './quiz'
import { saveQuizResult } from './profile'

type Step = 'intro' | number | 'reveal'

/** The travel-style quiz: one this-or-that question per screen, then the radar it produced. */
export function QuizScreen() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const next = safeNext(params.get('next'))
  const tripId = tripIdOf(next)
  const memberId = useDevice((s) => (tripId ? (s.trips[tripId]?.memberId ?? null) : null))
  // A retake is anyone who already has a profile or skipped before; decided once, on arrival.
  const [retake] = useState(() => {
    const s = useDevice.getState()
    return s.quizSeen || s.travelProfile !== null
  })
  const [step, setStep] = useState<Step>('intro')
  const [answers, setAnswers] = useState<Answers>({})
  const [scores, setScores] = useState<Scores | null>(null)
  const [error, setError] = useState<string | null>(null)
  const heading = useRef<HTMLHeadingElement>(null)

  // Each step is a new screen: move focus to its heading so screen readers announce it.
  useEffect(() => {
    heading.current?.focus()
  }, [step])

  const leave = () => navigate(next, { replace: true })

  function skip() {
    if (!retake) useDevice.getState().setQuizSeen()
    leave()
  }

  async function answer(index: number, choice: number) {
    const q = QUESTIONS[index]!
    const updated = { ...answers, [q.id]: choice }
    setAnswers(updated)
    if (index < QUESTIONS.length - 1) {
      setStep(index + 1)
      return
    }
    const result = scoreQuiz(updated)
    setScores(result)
    setStep('reveal')
    // Saved as soon as the last answer is in, so leaving from the result screen loses nothing.
    try {
      await saveQuizResult(result, tripId, memberId)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save your travel style. Try again.')
    }
  }

  if (step === 'reveal' && scores) {
    return (
      <Screen>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-700">Your travel style</p>
        <h1 ref={heading} tabIndex={-1} className="travel-heading mt-2 text-4xl text-brand-900 outline-none">{classify(scores)}</h1>
        <p className="mt-3 leading-relaxed text-stone-600">
          This is your radar. The group’s trip ideas balance everyone’s, and you can fine-tune yours any time in More → Trip ideas.
        </p>
        <div className="mt-4"><RadarChart scores={scores} label="Your travel style" /></div>
        <ErrorNote error={error} />
        <div className="mt-6 space-y-2">
          <Button className="w-full" onClick={leave}>{tripId ? 'Open the trip' : 'Continue'}<ArrowRight aria-hidden="true" className="size-4" /></Button>
          <Button variant="ghost" className="w-full" onClick={() => { setAnswers({}); setError(null); setStep(0) }}>Take it again</Button>
        </div>
      </Screen>
    )
  }

  if (step === 'intro' || step === 'reveal') {
    return (
      <Screen>
        <span className="flex size-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-700"><Compass aria-hidden="true" className="size-6" /></span>
        <h1 ref={heading} tabIndex={-1} className="travel-heading mt-5 text-4xl text-brand-900 outline-none">
          {retake ? 'Retake the travel quiz' : 'What kind of traveler are you?'}
        </h1>
        <p className="mt-3 leading-relaxed text-stone-600">
          {QUESTIONS.length} quick this-or-that questions, about a minute. Your answers draw your travel radar, so the group can plan days everyone enjoys.
        </p>
        <ul className="mt-5 space-y-2 text-sm text-stone-700">
          {['No right answers: pick what sounds most like you', 'Your group sees your radar, not your answers', 'Change it any time from More → Trip ideas'].map((t) => (
            <li key={t} className="flex gap-2"><Check aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-brand-700" />{t}</li>
          ))}
        </ul>
        <div className="mt-8 space-y-2">
          <Button className="w-full" onClick={() => setStep(0)}>Start the quiz<ArrowRight aria-hidden="true" className="size-4" /></Button>
          <Button variant="ghost" className="w-full" onClick={skip}>{retake ? 'Not now' : 'Skip for now'}</Button>
        </div>
      </Screen>
    )
  }

  const q = QUESTIONS[step]!
  const picked = answers[q.id]
  return (
    <Screen>
      <div className="flex items-center justify-between gap-2">
        <Button variant="ghost" className="-ml-4" onClick={() => setStep(step === 0 ? 'intro' : step - 1)}>
          <ArrowLeft aria-hidden="true" className="size-4" />Back
        </Button>
        <span className="text-sm tabular-nums text-stone-500">{step + 1} of {QUESTIONS.length}</span>
        <Button variant="ghost" className="-mr-4" onClick={skip}>{retake ? 'Not now' : 'Skip for now'}</Button>
      </div>
      <div role="progressbar" aria-label="Quiz progress" aria-valuemin={1} aria-valuemax={QUESTIONS.length} aria-valuenow={step + 1} className="mt-2 h-1.5 overflow-hidden rounded-full bg-stone-200">
        <div className="h-full rounded-full bg-brand-700 transition-[width] duration-300 motion-reduce:transition-none" style={{ width: `${((step + 1) / QUESTIONS.length) * 100}%` }} />
      </div>
      <h1 ref={heading} tabIndex={-1} id={`q-${q.id}`} className="travel-heading mt-8 text-3xl text-brand-900 outline-none">{q.prompt}</h1>
      <div role="radiogroup" aria-labelledby={`q-${q.id}`} className="mt-6 space-y-3">
        {q.options.map((o, i) => (
          <button
            key={o.label}
            type="button"
            role="radio"
            aria-checked={picked === i}
            onClick={() => void answer(step, i)}
            className={`flex min-h-14 w-full items-center rounded-2xl border px-4 py-3 text-left font-medium shadow-sm transition-colors active:bg-brand-50 ${picked === i ? 'border-brand-700 bg-brand-50 text-brand-900' : 'border-stone-200 bg-white text-stone-800 hover:border-brand-600'}`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </Screen>
  )
}

function Screen({ children }: { children: ReactNode }) {
  return (
    <main className="mx-auto min-h-full max-w-md px-5 pb-10 pt-[calc(env(safe-area-inset-top)+1.25rem)]">
      <Brand className="mb-6 scale-90 origin-left" />
      {children}
    </main>
  )
}
