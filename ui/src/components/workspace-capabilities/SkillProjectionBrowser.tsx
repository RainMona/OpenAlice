import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Search, FileText, ChevronRight } from 'lucide-react'
import { useSkillProjection, type ProjectInjection, type SkillProjection } from '../../hooks/useProjectInjection'
import type { SkillProjectionRequest } from '../workspace/api'
import { WorkspaceTemplateUpgradePanel } from '../workspace/WorkspaceTemplateUpgradePanel'
import { Button } from '../ui/button'
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '../ui/dialog'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../ui/tabs'

export function skillProjectionStatus(skill: SkillProjection) {
  if (skill.files.some((file) => file.unverified)) return 'unverified'
  if (!skill.installed) return 'notInstalled'
  if (!skill.canonicalPresent) return 'missingPrimary'
  if (!skill.files.some((file) => file.differs)) return 'matches'
  if (skill.customized) return 'customized'
  if (skill.files.some((file) => file.differs)) return 'updateAvailable'
  return 'matches'
}

export function SkillProjectionBrowser({ data, disabled, onChange }: {
  data: ProjectInjection; disabled: boolean; onChange(): void
}) {
  const { t } = useTranslation()
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<string | null>(null)
  const [operation, setOperation] = useState<{ workspaceId: string; workspaceName: string; request: SkillProjectionRequest } | null>(null)
  const skills = data.skills.filter((skill) => skill.name.toLowerCase().includes(search.toLowerCase()))
  const active = skills.find((skill) => skill.name === selected) ?? skills[0]
  return <div className="grid min-w-0 gap-6 lg:grid-cols-[190px_minmax(0,1fr)]">
    <nav aria-label={t('skillManager.prototypes')} className="min-w-0 lg:border-r lg:border-border lg:pr-4">
      <label className="mb-3 flex items-center gap-2 rounded-md border border-input px-2 py-2 text-muted-foreground focus-within:ring-2 focus-within:ring-ring">
        <Search size={14} aria-hidden="true" />
        <input aria-label={t('skillManager.search')} placeholder={t('skillManager.search')} value={search} onChange={(event) => setSearch(event.target.value)} className="min-w-0 flex-1 bg-transparent text-xs text-foreground outline-none" />
      </label>
      <div className="flex flex-wrap gap-1 lg:flex-col">
        {skills.map((skill) => <Button key={skill.name} variant={active?.name === skill.name ? 'secondary' : 'ghost'} aria-pressed={active?.name === skill.name} onClick={() => setSelected(skill.name)} className="justify-start font-mono text-xs">
          <FileText size={14} aria-hidden="true" />{skill.name}
        </Button>)}
      </div>
      {!skills.length && <p role="status" className="py-3 text-xs text-muted-foreground">{t('skillManager.noResults')}</p>}
    </nav>
    {active && <section className="min-w-0" aria-label={active.name}>
      <h3 className="font-mono text-base font-semibold">{active.name}</h3>
      <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{t('skillManager.prototypeHint')}</p>
      <Tabs defaultValue="copies" className="mt-4">
        <TabsList><TabsTrigger value="copies">{t('skillManager.copies')}</TabsTrigger><TabsTrigger value="source">{t('skillManager.prototype')}</TabsTrigger></TabsList>
        <TabsContent value="source" className="mt-4">
          {active.files.map((file) => <details key={`${active.name}:${file.path}`} open={file.path === 'SKILL.md'} className="border-t border-border py-3">
            <summary className="cursor-pointer font-mono text-xs">{file.path}</summary>
            <pre className="mt-3 max-h-[60vh] overflow-auto whitespace-pre-wrap break-words text-xs leading-relaxed">{file.content}</pre>
          </details>)}
        </TabsContent>
        <TabsContent value="copies" className="mt-4">
          {!data.workspaces.length && <p className="text-sm text-muted-foreground">{t('distribution.empty')}</p>}
          {data.workspaces.map((workspace) => {
            const projection = workspace.projections?.find((skill) => skill.name === active.name)
            return <div key={`${active.name}:${workspace.id}`} className="border-t border-border py-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0"><h4 className="text-sm font-medium">{workspace.name || workspace.id}</h4>
                  <p className="mt-1 text-xs text-muted-foreground">{projection ? t(`skillManager.${skillProjectionStatus(projection)}`) : t('distribution.error')}</p>
                </div>
                {projection && <div className="flex flex-wrap gap-1">
                  {(['install', 'update', 'restore', 'remove'] as const).filter((action) => {
                    if (action === 'install') return !projection.installed || !projection.canonicalPresent || !projection.enabled
                    if (action === 'update') return projection.installed && projection.sourceChanged && projection.files.some((file) => file.differs)
                    if (action === 'remove') return projection.installed || projection.enabled
                    return projection.installed && projection.files.some((file) => file.differs)
                  }).map((action) => <Button key={action} size="sm" variant={action === 'install' ? 'outline' : 'ghost'} disabled={disabled} onClick={() => setOperation({ workspaceId: workspace.id, workspaceName: workspace.name || workspace.id, request: { skill: active.name, action } })}>{t(`skillManager.${action}`)}</Button>)}
                </div>}
              </div>
              {workspace.error && <p role="alert" className="mt-2 text-xs">{workspace.error}</p>}
              {projection && <>
                <p className="mt-2 text-xs text-muted-foreground">{t(projection.enabled ? 'skillManager.retained' : 'skillManager.excluded')}</p>
                {projection.sourceChanged && projection.installed && <p className="mt-2 text-xs text-muted-foreground">{t('skillManager.updateAvailable')}</p>}
                {projection.mirrorDiverged && <p className="mt-2 text-xs text-warning">{t('skillManager.mirrorDiverged')}</p>}
                {workspace.plan?.blocked && <p className="mt-2 text-xs text-muted-foreground">{t('skillManager.blocked')}</p>}
                {projection.installed && <SkillComparison key={workspace.plan?.planDigest} workspaceId={workspace.id} skill={active.name} />}

              </>}
            </div>
          })}
        </TabsContent>
      </Tabs>
    </section>}
    <Dialog open={!!operation} onOpenChange={(open) => { if (!open) setOperation(null) }}>
      <DialogContent className="max-h-[90vh] overflow-auto sm:max-w-4xl" closeLabel={t('common.close')}>
        <DialogTitle>{operation && `${t(`skillManager.${operation.request.action}`)} ${operation.request.skill} · ${operation.workspaceName}`}</DialogTitle>
        <DialogDescription>{t(operation?.request.action === 'restore' ? 'skillManager.restoreHint' : 'skillManager.scopeHint')}</DialogDescription>
        {operation && <WorkspaceTemplateUpgradePanel wsId={operation.workspaceId} layer="alice-harness" projection={operation.request} onWorkspaceChanged={onChange} onClose={() => setOperation(null)} />}
      </DialogContent>
    </Dialog>
  </div>
}

