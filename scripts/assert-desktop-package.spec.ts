import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { createPackageWithOptions, uncache } from '@electron/asar'

import { ASAR_REQUIRED_FILES, BASE_REQUIRED_FILES, assertDesktopPackage } from './assert-desktop-package.mjs'

const PI_CLI = 'vendor/pi/node_modules/@earendil-works/pi-coding-agent/dist/cli.js'

function writePackageFile(appRoot: string, file: string, content = '') {
  const path = join(appRoot, file)
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, content)
}

async function writeBasePackage(appRoot: string, manifest: unknown) {
  for (const file of BASE_REQUIRED_FILES) {
    if (file === 'vendor/manifest.json') continue
    writePackageFile(appRoot, file)
  }
  writePackageFile(appRoot, 'package.json', JSON.stringify({ version: '0.91.1' }))
  writePackageFile(appRoot, 'vendor/manifest.json', JSON.stringify(manifest))
  const input = join(dirname(appRoot), 'fixture-source')
  for (const file of ASAR_REQUIRED_FILES) writePackageFile(input, file)
  writePackageFile(input, 'package.json', JSON.stringify({ version: '0.91.1' }))
  writePackageFile(input, 'node_modules/node-pty/build/Release/pty.node')
  await createPackageWithOptions(input, join(dirname(appRoot), 'app.asar'), { unpack: '**/*.node' })
  rmSync(input, { recursive: true, force: true })
}

function piManifest() {
  return {
    pi: {
      version: '0.83.0',
      mode: 'npm',
      cli: PI_CLI,
    },
  }
}

function searchToolsManifest(platformArch: string, windows = false) {
  return {
    searchTools: {
      [platformArch]: {
        path: `vendor/tools/${platformArch}`,
        binPath: 'bin',
        fd: {
          version: windows || platformArch.endsWith('arm64') ? '10.4.2' : '10.3.0',
          binary: `bin/fd${windows ? '.exe' : ''}`,
        },
        rg: { version: '15.1.0', binary: `bin/rg${windows ? '.exe' : ''}` },
      },
    },
  }
}

function writeSearchToolFiles(appRoot: string, platformArch: string, windows = false) {
  writePackageFile(appRoot, `vendor/tools/${platformArch}/bin/fd${windows ? '.exe' : ''}`)
  writePackageFile(appRoot, `vendor/tools/${platformArch}/bin/rg${windows ? '.exe' : ''}`)
  writePackageFile(appRoot, `vendor/tools/${platformArch}/licenses/fd/LICENSE-APACHE`)
  writePackageFile(appRoot, `vendor/tools/${platformArch}/licenses/fd/LICENSE-MIT`)
  writePackageFile(appRoot, `vendor/tools/${platformArch}/licenses/rg/LICENSE-MIT`)
  writePackageFile(appRoot, `vendor/tools/${platformArch}/licenses/rg/UNLICENSE`)
}

