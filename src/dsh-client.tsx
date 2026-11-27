import { useState, useSyncExternalStore } from 'react'
import type { CSSProperties, FormEvent } from 'react'
import type { LocaleRuntime } from '@deepseek-ai/dsh-client-locale/client'
import type { SlotCore } from '@deepseek-ai/dsh-client-ui-slots'
import type { SidebarFooterActionOwnerProps } from '@deepseek-ai/dsh-client-ui-sidebar/client'
import type { ConfigForm, ConfigForms } from '@deepseek-ai/dsh-client-ui-settings/client'
import { settingsCopy } from './settings-copy.js'
import { ImSettings } from './ImSettings.js'
import { imCopy } from './im-copy.js'
import { PrismShortcut } from './PrismShortcut.js'

interface Project {
  id: string
  workspace: string
  description: string
  permissions: string[]
  nodeId: string
  principals: string[]
  stack: string[]
}
interface ProjectSettings { managedProjects: Project[] }
type Copy = ReturnType<typeof settingsCopy>
const availableTools = ['read', 'glob', 'grep', 'read_image', 'write', 'edit', 'apply_patch', 'bash']
const newProject = (): Project => ({
  id: '', workspace: '', description: '', nodeId: 'local', principals: ['web:owner'],
  permissions: ['read', 'glob', 'grep'], stack: [],
})
const stack: CSSProperties = { display: 'grid', gap: 14 }
const row: CSSProperties = { display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }
const panel: CSSProperties = {
  ...stack, padding: 16, borderRadius: 12,
  border: '1px solid var(--dsw-alias-border-secondary, #c8ccc9)',
}
const button: CSSProperties = {
  border: '1px solid var(--dsw-alias-border-secondary, #c8ccc9)', borderRadius: 7,
  padding: '6px 12px', cursor: 'pointer', background: 'transparent', color: 'inherit', font: 'inherit',
}
const input: CSSProperties = {
  border: button.border, borderRadius: 6, background: 'transparent', color: 'inherit',
  font: 'inherit', padding: '7px 10px', width: '100%', boxSizing: 'border-box',
}

export function formatProjectPrincipals(principals: readonly string[]): string {
  return principals.join('\n')
}

export function parseProjectPrincipals(input: string, existing: readonly string[]): string[] | undefined {
  const lines = input.split(/\r?\n/u)
  const principals: string[] = []
  for (const raw of lines) {
    if (/[\x00-\x1f\x7f]/u.test(raw)) return
    const line = raw.trim()
    if (!line) continue
    // The registry matches exact strings. Preserve even a custom comma-bearing ID
    // when reopening an existing project, including when the user adds another line.
    if (existing.includes(raw)) principals.push(raw)
    else if (existing.includes(line)) principals.push(line)
    else if (line.startsWith('im:')) {
      try {
        const tuple: unknown = JSON.parse(line.slice(3))
        if (!Array.isArray(tuple) || tuple.length !== 3 || !tuple.every(id => typeof id === 'string' && id.length > 0)) return
        principals.push('im:' + JSON.stringify(tuple))
      } catch { return }
    } else if (lines.length === 1 && line.includes(',')) {
      // Older versions accepted plain identities in a comma-separated field.
      // A partial IM tuple must never turn into multiple project grants.
      const ids = line.split(',').map(id => id.trim()).filter(Boolean)
      if (!ids.every(id => /^[\p{L}\p{N}][\p{L}\p{N}_.:@/-]*$/u.test(id) && !id.startsWith('im:'))) return
      principals.push(...ids)
    } else principals.push(line)
  }
  if (principals.includes('*')) return
  return [...new Set(principals)]
}

