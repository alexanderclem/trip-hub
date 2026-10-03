import { DateTime } from 'luxon'
import { Cloud, CloudDrizzle, CloudFog, CloudLightning, CloudRain, CloudSnow, CloudSun, Droplets, Sun, Sunrise, Sunset, Wind, type LucideIcon } from 'lucide-react'
import { useDevice } from '@/data/device'
import { ATTRIBUTION_URL, describeCode, formatTemp, formatWind, type WeatherIcon } from '@/lib/weather'
import type { DayWeather } from './weather'

const ICONS: Record<WeatherIcon, LucideIcon> = {
  sun: Sun, partly: CloudSun, cloud: Cloud, fog: CloudFog, drizzle: CloudDrizzle, rain: CloudRain, snow: CloudSnow, storm: CloudLightning,
}

export function WeatherGlyph({ code, className }: { code: number; className?: string }) {
  const Icon = ICONS[describeCode(code).icon]
  return <Icon aria-hidden="true" className={className} />
}

/** The day's weather under the day heading: forecast, or typical weather for far-off dates. */
export function WeatherLine({ day }: { day: DayWeather | null }) {
  const unit = useDevice((s) => s.tempUnit)
  if (!day) return null
  const w = day.weather
  const { label } = describeCode(w.code)
  const typical = day.kind === 'typical'
  return (
    <section aria-label="Weather" className="rounded-xl border border-brand-100 bg-brand-50 px-3 py-2 text-sm text-brand-900">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="flex items-center gap-1.5 font-medium">
          <WeatherGlyph code={w.code} className="size-5 text-brand-700" />
          {label}
          {typical && <span className="rounded bg-white px-1.5 py-0.5 text-[11px] font-semibold uppercase text-stone-600">Typical</span>}
        </span>
        <span className="tabular-nums"><b>{formatTemp(w.hi, unit)}</b> / {formatTemp(w.lo, unit)}</span>
        {w.rainPct != null && (
          <span className="flex items-center gap-1 tabular-nums">
            <Droplets aria-hidden="true" className="size-4 text-brand-700" />
            {typical ? `Rained ${w.rainPct}% of years` : `${w.rainPct}% rain`}
          </span>
        )}
        {w.windKmh != null && <span className="flex items-center gap-1"><Wind aria-hidden="true" className="size-4 text-brand-700" />{formatWind(w.windKmh, unit)}</span>}
        {w.sunrise && <span className="flex items-center gap-1 tabular-nums"><Sunrise aria-hidden="true" className="size-4 text-amber-600" /><span className="sr-only">Sunrise</span>{w.sunrise}</span>}
        {w.sunset && <span className="flex items-center gap-1 tabular-nums"><Sunset aria-hidden="true" className="size-4 text-amber-700" /><span className="sr-only">Sunset</span>{w.sunset}</span>}
      </div>
      <p className="mt-1 text-xs text-stone-600">
        {typical ? 'Typical for these dates (last few years), not a forecast' : `Forecast updated ${Date.now() - Date.parse(day.fetched_at) < 60_000 ? 'just now' : DateTime.fromISO(day.fetched_at).toRelative()}`}
        {' · '}
        <a href={ATTRIBUTION_URL} target="_blank" rel="noreferrer" className="underline">
          Weather data by Open-Meteo.com<span className="sr-only"> (opens in a new tab)</span>
        </a>
      </p>
    </section>
  )
}
