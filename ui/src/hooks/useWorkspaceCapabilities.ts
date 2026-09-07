import { parse } from 'yaml'
import { useEffect, useState } from 'react'
import {
  listFiles,
  readWorkspaceFile,
  type ReadFileResult,
} from '../components/workspace/api'
import { fetchJson } from '../api/client'

export const cliExports = [
  { key: 'data', name: 'alice' },
  { key: 'traderhub', name: 'traderhub' },
  { key: 'workspace', name: 'alice-workspace' },
  { key: 'uta', name: 'alice-uta' },
] as const
export interface CliManifest {
  description: string
  groupDescriptions: Record<string, string>
  groups: Record<
    string,
    Record<
      string,
      {
        description: string
        schema: {
          properties?: Record<
            string,
            {
              type?: string
              description?: string
              enum?: unknown[]
              default?: unknown
            }
          >
          required?: string[]
        }
      }
    >
  >
}
export interface WorkspaceSkill {
  name: string
  description?: string
  path: string
  content: ReadFileResult
  locations: string[]
}
export interface CapabilityInventory {
  skills: WorkspaceSkill[]
  instructions: { path: string; content: ReadFileResult }[]
  errors: string[]
  roots: string[]
}

/** Actual Workspace files, not a projection of today's template catalog. */
export async function loadWorkspaceCapabilities(
  wsId: string,
): Promise<CapabilityInventory> {
  const roots: string[] = []
  const errors: string[] = []
  const skills: WorkspaceSkill[] = []
  const root = await listFiles(wsId, '')
  await Promise.all(
    ['.agents', '.claude', '.pi'].map(async (parent) => {
      if (
        !root.entries.some(
          (e) => e.name === parent && ['dir', 'symlink'].includes(e.kind),
        )
      )
        return
      try {
        const folder = await listFiles(wsId, parent)
        if (!folder.entries.some((e) => e.name === 'skills')) return
        const path = `${parent}/skills`
        roots.push(path)
        const entries = await listFiles(wsId, path)
        const loaded = await Promise.all(
          entries.entries
            .filter((e) => ['dir', 'symlink'].includes(e.kind))
            .map(async (entry) => {
              const file = `${path}/${entry.name}/SKILL.md`
              return {
                name: entry.name,
                path: file,
                locations: [file],
                content: await readWorkspaceFile(wsId, file),
              }
            }),
        )
        skills.push(...loaded)
      } catch (error) {
        errors.push(
          `${parent}: ${error instanceof Error ? error.message : String(error)}`,
        )
      }
    }),
  )
  const grouped: WorkspaceSkill[] = []
  for (const skill of skills.sort((a, b) => a.path.localeCompare(b.path))) {
    const same = grouped.find(
      (other) =>
        other.name === skill.name &&
        other.content.kind === 'ok' &&
        skill.content.kind === 'ok' &&
        other.content.content === skill.content.content,
    )
    if (same) same.locations.push(skill.path)
    else grouped.push(skill)
  }
  const instructions = await Promise.all(
    ['AGENTS.md', 'CLAUDE.md'].map(async (path) => ({
      path,
      content: await readWorkspaceFile(wsId, path),
    })),
  )
  for (const skill of grouped) {
    if (skill.content.kind !== 'ok') continue
    const header = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(
      skill.content.content,
    )
    if (!header) continue
    try {
      const metadata = parse(header[1]!, { maxAliasCount: 0 }) as unknown
      if (
        metadata &&
        typeof metadata === 'object' &&
        'description' in metadata &&
        typeof metadata.description === 'string'
      )
        skill.description = metadata.description
    } catch {
      /* The complete source remains available even for invalid YAML. */
    }
  }
  return {
    skills: grouped.sort((a, b) => a.name.localeCompare(b.name)),
    instructions,
    roots: roots.sort(),
    errors,
  }
}

export function useWorkspaceCapabilities(wsId: string, attempt: number) {
  const [state, setState] = useState<{
    id: string
    data?: CapabilityInventory
    error?: string
  }>()
  useEffect(() => {
    let alive = true
    setState(undefined)
    void loadWorkspaceCapabilities(wsId).then(
      (data) => {
        if (alive) setState({ id: wsId, data })
      },
      (error) => {
        if (alive)
          setState({
            id: wsId,
            error: error instanceof Error ? error.message : String(error),
          })
      },
    )
    return () => {
      alive = false
    }
  }, [wsId, attempt])
  return state?.id === wsId ? state : undefined
}

export function useWorkspaceCli(
  wsId: string,
  exportKey: string,
  attempt: number,
) {
  const id = `${wsId}:${exportKey}`
  const [state, setState] = useState<{
    id: string
    data?: CliManifest
    error?: string
  }>()
  useEffect(() => {
    let alive = true
    setState(undefined)
    void fetchJson<CliManifest>(
      `/api/workspaces/${encodeURIComponent(wsId)}/cli/${exportKey}/manifest`,
    ).then(
      (data) => {
        if (alive) setState({ id, data })
      },
      (error) => {
        if (alive)
          setState({
            id,
            error: error instanceof Error ? error.message : String(error),
          })
      },
    )
    return () => {
      alive = false
    }
  }, [wsId, exportKey, attempt, id])
  return state?.id === id ? state : undefined
}
