import { copy } from './client-locale.js'
import { useEffect, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { Button, DshProvider } from '@dsh-plugin/dsh-ui-components'
import type { ConversationView } from './conversation.js'
import { Composer } from './Composer.js'
import { Timeline } from './Timeline.js'
import { api, describe, post, upload } from './client-api.js'
import { dshHome, prismOpenedKey } from './navigation.js'

type Connection = 'connecting' | 'online' | 'reconnecting'
type Operation = 'send' | 'select'

function PrismMark() {
  return <span className="prism" aria-hidden="true"><i /><i /><i /></span>
}

function Concierge() {
  const [view, setView] = useState<ConversationView>()
  const [connection, setConnection] = useState<Connection>('connecting')
  const [operation, setOperation] = useState<Operation>()
  const [error, setError] = useState('')
  const [needsProject, setNeedsProject] = useState(false)
  const revision = useRef(0)
  const writing = useRef(false)

  useEffect(() => {
    let events: EventSource | undefined
    let timer: ReturnType<typeof setTimeout> | undefined
    let rememberOpening = integrated

    const disconnect = () => {
      clearTimeout(timer)
      events?.close()
      events = undefined
    }

    const connect = () => {
      disconnect()
      const source = new EventSource(api + '/events')
      events = source
      source.onmessage = (event) => {
        if (source !== events) return
        const next = JSON.parse(event.data) as ConversationView
        revision.current++
        setView(next)
        setConnection('online')
        setNeedsProject(false)
        if (rememberOpening && next.models.length > 0) {
          rememberOpening = false
          try {
            localStorage.setItem(prismOpenedKey, '1')
          } catch (error) {
            console.debug('Prism could not remember this browser’s first visit', error)
          }
        }
      }
      source.addEventListener('no-project', () => {
        if (source === events) setNeedsProject(true)
      })
      source.onerror = () => {
        if (source !== events) return
        setConnection('reconnecting')
        // EventSource retries a broken stream itself, but stops after some HTTP errors.
        if (source.readyState === EventSource.CLOSED) {
          clearTimeout(timer)
          timer = setTimeout(connect, 3000)
        }
      }
    }
    const onShow = (event: PageTransitionEvent) => {
      if (event.persisted) {
        setConnection('reconnecting')
        connect()
      }
    }
    connect()
    window.addEventListener('pagehide', disconnect)
    window.addEventListener('pageshow', onShow)
    return () => {
      disconnect()
      window.removeEventListener('pagehide', disconnect)
      window.removeEventListener('pageshow', onShow)
    }
  }, [])

  async function submit(kind: Operation, body: object, files: readonly File[] = []): Promise<void> {
    if (writing.current || connection !== 'online') throw new Error(copy.later)
    writing.current = true
    setOperation(kind)
    setError('')
    const acceptedAt = revision.current
    try {
      if (files.length) {
        const attachments: string[] = []
        for (const file of files) {
          attachments.push((await upload(file)).assetId)
        }
        body = {...body, attachments}
      }
      const next = await post(kind === 'send' ? '/message' : '/model', body)
      // The stream can already contain later task transitions or a new model selection.
      if (revision.current === acceptedAt) setView(next)
      if (kind === 'send') requestAnimationFrame(() => window.scrollTo(0, document.documentElement.scrollHeight))
    } catch (cause) {
      setError(describe(cause))
      throw cause
    } finally {
      writing.current = false
      setOperation(undefined)
    }
  }

  const empty = !view?.messages.length && !view?.tasks.length
  const feedback = error || (needsProject ? copy.noProject : connection === 'connecting' ? copy.connecting
    : connection === 'reconnecting' ? copy.reconnecting
    : operation === 'send' ? copy.sending
    : operation === 'select' ? copy.switching : '')

  return (
    <DshProvider>
      <header className="topbar">
        <div className="brand"><PrismMark /><span>{copy.brand}</span>{copy.brand !== 'Prism' && <span className="brand-en" lang="en">Prism</span>}</div>
        {integrated && <Button variant="outline" size="sm"
          onClick={() => window.location.assign(dshHome)}>DeepSeek Harness</Button>}
      </header>
      <main id="main" className={empty ? 'empty' : undefined}>
        {empty ? (
          <section id="welcome" aria-labelledby="welcome-title">
            <div className="hero-symbol"><PrismMark /></div>
            <h1 id="welcome-title">{copy.welcome}</h1>
          </section>
        ) : (
          <section id="thread" aria-label={copy.chat}>
            {view && <Timeline view={view} />}
          </section>
        )}
        <Composer
          view={view}
          busy={connection !== 'online' || operation !== undefined}
          feedback={feedback}
          onEdit={() => setError('')}
          onSend={(text, requestId, files) => submit('send', {text, requestId}, files)}
          onSelect={(modelId) => modelId === view?.modelId ? Promise.resolve() : submit('select', { modelId })}
        />
      </main>
    </DshProvider>
  )
}

const root = document.getElementById('root')
if (!root) throw new Error('Missing #root mount point')
const integrated = root.dataset.integrated === 'true'
createRoot(root).render(<Concierge />)
