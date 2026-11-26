import { useEffect, useRef, useState } from 'react'
import { admin, AdminError, channels, editedFields, fields, publicFields, savedSecrets, type Channel, type ChannelView } from './im-admin.js'
import type { ImCopy } from './im-copy.js'
import { ImQr } from './ImQr.js'
import { ui } from './im-style.js'

function describe(error: unknown, copy: ImCopy): string {
  if (!(error instanceof AdminError)) return copy.error
  if (error.code === 'unavailable' || error.code === 'not_found') return copy.noGateway
  return copy[error.code]
}

function Pairing({ channel, copy }: {channel: Channel; copy: ImCopy}) {
  const [issued, setIssued] = useState<{code: string; expiresAt: number}>()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const pending = useRef<AbortController>()
  useEffect(() => () => pending.current?.abort(), [])
  useEffect(() => {
    if (!issued) return
    const timer = setTimeout(() => setIssued(undefined), Math.max(0, issued.expiresAt - Date.now()))
    return () => clearTimeout(timer)
  }, [issued])
  async function generate() {
    if (pending.current) return
    const controller = new AbortController()
    pending.current = controller
    setBusy(true); setError('')
    try {
      const result = await admin<{code: string; expiresAt: number}>({op: 'pair', channel}, controller.signal)
      if (!/^[A-F0-9]{20}$/i.test(result.code) || !Number.isFinite(result.expiresAt) || result.expiresAt <= Date.now()) throw new Error('Invalid pairing response')
      if (!controller.signal.aborted) setIssued(result)
    } catch (failure) {
      if (!controller.signal.aborted) setError(describe(failure, copy))
    } finally {
      pending.current = undefined
      if (!controller.signal.aborted) setBusy(false)
    }
  }
  return <section style={ui.panel}>
    <h4 style={{margin: 0}}>{copy.pair}</h4>
    <p style={{margin: 0}}>{copy.pairHelp}</p>
    {issued ? <>
      <code data-prism-qr="">{'/pair ' + issued.code}</code>
      <small>{copy.expires} {new Date(issued.expiresAt).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</small>
      <div><button type="button" style={ui.button} onClick={() => setIssued(undefined)}>{copy.hidePair}</button></div>
    </> : <div><button type="button" data-prism-pair-start="" style={ui.button} disabled={busy} onClick={() => void generate()}>{copy.issuePair}</button></div>}
    {error && <div role="alert">{error}</div>}
  </section>
}

export function ChannelForm({ view, copy, update, reload }: {
  view: ChannelView; copy: ImCopy; update(view: ChannelView): void; reload(): void
}) {
  const [values, setValues] = useState(() => publicFields(view))
  const [ids, setIds] = useState(() => (view.fields.allowedUserIds as string[] | undefined)?.join('\n') ?? '')
  const [passwords, setPasswords] = useState<Record<string,string>>({})
  const [clear, setClear] = useState<string[]>([])
  const [base, setBase] = useState(() => ({revision: view.revision, fields: publicFields(view)}))
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [failed, setFailed] = useState(false)
  const pending = useRef(false)
  const alive = useRef(true)
  useEffect(() => { alive.current = true; return () => { alive.current = false } }, [])
  const channel = view.channel
  const schema = fields[channel]

  const draft: Record<string,string | string[]> = {}
  for (const name of schema.public) {
    const raw = values[name]
    if (typeof raw === 'string' && raw.trim()) draft[name] = raw.trim()
  }
  draft.allowedUserIds = [...new Set(ids.split(/[\n,]/).map(id => id.trim()).filter(Boolean))]
  const secrets = savedSecrets(passwords, clear)
  const dirty = JSON.stringify(draft) !== JSON.stringify(base.fields) || Object.keys(secrets).length > 0
  useEffect(() => {
    if (dirty || view.revision === base.revision) return
    const refreshed = publicFields(view)
    setValues(refreshed)
    setIds((refreshed.allowedUserIds as string[]).join('\n'))
    setBase({revision: view.revision, fields: refreshed})
  }, [view, base.revision, dirty])
  function changed() { setMessage(''); setFailed(false) }

  async function save(enabled: boolean) {
    if (pending.current) return
    pending.current = true
    setSaving(true)
    changed()
    try {
      const next = await admin<ChannelView>({op:'save', channel, revision: dirty ? base.revision : view.revision,
        enabled, fields: dirty ? editedFields(channel, base.fields, draft) : publicFields(view), secrets})
      if (!alive.current) return
      if (next.channel !== channel) throw new Error('Mismatched channel')
      update(next)
      const config = publicFields(next)
      setValues(config); setIds((config.allowedUserIds as string[]).join('\n'))
      setBase({revision: next.revision, fields: config})
      setClear([]); setPasswords({}); setMessage(copy.saved)
    } catch (error) {
      if (alive.current) { setMessage(describe(error,copy)); setFailed(true) }
    } finally {
      if (alive.current) { pending.current = false; setSaving(false) }
    }
  }

  return <section style={ui.stack} data-prism-channel-panel={channel}>
    <div style={ui.panel}>
      <h3 style={{ margin: 0 }}>{copy.names[channel]}</h3>
      <p style={{ margin: 0 }}>{copy.info[channel]}</p>
      <div role="status">{copy.status} · <strong>{copy.state[view.status]}</strong></div>
      {(channel === 'onebot' || channel === 'qq') && <label style={ui.field}>{copy.callback}
        <input style={ui.input} readOnly value={new URL('/prism/im/' + channel, window.location.origin).href} />
      </label>}
      <form style={ui.stack} autoComplete="off" onSubmit={e => {e.preventDefault(); void save(view.enabled)}}>
        {schema.public.map(name => name === 'domain' ?
          <label key={name} style={ui.field}>{copy.field[name]}
            <select style={ui.input} value={String(values[name] ?? '')} onChange={e => {setValues({...values, [name]:e.target.value}); changed()}}>
              <option value="">{copy.automatic}</option><option value="feishu">{copy.names.feishu.split(' / ')[0]}</option><option value="lark">Lark</option>
            </select>
          </label> :
          <label key={name} style={ui.field}>{copy.field[name]}
            <input style={ui.input} name={name} value={String(values[name] || '')} spellCheck={false}
              type={name === 'apiBase' ? 'url' : 'text'} onChange={e => {setValues({...values, [name]:e.target.value}); changed()}} />
          </label>)}
        {schema.private.map(name => <div key={name} style={ui.field}>
          <label style={ui.field}>{copy.field[name]}
            <input style={ui.input} type="password" name={'prism-' + channel + '-' + name}
              autoComplete="new-password" spellCheck={false}
              value={passwords[name] ?? ''} placeholder={view.secrets[name] ? copy.keep : undefined}
              onChange={e => {setPasswords({...passwords, [name]:e.target.value});setClear(clear.filter(k => k !== name));changed()}} />
          </label>
          <small>{view.secrets[name] ? copy.credentialStored : copy.credentialEmpty}</small>
          {view.secrets[name] && <label style={ui.row}>
            <input type="checkbox" checked={clear.includes(name)} onChange={e => {
              setClear(e.target.checked ? [...clear,name] : clear.filter(k => k !== name))
              setPasswords({...passwords,[name]:''}); changed()
            }} />{copy.removeSecret} · {copy.field[name]}</label>}
        </div>)}
        <label style={ui.field}>{copy.permissions}
          <textarea style={ui.input} rows={2} value={ids} spellCheck={false} onChange={e => {setIds(e.target.value);changed()}} />
          <small>{copy.listHint}</small>
        </label>
        <div style={ui.row}>
          <button type="submit" style={ui.button} disabled={saving}>{saving ? copy.working : copy.save}</button>
          <button type="button" style={ui.button} disabled={saving || dirty}
            onClick={() => void save(!view.enabled)}>{view.enabled ? copy.disable : copy.enable}</button>
        </div>
        {dirty && <small>{copy.saveFirst}</small>}
        {message && <div role={failed ? 'alert' : 'status'}>{message}</div>}
      </form>
    </div>
    {(channel === 'wechat' || channel === 'feishu') && <ImQr channel={channel} copy={copy} registered={view.registered} onRegistered={reload} />}
    <Pairing channel={channel} copy={copy} />
  </section>
}

export function ImSettings({ copy }: {copy: ImCopy}) {
  const [channel, setChannel] = useState<Channel>('telegram')
  const [views, setViews] = useState<ChannelView[]>()
  const [readError, setReadError] = useState('')
  const [refresh, setRefresh] = useState(0)
  const [epoch, setEpoch] = useState(0)
  const discardOnRead = useRef(false)
  useEffect(() => {
    const controller = new AbortController()
    admin<{channels: ChannelView[]}>(undefined, controller.signal).then(response => {
      if (controller.signal.aborted) return
      if (!Array.isArray(response.channels)) throw new Error('Invalid channel list')
      setViews(current => response.channels.map(incoming => {
        const previous = current?.find(item => item.channel === incoming.channel)
        return previous && previous.revision > incoming.revision ? previous : incoming
      }))
      setReadError('')
      if (discardOnRead.current) {discardOnRead.current = false; setEpoch(x => x + 1)}
    }).catch(error => {
      if (!controller.signal.aborted) setReadError(describe(error,copy))
    })
    return () => controller.abort()
  }, [refresh,copy])
  const view = views?.find(item => item.channel === channel)
  useEffect(() => {
    if (!view?.enabled) return
    const timer = setTimeout(() => setRefresh(x => x + 1), 4000)
    return () => clearTimeout(timer)
  }, [channel, view?.enabled, refresh])
  const update = (next: ChannelView) => setViews(current => current?.map(v => v.channel === next.channel ? next : v))
  return <section style={{ ...ui.stack, maxWidth: 620, padding: '8px 0 20px' }}>
    <h2 style={{ margin: 0 }}>{copy.title}</h2>
    <label style={ui.field}>{copy.channel}
      <select style={ui.input} data-prism-channel="" value={channel} onChange={e => setChannel(e.target.value as Channel)}>
        {channels.map(id => <option key={id} value={id}>{copy.names[id]}</option>)}
      </select>
    </label>
    {readError && <p role="alert">{readError}</p>}
    {!views && !readError && <p role="status">{copy.loading}</p>}
    {views && !view && <p role="alert">{copy.noGateway}</p>}
    {view && <ChannelForm key={channel + epoch} view={view} copy={copy} update={update} reload={() => setRefresh(x => x+1)}/>}
    <div><button type="button" style={ui.button} onClick={() => {discardOnRead.current = true; setRefresh(x=>x+1)}}>{copy.load}</button></div>
  </section>
}
