import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { PageHeader } from '../components/PageHeader'
import { SettingsScrollArea } from '../components/form'
import { Button } from '../components/ui/button'
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '../components/ui/dialog'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/ui/tabs'
import { useProjectInjection, injectionStatus, type InjectionWorkspace } from '../hooks/useProjectInjection'
import { WorkspaceTemplateUpgradePanel } from '../components/workspace/WorkspaceTemplateUpgradePanel'
import { AliceHarnessPanel } from '../components/workspace-capabilities/AliceHarnessPanel'

export function WorkspaceInjectionPage() {
  const { t } = useTranslation()
  const state = useProjectInjection()
  const [reviewRevision, setReviewRevision] = useState(0)
  const [review, setReview] = useState<InjectionWorkspace | null>(null)
  const [source, setSource] = useState<string | null>(null)
  const skill = state.data?.skills.find((s) => s.name === source)
  const ready = state.data?.workspaces.filter((row) => ['update', 'record'].includes(injectionStatus(row))).length ?? 0
  return <div className="flex min-h-0 flex-1 flex-col">
    <PageHeader title={t('distribution.title')} />
    <SettingsScrollArea className="px-4 py-5 md:px-8">
      <div className="mx-auto max-w-[960px] space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="max-w-2xl"><h2 className="text-lg font-semibold">Alice Harness</h2><p className="mt-2 text-sm text-muted-foreground">{t('distribution.description')}</p></div>
          <Button variant="outline" disabled={state.busy} onClick={state.refresh}>{t('harnessSurface.refresh')}</Button>
        </div>
        {state.error && <p role="alert">{state.error}</p>}
        {!state.data && !state.error && <p role="status">{t('common.loading')}</p>}
        {state.data && <>
          <div className="border-y border-border py-4 text-sm"><span className="text-muted-foreground">{t('distribution.skillsVersion')} </span><code className="break-all">{state.data.version}</code></div>
          <Tabs defaultValue="workspaces">
            <TabsList><TabsTrigger value="workspaces">{t('distribution.workspaces')}</TabsTrigger><TabsTrigger value="cli">CLI</TabsTrigger><TabsTrigger value="source">{t('distribution.source')}</TabsTrigger></TabsList>
            <TabsContent value="workspaces" className="mt-5">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><p className="max-w-xl text-xs text-muted-foreground">{t('distribution.batchHint')}</p><Button disabled={state.busy || !!state.error || !ready} onClick={() => void state.updateReady()}>{state.busy ? t('common.loading') : t('distribution.updateReady', { count: ready })}</Button></div>
              {!state.data.workspaces.length && <p>{t('distribution.empty')}</p>}
              {state.data.workspaces.map((row) => <section key={row.id} className="border-t border-border py-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0"><h3 className="font-medium">{row.name || row.id}</h3><p className="mt-1 break-all text-xs text-muted-foreground">{row.template} · {row.plan?.fromVersion === 'unversioned' ? t('aliceHarness.unversioned') : row.plan?.fromVersion}</p></div>
                  <div className="flex items-center gap-3"><span className="text-xs text-muted-foreground">{t(`distribution.${injectionStatus(row)}`)}</span><Button variant="outline" disabled={state.busy || !row.plan || !!state.error} onClick={() => setReview(row)}>{t('distribution.review')}</Button></div>
                </div>
                {row.error && <p role="alert" className="mt-2 text-xs">{row.error}</p>}
                {state.results[row.id] && <p role="status" className="mt-2 text-xs">{state.results[row.id] === 'ok' ? t('distribution.updated') : state.results[row.id]}</p>}
              </section>)}
            </TabsContent>
            <TabsContent value="cli" className="mt-5"><p className="mb-4 text-sm text-muted-foreground">{t('distribution.cliHint')}</p>{Object.entries(state.data.commands).map(([binary, groups]) => <section className="border-t border-border py-4" key={binary}><h3 className="font-mono font-semibold">{binary}</h3>{Object.entries(groups).map(([group, verbs]) => <details className="py-2" key={group}><summary className="font-mono text-sm">{group} <span className="text-muted-foreground">{verbs.length}</span></summary><div className="mt-2 grid gap-2 pl-4 text-xs sm:grid-cols-2">{verbs.map((verb) => <code key={verb}>{binary} {group} {verb}</code>)}</div></details>)}</section>)}</TabsContent>
            <TabsContent value="source" className="mt-5"><p className="mb-3 text-xs text-muted-foreground">{t('distribution.sourceHint')}</p>{state.data.skills.map((s) => <div key={s.name} className="flex items-center justify-between border-t border-border py-3"><code>{s.name}</code><Button variant="ghost" onClick={() => setSource(s.name)}>{t('distribution.browse')}</Button></div>)}</TabsContent>
          </Tabs>
        </>}
      </div>
    </SettingsScrollArea>
    <Dialog open={!!review} onOpenChange={(open) => { if (!open) setReview(null) }}><DialogContent className="max-h-[90vh] overflow-auto sm:max-w-4xl" closeLabel={t('common.close')}><DialogTitle>{review?.name}</DialogTitle><DialogDescription>{t('distribution.reviewHint')}</DialogDescription>{review && <><AliceHarnessPanel inProject wsId={review.id} onChange={() => { state.refresh(); setReviewRevision((v) => v + 1) }} /><WorkspaceTemplateUpgradePanel key={`${review.id}:${reviewRevision}`} wsId={review.id} layer="alice-harness" onWorkspaceChanged={state.refresh} onClose={() => setReview(null)} /></>}</DialogContent></Dialog>
    <Dialog open={!!skill} onOpenChange={(open) => { if (!open) setSource(null) }}><DialogContent className="max-h-[90vh] overflow-auto sm:max-w-3xl" closeLabel={t('common.close')}><DialogTitle>{skill?.name}</DialogTitle><DialogDescription>{t('distribution.sourceHint')}</DialogDescription>{skill?.files.map((file) => <details key={file.path} open={file.path === 'SKILL.md'} className="border-t border-border py-2"><summary className="font-mono text-xs">{file.path}</summary><pre className="mt-3 whitespace-pre-wrap break-words font-mono text-xs leading-relaxed">{file.content}</pre></details>)}</DialogContent></Dialog>
  </div>
}
