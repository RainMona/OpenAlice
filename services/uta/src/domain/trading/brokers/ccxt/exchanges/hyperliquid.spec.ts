import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { Exchange } from 'ccxt'
import {
  hyperliquidOverrides,
  mergeBalanceLedgers,
  resetAbstractionModeCache,
  ABSTRACTION_MODE_TTL_MS,
} from './hyperliquid.js'

type Balance = Record<string, unknown>

/** Shapes ccxt's hyperliquid.fetchBalance returns for each clearinghouse. */
const PERP_LEDGER: Balance = {
  info: { marginSummary: { accountValue: '150.5', totalMarginUsed: '50' } },
  timestamp: 1_700_000_000_000,
  USDC: { free: 100.5, used: 50, total: 150.5 },
  free: { USDC: 100.5 }, used: { USDC: 50 }, total: { USDC: 150.5 },
}
const SPOT_LEDGER: Balance = {
  info: { balances: [{ coin: 'USDC', total: '1000', hold: '0' }, { coin: 'HYPE', total: '2.5', hold: '0' }] },
  USDC: { free: 1000, used: 0, total: 1000 },
  HYPE: { free: 2.5, used: 0, total: 2.5 },
  free: { USDC: 1000, HYPE: 2.5 }, used: { USDC: 0, HYPE: 0 }, total: { USDC: 1000, HYPE: 2.5 },
}

function fakeExchange(opts: { mode?: unknown; walletAddress?: string; infoError?: Error } = {}) {
  const publicPostInfo = vi.fn(async (req: Record<string, unknown>) => {
    if (opts.infoError) throw opts.infoError
    expect(req).toEqual({ type: 'userAbstraction', user: expect.any(String) })
    return opts.mode
  })
  const exchange = {
    walletAddress: opts.walletAddress ?? '0xmain',
    publicPostInfo,
  } as unknown as Exchange
  return { exchange, publicPostInfo }
}

/** A defaultImpl stand-in that answers per requested wallet type. */
function ledgerImpl() {
  return vi.fn(async (_ex: Exchange, params?: Record<string, unknown>) => {
    if (params?.['type'] === 'spot') return SPOT_LEDGER
    if (params?.['type'] === 'swap') return PERP_LEDGER
    return { ...PERP_LEDGER, info: { ...(PERP_LEDGER['info'] as object), unscoped: true } }
  })
}

