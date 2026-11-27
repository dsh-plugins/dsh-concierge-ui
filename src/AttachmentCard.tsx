import { useEffect, useState } from 'react'
import { Icon } from '@dsh-plugin/dsh-ui-components'
import { attachmentIssue, attachmentSize } from './attachments.js'
import { copy, locale } from './client-locale.js'

export type Attachment = { id: string; file: File } & (
  | { status: 'uploading' }
  | { status: 'ready'; assetId: string }
  | { status: 'failed'; error: string; retryable: boolean }
)

interface Props {
  attachment: Attachment
  sending: boolean
  canRetry: boolean
  onRetry(): void
  onRemove(): void
}

function FileThumbnail({ file }: { file: File }) {
  const [preview, setPreview] = useState<string>()
  const image = file.type.startsWith('image/') && !attachmentIssue(file)

  useEffect(() => {
    if (!image || typeof createImageBitmap !== 'function') return
    let active = true
    void createImageBitmap(file).then(bitmap => {
      try {
        if (!active) return
        const canvas = document.createElement('canvas')
        canvas.width = canvas.height = 96
        const context = canvas.getContext('2d')
        if (!context) return
        const side = Math.min(bitmap.width, bitmap.height)
        context.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, 96, 96)
        setPreview(canvas.toDataURL('image/png'))
      } finally {
        bitmap.close()
      }
    }).catch(() => {
      // A file that cannot be decoded keeps its fallback icon.
    })
    return () => { active = false }
  }, [file, image])

  return (
    <span className="prism-attachment-thumb" aria-hidden="true">
      {preview ? <img src={preview} alt="" draggable={false} /> :
        <Icon name={image ? 'Camera' : file.type.startsWith('video/') ? 'Play' : 'Doc'} size={19} />}
    </span>
  )
}

export function AttachmentCard({ attachment, sending, canRetry, onRetry, onRemove }: Props) {
  const { file, status } = attachment
  return (
    <li className="prism-attachment" data-status={status} aria-busy={status === 'uploading'}>
      <FileThumbnail file={file} />
      <span className="prism-attachment-details">
        <span className="prism-attachment-name" title={file.name}>{file.name}</span>
        <small className="prism-attachment-size">{attachmentSize(file.size, locale)}</small>
        {status === 'uploading' && <small className="prism-attachment-state" role="status">{copy.uploadingAttachment}</small>}
        {status === 'failed' && <small className="prism-attachment-state" role="status">{attachment.error}</small>}
      </span>
      <span className="prism-attachment-actions">
        {status === 'failed' && attachment.retryable && (
          <button type="button" disabled={!canRetry} aria-label={copy.retryAttachment + ' ' + file.name}
            title={copy.retryAttachment} onClick={onRetry}>
            <Icon name="Refresh" size={14} aria-hidden="true" />
          </button>
        )}
        <button type="button" disabled={sending} aria-label={copy.removeMedia + ' ' + file.name}
          title={copy.removeMedia} onClick={onRemove}>
          <Icon name="Close" size={14} aria-hidden="true" />
        </button>
      </span>
    </li>
  )
}
