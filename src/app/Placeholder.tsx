export function Placeholder({ title, phase }: { title: string; phase: number }) {
  return (
    <div className="pt-safe p-6">
      <h1 className="text-2xl font-semibold">{title}</h1>
      <p className="mt-2 text-stone-500">Coming in phase {phase}.</p>
    </div>
  )
}