function ProjectEditor({ initial, existing, copy, save, cancel, busy }: {
  initial: Project; existing: boolean; copy: Copy; busy: boolean
  save(project: Project): Promise<void>; cancel(): void
}) {
  const [draft, setDraft] = useState(initial)
  const [owners, setOwners] = useState(formatProjectPrincipals(initial.principals))
  const [error, setError] = useState('')
  const textField = (key: 'id' | 'workspace' | 'description' | 'nodeId', label: string, placeholder?: string) =>
    <label style={{ ...stack, gap: 4 }}>{label}
      <input style={input} value={draft[key]} placeholder={placeholder} disabled={key === 'id' && existing}
        required={key !== 'description'} onChange={e => setDraft({ ...draft, [key]: e.target.value })} />
    </label>

  async function submit(event: FormEvent) {
    event.preventDefault()
    const principals = parseProjectPrincipals(owners, initial.principals)
    if (!principals || (!principals.length && initial.principals.length)) {
      setError(copy.invalid)
      return
    }
    const project = {
      ...draft, id: draft.id.trim(), workspace: draft.workspace.trim(), nodeId: draft.nodeId.trim(),
      description: draft.description.trim() || draft.id.trim(), principals,
    }
    const key = /^[\p{L}\p{N}][\p{L}\p{N}_.-]*$/u
    if (!key.test(project.id) || !key.test(project.nodeId) ||
        !/^(?:\/|[a-z]:[\\/]|\\\\)[^\x00-\x1f\x7f]*$/iu.test(project.workspace)) {
      setError(copy.invalid)
      return
    }
    setError('')
    await save(project)
  }

  return <form style={panel} onSubmit={e => { void submit(e) }}>
    {textField('id', copy.id, 'web-app')}
    {textField('workspace', copy.folder, '/home/user/projects/web-app')}
    {textField('description', copy.description)}
    <fieldset style={{ ...row, border: 0, padding: 0, margin: 0 }}>
      <legend>{copy.permissions}</legend>
      {availableTools.map(tool => <label key={tool} style={row}>
        <input type="checkbox" checked={draft.permissions.includes(tool)} onChange={e => setDraft({
          ...draft, permissions: e.target.checked
            ? [...draft.permissions, tool] : draft.permissions.filter(current => current !== tool),
        })} />{tool}
      </label>)}
    </fieldset>
    <details><summary style={{ cursor: 'pointer' }}>{copy.advanced}</summary>
      <div style={{ ...stack, marginTop: 8 }}>
        {textField('nodeId', copy.node)}
        <label style={{ ...stack, gap: 4 }}>{copy.principals}
          <textarea style={input} value={owners} rows={3} required={initial.principals.length > 0}
            spellCheck={false} onChange={e => setOwners(e.target.value)} />
        </label>
      </div>
    </details>
    {error && <div role="alert">{error}</div>}
    <div style={row}><button type="submit" style={button} disabled={busy}>{copy.save}</button>
      <button type="button" style={button} disabled={busy} onClick={cancel}>{copy.cancel}</button></div>
  </form>
}

