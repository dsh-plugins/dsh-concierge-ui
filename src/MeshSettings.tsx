import { useEffect, useRef, useState } from 'react'
import { Arco } from '@dsh-plugin/dsh-loader/client'
import { Field, MeshServerSettings, validServer, type ServerDraft } from './MeshServerSettings.js'
import { changeMesh, issueTurnCredentials, loadMesh, type MeshCommand, type MeshView, type TurnCredentials } from './mesh-admin.js'
import { meshCopy } from './mesh-copy.js'
import { ui } from './im-style.js'

type ClientDraft = {signalingUrl: string; iceText: string; turnUsername: string; turnPassword: string}

function connectionCode(): string {
  const bytes = globalThis.crypto.getRandomValues(new Uint8Array(16))
  const hex = Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('')
  return hex.match(/.{4}/gu)!.join('-')
}

function signalingAddress(value: string): boolean {
  try {
    const url = new URL(value)
    return !url.username && !url.password && !url.hash && !url.search &&
      (url.protocol === 'wss:' || url.protocol === 'ws:' && ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) && url.port === '8080')
  } catch {
    return false
  }
}

function applyServerConfig(config: ServerDraft): MeshCommand {
  const {enabled, host, signaling, ice} = config
  const {auth, ...iceFields} = ice
  const protectedValues = auth.mode === 'long-term'
    ? {username: auth.username?.trim() || undefined, password: auth.password || undefined}
    : {secret: auth.secret || undefined}
  return {op: 'applyServer', config: {enabled, host: host.trim(), signaling: {
    ...signaling, certFile: signaling.certFile?.trim() || undefined, keyFile: signaling.keyFile?.trim() || undefined,
  }, ice: {...iceFields, externalIp: ice.externalIp?.trim() || undefined, certFile: ice.certFile?.trim() || undefined,
    keyFile: ice.keyFile?.trim() || undefined,
    auth: {mode: auth.mode, realm: auth.realm.trim(), ...protectedValues}}}}
}

