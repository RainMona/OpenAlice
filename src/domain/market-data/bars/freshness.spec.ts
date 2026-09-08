import { describe, it, expect } from 'vitest'
import { describeBarFreshness } from './freshness.js'
const now = new Date('2026-09-08T08:00:00Z')
describe('bar record freshness', () => {
  it('measures timestamp age with explicit offsets, without claiming latency', () => {
    expect(describeBarFreshness('2026-09-08T15:45:00+08:00', false, now)).toEqual({
      fetchedAt: now.toISOString(), latestRecordAt: '2026-09-08T15:45:00+08:00',
      timestampKind: 'instant', recordAgeSeconds: 900, historical: false,
    })
  })
  it('does not manufacture intraday ages from dates or timezone-less records', () => {
    for (const date of ['2026-09-07', '2026-09-08T07:00:00', '', 'invalid']) {
      expect(describeBarFreshness(date, false, now).recordAgeSeconds).toBeNull()
    }
  })
  it('does not clamp future records into an apparently current age', () => {
    expect(describeBarFreshness('2026-09-09T08:00:00Z', false, now).recordAgeSeconds).toBeNull()
  })
  it('identifies explicit historical requests independently of record age', () => {
    expect(describeBarFreshness('2025-01-01T08:00:00Z', true, now).historical).toBe(true)
  })
})
