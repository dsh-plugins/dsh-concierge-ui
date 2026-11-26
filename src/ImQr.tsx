import { useEffect, useRef, useState } from 'react'
import QRCode from 'qrcode'
import { activeLogin, admin, AdminError, type LoginChannel, type LoginView } from './im-admin.js'
import type { ImCopy } from './im-copy.js'
import { ui } from './im-style.js'

export function officialLink(channel: LoginChannel, payload: string): string | undefined {
  const url = URL.parse(payload)
  if (!url || url.protocol !== 'https:' || url.username || url.password || url.port) return
  const allowed = channel === 'feishu'
    ? /(^|\.)(feishu\.cn|larksuite\.com|larkoffice\.com)$/
    : /(^|\.)(weixin\.qq\.com|wechat\.com)$/
  if (allowed.test(url.hostname)) return url.href
}

function CodeImage({ payload, channel, copy }: { payload: string; channel: LoginChannel; copy: ImCopy }) {
  const [src, setSrc] = useState('')
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    let mounted = true
    QRCode.toDataURL(payload, { width: 240, margin: 4, errorCorrectionLevel: 'M' }).then(
      value => { if (mounted) setSrc(value) },
      () => { if (mounted) setFailed(true) },
    )
    return () => { mounted = false }
  }, [payload])
  const link = officialLink(channel, payload)
  return <div data-prism-qr="" style={{ ...ui.stack, justifyItems: 'start' }}>
    {src && <img src={src} width={240} height={240} alt={copy.qrAlt} />}
    {failed && <span role="alert">{copy.qrError}</span>}
    {link && <a href={link} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer">{copy.official}</a>}
  </div>
}

export function ImQr({ channel, copy, registered, onRegistered }: {
  channel: LoginChannel; copy: ImCopy; registered: boolean; onRegistered(): void
}) {
  const [session, setSession] = useState<LoginView>()
  const [busy, setBusy] = useState<'' | 'start' | 'cancel' | 'code'>('')
  const [error, setError] = useState('')
  const [startFailed, setStartFailed] = useState(false)
  const [pin, setPin] = useState('')
  const [refresh, setRefresh] = useState(0)
  const latest = useRef<LoginView>()
  const generation = useRef(0)
  const updating = useRef(false)
  const registeredCallback = useRef(onRegistered)
  registeredCallback.current = onRegistered

  function update(next: LoginView) {
    if (next.channel !== channel) throw new Error('Mismatched channel')
    const before = latest.current
    latest.current = next
    setSession(next)
    if (next.status !== 'code') setPin('')
    if (next.status === 'complete' && before?.status !== 'complete') registeredCallback.current()
  }

  useEffect(() => () => {
    generation.current++
    const last = latest.current
    if (last && activeLogin(last.status)) {
      void admin({op: 'loginCancel', channel, loginId: last.loginId}).catch(() => {})
    }
  }, [channel])

  const status = session?.status
  const loginId = session?.loginId
  useEffect(() => {
    if (!loginId || !status || !activeLogin(status) || busy) return
    const controller = new AbortController()
    const stamp = generation.current
    let timer: ReturnType<typeof setTimeout>
    const poll = async () => {
      try {
        const next = await admin<LoginView>({op: 'loginStatus', channel, loginId}, controller.signal)
        if (controller.signal.aborted || stamp !== generation.current || next.loginId !== loginId) return
        update(next)
        setError('')
        if (activeLogin(next.status)) timer = setTimeout(() => { void poll() }, 1600)
      } catch (failure) {
        if (controller.signal.aborted || stamp !== generation.current) return
        if (failure instanceof AdminError && failure.code === 'not_found' && latest.current) {
          update({...latest.current, status: 'expired', url: undefined})
        } else setError(copy.statusError)
      }
    }
    timer = setTimeout(() => { void poll() }, 600)
    return () => { controller.abort(); clearTimeout(timer) }
  }, [channel, loginId, status, busy, refresh, copy])

  async function act(action: 'start' | 'cancel' | 'code') {
    if (updating.current || (action !== 'start' && !loginId)) return
    updating.current = true
    const stamp = ++generation.current
    setBusy(action)
    setError('')
    if (action === 'start') { setStartFailed(false); latest.current = undefined; setSession(undefined); setPin('') }
    try {
      const op = action === 'start' ? 'loginStart' : action === 'code' ? 'loginCode' : 'loginCancel'
      const next = await admin<LoginView>({op, channel, ...(action !== 'start' && {loginId}), ...(action === 'code' && {code: pin.trim()})})
      if (generation.current !== stamp) {
        if (action === 'start' && activeLogin(next.status)) {
          void admin({op:'loginCancel', channel, loginId:next.loginId}).catch(() => {})
        }
        return
      }
      if (action !== 'start' && next.loginId !== loginId) throw new Error('Mismatched sign-in session')
      update(next)
    } catch {
      if (generation.current === stamp) {
        if (action === 'start') setStartFailed(true)
        setError(copy.error)
      }
    } finally {
      if (generation.current === stamp) { updating.current = false; setBusy('') }
    }
  }

  const phase = busy === 'start' ? 'starting' : session?.status ?? (startFailed ? 'error' : 'idle')
  const pending = phase !== 'idle' && activeLogin(phase)
  const showCode = pending && Boolean(session?.url)
  return <section data-prism-login={channel} data-state={phase} style={ui.panel}>
    <h4 style={{ margin: 0 }}>{copy.login}</h4>
    <p style={{ margin: 0 }}>{copy.qrHelp}</p>
    {registered && <strong>{copy.savedLogin}</strong>}
    <div role="status">{copy.phase[phase]}</div>
    {showCode && <CodeImage key={session!.url} payload={session!.url!} channel={channel} copy={copy} />}
    {pending && session?.expiresAt && <span>{copy.expires} {new Date(session.expiresAt).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span>}
    {session?.status === 'code' && <form onSubmit={e => {e.preventDefault(); if (pin.trim()) void act('code')}} style={ui.row}>
      <label data-prism-qr="" style={ui.field}>{copy.code}
        <input type="password" inputMode="numeric" autoComplete="one-time-code" value={pin} style={ui.input} onChange={e => setPin(e.target.value)} />
      </label><button type="submit" style={ui.button} disabled={!!busy || !pin.trim()}>{copy.submit}</button>
    </form>}
    {error && <p role="alert">{error}</p>}
    <div style={ui.row}>
      {!pending && <button type="button" data-prism-qr-start="" style={ui.button} disabled={!!busy}
        onClick={() => void act('start')}>{phase === 'idle' ? copy.start : copy.retry}</button>}
      {pending && loginId && <button type="button" data-prism-qr-cancel="" style={ui.button} disabled={!!busy}
        onClick={() => void act('cancel')}>{copy.cancel}</button>}
      {pending && loginId && error && <button type="button" style={ui.button} disabled={!!busy}
        onClick={() => {setError(''); setRefresh(x => x + 1)}}>{copy.refresh}</button>}
    </div>
  </section>
}
