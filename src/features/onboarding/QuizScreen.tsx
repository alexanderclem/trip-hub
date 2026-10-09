import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { ArrowLeft, ArrowRight, Check } from 'lucide-react'
import { useDevice } from '@/data/device'
import { classify, type Scores } from '@/features/discovery/model'
import { RadarChart } from '@/features/discovery/RadarChart'
import { Bubble } from '@/features/stowie/chat'
import type { Mood } from '@/features/stowie/script'
import { Stowie } from '@/features/stowie/Stowie'
import { Button, ErrorNote } from '@/ui'
import { QUESTIONS, safeNext, scoreQuiz, tripIdOf, type Answers } from './quiz'
import { saveQuizResult } from './profile'

type Step = 'intro' | number | 'reveal'

/** The travel-style quiz as a chat with Stowie: one this-or-that question at a time, then the radar it produced. */
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
  const [mood, setMood] = useState<Mood>('talking')

  // Each step is a new question: move focus to its heading so screen readers announce it.
  useEffect(() => {
    heading.current?.focus({ preventScroll: true })
    heading.current?.scrollIntoView({ block: 'nearest' })
  }, [step])
  // Stowie reacts for a moment, then settles. The result keeps it happy.
  useEffect(() => {
    if (mood === 'idle' || step === 'reveal') return
    const timer = setTimeout(() => setMood('idle'), 900)
    return () => clearTimeout(timer)
  }, [mood, step])

  const leave = () => navigate(next, { replace: true })

  function skip() {
    if (!retake) useDevice.getState().setQuizSeen()
    leave()
  }

  async function answer(index: number, choice: number) {
    const q = QUESTIONS[index]!
    const updated = { ...answers, [q.id]: choice }
    setAnswers(updated)
    setMood('delighted')
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
      <Screen mood="delighted">
        <Bubble from="stowie">That’s all I need. Here’s how you travel.</Bubble>
        <p className="ui-label mt-5">Your travel style</p>
        <h1 ref={heading} tabIndex={-1} className="travel-heading mt-2 text-4xl text-brand-900 outline-none">{classify(scores)}</h1>
        <p className="mt-3 leading-relaxed text-stone-600">
          This is your radar. The group’s trip ideas balance everyone’s, and you can fine-tune yours any time by asking me in More → Trip ideas.
        </p>
        <div className="mt-4"><RadarChart scores={scores} label="Your travel style" /></div>
        <ErrorNote error={error} />
        <div className="mt-6 space-y-2">
          <Button className="w-full" onClick={leave}>{tripId ? 'Open the trip' : 'Continue'}<ArrowRight aria-hidden="true" className="size-4" /></Button>
          <Button variant="ghost" className="w-full" onClick={() => { setAnswers({}); setError(null); setMood('talking'); setStep(0) }}>Take it again</Button>
        </div>
      </Screen>
    )
  }

  if (step === 'intro' || step === 'reveal') {
    return (
      <Screen mood={mood}>
        <Bubble from="stowie">Hi, I’m Stowie. I ride along in the suitcase and think about trips all day.</Bubble>
        <div className="mt-3"><Bubble from="stowie">
          <h1 ref={heading} tabIndex={-1} className="travel-heading inline text-2xl text-brand-900 outline-none">
            {retake ? 'Retake the travel quiz' : 'What kind of traveler are you?'}
          </h1>
        </Bubble></div>
        <p className="mt-5 leading-relaxed text-stone-600">
          {QUESTIONS.length} quick this-or-that questions, about a minute. Your answers draw your travel radar, so the group can plan days everyone enjoys.
        </p>
        <ul className="mt-5 space-y-2 text-sm text-stone-700">
          {['No right answers: pick what sounds most like you', 'Your group sees your radar, not your answers', 'Change it any time from More → Trip ideas'].map((t) => (
            <li key={t} className="flex gap-2"><Check aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-brand-700" />{t}</li>
          ))}
        </ul>
        <div className="mt-8 space-y-2">
          <Button className="w-full" onClick={() => { setMood('talking'); setStep(0) }}>Start the quiz<ArrowRight aria-hidden="true" className="size-4" /></Button>
          <Button variant="ghost" className="w-full" onClick={skip}>{retake ? 'Not now' : 'Skip for now'}</Button>
        </div>
      </Screen>
    )
  }

  const q = QUESTIONS[step]!
  const picked = answers[q.id]
  return (
    <Screen mood={mood}>
      <div className="flex items-center justify-between gap-2">
        <Button variant="ghost" className="-ml-4" onClick={() => { setMood('talking'); setStep(step === 0 ? 'intro' : step - 1) }}>
          <ArrowLeft aria-hidden="true" className="size-4" />Back
        </Button>
        <span className="text-sm tabular-nums text-stone-600">{step + 1} of {QUESTIONS.length}</span>
        <Button variant="ghost" className="-mr-4" onClick={skip}>{retake ? 'Not now' : 'Skip for now'}</Button>
      </div>
      <div role="progressbar" aria-label="Quiz progress" aria-valuemin={1} aria-valuemax={QUESTIONS.length} aria-valuenow={step + 1} className="mt-2 h-1.5 overflow-hidden rounded-full bg-stone-200">
        <div className="h-full rounded-full bg-brand-700 transition-[width] duration-300 motion-reduce:transition-none" style={{ width: `${((step + 1) / QUESTIONS.length) * 100}%` }} />
      </div>
      {/* What's been said so far scrolls up above the current question, like any chat. */}
      <div className="mt-5 space-y-3">
        {QUESTIONS.slice(Math.max(0, step - 1), step).map((earlier) => {
          const choice = answers[earlier.id]
          return (
            <div key={earlier.id} className="space-y-3 opacity-60">
              <Bubble from="stowie">{earlier.prompt}</Bubble>
              {choice !== undefined && <Bubble from="me">{earlier.options[choice]?.label}</Bubble>}
            </div>
          )
        })}
        <Bubble key={q.id} from="stowie">
          <h1 ref={heading} tabIndex={-1} id={`q-${q.id}`} className="travel-heading inline text-2xl text-brand-900 outline-none">{q.prompt}</h1>
        </Bubble>
      </div>
      <div role="radiogroup" aria-labelledby={`q-${q.id}`} className="mt-5 space-y-3">
        {q.options.map((o, i) => (
          <button
            key={o.label}
            type="button"
            role="radio"
            aria-checked={picked === i}
            onClick={() => void answer(step, i)}
            className={`flex min-h-14 w-full items-center rounded-2xl border px-4 py-3 text-left font-medium transition-colors active:bg-brand-50 ${picked === i ? 'border-brand-700 bg-brand-50 text-brand-900' : 'border-stone-200 bg-surface text-stone-800 hover:border-brand-600'}`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </Screen>
  )
}

function Screen({ mood, children }: { mood: Mood; children: ReactNode }) {
  return (
    <main className="mx-auto min-h-full max-w-md px-5 pb-10 pt-[calc(env(safe-area-inset-top)+1.25rem)]">
      <Stowie mood={mood} size={84} className="mb-4" />
      {children}
    </main>
  )
}
