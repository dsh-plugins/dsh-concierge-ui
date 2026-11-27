import { copy, locale } from './client-locale.js'
import { useEffect, useLayoutEffect, useRef } from 'react'
import { Card, Tag, type TagTone } from '@dsh-plugin/dsh-ui-components'
import Markdown from 'react-markdown'
import remarkBreaks from 'remark-breaks'
import remarkGfm from 'remark-gfm'
import type { ConversationView, PublicMessage, TaskCard } from '@dsh-prism/dsh-orchestrator/contracts'
import { missingReply } from './delivery.js'

const states: Record<TaskCard['status'], { label: string; tone: TagTone }> = {
  queued: { label: copy.queued, tone: 'neutral' },
  running: { label: copy.running, tone: 'warning' },
  completed: { label: copy.completed, tone: 'success' },
  failed: { label: copy.failed, tone: 'danger' },
}
const clock = new Intl.DateTimeFormat(locale, {
  month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false,
})
const markdownComponents = {
  a: ({href, children}: React.ComponentProps<'a'>) => (
    <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>
  ),
  img: ({alt}: React.ComponentProps<'img'>) => alt || null,
}

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
      {assistant ? <div className="prism-markdown">
        <Markdown skipHtml remarkPlugins={[remarkGfm, remarkBreaks]} components={markdownComponents}>{item.text}</Markdown>
      </div> : <p>{item.text}</p>}
      {!assistant && item.delivery === 'pending' && <span className="time">{copy.processing}</span>}
      {!assistant && item.delivery === 'failed' &&
        <span className="time">{missingReply(item) ? copy.noResponse : copy.processFailed}</span>}
    </article>
  )
}

function Task({ task, childrenByParent }: {
  task: TaskCard
  childrenByParent: Map<string, TaskCard[]>
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
          <Timestamp at={task.at} />
          {childrenByParent.get(task.id)?.map(child =>
            <Task key={child.id} task={child} childrenByParent={childrenByParent} />)}
        </div>
      </details>
    </Card>
  )
}

export function Timeline({ view }: { view: ConversationView }) {
  const pinned = useRef(true)
  useEffect(() => {
    const track = () => {
      pinned.current = document.documentElement.scrollHeight - window.scrollY - window.innerHeight < 150
    }
    window.addEventListener('scroll', track, { passive: true })
    return () => window.removeEventListener('scroll', track)
  }, [])
  useLayoutEffect(() => {
    if (pinned.current) {
      const frame = requestAnimationFrame(() => window.scrollTo(0, document.documentElement.scrollHeight))
      return () => cancelAnimationFrame(frame)
    }
  }, [view.messages, view.tasks])

  const children = new Map<string, TaskCard[]>()
  const rows = view.messages.map(item => ({
    at: item.at, node: <Message key={'message-' + item.id} item={item} />,
  }))
  for (const task of view.tasks) {
    if (task.parentId) {
      const group = children.get(task.parentId) ?? []
      group.push(task)
      children.set(task.parentId, group)
    } else {
      rows.push({ at: task.at, node: <Task key={'task-' + task.id} task={task} childrenByParent={children} /> })
    }
  }
  rows.sort((a, b) => a.at.localeCompare(b.at))

  return (
    <div id="timeline" role="log" aria-label={copy.timeline} aria-relevant="additions text">
      {rows.map(row => row.node)}
    </div>
  )
}
