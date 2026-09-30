import 'fake-indexeddb/auto'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { db } from '@/data/db'
import { importPlaces } from './importPlaces'

const TRIP = '00000000-0000-4000-8000-0000000000aa'
const seed = JSON.parse(readFileSync('seed/guatemala-2027/places.json', 'utf8'))

describe('importPlaces', () => {
  it('imports the Guatemala seed into the idea pool, and re-importing adds nothing', async () => {
    const first = await importPlaces(TRIP, seed, 'ana')
    expect(first.added).toBe(seed.places.length)
    expect(await db.places.where('[trip_id+status]').equals([TRIP, 'catalog']).count()).toBe(seed.places.length)

    const again = await importPlaces(TRIP, seed, 'ben')
    expect(again).toEqual({ added: 0, skipped: seed.places.length })
    expect(await db.places.count()).toBe(seed.places.length)
  })

  it('keeps edits people made to imported places', async () => {
    const one = { places: [seed.places[0]] }
    const trip = '00000000-0000-4000-8000-0000000000bb'
    await importPlaces(trip, one, 'ana')
    const p = (await db.places.where('trip_id').equals(trip).first())!
    await db.places.update(p.id, { status: 'shortlist', notes: 'Must try' })
    await importPlaces(trip, one, 'ana')
    expect((await db.places.get(p.id))!.notes).toBe('Must try')
  })

  it('rejects files that are not places files', async () => {
    await expect(importPlaces(TRIP, { hello: 1 }, 'ana')).rejects.toThrow(/Not a Trip Hub places file/)
  })
})
