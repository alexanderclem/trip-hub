import { describe, expect, it } from 'vitest'
import type { StyleSpecification } from 'maplibre-gl'
import type { TripArea } from '@/features/destinations/destinations'
import { fontStacks, planTiles, tilesFor, union } from './savedArea'

const antigua: TripArea = { name: 'Antigua', bbox: [14.54, -90.75, 14.575, -90.715], lat: 14.5575, lng: -90.7325 }
const pana: TripArea = { name: 'Panajachel', bbox: [14.73, -91.17, 14.75, -91.145], lat: 14.74, lng: -91.1575 }

describe('tilesFor', () => {
  it('is the single world tile at zoom 0', () => {
    expect(tilesFor(antigua.bbox, 0)).toEqual([{ z: 0, x: 0, y: 0 }])
  })

  it('finds the known tile for Antigua at zoom 14', () => {
    // Parque Central (14.5572, -90.7334) is in tile 14/4062/7522.
    expect(tilesFor([14.5572, -90.7334, 14.5572, -90.7334], 14)).toEqual([{ z: 14, x: 4062, y: 7522 }])
  })

  it('covers a box with a small grid and stays inside the world', () => {
    const tiles = tilesFor(antigua.bbox, 14)
    expect(tiles.length).toBeGreaterThanOrEqual(4)
    expect(tiles.length).toBeLessThanOrEqual(12)
    expect(tilesFor([-89, -200, 89, 200], 1)).toHaveLength(4)
  })
})

describe('planTiles', () => {
  it('has no duplicates and reaches street level only inside the areas', () => {
    const tiles = planTiles([antigua, pana])
    expect(new Set(tiles.map((t) => `${t.z}/${t.x}/${t.y}`)).size).toBe(tiles.length)
    expect(tiles.some((t) => t.z === 14 && t.x === 4062 && t.y === 7522)).toBe(true)
    // Half-way between the towns there is middle-zoom map but no street-level tile.
    const mid = tilesFor([14.65, -90.95, 14.65, -90.95], 14)[0]!
    expect(tiles.some((t) => t.z === 14 && t.x === mid.x && t.y === mid.y)).toBe(false)
    const mid11 = tilesFor([14.65, -90.95, 14.65, -90.95], 11)[0]!
    expect(tiles.some((t) => t.z === 11 && t.x === mid11.x && t.y === mid11.y)).toBe(true)
  })

  it('stays a modest download for two towns', () => {
    expect(planTiles([antigua, pana]).length).toBeLessThan(250)
  })

  it('stops at the source\'s top zoom', () => {
    expect(Math.max(...planTiles([antigua], 6).map((t) => t.z))).toBe(6)
    expect(planTiles([])).toEqual([])
  })
})

describe('union', () => {
  it('spans every area', () => {
    expect(union([antigua, pana])).toEqual([14.54, -91.17, 14.75, -90.715])
  })
})

describe('fontStacks', () => {
  it('collects plain and expression fonts once each', () => {
    const style = {
      version: 8, sources: {},
      layers: [
        { id: 'a', type: 'symbol', source: 's', layout: { 'text-font': ['Noto Sans Regular'] } },
        { id: 'b', type: 'symbol', source: 's', layout: { 'text-font': ['Noto Sans Regular'] } },
        { id: 'c', type: 'symbol', source: 's', layout: { 'text-font': ['case', ['has', 'x'], ['literal', ['Noto Sans Bold', 'Noto Sans Regular']], ['literal', ['Noto Sans Italic']]] } },
        { id: 'd', type: 'background' },
      ],
    } as unknown as StyleSpecification
    expect(fontStacks(style).sort()).toEqual(['Noto Sans Bold,Noto Sans Regular', 'Noto Sans Italic', 'Noto Sans Regular'])
  })
})
