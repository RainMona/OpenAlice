import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

import { ensureHomeMachineIdentity, homeMachineIdPath, normalizeProcessExitCode } from './process-control.js'

let home: string

afterEach(async () => {
  if (home) await rm(home, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 })
})

describe('normalizeProcessExitCode', () => {
  it('preserves valid integer exit codes', () => {
    expect(normalizeProcessExitCode(0)).toBe(0)
    expect(normalizeProcessExitCode(1)).toBe(1)
    expect(normalizeProcessExitCode(137)).toBe(137)
  })

  it('maps signal callback payloads and invalid numbers to success', () => {
    expect(normalizeProcessExitCode('SIGINT')).toBe(0)
    expect(normalizeProcessExitCode('SIGTERM')).toBe(0)
    expect(normalizeProcessExitCode(Number.NaN)).toBe(0)
    expect(normalizeProcessExitCode(-1)).toBe(0)
  })
})

describe('ensureHomeMachineIdentity', () => {
  it('creates, persists, and reuses a home-scoped machine identity', async () => {
    home = join(tmpdir(), `guardian-machine-id-${process.pid}-${Math.random().toString(16).slice(2)}`)
    await mkdir(home, { recursive: true })
    const firstEnv: NodeJS.ProcessEnv = {}
    const first = await ensureHomeMachineIdentity(home, firstEnv)
    expect(firstEnv.OPENALICE_MACHINE_ID).toBe(first)
    expect((await readFile(homeMachineIdPath(home), 'utf8')).trim()).toBe(first)

    const secondEnv: NodeJS.ProcessEnv = {}
    await expect(ensureHomeMachineIdentity(home, secondEnv)).resolves.toBe(first)
    expect(secondEnv.OPENALICE_MACHINE_ID).toBe(first)
  })

  it('keeps an explicit OPENALICE_MACHINE_ID and writes it when the home file is missing', async () => {
    home = join(tmpdir(), `guardian-machine-id-${process.pid}-${Math.random().toString(16).slice(2)}`)
    await mkdir(home, { recursive: true })
    const env: NodeJS.ProcessEnv = { OPENALICE_MACHINE_ID: 'compose-fixed' }
    await expect(ensureHomeMachineIdentity(home, env)).resolves.toBe('compose-fixed')
    expect((await readFile(homeMachineIdPath(home), 'utf8')).trim()).toBe('compose-fixed')
  })

  it('does not overwrite a persisted identity with a later env override absence', async () => {
    home = join(tmpdir(), `guardian-machine-id-${process.pid}-${Math.random().toString(16).slice(2)}`)
    await mkdir(join(home, 'state'), { recursive: true })
    await writeFile(homeMachineIdPath(home), 'already-persisted\n', 'utf8')
    const env: NodeJS.ProcessEnv = {}
    await expect(ensureHomeMachineIdentity(home, env)).resolves.toBe('already-persisted')
    expect(env.OPENALICE_MACHINE_ID).toBe('already-persisted')
  })
})
