import { useId, type ReactNode } from 'react'
import type { FeishuBindingView, FeishuMode } from './im-admin.js'
import type { ImCopy } from './im-copy.js'
import { ImQr } from './ImQr.js'
import { ui } from './im-style.js'

/** 飞书凭据输入和扫码控制各占一个选项卡，扫码凭据只显示绑定状态。 */
export function FeishuBinding({ binding, copy, mode, onMode, onRegistered, manual, disabled }: {
  binding?: FeishuBindingView; copy: ImCopy; mode: FeishuMode; onMode(mode: FeishuMode): void
  onRegistered(): void; manual: ReactNode; disabled: boolean
}) {
  const id = useId()
  const modes: FeishuMode[] = ['manual', 'scan']
  const scan = binding?.mode === 'scan' ? binding : undefined

  return <section style={ui.stack}>
    {binding && <div>{copy.nickname} · <strong>{binding.nickname ?? copy.nicknameUnavailable}</strong></div>}
    <div style={ui.row} role="tablist" aria-label={copy.binding}>
      {modes.map(tab => <button key={tab} id={`${id}-${tab}`} type="button" role="tab"
        aria-selected={mode === tab} aria-controls={`${id}-${tab}-panel`} tabIndex={mode === tab ? 0 : -1}
        style={{...ui.button, ...(mode === tab && {fontWeight: 600, background: 'var(--dsw-alias-bg-secondary, rgba(127,127,127,.14))'})}}
        onClick={() => onMode(tab)} onKeyDown={event => {
          if (event.key === 'ArrowLeft' || event.key === 'ArrowRight' || event.key === 'Home' || event.key === 'End') {
            event.preventDefault()
            const next = event.key === 'Home' ? 'manual' : event.key === 'End' ? 'scan' : tab === 'manual' ? 'scan' : 'manual'
            onMode(next)
            document.getElementById(`${id}-${next}`)?.focus()
          }
        }}>{tab === 'manual' ? copy.manualBind : copy.scanBind}</button>)}
    </div>
    <div id={`${id}-manual-panel`} role="tabpanel" aria-labelledby={`${id}-manual`} hidden={mode !== 'manual'}>
      {mode === 'manual' && <div style={ui.stack}>{manual}</div>}
    </div>
    <div id={`${id}-scan-panel`} role="tabpanel" aria-labelledby={`${id}-scan`} hidden={mode !== 'scan'}>
      {mode === 'scan' && <div style={ui.stack}>
        {scan && <div style={ui.stack}>
          <label style={ui.field}>{copy.field.appId}<input style={ui.input} readOnly value={scan.appId} /></label>
          <div>{copy.field.appSecret} · <strong>{scan.secretStored ? copy.credentialStored : copy.credentialEmpty}</strong></div>
        </div>}
        <ImQr channel="feishu" copy={copy} registered={Boolean(scan?.secretStored)} onRegistered={onRegistered} disabled={disabled} />
      </div>}
    </div>
  </section>
}