describe('assertDesktopPackage', () => {
  it('rejects a legacy loose app tree with no ASAR runtime layout', () => {
    const root = mkdtempSync(join(tmpdir(), 'openalice-package-legacy-'))
    try {
      writePackageFile(join(root, 'mac-arm64/OpenAlice.app/Contents/Resources/app'), 'package.json', '{}')
      expect(assertDesktopPackage({ packageRoot: root }).ok).toBe(false)
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('rejects a corrupt archive, missing native payload, and mismatched product metadata', async () => {
    const root = mkdtempSync(join(tmpdir(), 'openalice-package-asar-invalid-'))
    const appRoot = join(root, 'mac-arm64/OpenAlice.app/Contents/Resources/runtime')
    try {
      await writeBasePackage(appRoot, { ...piManifest(), ...searchToolsManifest('darwin-arm64') })
      writeSearchToolFiles(appRoot, 'darwin-arm64')
      writePackageFile(join(dirname(appRoot), 'app.asar.unpacked'), 'node_modules/dugite/git/bin/git')
      expect(assertDesktopPackage({ packageRoot: root, arch: 'arm64' }).ok).toBe(true)
      rmSync(join(dirname(appRoot), 'app.asar.unpacked/node_modules/node-pty/build/Release/pty.node'))
      expect(assertDesktopPackage({ packageRoot: root, arch: 'arm64' }).errors.join('\n'))
        .toContain('native payload must be unpacked')
      writePackageFile(appRoot, 'package.json', JSON.stringify({ version: '0.0.0' }))
      expect(assertDesktopPackage({ packageRoot: root, arch: 'arm64' }).errors.join('\n'))
        .toContain('product versions differ')
      const archivePath = join(dirname(appRoot), 'app.asar')
      uncache(archivePath)
      writeFileSync(archivePath, 'broken')
      expect(assertDesktopPackage({ packageRoot: root, arch: 'arm64' }).errors.join('\n'))
        .toContain('invalid app.asar')
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('requires managed search tools but not vendor Git in macOS packages', async () => {
    const root = mkdtempSync(join(tmpdir(), 'openalice-package-mac-'))
    try {
      const appRoot = join(root, 'mac-arm64/OpenAlice.app/Contents/Resources/runtime')
      await writeBasePackage(appRoot, { ...piManifest(), ...searchToolsManifest('darwin-arm64') })
      writeSearchToolFiles(appRoot, 'darwin-arm64')
      writePackageFile(join(dirname(appRoot), 'app.asar.unpacked'), 'node_modules/dugite/git/bin/git')

      const result = assertDesktopPackage({ packageRoot: root, repoRoot: root, arch: 'arm64' })

      expect(result.ok).toBe(true)
      expect(result.platform).toBe('darwin')
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('requires managed Git Bash files and manifest metadata in Windows packages', async () => {
    const root = mkdtempSync(join(tmpdir(), 'openalice-package-win-missing-'))
    try {
      const appRoot = join(root, 'win-unpacked/resources/runtime')
      await writeBasePackage(appRoot, piManifest())

      const result = assertDesktopPackage({ packageRoot: root, repoRoot: root, arch: 'x64' })

      expect(result.ok).toBe(false)
      expect(result.errors.join('\n')).toContain('vendor/tools/win32-x64/bin/fd.exe')
      expect(result.errors.join('\n')).toContain('expected manifest.searchTools.win32-x64')
      expect(result.errors.join('\n')).toContain('vendor/git/win32-x64/cmd/git.exe')
      expect(result.errors.join('\n')).toContain('vendor/git/win32-x64/bin/bash.exe')
      expect(result.errors.join('\n')).toContain('expected manifest.git.win32-x64')
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('accepts Windows packages with PortableGit files', async () => {
    const root = mkdtempSync(join(tmpdir(), 'openalice-package-win-ok-'))
    try {
      const appRoot = join(root, 'win-unpacked/resources/runtime')
      await writeBasePackage(appRoot, {
        ...piManifest(),
        ...searchToolsManifest('win32-x64', true),
        git: {
          'win32-x64': {
            version: '2.55.0.2',
            path: 'vendor/git/win32-x64',
            gitBin: 'cmd/git.exe',
            shellPath: 'bin/bash.exe',
            shPath: 'bin/sh.exe',
          },
        },
      })
      writePackageFile(appRoot, 'vendor/git/win32-x64/cmd/git.exe')
      writePackageFile(appRoot, 'vendor/git/win32-x64/bin/bash.exe')
      writePackageFile(appRoot, 'vendor/git/win32-x64/bin/sh.exe')
      writeSearchToolFiles(appRoot, 'win32-x64', true)

      const result = assertDesktopPackage({ packageRoot: root, repoRoot: root, arch: 'x64' })

      expect(result.ok).toBe(true)
      expect(result.platform).toBe('win32')
      expect(result.platformArch).toBe('win32-x64')
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('rejects dugite embedded Git in Windows packages', async () => {
    const root = mkdtempSync(join(tmpdir(), 'openalice-package-win-dugite-git-'))
    try {
      const appRoot = join(root, 'win-unpacked/resources/runtime')
      await writeBasePackage(appRoot, {
        ...piManifest(),
        ...searchToolsManifest('win32-x64', true),
        git: {
          'win32-x64': {
            version: '2.55.0.2',
            path: 'vendor/git/win32-x64',
            gitBin: 'cmd/git.exe',
            shellPath: 'bin/bash.exe',
            shPath: 'bin/sh.exe',
          },
        },
      })
      writePackageFile(appRoot, 'vendor/git/win32-x64/cmd/git.exe')
      writePackageFile(appRoot, 'vendor/git/win32-x64/bin/bash.exe')
      writePackageFile(appRoot, 'vendor/git/win32-x64/bin/sh.exe')
      writeSearchToolFiles(appRoot, 'win32-x64', true)
      writePackageFile(join(dirname(appRoot), 'app.asar.unpacked'), 'node_modules/dugite/git/cmd/git.exe')

      const result = assertDesktopPackage({ packageRoot: root, repoRoot: root, arch: 'x64' })

      expect(result.ok).toBe(false)
      expect(result.errors.join('\n')).toContain('dugite\'s embedded Git payload is forbidden')
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('rejects optional broker SDKs bundled into the desktop app', async () => {
    const root = mkdtempSync(join(tmpdir(), 'openalice-package-broker-sdk-'))
    try {
      const appRoot = join(root, 'mac-arm64/OpenAlice.app/Contents/Resources/runtime')
      await writeBasePackage(appRoot, { ...piManifest(), ...searchToolsManifest('darwin-arm64') })
      writeSearchToolFiles(appRoot, 'darwin-arm64')
      writePackageFile(join(dirname(appRoot), 'app.asar.unpacked'), 'node_modules/dugite/git/bin/git')
      writePackageFile(join(dirname(appRoot), 'app.asar.unpacked'), 'node_modules/.pnpm/ccxt@4.5.38/package.json')
      writePackageFile(join(dirname(appRoot), 'app.asar.unpacked'), 'node_modules/longbridge/package.json')

      const result = assertDesktopPackage({ packageRoot: root, repoRoot: root, arch: 'arm64' })

      expect(result.ok).toBe(false)
      expect(result.errors.join('\n')).toContain('optional broker SDKs')
      expect(result.errors.join('\n')).toContain('ccxt')
      expect(result.errors.join('\n')).toContain('longbridge')
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })
})