function Settings({ form, copy }: { form: ConfigForm<ProjectSettings>; copy: Copy }) {
  const snapshot = useSyncExternalStore(listener => form.subscribe(listener), () => form.getSnapshot())
  const projects = snapshot.value?.managedProjects ?? []
  const [editing, setEditing] = useState<{ project: Project; existing: boolean; revision: number }>()
  const [removing, setRemoving] = useState<{ id: string; revision: number }>()
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState('')
  const writable = snapshot.status === 'ready' && snapshot.writable && snapshot.revision !== undefined
  function edit(project: Project, existing: boolean) {
    if (!writable) return
    setStatus('')
    setRemoving(undefined)
    setEditing({ project, existing, revision: snapshot.revision! })
  }
  async function persist(projects: Project[], revision: number) {
    if (busy) return
    setBusy(true)
    setStatus('')
    try {
      if (!await form.mutate([{ op: 'set', path: ['managedProjects'], value: projects.map(p => ({ ...p })) }], revision)) {
        setStatus(copy.changed)
        return
      }
      setEditing(undefined)
      setRemoving(undefined)
      setStatus(copy.saved)
    } catch { setStatus(copy.changed) }
    finally { setBusy(false) }
  }
  return <section style={{ ...stack, maxWidth: 620, padding: '8px 0 20px' }}>
    <h2 style={{ margin: 0 }}>{copy.projects}</h2>
    <p style={{ margin: 0 }}>{copy.modelHelp}</p>
    <div><button type="button" style={button} onClick={() => window.location.assign('/prism')}>{copy.open}</button></div>
    {projects.map(p => <div key={p.id} style={panel}>
      <strong>{p.id}</strong><span style={{ overflowWrap: 'anywhere' }}>{p.workspace}</span>
      <span>{p.permissions.join(', ')}</span>
      {removing?.id === p.id
        ? <div style={row}><span>{copy.confirmRemove}</span>
            <button style={button} disabled={busy} onClick={() => void persist(projects.filter(x => x.id !== p.id), removing.revision)}>{copy.remove}</button>
            <button style={button} disabled={busy} onClick={() => setRemoving(undefined)}>{copy.cancel}</button></div>
        : <div style={row}><button style={button} disabled={!writable || busy} onClick={() => edit(p, true)}>{copy.edit}</button>
            <button style={button} disabled={!writable || busy} onClick={() => {
              setEditing(undefined); setRemoving({ id: p.id, revision: snapshot.revision! }); setStatus('')
            }}>{copy.remove}</button></div>}
    </div>)}
    {writable && !projects.length && !editing && <p>{copy.empty}</p>}
    {editing ? <ProjectEditor key={editing.project.id} initial={editing.project} existing={editing.existing} busy={busy}
      copy={copy} cancel={() => { setEditing(undefined); setStatus('') }}
      save={async project => {
        if (!editing.existing && projects.some(p => p.id === project.id)) { setStatus(copy.invalid); return }
        const next = editing.existing ? projects.map(p => p.id === project.id ? project : p) : [...projects, project]
        await persist(next, editing.revision)
      }} /> : <div><button style={button} disabled={!writable || busy} onClick={() => edit(newProject(), false)}>{copy.add}</button></div>}
    {snapshot.status !== 'loading' && !writable && <p>{copy.unavailable}</p>}
    {status && <p role="status">{status}</p>}
  </section>
}

export const inject = ['slots', 'configForms', 'locale']
interface BrowserContext {
  configForms: Pick<ConfigForms, 'get'>
  locale: Pick<LocaleRuntime, 'subscribe' | 'getSnapshot'>
  slots: Pick<SlotCore, 'register'> & {
    inject(name: 'settings.section' | 'sidebar.footer.action', mount: () => () => void): void
  }
}
export function apply(ctx: BrowserContext) {
  const form = ctx.configForms.get<ProjectSettings>('dsh-workspace-registry')
  function useLanguage() {
    return useSyncExternalStore(listener => ctx.locale.subscribe(listener), () => ctx.locale.getSnapshot().active)
  }
  function PrismSettings() {
    return <Settings form={form} copy={settingsCopy(useLanguage())} />
  }
  function PrismIm() {
    return <ImSettings copy={imCopy(useLanguage())} />
  }
  function PrismButton({ wide }: SidebarFooterActionOwnerProps) {
    const copy = settingsCopy(useLanguage())
    return <PrismShortcut wide={wide} label={copy.title} title={copy.open} />
  }
  ctx.slots.inject('settings.section', () => ctx.slots.register({
    name: 'settings.section', id: 'prism-projects', order: 60, label: () => {
      const copy = settingsCopy(ctx.locale.getSnapshot().active)
      return `${copy.title}/${copy.config}`
    },
  }, PrismSettings))
  ctx.slots.inject('settings.section', () => ctx.slots.register({
    name: 'settings.section', id: 'prism-im', order: 61,
    label: () => `${settingsCopy(ctx.locale.getSnapshot().active).title}/IM`,
  }, PrismIm))
  ctx.slots.inject('sidebar.footer.action', () => ctx.slots.register({
    name: 'sidebar.footer.action', id: 'prism-chat', order: 60,
  }, PrismButton))
}
