import { copy, locale } from './client-locale.js'
import { useEffect, useLayoutEffect, useRef } from 'react'
import { Card, Tag, type TagTone } from '@dsh-plugin/dsh-ui-components'
import Markdown from 'react-markdown'
import remarkBreaks from 'remark-breaks'
import remarkGfm from 'remark-gfm'
import type { TaskCard } from '@dsh-prism/dsh-orchestrator/contracts'
import type { ConversationView, PublicMessage } from './conversation.js'
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
        <strong>{assistant ? copy.brand : !item.source || item.source.channel === 'web'
          ? copy.you : [item.source.sender, item.source.channel].filter(Boolean).join(' · ')}</strong>
        <Timestamp at={item.at} />
      </span>
      {assistant ? <div className="prism-markdown">
        <Markdown skipHtml remarkPlugins={[remarkGfm, remarkBreaks]} components={markdownComponents}>{item.text}</Markdown>
      </div> : item.text && <p>{item.text}</p>}
      {item.attachments?.map(asset => {
        const src = '/prism/api/attachment?' + new URLSearchParams({id: asset.assetId})
        return asset.mimeType.startsWith('image/')
          ? <img key={asset.assetId} className="message-media" loading="lazy" src={src} alt={asset.name ?? copy.attachMedia} />
          : <video key={asset.assetId} className="message-media" preload="metadata" controls src={src} aria-label={asset.name ?? copy.attachMedia} />
      })}
      {!assistant && item.delivery === 'pending' && <span className="time">{copy.processing}</span>}
      {!assistant && item.delivery === 'failed' &&
        <span className="time">{missingReply(item) ? copy.noResponse : copy.processFailed}</span>}
    </article>
  )
}

function Task({ task }: { task: TaskCard }) {
  const { label, tone } = states[task.status]
  return (
    <Card variant="flat" bodyStyle={{ padding: 0 }} className="prism-task-surface">
      <div className="task" data-task={task.id}>
        <span className="task-glyph" aria-hidden="true" />
        <span className="task-name">
          <span className="task-meta">
            <small>{copy.task}</small>
            <Timestamp at={task.at} />
          </span>
          <strong title={task.title}>{task.title}</strong>
        </span>
        <Tag className={'status ' + task.status} tone={tone}>{label}</Tag>
      </div>
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

  const rows = view.messages.map(item => ({
    at: item.at, node: <Message key={'message-' + item.id} item={item} />,
  }))
  for (const task of view.tasks) {
    if (!task.parentId) {
      rows.push({ at: task.at, node: <Task key={'task-' + task.id} task={task} /> })
    }
  }
  rows.sort((a, b) => a.at.localeCompare(b.at))

  return (
    <div id="timeline" role="log" aria-label={copy.timeline} aria-relevant="additions text">
      {rows.map(row => row.node)}
    </div>
  )
}
