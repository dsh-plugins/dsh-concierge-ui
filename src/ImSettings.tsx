import { useEffect, useRef, useState } from 'react'
import { DshMenu, Icon } from '@dsh-plugin/dsh-loader/client'
import { admin, AdminError, editedFields, fields, publicFields, savedSecrets, type Channel, type ChannelView, type FeishuMode } from './im-admin.js'
import type { ImCopy } from './im-copy.js'
import { FeishuBinding } from './FeishuBinding.js'
import { ImApprovals } from './ImApprovals.js'
import { ImQr } from './ImQr.js'
import { ui } from './im-style.js'

function describe(error: unknown, copy: ImCopy): string {
  if (!(error instanceof AdminError)) return copy.error
  if (error.code === 'unavailable' || error.code === 'not_found') return copy.noGateway
  return copy[error.code]
}

async function readChannels(signal?: AbortSignal): Promise<ChannelView[]> {
  const response = await admin<{channels: ChannelView[]}>(undefined, signal)
  if (!Array.isArray(response.channels)) {
    throw new Error('Invalid channel list')
  }
  return response.channels
}

function configured(view: ChannelView): boolean {
  return view.revision > 0 || view.enabled || view.registered || Object.values(view.secrets).some(Boolean)
}

function accountName(view: ChannelView): string | undefined {
  if (view.channel === 'feishu') {
    return view.feishu?.nickname
  }
  const id = view.fields.botId || view.fields.appId || view.fields.selfId
  return view.username || (typeof id === 'string' && id ? id : view.accountId)
}

