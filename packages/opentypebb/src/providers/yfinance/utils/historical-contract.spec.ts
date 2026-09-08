import { afterEach, describe, expect, it, vi } from 'vitest'
const { chart } = vi.hoisted(() => ({ chart: vi.fn() }))
vi.mock('yahoo-finance2', () => ({ default: class { chart = chart } }))
import { getHistoricalData } from './helpers.js'
import { YFinanceEquityHistoricalFetcher } from '../models/equity-historical.js'
import { YFinanceCryptoHistoricalFetcher } from '../models/crypto-historical.js'
import { YFinanceCurrencyHistoricalFetcher } from '../models/currency-historical.js'

const quote = (date: string) => ({ date: new Date(date), open: 1, high: 2, low: 0.5, close: 1.5, volume: 10 })
afterEach(() => { vi.useRealTimers(); chart.mockReset() })
describe('Yahoo historical time contract', () => {
  it('includes the end day and preserves intraday instants, including midnight', async () => {
    chart.mockResolvedValue({ quotes: [quote('2024-01-02T00:00:00Z'), quote('2024-01-02T14:30:00Z')] })
    const bars = await getHistoricalData('AAPL', { startDate: '2024-01-02', endDate: '2024-01-02', interval: '1h' })
    expect(chart).toHaveBeenCalledWith('AAPL', expect.objectContaining({ period1: new Date('2024-01-02'), period2: new Date('2024-01-03'), includePrePost: false }))
    expect(bars.map(b => b.date)).toEqual(['2024-01-02T00:00:00.000Z', '2024-01-02T14:30:00.000Z'])
  })
  it('does not count an appended live quote as another candle', async () => {
    const live = new Date('2024-01-02T14:52:15Z')
    chart.mockResolvedValue({ meta: { regularMarketTime: live }, quotes: [quote('2024-01-02T14:30:00Z'), { date: live, open: 2, high: 2, low: 2, close: 2, volume: 0 }] })
    const bars = await getHistoricalData('AAPL', { interval: '1h' })
    expect(bars).toHaveLength(1)
    expect(bars[0].date).toBe('2024-01-02T14:30:00.000Z')
  })
  it('clamps the current end day to now and retains daily labels', async () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2024-01-02T16:00:00Z'))
    chart.mockResolvedValue({ quotes: [quote('2024-01-02T14:30:00Z')] })
    const bars = await getHistoricalData('AAPL', { endDate: '2024-01-02' })
    expect(chart.mock.calls[0][1].period2).toEqual(new Date())
    expect(bars[0].date).toBe('2024-01-02')
  })
  it.each([YFinanceEquityHistoricalFetcher, YFinanceCryptoHistoricalFetcher, YFinanceCurrencyHistoricalFetcher])('maps the product weekly period to Yahoo weekly data', async (Fetcher) => {
    chart.mockResolvedValue({ quotes: [quote('2024-01-01T00:00:00Z')] })
    const query = Fetcher.transformQuery({ symbol: 'AAPL', interval: '1w', start_date: '2024-01-01', end_date: '2024-01-07' })
    await Fetcher.extractData(query, null)
    expect(chart.mock.calls[0][1].interval).toBe('1wk')
  })
})
