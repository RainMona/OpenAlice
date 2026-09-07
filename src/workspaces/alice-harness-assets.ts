import { createHash } from 'node:crypto'
import { cp, mkdir, readFile, readdir } from 'node:fs/promises'
import { join } from 'node:path'
import { defaultPath } from '../core/paths.js'
import { CLI_EXPORTS } from '../server/cli-commands.js'
import { ALICE_HARNESS_SKILLS, cliGroupEnabled, type AliceHarnessConfig, DEFAULT_ALICE_HARNESS_CONFIG } from './alice-harness-policy.js'

/** The Project supplies this revision; it is independent of Workspace template pins. */
export async function aliceHarnessSourceVersion(): Promise<string> {
  const manifest = JSON.parse(await readFile(defaultPath('alice-harness.json'), 'utf8')) as { version: string }
  const hash = createHash('sha256').update(JSON.stringify(CLI_EXPORTS))
  async function walk(dir: string, relative: string) {
    for (const entry of (await readdir(dir, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
      const path = join(dir, entry.name)
      if (entry.isDirectory()) await walk(path, `${relative}/${entry.name}`)
      else if (entry.isFile()) hash.update(`${relative}/${entry.name}\0`).update(await readFile(path))
    }
  }
  for (const skill of ALICE_HARNESS_SKILLS) await walk(defaultPath('skills', skill), skill)
  return `${manifest.version}+${hash.digest('hex').slice(0, 16)}`
}

export async function injectAliceHarnessSkills(dir: string, injectTools: boolean, config: AliceHarnessConfig = DEFAULT_ALICE_HARNESS_CONFIG): Promise<void> {
  const skills = ALICE_HARNESS_SKILLS.filter((skill) => {
    if (!injectTools && skill !== 'self-scheduling') return false
    const binary = ['self-scheduling', 'alice-analysis'].includes(skill) ? 'alice' : skill
    const exp = Object.values(CLI_EXPORTS).find((candidate) => candidate.binary === binary)!
    return Object.keys(exp.commands).some((group) => cliGroupEnabled(config, binary, group))
  })
  for (const root of ['.agents/skills', '.claude/skills']) {
    await mkdir(join(dir, root), { recursive: true })
    for (const skill of skills) await cp(defaultPath('skills', skill), join(dir, root, skill), { recursive: true })
  }
}
