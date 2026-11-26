import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { Button, Icon, IconButton, Popover, Textarea, type TextareaRef } from '@dsh-plugin/dsh-ui-components'
import type { ConversationView } from '@dsh-prism/dsh-orchestrator/contracts'

export interface ComposerProps {
  view?: ConversationView
  busy: boolean
  feedback?: string
  onEdit?(): void
  onSend(text: string, requestId: string): Promise<void>
  onSelect(id: string): Promise<void>
}

function requestId() {
  // getRandomValues also works on a non-TLS LAN origin.
  return Array.from(crypto.getRandomValues(new Uint8Array(16)), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('')
}

export function Composer({ view, busy, feedback, onSend, onSelect, onEdit }: ComposerProps) {
  const [draft, setDraft] = useState('')
  const [open, setOpen] = useState(false)
  const trigger = useRef<HTMLButtonElement>(null)
  const menu = useRef<HTMLDivElement>(null)
  const input = useRef<TextareaRef>(null)
  const pending = useRef<{ text: string; id: string } | null>(null)
  const inFlight = useRef(false)
  const unavailable = !view?.models.length || busy

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
    if (!text || !view || busy || inFlight.current) return
    if (pending.current?.text !== text) pending.current = { text, id: requestId() }
    inFlight.current = true
    try {
      await onSend(text, pending.current.id)
      pending.current = null
      setDraft((current) => (current.trim() === text ? '' : current))
      input.current?.focus()
    } catch {
      /* Keep the draft and id for retries after an uncertain acknowledgement. */
    } finally {
      inFlight.current = false
    }
  }

  const choices = (
    <div id="model-menu" ref={menu} onKeyDown={navigate}>
      <h2 id="model-heading">对话模型</h2>
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
              <strong>{model.id}</strong>
              <small>{model.description}</small>
            </span>
            {model.id === view.modelId && <Icon name="Check" aria-hidden="true" size={15} />}
          </Button>
        ))}
      </div>
    </div>
  )

  return (
    <section className="dock" aria-label="发送消息">
      <div className="dock-inner">
        <form
          id="composer"
          onSubmit={(event) => {
            event.preventDefault()
            void submit()
          }}
        >
          <label className="sr-only" htmlFor="draft">
            消息
          </label>
          <Textarea
            id="draft"
            ref={input}
            rows={2}
            maxLength={32000}
            placeholder="给棱镜发消息…"
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
          <div className="composer-foot">
            <span className="key-hint">
              <kbd>Enter</kbd> 发送 <span>·</span> <kbd>Shift + Enter</kbd> 换行
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
                  aria-label={`切换对话模型，当前模型 ${view?.modelId ?? '尚未加载'}`}
                  onKeyDown={(event) => {
                    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                      event.preventDefault()
                      setOpen(true)
                    }
                  }}
                >
                  <Icon name="Diamond" size={14} aria-hidden="true" />
                  <span id="model-name">{view?.modelId ?? '选择模型'}</span>
                  <Icon name={open ? 'ChevronDown' : 'ChevronUp'} size={13} aria-hidden="true" />
                </Button>
              </Popover>
            </div>
            <IconButton
              id="send"
              label="发送消息"
              htmlType="submit"
              variant="primary"
              shape="circle"
              icon={<Icon name="Send" size={17} aria-hidden="true" />}
              disabled={!view || busy || !draft.trim()}
            />
          </div>
        </form>
        <div id="feedback" role="status" aria-live="polite">
          {feedback}
        </div>
      </div>
    </section>
  )
}