export function MeshSettings({language}: {language: string}) {
  const copy = meshCopy(language)
  const [view, setView] = useState<MeshView>()
  const [readFailed, setReadFailed] = useState(false)
  const [readAttempt, setReadAttempt] = useState(0)
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState('')
  const [clipboardStatus, setClipboardStatus] = useState('')
  const [code, setCode] = useState(connectionCode)
  const [waitingCode, setWaitingCode] = useState<string>()
  const [clientDraft, setClientDraft] = useState<ClientDraft>()
  const [serverDraft, setServerDraft] = useState<ServerDraft>()
  const [credentials, setCredentials] = useState<TurnCredentials>()
  const [confirmForget, setConfirmForget] = useState<string>()
  const activeAction = useRef<AbortController>()
  const requestRevision = useRef(0)
  const waiting = view?.pairing.status === 'waiting'

  useEffect(() => {
    const lifetime = new AbortController()
    let timer: ReturnType<typeof setTimeout>
    const poll = async () => {
      if (!activeAction.current) {
        const revision = requestRevision.current
        try {
          const current = await loadMesh(AbortSignal.any([lifetime.signal, AbortSignal.timeout(8000)]))
          if (!lifetime.signal.aborted && revision === requestRevision.current) {
            setView(current)
            setReadFailed(false)
          }
        } catch {
          if (!lifetime.signal.aborted && revision === requestRevision.current) {
            setReadFailed(true)
          }
        }
      }
      if (!lifetime.signal.aborted) {
        timer = setTimeout(() => {void poll()}, 1800)
      }
    }
    void poll()
    return () => {
      lifetime.abort()
      clearTimeout(timer)
    }
  }, [readAttempt])
  useEffect(() => () => activeAction.current?.abort(), [])
  useEffect(() => {
    if (!waiting && waitingCode !== undefined) {
      setWaitingCode(undefined)
      setCode(connectionCode())
      setClipboardStatus('')
    }
  }, [waiting, waitingCode])

  async function perform<T>(run: (signal: AbortSignal) => Promise<T>, accept: (next: T) => void) {
    if (activeAction.current) {
      return
    }
    const current = new AbortController()
    requestRevision.current += 1
    activeAction.current = current
    setBusy(true)
    setActionError('')
    try {
      const result = await run(AbortSignal.any([current.signal, AbortSignal.timeout(35000)]))
      if (!current.signal.aborted) {
        accept(result)
      }
    } catch (error) {
      if (!current.signal.aborted) {
        setActionError(error instanceof Error && error.message ? error.message : copy.updateFailed)
      }
    } finally {
      activeAction.current = undefined
      if (!current.signal.aborted) {
        setBusy(false)
      }
    }
  }

  function send(command: MeshCommand, finish?: (next: MeshView) => void) {
    void perform(signal => changeMesh(signal, command), next => {
      setView(next)
      setReadFailed(false)
      finish?.(next)
    })
  }

  async function copyValue(value: string) {
    try {
      await navigator.clipboard.writeText(value)
      setClipboardStatus(copy.copied)
    } catch {
      setClipboardStatus(copy.copyError)
    }
  }

  if (!view) {
    return <section style={ui.stack}>
      <h2 style={{margin: 0}}>{copy.title}</h2>
      {readFailed ? <><p role="alert">{copy.failed}</p><div><Arco.Button onClick={() => setReadAttempt(value => value + 1)}>{copy.reload}</Arco.Button></div></>
        : <p role="status">{copy.loading}</p>}
    </section>
  }

  const saved = view.client
  const client = clientDraft ?? {signalingUrl: saved?.signalingUrl ?? '', iceText: saved?.iceUrls.join('\n') ?? '',
    turnUsername: saved?.turnUsername ?? '', turnPassword: ''}
  const iceUrls = [...new Set(client.iceText.trim().split(/\s+|,/u).filter(Boolean))]
  const turnUrls = iceUrls.filter(url => /^turns?:/iu.test(url))
  const savedTurnUrls = (saved?.iceUrls ?? []).filter(url => /^turns?:/iu.test(url))
  const canKeepPassword = Boolean(saved?.hasTurnPassword) && client.turnUsername.trim() === saved?.turnUsername
    && turnUrls.length === savedTurnUrls.length && turnUrls.every(url => savedTurnUrls.includes(url))
  const paired = Boolean(saved) && view.nodes.some(node => node.managed)
  const displayedCode = waiting ? waitingCode ?? '' : code
  const server = serverDraft ?? view.server.config
  const currentServer = view.server.config
  const mayIssue = view.server.status === 'running' && currentServer.enabled && currentServer.ice.enabled
    && currentServer.ice.relay && currentServer.ice.auth.mode === 'shared-secret'

  function updateClient(patch: Partial<ClientDraft>) {
    setClientDraft({...client, ...patch})
  }

  function saveClient(pair: boolean) {
    const signalingUrl = paired && saved ? saved.signalingUrl : client.signalingUrl.trim()
    if (!signalingAddress(signalingUrl) || iceUrls.some(url => !/^(stun|turns?):[^\s]+$/u.test(url))
        || turnUrls.length > 0 && (!client.turnUsername.trim() || !client.turnPassword && !canKeepPassword)) {
      setActionError(copy.invalidClient)
      return
    }
    const normalizedCode = code.trim().replace(/[\s-]/gu, '').toLowerCase()
    if (pair && !/^[a-f0-9]{32}$/u.test(normalizedCode)) {
      setActionError(copy.invalidCode)
      return
    }
    const fields = {signalingUrl, iceUrls, ...(turnUrls.length > 0 && {
      turnUsername: client.turnUsername.trim(), turnPassword: client.turnPassword || undefined,
    })}
    send(pair ? {op: 'connect', code: normalizedCode, ...fields} : {op: 'saveClient', ...fields}, next => {
      setClientDraft({...client, signalingUrl, turnPassword: ''})
      if (pair && next.pairing.status === 'waiting') {
        setWaitingCode(code)
      }
    })
  }

  function apply() {
    const target = server.enabled ? {...server} : {...currentServer, enabled: false}
    if (!target.signaling.enabled) {
      target.signaling = {...currentServer.signaling, enabled: false}
    }
    if (!target.ice.enabled) {
      target.ice = {...currentServer.ice, enabled: false}
    } else if (!target.ice.relay) {
      target.ice = {...currentServer.ice, enabled: true, port: target.ice.port, relay: false}
    }
    if (!validServer(target)) {
      setActionError(copy.invalidServer)
      return
    }
    send(applyServerConfig(target), next => {
      if (next.server.status !== 'error') {
        setServerDraft(undefined)
        setCredentials(undefined)
      }
    })
  }

  return <section style={{...ui.stack, maxWidth: 620, padding: '8px 0 20px'}}>
    <h2 style={{margin: 0}}>{copy.title}</h2>
    <p style={{margin: 0, overflowWrap: 'anywhere'}}>{copy.localNode} <code>{view.nodeId}</code></p>
    {view.mode === 'static' ? <div style={ui.stack}>
      <p style={{margin: 0}}>{copy.static}</p>
      <Field label={copy.signal}><input style={ui.input} value={client.signalingUrl} readOnly /></Field>
      <Field label={copy.ice}><textarea style={ui.input} rows={2} value={client.iceText} readOnly /></Field>
    </div> : <form style={ui.stack} onSubmit={event => {
      event.preventDefault()
      if (!busy && !waiting) {
        saveClient(true)
      }
    }}>
      <Field label={copy.signal}>
        <input style={ui.input} value={paired && saved ? saved.signalingUrl : client.signalingUrl} placeholder="wss://mesh.example.org:8443"
          autoComplete="off" spellCheck={false} disabled={waiting || busy || paired}
          onChange={event => updateClient({signalingUrl: event.currentTarget.value})} />
      </Field>
      <Field label={copy.ice}>
        <textarea style={{...ui.input, resize: 'vertical'}} value={client.iceText} placeholder="stun:stun.example.org:3478"
          rows={2} spellCheck={false} disabled={waiting || busy} onChange={event => updateClient({iceText: event.currentTarget.value})} />
        <small>{copy.iceHelp}</small>
      </Field>
      {turnUrls.length > 0 && <details>
        <summary>{copy.turnClientAuth}</summary>
        <div style={{...ui.stack, paddingTop: 10}}>
          <Field label={copy.turnUsername}><input style={ui.input} value={client.turnUsername} autoComplete="off"
            disabled={waiting || busy} onChange={event => updateClient({turnUsername: event.currentTarget.value})} /></Field>
          <Field label={copy.turnPassword}><input style={ui.input} value={client.turnPassword} type="password" autoComplete="new-password"
            placeholder={canKeepPassword ? copy.savedSecret : undefined} disabled={waiting || busy}
            onChange={event => updateClient({turnPassword: event.currentTarget.value})} /></Field>
        </div>
      </details>}
      <Field label={copy.code}>
        <input style={ui.input} value={displayedCode} readOnly={busy || waiting} autoComplete="off" spellCheck={false}
          placeholder={waiting && waitingCode === undefined ? copy.codeFromOtherTab : undefined}
          onChange={event => {setCode(event.currentTarget.value); setClipboardStatus('')}} />
        <small>{copy.codeHelp}</small>
      </Field>
      <div style={ui.row}>
        <Arco.Button type="primary" htmlType="submit" disabled={busy || waiting}>{copy.connect}</Arco.Button>
        {paired && <Arco.Button disabled={busy || waiting} onClick={() => saveClient(false)}>{copy.saveConnection}</Arco.Button>}
        {waiting && <Arco.Button disabled={busy} onClick={() => send({op: 'cancel'})}>{copy.cancel}</Arco.Button>}
        <Arco.Button disabled={!displayedCode} onClick={() => void copyValue(displayedCode)}>{copy.copy}</Arco.Button>
        <Arco.Button disabled={busy || waiting} onClick={() => {setCode(connectionCode()); setClipboardStatus('')}}>{copy.renew}</Arco.Button>
      </div>
      {waiting && <p role="status" style={{margin: 0}}>{copy.waiting}</p>}
      {view.pairing.error && <p role="alert" style={{margin: 0}}>{view.pairing.error}</p>}
    </form>}
    {readFailed && <p role="alert" style={{margin: 0}}>{copy.failed}</p>}
    {actionError && <p role="alert" style={{margin: 0}}>{actionError}</p>}
    {clipboardStatus && <small role="status">{clipboardStatus}</small>}
    <div style={ui.panel}>
      <h3 style={{margin: 0}}>{copy.nodes}</h3>
      {view.nodes.length === 0 ? <p style={{margin: 0}}>{copy.none}</p> :
        <ul style={{...ui.stack, listStyle: 'none', margin: 0, padding: 0}}>
          {view.nodes.map(node => <li key={node.id} style={ui.stack}>
            <div style={ui.row}><code style={{overflowWrap: 'anywhere'}}>{node.id}</code><span>{copy[node.status]}</span>
              {node.managed && confirmForget !== node.id && <Arco.Button size="small" disabled={busy}
                onClick={() => setConfirmForget(node.id)}>{copy.forget}</Arco.Button>}
            </div>
            {confirmForget === node.id && <div style={ui.stack}>
              <p style={{margin: 0}}>{copy.forgetConfirm}</p>
              <div style={ui.row}>
                <Arco.Button status="danger" size="small" disabled={busy} onClick={() =>
                  send({op: 'forget', nodeId: node.id}, () => setConfirmForget(undefined))}>{copy.confirm}</Arco.Button>
                <Arco.Button size="small" disabled={busy} onClick={() => setConfirmForget(undefined)}>{copy.cancel}</Arco.Button>
              </div>
            </div>}
          </li>)}
        </ul>}
    </div>
    <MeshServerSettings copy={copy} language={language} config={server} update={setServerDraft} busy={busy}
      status={view.server.status} error={view.server.error} apply={apply} credentials={credentials} mayIssue={mayIssue}
      issue={() => void perform(issueTurnCredentials, setCredentials)} hide={() => setCredentials(undefined)}
      copyValue={value => void copyValue(value)} />
  </section>
}
