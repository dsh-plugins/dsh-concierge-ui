import { useEffect, useId, useRef, useState, useSyncExternalStore } from 'react'
import type { ConfigForm } from '@deepseek-ai/dsh-client-ui-settings/client'
import { Scrollbar } from '@dsh-plugin/dsh-loader/client'
import { DshProvider, PanelShell } from '@dsh-plugin/dsh-ui-components'
import { modelSettingsCopy } from './model-settings-copy.js'
import { modelSettingsStyle } from './model-settings-style.js'
import { ui } from './im-style.js'

export const modelSettingsNamespace = 'dsh-prism-models'
const layers = ['L1', 'L2', 'L3'] as const
type Layer = typeof layers[number]
type ModelRule = { provider: string; model: string; enabled: boolean; description: string; prompt: string }
type Identity = Pick<ModelRule, 'provider' | 'model'>
type Details = Pick<ModelRule, 'description' | 'prompt'>
type ModelChange = Partial<Pick<ModelRule, 'enabled' | 'description' | 'prompt'>>
export type ModelSelections = Record<Layer, ModelRule[]>
type Copy = ReturnType<typeof modelSettingsCopy>
type Provider = {
  id: string
  name: string
  models: readonly { id: string; name: string; description?: string }[]
}
type Directory = {
  status: 'loading' | 'ready' | 'failed'
  groups: readonly Provider[]
  partial: boolean
}
/** 通过 DSH 原生会话服务读取当前宿主的模型目录。 */
export interface ModelDirectoryRemote {
  session: {
    modelCatalog(): Promise<{ok: true; value: {groups: readonly Provider[]; failures: readonly unknown[]}} | {ok: false}>
  }
  $on(event: 'llm/adapters-updated' | 'settings/document-updated', listener: (namespace?: string) => void): () => void
}
type Candidate = Identity & {name: string; providerName: string; description?: string; available: boolean; rule?: ModelRule}
type Result = 'ok' | 'conflict' | 'failed'

function key({provider, model}: Identity): string {
  return JSON.stringify([provider, model])
}

function candidates(groups: readonly Provider[], rules: readonly ModelRule[]) {
  const unmatched = new Map(rules.map(rule => [key(rule), rule]))
  const result = groups.filter(group => group.models.length > 0).map(group => {
    const models = group.models.map(model => {
      const identity = {provider: group.id, model: model.id}
      const id = key(identity)
      const rule = unmatched.get(id)
      unmatched.delete(id)
      return {...identity, name: model.name, providerName: group.name, description: model.description,
        available: true, rule} satisfies Candidate
    })
    return {id: group.id, name: group.name, models}
  })
  return {result, unavailable: [...unmatched.values()].map(rule => ({
    provider: rule.provider, model: rule.model, name: rule.model, providerName: rule.provider, available: false, rule,
  } satisfies Candidate))}
}

