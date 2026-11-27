import { copy } from './client-locale.js'
import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { Button, Icon, Popover, Textarea, type TextareaRef } from '@dsh-plugin/dsh-ui-components'
import type { ConversationView } from './conversation.js'

export interface ComposerProps {
  view?: ConversationView
  busy: boolean
  feedback?: string
  onEdit?(): void
  onSend(text: string, requestId: string, files: readonly File[]): Promise<void>
  onSelect(id: string): Promise<void>
}

function requestId() {
  // getRandomValues also works on a non-TLS LAN origin.
  return Array.from(crypto.getRandomValues(new Uint8Array(16)), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('')
}

function modelLabel(model: ConversationView['models'][number]): string {
  return 'label' in model && typeof model.label === 'string' ? model.label : model.id
}

export function Composer({ view, busy, feedback, onSend, onSelect, onEdit }: ComposerProps) {
  const [draft, setDraft] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [open, setOpen] = useState(false)
  const trigger = useRef<HTMLButtonElement>(null)
  const menu = useRef<HTMLDivElement>(null)
  const input = useRef<TextareaRef>(null)
  const pending = useRef<{text: string; id: string; files: readonly File[]} | null>(null)
  const inFlight = useRef(false)
  const unavailable = !view?.models.length || busy
  const selectedModel = view?.models.find(model => model.id === view.modelId)
  const selectedLabel = selectedModel ? modelLabel(selectedModel) : view?.modelId

  useEffect(() => {
    if (unavailable) setOpen(false)
  }, [unavailable])
  useEffect(() => {
    if (!open) return
    const frame = requestAnimationFrame(() => {
      const selected = menu.current?.querySelector<HTMLElement>('[aria-selected="true"]')
      const initial = selected ?? menu.current?.querySelector<HTMLElement>('[role="option"]')
      initial?.focus({ preventScroll: true })
    })
    function onFocus(event: FocusEvent) {
      const target = event.target
      if (target instanceof Node && !trigger.current?.contains(target) && !menu.current?.contains(target))
        setOpen(false)
    }
    document.addEventListener('focusin', onFocus)
    return () => {
      cancelAnimationFrame(frame)
      document.removeEventListener('focusin', onFocus)
    }
  }, [open])

  function closeMenu() {
    setOpen(false)
    trigger.current?.focus({ preventScroll: true })
  }
  function navigate(event: KeyboardEvent<HTMLDivElement>) {
    const options = [...(menu.current?.querySelectorAll<HTMLButtonElement>('[role="option"]') ?? [])]
    if (event.key === 'Tab' || event.key === 'Escape') {
      if (event.key === 'Escape') event.preventDefault()
      closeMenu()
      return
    }
    const current = options.indexOf(document.activeElement as HTMLButtonElement)
    const last = options.length - 1
    let target: number
    switch (event.key) {
      case 'ArrowDown':
        target = current === last ? 0 : current + 1
        break
      case 'ArrowUp':
        target = current <= 0 ? last : current - 1
        break
      case 'Home':
        target = 0
        break
      case 'End':
        target = last
        break
      default:
        return
    }
    event.preventDefault()
    options[target]?.focus()
  }
  async function select(id: string) {
    closeMenu()
    if (unavailable || id === view?.modelId || inFlight.current) return
    inFlight.current = true
    try {
      await onSelect(id)
    } catch {
      /* Parent displays the operation error in feedback. */
    } finally {
      inFlight.current = false
      requestAnimationFrame(() => {
        if (document.activeElement === document.body) trigger.current?.focus({ preventScroll: true })
      })
    }
  }
  async function submit() {
    const text = draft.trim()
    if ((!text && !files.length) || !view || busy || inFlight.current) { return }
    if (pending.current?.text !== text || pending.current.files !== files) {
      pending.current = {text, id: requestId(), files}
    }
    inFlight.current = true
    try {
      await onSend(text, pending.current.id, files)
      pending.current = null
      setDraft((current) => (current.trim() === text ? '' : current))
      setFiles([])
      input.current?.focus()
    } catch {
      /* Keep the draft and id for retries after an uncertain acknowledgement. */
    } finally {
      inFlight.current = false
    }
  }

  const choices = (
    <div id="model-menu" ref={menu} onKeyDown={navigate}>
      <h2 id="model-heading">{copy.models}</h2>
      <div id="models" role="listbox" aria-labelledby="model-heading">
        {view?.models.map((model) => (
          <Button
            key={model.id}
            className="choice"
            variant="text"
            role="option"
            tabIndex={-1}
            aria-selected={model.id === view.modelId}
            onClick={() => {
              void select(model.id)
            }}
          >
            <span className="model-option">
              <strong>{modelLabel(model)}</strong>
              <small>{model.description}</small>
            </span>
            {model.id === view.modelId && <Icon name="Check" aria-hidden="true" size={15} />}
          </Button>
        ))}
      </div>
    </div>
  )

  return (
    <section className="dock" aria-label={copy.sendMessage}>
      <div className="dock-inner">
        <form
          id="composer"
          onSubmit={(event) => {
            event.preventDefault()
            void submit()
          }}
        >
          <label className="sr-only" htmlFor="draft">
            {copy.message}
          </label>
          <Textarea
            id="draft"
            ref={input}
            rows={2}
            maxLength={32000}
            placeholder={copy.placeholder}
            value={draft}
            onChange={(value: string) => {
              setDraft(value)
              onEdit?.()
            }}
            onKeyDown={(event) => {
              if (
                event.key !== 'Enter' ||
                event.shiftKey ||
                event.nativeEvent.isComposing ||
                event.nativeEvent.keyCode === 229
              )
                return
              event.preventDefault()
              void submit()
            }}
          />
          {view?.mediaEnabled && (
            <div className="attach-files">
              <label>
                <span>{copy.attachMedia}</span>
                <input type="file" multiple accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime"
                  disabled={busy} onChange={event => {
                    setFiles(current => [...current, ...Array.from(event.currentTarget.files ?? [])].slice(0, 8))
                    event.currentTarget.value = ''
                    onEdit?.()
                  }} />
              </label>
              {files.map((file, index) => <Button key={file.name + index} size="sm" variant="text" disabled={busy}
                title={copy.removeMedia} aria-label={copy.removeMedia + ' ' + file.name}
                onClick={() => setFiles(current => current.filter((_, position) => index !== position))}>
                {file.name} <span aria-hidden="true">×</span>
              </Button>)}
            </div>
          )}
          <div className="composer-foot">
            <span className="key-hint">
              <kbd>Enter</kbd> {copy.send} <span>·</span> <kbd>Shift + Enter</kbd> {copy.newline}
            </span>
            <div className="models">
              <Popover
                position="tr"
                trigger="click"
                className="prism-model-popup"
                content={choices}
                popupVisible={open && !unavailable}
                onVisibleChange={(visible) => setOpen(!unavailable && visible)}
                triggerProps={{ autoFitPosition: true, updateOnScroll: true, showArrow: false }}
              >
                <Button
                  id="model-toggle"
                  className="model-toggle"
                  ref={trigger}
                  variant="outline"
                  disabled={unavailable}
                  aria-haspopup="listbox"
                  aria-expanded={open}
                  aria-controls={open ? 'models' : undefined}
                  aria-label={copy.currentModel.replace('{model}', () => selectedLabel ?? copy.notLoaded)}
                  onKeyDown={(event) => {
                    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                      event.preventDefault()
                      setOpen(true)
                    }
                  }}
                >
                  <Icon name="Diamond" size={14} aria-hidden="true" />
                  <span id="model-name">{selectedLabel ?? copy.chooseModel}</span>
                  <Icon name={open ? 'ChevronDown' : 'ChevronUp'} size={13} aria-hidden="true" />
                </Button>
              </Popover>
            </div>
            <button
              id="send"
              aria-label={copy.sendMessage}
              title={copy.sendMessage}
              type="submit"
              disabled={!view || busy || (!draft.trim() && !files.length)}
            >
              <Icon name="Send" size={17} aria-hidden="true" />
            </button>
          </div>
        </form>
        <div id="feedback" role="status" aria-live="polite">
          {feedback}
        </div>
      </div>
    </section>
  )
}