function ChannelForm({ view, copy, update, reload, cancel }: {
  view: ChannelView; copy: ImCopy; update(view: ChannelView, collapse?: boolean): void; reload(): void; cancel(): void
}) {
  const [values, setValues] = useState(() => publicFields(view))
  const [username, setUsername] = useState(view.username ?? '')
  const [feishuMode, setFeishuMode] = useState<FeishuMode>(() => view.feishu?.mode ?? 'scan')
  const [passwords, setPasswords] = useState<Record<string,string>>({})
  const [clear, setClear] = useState<string[]>([])
  const [base, setBase] = useState(() => ({revision: view.revision, fields: publicFields(view), username: view.username ?? ''}))
  const [saving, setSaving] = useState(false)
  const [refreshingRegistration, setRefreshingRegistration] = useState(false)
  const [message, setMessage] = useState('')
  const [failed, setFailed] = useState(false)
  const pending = useRef(false)
  const alive = useRef(true)
  useEffect(() => { alive.current = true; return () => { alive.current = false } }, [])
  const channel = view.channel
  const schema = fields[channel]
  const busy = saving || refreshingRegistration
  const scanningFeishu = channel === 'feishu' && feishuMode === 'scan'

  const draft: Record<string, string> = {}
  for (const name of schema.public) {
    const raw = (scanningFeishu ? base.fields : values)[name]
    if (typeof raw === 'string' && raw.trim()) {
      draft[name] = raw.trim()
    }
  }
  const secrets = scanningFeishu ? {} : savedSecrets(passwords, clear)
  const nameChanged = channel !== 'feishu' && username.trim() !== base.username
  const dirty = nameChanged || JSON.stringify(draft) !== JSON.stringify(base.fields) || Object.keys(secrets).length > 0
  useEffect(() => {
    if (dirty || busy || view.revision === base.revision) {
      return
    }
    const refreshed = publicFields(view)
    setValues(refreshed)
    setUsername(view.username ?? '')
    setBase({revision: view.revision, fields: refreshed, username: view.username ?? ''})
  }, [view, base.revision, busy, dirty])
  function changed() { setMessage(''); setFailed(false) }

  async function save(enabled: boolean, collapse: boolean) {
    if (pending.current || refreshingRegistration) {
      return
    }
    if (collapse && channel !== 'feishu' && !configured(view) && !username.trim()) {
      setMessage(copy.invalid)
      setFailed(true)
      return
    }
    if (collapse && scanningFeishu && view.feishu?.mode !== 'scan') {
      setMessage(copy.scanRequired)
      setFailed(true)
      return
    }
    pending.current = true
    setSaving(true)
    changed()
    try {
      const next = await admin<ChannelView>({op:'save', channel, revision: dirty ? base.revision : view.revision,
        enabled, fields: dirty ? editedFields(channel, base.fields, draft) : publicFields(view), secrets,
        ...(collapse && channel === 'feishu' && !scanningFeishu && {feishuMode: 'manual'}),
        ...(nameChanged && {username: username.trim()})})
      if (!alive.current) {
        return
      }
      if (next.channel !== channel || nameChanged && (next.username ?? '') !== username.trim()) {
        throw new Error('Unexpected channel settings response')
      }
      update(next, collapse)
      if (collapse) {
        return
      }
      const config = publicFields(next)
      setValues(config)
      setUsername(next.username ?? '')
      setBase({revision: next.revision, fields: config, username: next.username ?? ''})
      setClear([]); setPasswords({}); setMessage(copy.saved)
    } catch (error) {
      if (alive.current) { setMessage(describe(error,copy)); setFailed(true) }
    } finally {
      if (alive.current) { pending.current = false; setSaving(false) }
    }
  }

  async function syncRegistration() {
    setRefreshingRegistration(true)
    try {
      const next = (await readChannels()).find(item => item.channel === channel)
      if (!alive.current) {
        return
      }
      if (!next?.registered) {
        throw new Error('Missing channel registration')
      }
      const refreshed = publicFields(next)
      const latestUsername = next.username ?? ''
      update(next)
      if (nameChanged && latestUsername !== base.username && latestUsername !== username.trim()) {
        setMessage(copy.conflict)
        setFailed(true)
        return
      }
      setValues(refreshed)
      setClear([])
      setPasswords({})
      if (!nameChanged) {
        setUsername(latestUsername)
      }
      setBase({revision: next.revision, fields: refreshed, username: latestUsername})
    } catch (error) {
      if (alive.current) {
        setMessage(describe(error, copy))
        setFailed(true)
      }
    } finally {
      if (alive.current) {
        setRefreshingRegistration(false)
      }
    }
  }

  const credentials = <>
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
      {view.secrets[name] && channel !== 'feishu' && <label style={ui.row}>
        <input type="checkbox" checked={clear.includes(name)} onChange={e => {
          setClear(e.target.checked ? [...clear,name] : clear.filter(k => k !== name))
          setPasswords({...passwords,[name]:''}); changed()
        }} />{copy.removeSecret} · {copy.field[name]}</label>}
    </div>)}
  </>

  return <section style={ui.stack} data-prism-channel-panel={channel}>
    <div style={ui.panel}>
      <h3 style={{ margin: 0 }}>{copy.names[channel]}</h3>
      <p style={{ margin: 0 }}>{copy.info[channel]}</p>
      <div role="status">{copy.status} · <strong>{copy.state[view.status]}</strong></div>
      {(channel === 'onebot' || channel === 'qq') && <label style={ui.field}>{copy.callback}
        <input style={ui.input} readOnly value={new URL('/prism/im/' + channel, window.location.origin).href} />
      </label>}
      <form style={ui.stack} autoComplete="off" onSubmit={e => {e.preventDefault(); void save(view.enabled, true)}}>
        <fieldset style={ui.formFields} disabled={busy}>
          {channel !== 'feishu' && <label style={ui.field}>{copy.username}
            <input style={ui.input} name="username" value={username} maxLength={256} required={!configured(view)}
              placeholder={accountName(view)} spellCheck={false} onChange={e => {setUsername(e.target.value); changed()}} />
          </label>}
          {channel === 'feishu' ? <FeishuBinding binding={view.feishu} copy={copy} mode={feishuMode} disabled={busy}
            manual={credentials} onMode={mode => {setFeishuMode(mode); changed()}} onRegistered={() => void syncRegistration()} /> : credentials}
          <div style={ui.row}>
            <button type="submit" style={ui.button}>{saving ? copy.working : copy.save}</button>
            <button type="button" style={ui.button} disabled={dirty || !configured(view)}
              onClick={() => void save(!view.enabled, false)}>{view.enabled ? copy.disable : copy.enable}</button>
            <button type="button" style={ui.button} onClick={cancel}>{copy.cancelEdit}</button>
            {failed && <button type="button" style={ui.button} onClick={reload}>{copy.load}</button>}
          </div>
          {dirty && <small>{copy.saveFirst}</small>}
        </fieldset>
        {message && <div role={failed ? 'alert' : 'status'}>{message}</div>}
      </form>
    </div>
    {channel === 'wechat' && <ImQr channel={channel} copy={copy} registered={view.registered} onRegistered={() => void syncRegistration()} />}
  </section>
}

