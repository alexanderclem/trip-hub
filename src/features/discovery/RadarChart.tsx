import { useId } from 'react'
import { AXES, type Scores } from './model'

const point = (index: number, radius: number) => {
  const angle = index * Math.PI / 4 - Math.PI / 2
  return [200 + Math.cos(angle) * radius, 170 + Math.sin(angle) * radius]
}
const polygon = (scores: Scores) => AXES.map(({ key }, i) => point(i, scores[key] * 1.06).join(',')).join(' ')

export function RadarChart({ scores, comparison, range, label = 'Your travel preferences' }: {
  scores: Scores; comparison?: Scores; range?: { low: Scores; high: Scores }; label?: string
}) {
  const id = useId()
  return <figure>
    <svg viewBox="0 0 400 340" role="img" aria-labelledby={`${id}-title ${id}-desc`} className="mx-auto w-full max-w-md text-brand-700">
      <title id={`${id}-title`}>{label}</title>
      <desc id={`${id}-desc`}>Eight preferences from 0 to 100. Higher means more important. Exact values follow the chart.</desc>
      {[25, 50, 75, 100].map((n) => <polygon key={n} points={AXES.map((_, i) => point(i, n * 1.06).join(',')).join(' ')} fill="none" stroke="#d6d3d1" strokeWidth="1" />)}
      {AXES.map(({ key, label: axisLabel }, i) => {
        const [x, y] = point(i, 106), [tx, ty] = point(i, 139)
        return <g key={key}><line x1="200" y1="170" x2={x} y2={y} stroke="#e7e5e4" /><text x={tx} y={ty} textAnchor="middle" dominantBaseline="middle" fontSize="13" fill="#44403c">{axisLabel}</text></g>
      })}
      {range && <><polygon points={polygon(range.high)} fill="#d6e4e5" fillOpacity="0.6" stroke="#517f8a" strokeDasharray="2 4" /><polygon points={polygon(range.low)} fill="#fff" fillOpacity="0.8" stroke="#517f8a" strokeDasharray="2 4" /></>}
      {comparison && <polygon points={polygon(comparison)} fill="none" stroke="#9a3412" strokeWidth="2" strokeDasharray="6 4" />}
      <polygon points={polygon(scores)} fill="currentColor" fillOpacity="0.15" stroke="currentColor" strokeWidth="2.5" />
      {AXES.map(({ key }, i) => { const [x, y] = point(i, scores[key] * 1.06); return <circle key={key} cx={x} cy={y} r="3" fill="currentColor" /> })}
    </svg>
    <figcaption className="text-center text-xs text-stone-600">Solid: {label.toLowerCase()}{comparison ? ' · Dashed: your profile' : ''}{range ? ' · Dotted: group range' : ''}</figcaption>
    <details className="mt-3 text-sm"><summary className="min-h-11 cursor-pointer py-3 text-brand-700">View exact scores</summary>
      <table className="w-full text-left text-xs"><thead><tr><th className="py-2">Preference</th><th>Score</th>{comparison && <th>You</th>}{range && <th>Group range</th>}</tr></thead><tbody>{AXES.map(({ key, label: axisLabel }) => <tr key={key} className="border-t border-stone-100"><th className="py-2 font-normal">{axisLabel}</th><td>{scores[key]}</td>{comparison && <td>{comparison[key]}</td>}{range && <td>{range.low[key]}–{range.high[key]}</td>}</tr>)}</tbody></table>
    </details>
  </figure>
}
