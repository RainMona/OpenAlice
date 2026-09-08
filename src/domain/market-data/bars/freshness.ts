/** Record age is not feed latency: sessions, bar boundaries and publication rules differ. */
export interface BarFreshness {
  fetchedAt: string
  latestRecordAt: string | null
  timestampKind: 'instant' | 'date' | 'unknown'
  recordAgeSeconds: number | null
  historical: boolean
}

export function describeBarFreshness(latest: string, historical: boolean, now = new Date()): BarFreshness {
  const instant = /T.*(?:Z|[+-]\d{2}:?\d{2})$/i.test(latest) && Number.isFinite(Date.parse(latest))
  const timestampKind = instant ? 'instant' : /^\d{4}-\d{2}-\d{2}$/.test(latest) ? 'date' : 'unknown'
  const age = instant ? (now.getTime() - Date.parse(latest)) / 1000 : null
  return {
    fetchedAt: now.toISOString(), latestRecordAt: latest || null, timestampKind,
    recordAgeSeconds: age !== null && age >= 0 ? Math.floor(age) : null,
    historical,
  }
}