describe('hyperliquidOverrides.fetchBalance', () => {
  beforeEach(() => { vi.useFakeTimers({ now: 1_700_000_000_000 }) })
  afterEach(() => { vi.useRealTimers() })

  it('reads only the spot clearinghouse for a unifiedAccount wallet', async () => {
    // The reported bug: Hyperliquid keeps a unified wallet's USDC in the spot
    // clearinghouse; the perp accountValue is 0 with no positions open and a
    // mirror of the same USDC otherwise. Reading perp alone shows 0 equity;
    // reading both double-counts.
    const { exchange, publicPostInfo } = fakeExchange({ mode: 'unifiedAccount' })
    const impl = ledgerImpl()

    const result = await hyperliquidOverrides.fetchBalance!(exchange, undefined, impl)

    expect(publicPostInfo).toHaveBeenCalledWith({ type: 'userAbstraction', user: '0xmain' })
    expect(impl).toHaveBeenCalledTimes(1)
    expect(impl.mock.calls[0]![1]).toEqual({ type: 'spot' })
    expect(result).toBe(SPOT_LEDGER)
  })

  it('treats portfolioMargin like unifiedAccount (upstream ccxt does not)', async () => {
    const { exchange } = fakeExchange({ mode: 'portfolioMargin' })
    const impl = ledgerImpl()

    const result = await hyperliquidOverrides.fetchBalance!(exchange, undefined, impl)

    expect(impl).toHaveBeenCalledTimes(1)
    expect(impl.mock.calls[0]![1]).toEqual({ type: 'spot' })
    expect(result).toBe(SPOT_LEDGER)
  })

  it.each(['default', 'disabled', 'dexAbstraction'])('merges perp + spot pools for a %s (Standard) wallet', async (mode) => {
    const { exchange } = fakeExchange({ mode })
    const impl = ledgerImpl()

    const result = await hyperliquidOverrides.fetchBalance!(exchange, undefined, impl)

    expect(impl.mock.calls.map(c => c[1])).toEqual([{ type: 'swap' }, { type: 'spot' }])
    expect(result['USDC']).toEqual({ free: 1100.5, used: 50, total: 1150.5 })
    expect(result['HYPE']).toEqual({ free: 2.5, used: 0, total: 2.5 })
    expect(result['total']).toEqual({ USDC: 1150.5, HYPE: 2.5 })
    expect(result['info']).toEqual({ perp: PERP_LEDGER['info'], spot: SPOT_LEDGER['info'] })
  })

  it('propagates a failed pool read in Standard mode instead of returning a partial ledger', async () => {
    const { exchange } = fakeExchange({ mode: 'default' })
    const impl = vi.fn(async (_ex: Exchange, params?: Record<string, unknown>) => {
      if (params?.['type'] === 'spot') throw new Error('hyperliquid 429 rate limited')
      return PERP_LEDGER
    })

    await expect(hyperliquidOverrides.fetchBalance!(exchange, undefined, impl)).rejects.toThrow('429')
  })

  it('accepts the still-quoted string ccxt may hand back from publicPostInfo', async () => {
    const { exchange } = fakeExchange({ mode: '"unifiedAccount"' })
    const impl = ledgerImpl()

    await hyperliquidOverrides.fetchBalance!(exchange, undefined, impl)

    expect(impl.mock.calls[0]![1]).toEqual({ type: 'spot' })
  })

  it('honors an explicit type selector without consulting userAbstraction', async () => {
    const { exchange, publicPostInfo } = fakeExchange({ mode: 'unifiedAccount' })
    const impl = ledgerImpl()

    const result = await hyperliquidOverrides.fetchBalance!(exchange, { type: 'swap' }, impl)

    expect(publicPostInfo).not.toHaveBeenCalled()
    expect(impl).toHaveBeenCalledWith(exchange, { type: 'swap' })
    expect(result).toBe(PERP_LEDGER)
  })

  it('falls back to ccxt default routing when userAbstraction is unreadable', async () => {
    const { exchange } = fakeExchange({ infoError: new Error('ECONNRESET') })
    const impl = ledgerImpl()

    const result = await hyperliquidOverrides.fetchBalance!(exchange, undefined, impl)

    expect(impl).toHaveBeenCalledTimes(1)
    expect(impl.mock.calls[0]![1]).toBeUndefined()
    expect((result['info'] as { unscoped?: boolean }).unscoped).toBe(true)
  })

  it('falls back to ccxt default routing for an unrecognized mode', async () => {
    const { exchange } = fakeExchange({ mode: 'someFutureMode' })
    const impl = ledgerImpl()

    await hyperliquidOverrides.fetchBalance!(exchange, undefined, impl)

    expect(impl).toHaveBeenCalledTimes(1)
    expect(impl.mock.calls[0]![1]).toBeUndefined()
  })

  it('prefers params.user over the configured walletAddress', async () => {
    const { exchange, publicPostInfo } = fakeExchange({ mode: 'unifiedAccount' })
    const impl = ledgerImpl()

    await hyperliquidOverrides.fetchBalance!(exchange, { user: '0xvault' }, impl)

    expect(publicPostInfo).toHaveBeenCalledWith({ type: 'userAbstraction', user: '0xvault' })
    expect(impl.mock.calls[0]![1]).toEqual({ user: '0xvault', type: 'spot' })
  })

  it('caches the mode per exchange within the TTL and re-reads after it', async () => {
    const { exchange, publicPostInfo } = fakeExchange({ mode: 'unifiedAccount' })
    const impl = ledgerImpl()

    await hyperliquidOverrides.fetchBalance!(exchange, undefined, impl)
    await hyperliquidOverrides.fetchBalance!(exchange, undefined, impl)
    expect(publicPostInfo).toHaveBeenCalledTimes(1)

    vi.advanceTimersByTime(ABSTRACTION_MODE_TTL_MS + 1)
    await hyperliquidOverrides.fetchBalance!(exchange, undefined, impl)
    expect(publicPostInfo).toHaveBeenCalledTimes(2)

    resetAbstractionModeCache(exchange)
    await hyperliquidOverrides.fetchBalance!(exchange, undefined, impl)
    expect(publicPostInfo).toHaveBeenCalledTimes(3)
  })

  it('does not reuse a cached mode for a different user address', async () => {
    const { exchange, publicPostInfo } = fakeExchange({ mode: 'unifiedAccount' })
    const impl = ledgerImpl()

    await hyperliquidOverrides.fetchBalance!(exchange, undefined, impl)
    await hyperliquidOverrides.fetchBalance!(exchange, { user: '0xother' }, impl)

    expect(publicPostInfo.mock.calls.map(c => c[0]!['user'])).toEqual(['0xmain', '0xother'])
  })
})

describe('mergeBalanceLedgers', () => {
  it('adds per-currency figures, rebuilds aggregates, and skips reserved keys', () => {
    const merged = mergeBalanceLedgers(
      { info: 'a', timestamp: 1, USDC: { free: '1.1', used: 0.2, total: '1.3' }, free: { USDC: 1.1 } },
      { info: 'b', USDC: { free: 2, used: '0.1', total: 2.1 }, PURR: { total: 7 }, debt: { USDC: 0 } },
    )
    expect(merged['USDC']).toEqual({ free: 3.1, used: 0.3, total: 3.4 })
    expect(merged['PURR']).toEqual({ free: 0, used: 0, total: 7 })
    expect(merged['free']).toEqual({ USDC: 3.1, PURR: 0 })
    expect(merged['info']).toEqual({ perp: 'a', spot: 'b' })
    expect(merged['timestamp']).toBe(1)
    expect(merged).not.toHaveProperty('debt')
  })
})