function Editor({ layer, model, copy, save, close }: {
  layer: Layer; model: Candidate; copy: Copy; save(details: Details): Promise<Result>; close(): void
}) {
  const formId = useId()
  const [description, setDescription] = useState(model.rule?.description ?? '')
  const [prompt, setPrompt] = useState(model.rule?.prompt ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  async function submit() {
    setSaving(true)
    setError('')
    const result = await save({description: description.trim(), prompt})
    if (result === 'ok') {
      close()
      return
    }
    setSaving(false)
    setError(result === 'conflict' ? copy.conflict : copy.saveFailed)
  }

  return <div style={{display: 'contents'}} onKeyDown={event => event.stopPropagation()}>
    <DshProvider style={{display: 'contents'}}>
      <PanelShell title={copy.edit.replace('{model}', () => model.name)} onClose={saving ? undefined : close}
        className="prism-model-dialog" footer={<>
          <button type="button" style={ui.button} disabled={saving} onClick={close}>{copy.cancel}</button>
          <button type="submit" form={formId} style={ui.button} disabled={saving}>{saving ? copy.saving : copy.save}</button>
        </>}>
        <form id={formId} className="prism-model-editor-fields" onSubmit={event => {
          event.preventDefault()
          if (!saving) {
            void submit()
          }
        }}>
          <small>{layer} · {model.provider}/{model.model}</small>
          <label>{copy.description}
            <textarea rows={3} maxLength={2000} value={description} placeholder={model.description}
              disabled={saving} onChange={event => setDescription(event.currentTarget.value)} />
          </label>
          <label>{copy.prompt}
            <textarea rows={6} maxLength={16000} value={prompt}
              disabled={saving} onChange={event => setPrompt(event.currentTarget.value)} />
          </label>
          {error && <div role="alert">{error}</div>}
        </form>
      </PanelShell>
    </DshProvider>
  </div>
}

export function ModelSettings({ form, remote, language }: {
  form: ConfigForm<ModelSelections>; remote: ModelDirectoryRemote; language: string
}) {
  const copy = modelSettingsCopy(language)
  const snapshot = useSyncExternalStore(listener => form.subscribe(listener), () => form.getSnapshot())
  const [directory, setDirectory] = useState<Directory>({status: 'loading', groups: [], partial: false})
  const [refresh, setRefresh] = useState(0)
  const [saving, setSaving] = useState(false)
  const [feedback, setFeedback] = useState('')
  const [editor, setEditor] = useState<{layer: Layer; model: Candidate; revision: number}>()
  const busy = useRef(false)

  useEffect(() => {
    let generation = 0
    let closed = false
    async function load() {
      const request = ++generation
      setDirectory(current => ({...current, status: 'loading'}))
      const reply = await remote.session.modelCatalog().catch(() => undefined)
      if (closed || request !== generation) {
        return
      }
      if (reply?.ok) {
        setDirectory({status: 'ready', groups: reply.value.groups, partial: reply.value.failures.length > 0})
      } else {
        setDirectory(current => ({...current, status: 'failed'}))
      }
    }
    void load()
    const stopAdapters = remote.$on('llm/adapters-updated', () => { void load() })
    const stopSettings = remote.$on('settings/document-updated', namespace => {
      if (namespace !== modelSettingsNamespace) {
        void load()
      }
    })
    return () => {
      closed = true
      stopAdapters()
      stopSettings()
    }
  }, [remote, refresh])

  async function update(layer: Layer, identity: Identity, change: ModelChange, revision?: number): Promise<Result> {
    const current = form.getSnapshot()
    if (busy.current || !current.writable || current.status !== 'ready' || current.revision === undefined) {
      return 'failed'
    }
    if (revision !== undefined && current.revision !== revision) {
      return 'conflict'
    }
    const id = key(identity)
    const rules = current.value?.[layer] ?? []
    const index = rules.findIndex(rule => key(rule) === id)
    const existing = rules[index]
    const next = {...(existing ?? {provider: identity.provider, model: identity.model, enabled: false, description: '', prompt: ''}),
      ...change}
    const keep = next.enabled || next.description || next.prompt
    const updated = [...rules]
    if (index < 0 && keep) {
      updated.push(next)
    } else if (index >= 0) {
      updated.splice(index, 1, ...(keep ? [next] : []))
    }
    busy.current = true
    setSaving(true)
    try {
      const saved = await form.mutate([{op: 'set', path: [layer], value: updated}], current.revision)
      if (saved) {
        return 'ok'
      }
      return form.getSnapshot().revision !== current.revision ? 'conflict' : 'failed'
    } catch {
      return 'failed'
    } finally {
      busy.current = false
      setSaving(false)
    }
  }

  const locked = saving || !snapshot.writable || snapshot.revision === undefined || snapshot.status !== 'ready'
  const hasRules = layers.some(layer => snapshot.value?.[layer]?.length)
  const hasModels = directory.groups.some(group => group.models.length)

  function renderModel(layer: Layer, model: Candidate) {
    const label = copy.edit.replace('{model}', () => model.name)
    const checked = model.rule?.enabled ?? false
    return <div className="prism-model-row" key={key(model)}>
      <label>
        <input type="checkbox" checked={checked} disabled={locked || (!model.available && !checked)}
          onChange={event => {
            setFeedback('')
            void update(layer, model, {enabled: event.currentTarget.checked}).then(result => {
              if (result !== 'ok') {
                setFeedback(copy.saveFailed)
              }
            })
          }} />
        <span>
          <span className="prism-model-name">{model.name}</span>
          <span className="prism-model-route">{model.providerName} · {model.provider}/{model.model}</span>
          {!model.available && <span className="prism-model-unavailable">{copy.removed}</span>}
        </span>
      </label>
      <button type="button" className="prism-model-edit" aria-label={label} aria-haspopup="dialog"
        title={label} disabled={locked} onClick={() => {
          if (snapshot.revision !== undefined) {
            setEditor({layer, model, revision: snapshot.revision})
          }
        }}>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.25"
          strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M3 10.6 10.8 2.8a1.6 1.6 0 0 1 2.3 2.3l-7.8 7.8L2.4 13.6 3 10.6Zm6.7-6.7 2.4 2.4" />
        </svg>
      </button>
    </div>
  }

  return <div className="prism-model-settings">
    <style>{modelSettingsStyle}</style>
    <p>{copy.fallback}</p>
    {snapshot.status !== 'ready' && snapshot.status !== 'loading' && <p role="alert">{copy.unavailable}</p>}
    {directory.status === 'loading' && !hasModels && <p role="status">{copy.loading}</p>}
    {directory.status === 'ready' && !hasModels && !hasRules && !directory.partial && <p>{copy.empty}</p>}
    {(directory.status === 'failed' || directory.partial) && <div style={ui.row} role="status">
      <span>{directory.status === 'failed' ? copy.failed : copy.partial}</span>
      <button type="button" style={ui.button} onClick={() => setRefresh(value => value + 1)}>{copy.refresh}</button>
    </div>}
    {(hasModels || hasRules) && layers.map(layer => {
      const {result, unavailable} = candidates(directory.groups, snapshot.value?.[layer] ?? [])
      return <fieldset key={layer} data-prism-model-layer={layer}>
        <legend>{copy.layer.replace('{layer}', layer)}</legend>
        <Scrollbar style={{maxHeight: 248}}>
          {result.map(group => <div className="prism-model-group" key={group.id} data-provider={group.id}>
            <div className="prism-model-provider">{group.name}</div>
            {group.models.map(model => renderModel(layer, model))}
          </div>)}
          {unavailable.length > 0 && <div className="prism-model-group">
            {unavailable.map(model => renderModel(layer, model))}
          </div>}
        </Scrollbar>
      </fieldset>
    })}
    {feedback && <p role="alert">{feedback}</p>}
    {editor && <Editor layer={editor.layer} model={editor.model} copy={copy}
      save={change => update(editor.layer, editor.model, change, editor.revision)}
      close={() => setEditor(undefined)} />}
  </div>
}
