import { copy, locale } from './client-locale.js'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Button, Card, Modal, Tag, type TagTone } from '@dsh-plugin/dsh-ui-components'
import type { ConversationView, PublicMessage, TaskCard, TraceEntry } from '@dsh-prism/dsh-orchestrator/contracts'
import { describe, request } from './client-api.js'

const states: Record<TaskCard['status'], { label: string; tone: TagTone }> = {
  queued: { label: copy.queued, tone: 'neutral' },
  running: { label: copy.running, tone: 'warning' },
  completed: { label: copy.completed, tone: 'success' },
  failed: { label: copy.failed, tone: 'danger' },
}
const roles: Record<string, string> = { user: copy.input, assistant: copy.assistant, tool: copy.tool, system: copy.system }
const clock = new Intl.DateTimeFormat(locale, {
  month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false,
})

function Timestamp({ at }: { at?: string }) {
  if (!at) return null
  const date = new Date(at)
  if (Number.isNaN(date.getTime())) return null
  return <time dateTime={at} className="time">{clock.format(date)}</time>
}

function Message({ item }: { item: PublicMessage }) {
  const assistant = item.role === 'assistant'
  return (
    <article className={'message ' + item.role} aria-label={assistant ? copy.prismMessage : copy.yourMessage}>
      <span className="speaker">
        {assistant && <span className="prism" aria-hidden="true"><i /><i /><i /></span>}
        <strong>{assistant ? copy.brand : copy.you}</strong>
        <Timestamp at={item.at} />
      </span>
      <p>{item.text}</p>
      {!assistant && item.delivery && item.delivery !== 'processed' &&
        <span className="time">{item.delivery === 'failed' ? copy.processFailed : copy.processing}</span>}
    </article>
  )
}

type OpenTrace = (task: TaskCard, trigger: HTMLButtonElement) => void

function Task({ task, childrenByParent, onOpen }: {
  task: TaskCard
  childrenByParent: Map<string, TaskCard[]>
  onOpen: OpenTrace
}) {
  const { label, tone } = states[task.status]
  return (
    <Card variant="flat" bodyStyle={{ padding: 0 }} className="prism-task-surface">
      <details className="task" data-task={task.id}>
        <summary>
          <span className="task-glyph" aria-hidden="true" />
          <span className="task-name">
            {!task.parentId && <small>{copy.task}</small>}
            <strong title={task.title}>{task.title}</strong>
          </span>
          <Tag className={'status ' + task.status} tone={tone}>{label}</Tag>
          <i className="chevron" aria-hidden="true" />
        </summary>
        <div className="task-body">
          <div className="task-meta">
            <Timestamp at={task.at} />
            <Button className="text-button" size="sm" variant="text" data-trace={task.id}
              onClick={(event) => {
                if (event.currentTarget instanceof HTMLButtonElement) onOpen(task, event.currentTarget)
              }}>{copy.viewSession}</Button>
          </div>
          {childrenByParent.get(task.id)?.map(child =>
            <Task key={child.id} task={child} childrenByParent={childrenByParent} onOpen={onOpen} />)}
        </div>
      </details>
    </Card>
  )
}

type TraceState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; entries: TraceEntry[] }

function TraceDialog({ task, onClose }: { task: TaskCard; onClose: () => void }) {
  const [revision, setRevision] = useState(0)
  const [state, setState] = useState<TraceState>({ status: 'loading' })
  useEffect(() => {
    const controller = new AbortController()
    setState({ status: 'loading' })
    request<TraceEntry[]>('/trace?task=' + encodeURIComponent(task.id), { signal: controller.signal })
      .then(entries => {
        if (!controller.signal.aborted) setState({ status: 'ready', entries })
      })
      .catch(error => {
        if (!controller.signal.aborted) setState({ status: 'error', message: describe(error) })
      })
    return () => controller.abort()
  }, [task.id, revision])

  return (
    <Modal visible className="prism-trace-modal" closable={false} scroll={false} focusLock autoFocus
      escToExit onCancel={onClose}
      title={<div className="prism-trace-heading">
        <span className="eyebrow">{copy.session}</span><h2 id="trace-title">{task.title}</h2>
      </div>}
      footer={<>
        <Button id="trace-refresh" size="sm" disabled={state.status === 'loading'}
          onClick={() => setRevision(n => n + 1)}>{copy.refresh}</Button>
        <Button id="trace-close" size="sm" onClick={onClose}>{copy.close}</Button>
      </>}>
      <div id="trace-dialog" aria-labelledby="trace-title">
        <div id="trace-content" className="trace-content" aria-live="polite" aria-busy={state.status === 'loading'}>
          {state.status === 'loading' && <p className="notice">{copy.loading}</p>}
          {state.status === 'error' && <p className="notice">{state.message}</p>}
          {state.status === 'ready' && !state.entries.length && <p className="notice">{copy.noHistory}</p>}
          {state.status === 'ready' && state.entries.map((entry, i) =>
            <article className="trace-entry" key={i}>
              <div className="speaker"><strong>{roles[entry.role] ?? entry.role}</strong><Timestamp at={entry.at} /></div>
              <p>{entry.text}</p>
            </article>)}
        </div>
      </div>
    </Modal>
  )
}

export function Timeline({ view }: { view: ConversationView }) {
  const [selected, setSelected] = useState<TaskCard>()
  const opener = useRef<HTMLButtonElement | null>(null)
  const pinned = useRef(true)
  useEffect(() => {
    const track = () => {
      pinned.current = document.documentElement.scrollHeight - window.scrollY - window.innerHeight < 150
    }
    window.addEventListener('scroll', track, { passive: true })
    return () => window.removeEventListener('scroll', track)
  }, [])
  useLayoutEffect(() => {
    if (pinned.current && !opener.current) {
      const frame = requestAnimationFrame(() => window.scrollTo(0, document.documentElement.scrollHeight))
      return () => cancelAnimationFrame(frame)
    }
  }, [view.messages, view.tasks])

  const children = new Map<string, TaskCard[]>()
  const open: OpenTrace = (task, trigger) => {
    opener.current = trigger
    setSelected(task)
  }
  const rows = view.messages.map(item => ({
    at: item.at, node: <Message key={'message-' + item.id} item={item} />,
  }))
  for (const task of view.tasks) {
    if (task.parentId) {
      const group = children.get(task.parentId) ?? []
      group.push(task)
      children.set(task.parentId, group)
    } else {
      rows.push({ at: task.at, node: <Task key={'task-' + task.id} task={task} childrenByParent={children} onOpen={open} /> })
    }
  }
  rows.sort((a, b) => a.at.localeCompare(b.at))

  function closeTrace() {
    const trigger = opener.current
    opener.current = null
    setSelected(undefined)
    requestAnimationFrame(() => trigger?.focus({ preventScroll: true }))
  }
  return <>
    <div id="timeline" role="log" aria-label={copy.timeline} aria-relevant="additions text">
      {rows.map(row => row.node)}
    </div>
    {selected && <TraceDialog key={selected.id} task={selected} onClose={closeTrace} />}
  </>
}
