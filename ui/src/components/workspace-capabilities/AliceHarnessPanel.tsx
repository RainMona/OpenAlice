import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAliceHarness, type AliceHarnessConfig } from '../../hooks/useAliceHarness'
import { Button } from '../ui/button'
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '../ui/dialog'
import { WorkspaceTemplateUpgradePanel } from '../workspace/WorkspaceTemplateUpgradePanel'

export function AliceHarnessPanel({ wsId, onChange }: { wsId: string; onChange(): void }) {
  const { t } = useTranslation()
  const state = useAliceHarness(wsId)
  const [open, setOpen] = useState(false)
  const [review, setReview] = useState(false)
  const [draft, setDraft] = useState<AliceHarnessConfig | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  useEffect(() => { setDraft(state.data?.config ?? null) }, [state.data])
  return <>
    <div className="flex flex-wrap items-center gap-3 border-b border-border py-3 text-xs">
      <strong>Alice Harness</strong>
      <span className="min-w-0 flex-1 break-all text-muted-foreground">{state.error ?? (state.data ? state.data.appliedVersion ?? t('aliceHarness.unversioned') : t('common.loading'))}</span>
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>{t('aliceHarness.manage')}</Button>
    </div>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-h-[85vh] overflow-auto sm:max-w-3xl" closeLabel={t('common.close')}>
        <DialogTitle>Alice Harness</DialogTitle>
        <DialogDescription>{t('aliceHarness.description')}</DialogDescription>
        {state.error && <Button variant="outline" onClick={state.refresh}>{t('common.retry')}</Button>}
        {(!state.data && !state.error) && <p role="status">{t('common.loading')}</p>}
        {(state.error || error) && <p role="alert">{state.error || error}</p>}
        {state.data && draft && <>
          <div className="space-y-1 break-all text-xs text-muted-foreground">
            <p>{t('aliceHarness.applied')}: {state.data.appliedVersion ?? t('aliceHarness.unversioned')}</p>
            <p>{t('aliceHarness.available')}: {state.data.availableVersion}</p>
          </div>
          {Object.entries(state.data.commands).map(([binary, groups]) => <fieldset key={binary} className="border-t border-border py-3">
            <legend className="px-1 font-mono text-sm">{binary}</legend>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={draft.cli[binary]?.enabled !== false} onChange={(event) => setDraft({ ...draft, cli: { ...draft.cli, [binary]: { ...draft.cli[binary], enabled: event.target.checked } } })} />
              {t('aliceHarness.enabled')}
            </label>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {groups.map((group) => <label key={group} className="flex items-center gap-2 font-mono text-xs">
                <input type="checkbox" disabled={draft.cli[binary]?.enabled === false} checked={draft.cli[binary]?.groups?.[group] !== false} onChange={(event) => setDraft({ ...draft, cli: { ...draft.cli, [binary]: { ...draft.cli[binary], groups: { ...draft.cli[binary]?.groups, [group]: event.target.checked } } } })} />
                {group}
              </label>)}
            </div>
          </fieldset>)}
          <p className="text-xs text-muted-foreground">{t('aliceHarness.configHint')}</p>
          <div className="flex flex-wrap gap-2">
            <Button disabled={saving} onClick={() => { setSaving(true); setError(null); void state.save(draft).then(onChange).catch((err) => setError((err as Error).message)).finally(() => setSaving(false)) }}>{t('common.save')}</Button>
            <Button variant="outline" onClick={() => setReview((value) => !value)}>{t('aliceHarness.review')}</Button>
          </div>
          {review && <WorkspaceTemplateUpgradePanel wsId={wsId} layer="alice-harness" onWorkspaceChanged={() => { state.refresh(); onChange() }} onClose={() => setReview(false)} />}
        </>}
      </DialogContent>
    </Dialog>
  </>
}
