import { copy } from './client-locale.js'
import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { Button, Icon, Popover, Textarea, type TextareaRef } from '@dsh-plugin/dsh-ui-components'
import type { ConversationView, MediaAsset } from './conversation.js'
import { AttachmentCard, type Attachment } from './AttachmentCard.js'
import { attachmentAccept, attachmentIssue, attachmentLimit } from './attachments.js'

export interface ComposerProps {
  view?: ConversationView
  busy: boolean
  sending: boolean
  feedback?: string
  onEdit?(): void
  onUpload(file: File, signal: AbortSignal): Promise<MediaAsset>
  onSend(text: string, requestId: string, attachmentIds: readonly string[]): Promise<void>
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

export function Composer({ view, busy, sending, feedback, onUpload, onSend, onSelect, onEdit }: ComposerProps) {
  const [draft, setDraft] = useState('')
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [pickerFeedback, setPickerFeedback] = useState('')
  const [open, setOpen] = useState(false)
  const trigger = useRef<HTMLButtonElement>(null)
  const menu = useRef<HTMLDivElement>(null)
  const input = useRef<TextareaRef>(null)
  const picker = useRef<HTMLInputElement>(null)
  const uploads = useRef(new Map<string, AbortController>())
  const pending = useRef<{value: string; id: string} | null>(null)
  const inFlight = useRef(false)
  const unavailable = !view?.models.length || busy
  const canUpload = view?.mediaEnabled === true && !busy
  const canSend = Boolean(view && !busy && (draft.trim() || attachments.length) &&
    (attachments.length === 0 || view.mediaEnabled && attachments.every(attachment => attachment.status === 'ready')))
  const selectedModel = view?.models.find(model => model.id === view.modelId)
  const selectedLabel = selectedModel ? modelLabel(selectedModel) : view?.modelId

  useEffect(() => {
    const pendingUploads = uploads.current
    return () => {
      for (const controller of pendingUploads.values()) {
        controller.abort()
      }
      pendingUploads.clear()
    }
  }, [])

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
    if (!canSend || inFlight.current) { return }
    const ids = attachments.flatMap(attachment => attachment.status === 'ready' ? [attachment.assetId] : [])
    const value = JSON.stringify([text, ids])
    if (pending.current?.value !== value) {
      pending.current = {value, id: requestId()}
    }
    inFlight.current = true
    try {
      await onSend(text, pending.current.id, ids)
      pending.current = null
      setDraft((current) => (current.trim() === text ? '' : current))
      setAttachments(current => current.filter(attachment => !attachments.includes(attachment)))
      setPickerFeedback('')
      input.current?.focus()
    } catch {
      /* Keep the draft and id for retries after an uncertain acknowledgement. */
    } finally {
      inFlight.current = false
    }
  }

  async function stage({ id, file }: Attachment) {
    const controller = new AbortController()
    uploads.current.set(id, controller)
    const update = (attachment: Attachment) => {
      if (uploads.current.get(id) === controller) {
        setAttachments(current => current.map(entry => entry.id === id ? attachment : entry))
      }
    }
    update({ id, file, status: 'uploading' })
    try {
      const asset = await onUpload(file, controller.signal)
      update({ id, file, status: 'ready', assetId: asset.assetId })
    } catch (error) {
      const message = error instanceof Error && !(error instanceof TypeError) ? error.message : copy.attachmentUploadFailed
      update({ id, file, status: 'failed', error: message, retryable: true })
    } finally {
      if (uploads.current.get(id) === controller) {
        uploads.current.delete(id)
      }
    }
  }

  function pick(files: readonly File[]) {
    if (!canUpload || inFlight.current || !files.length) return
    const space = attachmentLimit - attachments.length
    setPickerFeedback(files.length > space ? copy.tooManyAttachments : '')
    const issues = { format: copy.unsupportedAttachment, empty: copy.emptyAttachment, size: copy.largeAttachment }
    const next = files.slice(0, space).map((file): Attachment => {
      const issue = attachmentIssue(file)
      const id = requestId()
      return issue ? { id, file, status: 'failed', retryable: false, error: issues[issue] } : { id, file, status: 'uploading' }
    })
    setAttachments(current => [...current, ...next])
    for (const attachment of next) {
      if (attachment.status === 'uploading') void stage(attachment)
    }
    onEdit?.()
  }

  function remove(id: string) {
    const controller = uploads.current.get(id)
    uploads.current.delete(id)
    controller?.abort()
    setAttachments(current => current.filter(attachment => attachment.id !== id))
    setPickerFeedback('')
    onEdit?.()
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
          {attachments.length > 0 && (
            <ul className="prism-compose-files" aria-label={copy.attachments}>
              {attachments.map(attachment => (
                <AttachmentCard key={attachment.id} attachment={attachment} sending={sending} canRetry={canUpload}
                  onRetry={() => { if (!uploads.current.has(attachment.id)) void stage(attachment) }}
                  onRemove={() => remove(attachment.id)} />
              ))}
            </ul>
          )}
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
          <div className="composer-foot">
            {view?.mediaEnabled && (
              <>
                <input id="attachment-picker" ref={picker} type="file" hidden multiple accept={attachmentAccept}
                  disabled={!canUpload || attachments.length >= attachmentLimit} onChange={event => {
                    const selected = Array.from(event.currentTarget.files ?? [])
                    event.currentTarget.value = ''
                    pick(selected)
                  }} />
                <button type="button" className="prism-attach-button" aria-label={copy.attachMedia}
                  title={attachments.length >= attachmentLimit ? copy.tooManyAttachments : copy.attachMedia}
                  disabled={!canUpload || attachments.length >= attachmentLimit} onClick={() => picker.current?.click()} />
              </>
            )}
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
              disabled={!canSend}
            >
              <Icon name="Send" size={17} aria-hidden="true" />
            </button>
          </div>
        </form>
        <div id="feedback" role="status" aria-live="polite">
          {feedback || pickerFeedback}
        </div>
      </div>
    </section>
  )
}