function FilePreview({ label, content, missing }: { label: string; content: string | null; missing: string }) {
  return <section className="min-w-0"><h5 className="mb-2 text-xs font-medium">{label}</h5><pre className="max-h-80 overflow-auto whitespace-pre-wrap break-words rounded bg-secondary/40 p-3 text-xs leading-relaxed">{content ?? missing}</pre></section>
}

function SkillComparison({ workspaceId, skill }: { workspaceId: string; skill: string }) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const state = useSkillProjection(workspaceId, skill, open)
  return <details className="group mt-3" onToggle={(event) => setOpen(event.currentTarget.open)}>
    <summary className="flex cursor-pointer list-none items-center gap-1 text-xs text-muted-foreground"><ChevronRight size={13} className="transition-transform group-open:rotate-90" />{t('skillManager.compare')}</summary>
    {open && <div className="mt-3 space-y-2">
      {state.error && <p role="alert" className="text-xs">{state.error}</p>}
      {!state.data && !state.error && <p role="status" className="text-xs">{t('common.loading')}</p>}
      {state.data?.files.map((file) => <details key={file.path} className="rounded-md border border-border p-2">
        <summary className="cursor-pointer break-all font-mono text-xs">{file.path} · {t(file.unverified ? 'skillManager.unverified' : file.differs ? 'skillManager.different' : 'skillManager.matches')}</summary>
        {file.truncated && <p className="mt-2 text-xs text-warning">{t('skillManager.truncated')}</p>}
        <div className="mt-3 grid min-w-0 gap-3 xl:grid-cols-2">
          <FilePreview label={t('skillManager.local')} content={file.currentPreview ?? null} missing={t('skillManager.absent')} />
          <FilePreview label={t('skillManager.prototype')} content={file.sourcePreview ?? null} missing={t('skillManager.absent')} />
        </div>
      </details>)}
    </div>}
  </details>
}
