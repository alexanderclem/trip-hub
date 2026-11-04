import { expect, it } from 'vitest'
import { searchTrip, type SearchData } from './search'

it('searches document text and accents without disclosing other trips or removed rows', () => {
  const data = { items: [], places: [
    { id: 'p', trip_id: 'mine', name: 'Café Azul', tags: [], address: 'Antigua' },
    { id: 'x', trip_id: 'other', name: 'Café Secret', tags: [] },
    { id: 'gone', trip_id: 'mine', name: 'Café Removed', tags: [], deleted_at: 'removed' },
  ], attachments: [{ id: 'a', trip_id: 'mine', title: 'Boarding pass', text: 'Baggage ABC123', details: {} }], notes: [], tasks: [] } as unknown as SearchData
  expect(searchTrip(data, 'mine', 'cafe').map((r) => r.id)).toEqual(['p'])
  expect(searchTrip(data, 'mine', 'ABC123')[0]?.path).toBe('/t/mine/tickets/a')
  expect(searchTrip(data, 'mine', 'cafe antigua').map((r) => r.id)).toEqual(['p'])
  expect(searchTrip(data, 'mine', '  ')).toEqual([])
})