export function ImSettings({ copy }: {copy: ImCopy}) {
  const [editing, setEditing] = useState<Channel>()
  const [addMenu, setAddMenu] = useState<'top' | 'bottom'>()
  const [views, setViews] = useState<ChannelView[]>()
  const [readError, setReadError] = useState('')
  const [refresh, setRefresh] = useState(0)
  const [epoch, setEpoch] = useState(0)
  const discardOnRead = useRef(false)
  useEffect(() => {
    const controller = new AbortController()
    readChannels(controller.signal).then(incomingViews => {
      if (controller.signal.aborted) {
        return
      }
      setViews(current => incomingViews.map(incoming => {
        const previous = current?.find(item => item.channel === incoming.channel)
        return previous && previous.revision > incoming.revision ? previous : incoming
      }))
      setReadError('')
      if (discardOnRead.current) {
        discardOnRead.current = false
        setEpoch(x => x + 1)
      }
    }).catch(error => {
      if (!controller.signal.aborted) {
        discardOnRead.current = false
        setReadError(describe(error,copy))
      }
    })
    return () => controller.abort()
  }, [refresh,copy])
  const view = views?.find(item => item.channel === editing)
  useEffect(() => {
    if (!view?.enabled) {
      return
    }
    const timer = setTimeout(() => setRefresh(x => x + 1), 4000)
    return () => clearTimeout(timer)
  }, [editing, view?.enabled, refresh])
  function update(next: ChannelView, collapse = false) {
    setViews(current => current?.map(v => v.channel === next.channel && v.revision <= next.revision ? next : v))
    if (collapse) {
      setEditing(current => current === next.channel ? undefined : current)
    }
  }
  function reload() {
    discardOnRead.current = true
    setRefresh(x => x + 1)
  }
  const saved = views?.filter(configured) ?? []
  const pausedFeishu = saved.some(card => card.channel === 'feishu' && card.feishu?.secretStored && !card.enabled)
  const available = views?.filter(item => !configured(item)) ?? []
  const cards = view && !configured(view) ? [...saved, view] : saved
  return <section style={{ ...ui.stack, maxWidth: 620, padding: '8px 0 20px' }}>
    <h2 style={{ margin: 0 }}>{copy.title}</h2>
    {!!available.length && <div>
      <DshMenu portal maxRows={7} open={addMenu !== undefined && !view} side={addMenu}
        items={available.map(({ channel }) => ({id: channel, label: copy.names[channel]}))}
        onClose={() => setAddMenu(undefined)} onSelect={id => {
          setAddMenu(undefined)
          const choice = available.find(({ channel }) => channel === id)
          if (choice && !view) {
            setEditing(choice.channel)
          }
        }}
        anchor={<button type="button" style={{...ui.menuButton, cursor: view ? 'not-allowed' : 'pointer', opacity: view ? 0.55 : 1}}
          disabled={Boolean(view)} aria-haspopup="menu"
          aria-expanded={addMenu !== undefined && !view} onClick={event => {
            const rect = event.currentTarget.getBoundingClientRect()
            const below = window.innerHeight - rect.bottom
            setAddMenu(addMenu === undefined ? below < Math.min(260, rect.top) ? 'top' : 'bottom' : undefined)
          }}>
          {copy.add}<Icon name="ChevronDown" size={14} />
        </button>} />
    </div>}
    {readError && <p role="alert">{readError}</p>}
    {!views && !readError && <p role="status">{copy.loading}</p>}
    {views && cards.length === 0 && <p>{copy.empty}</p>}
    {cards.map(card => card.channel === editing ?
      <ChannelForm key={card.channel + epoch} view={card} copy={copy} update={update} reload={reload} cancel={() => setEditing(undefined)} /> :
      <button key={card.channel} type="button" style={{...ui.button, ...ui.summary}} data-prism-channel-card={card.channel}
        disabled={Boolean(view)} onClick={() => setEditing(card.channel)}>
        <strong>{copy.names[card.channel]}</strong><span style={ui.accountName}>
          {accountName(card) ?? (card.channel === 'feishu' ? copy.nicknameUnavailable : copy.unnamed)}</span>
      </button>)}
    {pausedFeishu && !view && <p role="status" style={{margin: 0}}>{copy.feishuDisabled}</p>}
    {!view && <div><button type="button" style={ui.button} onClick={reload}>{copy.load}</button></div>}
    <ImApprovals copy={copy} />
  </section>
}
