import type { ReactNode } from 'react'
import { Arco } from '@dsh-plugin/dsh-loader/client'
import { ui } from './im-style.js'
import type { MeshServerConfig, TurnCredentials } from './mesh-admin.js'
import type { meshCopy } from './mesh-copy.js'

type Copy = ReturnType<typeof meshCopy>
type AuthDraft = MeshServerConfig['ice']['auth'] & {password?: string; secret?: string}
type IceDraft = Omit<MeshServerConfig['ice'], 'auth'> & {auth: AuthDraft}

/** 编辑期间保存尚未提交的凭据。 */
export type ServerDraft = Omit<MeshServerConfig, 'ice'> & {ice: IceDraft}

function validPort(value: number): boolean {
  return Number.isInteger(value) && value >= 1 && value <= 65535
}

export function validServer(config: ServerDraft): boolean {
  if (!config.enabled) {
    return true
  }
  const {signaling, ice} = config
  if (!config.host.trim()) {
    return false
  }
  if (signaling.enabled && (!validPort(signaling.port) ||
      !signaling.localTest && (!signaling.certFile?.trim() || !signaling.keyFile?.trim()))) {
    return false
  }
  if (!ice.enabled) {
    return true
  }
  if (!validPort(ice.port)) {
    return false
  }
  if (!ice.relay) {
    return true
  }
  const {auth, tlsPort} = ice
  return validPort(ice.minPort) && validPort(ice.maxPort) && ice.minPort <= ice.maxPort
    && (!ice.behindNat || Boolean(ice.externalIp?.trim()))
    && (tlsPort === undefined || (validPort(tlsPort) && Boolean(ice.certFile?.trim() && ice.keyFile?.trim())))
    && Boolean(auth.realm.trim())
    && (auth.mode === 'long-term' ? Boolean(auth.username?.trim() && (auth.password || auth.hasPassword))
      : Boolean(auth.secret || auth.hasSecret))
}

export function Field({ label, children }: {label: string; children: ReactNode}) {
  return <label style={ui.field}><span>{label}</span>{children}</label>
}

function TextField({label, value, update, password, placeholder}: {
  label: string; value?: string; update(value: string): void; password?: boolean; placeholder?: string
}) {
  return <Field label={label}>
    <input style={ui.input} value={value ?? ''} onChange={event => update(event.currentTarget.value)}
      type={password ? 'password' : 'text'} autoComplete={password ? 'new-password' : 'off'} placeholder={placeholder} />
  </Field>
}

function PortField({label, value, update, disabled}: {label: string; value: number; update(value: number): void; disabled?: boolean}) {
  return <Field label={label}>
    <input type="number" min={1} max={65535} step={1} disabled={disabled} style={ui.input}
      value={Number.isFinite(value) ? value : ''} onChange={event => update(event.currentTarget.valueAsNumber)} />
  </Field>
}

function SwitchField({label, checked, change, disabled}: {label: string; checked: boolean; change(checked: boolean): void; disabled: boolean}) {
  return <div style={ui.row}><Arco.Switch aria-label={label} checked={checked} onChange={change} disabled={disabled} /><span>{label}</span></div>
}

export function MeshServerSettings({ copy, language, config, update, busy, status, error, apply,
  credentials, mayIssue, issue, hide, copyValue }: {
  copy: Copy; language: string; config: ServerDraft; update(next: ServerDraft): void; busy: boolean
  status: 'stopped' | 'starting' | 'running' | 'error'; error?: string; apply(): void
  credentials?: TurnCredentials; mayIssue: boolean; issue(): void; hide(): void; copyValue(value: string): void
}) {
  const {signaling, ice} = config
  const {auth} = ice
  const changeSignal = (patch: Partial<ServerDraft['signaling']>) => update({...config, signaling: {...signaling, ...patch}})
  const changeIce = (patch: Partial<IceDraft>) => update({...config, ice: {...ice, ...patch}})
  const changeAuth = (patch: Partial<AuthDraft>) => changeIce({auth: {...auth, ...patch}})
  const dates = typeof credentials?.expiresAt === 'number' && credentials.expiresAt < 1e12
    ? credentials.expiresAt * 1000 : credentials?.expiresAt
  const expiry = dates === undefined ? undefined : new Date(dates)
  const statusLabel = status === 'error' ? copy.serviceError : copy[status]
  return <form aria-label={copy.serve} onSubmit={event => {event.preventDefault(); apply()}} style={ui.stack}>
    <fieldset style={ui.formFields} disabled={busy}>
      <label style={ui.row}>
        <input type="checkbox" checked={config.enabled} onChange={event => update({...config, enabled: event.currentTarget.checked})} />
        {copy.serve}
      </label>
      {config.enabled && <>
        <TextField label={copy.host} value={config.host} update={host => update({...config, host})} placeholder="0.0.0.0" />
        <div style={ui.panel}>
          <SwitchField label={copy.signalEnabled} checked={signaling.enabled} disabled={busy} change={enabled => changeSignal({enabled})} />
          {signaling.enabled && <>
            <label style={ui.row}>
              <input type="checkbox" checked={signaling.localTest} onChange={event => {
                const localTest = event.currentTarget.checked
                changeSignal({localTest, port: localTest ? 8080 : 8443})
              }} />
              {copy.localTest}
            </label>
            <PortField label={copy.signalPort} value={signaling.port} disabled={signaling.localTest} update={port => changeSignal({port})} />
            <small>{copy.signalHelp}</small>
            {!signaling.localTest && <>
              <TextField label={copy.certificate} value={signaling.certFile} update={certFile => changeSignal({certFile})} />
              <TextField label={copy.privateKey} value={signaling.keyFile} update={keyFile => changeSignal({keyFile})} />
            </>}
          </>}
        </div>
        <div style={ui.panel}>
          <SwitchField label={copy.iceEnabled} checked={ice.enabled} disabled={busy} change={enabled => changeIce({enabled})} />
          {ice.enabled && <>
            <PortField label={copy.icePort} value={ice.port} update={port => changeIce({port})} />
            <SwitchField label={copy.relay} checked={ice.relay} disabled={busy} change={relay => changeIce({relay})} />
            {ice.relay && <>
              <fieldset style={ui.formFields}>
                <legend>{copy.range}</legend>
                <div style={{...ui.row, marginTop: 6}}>
                  <PortField label={copy.minPort} value={ice.minPort} update={minPort => changeIce({minPort})} />
                  <PortField label={copy.maxPort} value={ice.maxPort} update={maxPort => changeIce({maxPort})} />
                </div>
              </fieldset>
              <label style={ui.row}>
                <input type="checkbox" checked={ice.behindNat} onChange={event => changeIce({behindNat: event.currentTarget.checked})} />
                {copy.behindNat}
              </label>
              <TextField label={copy.externalIp} value={ice.externalIp} update={externalIp => changeIce({externalIp})} placeholder="203.0.113.10" />
              <small>{copy.natHelp}</small>
              <details>
                <summary>{copy.auth}</summary>
                <div style={{...ui.stack, paddingTop: 10}}>
                  <div style={ui.field}>
                    <span>{copy.mode}</span>
                    <Arco.Radio.Group aria-label={copy.mode} type="button" value={auth.mode} disabled={busy}
                      options={[{label: copy.longTerm, value: 'long-term'}, {label: copy.shared, value: 'shared-secret'}]}
                      onChange={mode => changeAuth({mode, password: undefined, secret: undefined})} />
                  </div>
                  <TextField label={copy.realm} value={auth.realm} update={realm => changeAuth({realm})} />
                  {auth.mode === 'long-term' ? <>
                    <TextField label={copy.username} value={auth.username} update={username => changeAuth({username})} />
                    <TextField label={copy.password} value={auth.password} update={password => changeAuth({password})} password
                      placeholder={auth.hasPassword ? copy.savedSecret : undefined} />
                  </> : <>
                    <TextField label={copy.secret} value={auth.secret} update={secret => changeAuth({secret})} password
                      placeholder={auth.hasSecret ? copy.savedSecret : undefined} />
                    <div><Arco.Button disabled={busy || !mayIssue} onClick={issue}>{copy.issue}</Arco.Button></div>
                    {!mayIssue && <small>{copy.runningCredentials}</small>}
                    {credentials && <div style={ui.panel}>
                      <Field label={copy.username}><input style={ui.input} value={credentials.username} readOnly /></Field>
                      <Field label={copy.password}><input style={ui.input} value={credentials.password} readOnly /></Field>
                      {expiry && !Number.isNaN(expiry.getTime()) && <small>{copy.expires.replace('{time}', expiry.toLocaleString(language))}</small>}
                      <div style={ui.row}>
                        <Arco.Button onClick={() => copyValue(credentials.username + '\n' + credentials.password)}>{copy.copy}</Arco.Button>
                        <Arco.Button onClick={hide}>{copy.hide}</Arco.Button>
                      </div>
                    </div>}
                  </>}
                </div>
              </details>
              <details>
                <summary>{copy.turnTls}</summary>
                <div style={{...ui.stack, paddingTop: 10}}>
                  <SwitchField label={copy.secureTurn} checked={ice.tlsPort !== undefined} disabled={busy}
                    change={enabled => changeIce({tlsPort: enabled ? 5349 : undefined})} />
                  {ice.tlsPort !== undefined && <>
                    <PortField label={copy.securePort} value={ice.tlsPort} update={tlsPort => changeIce({tlsPort})} />
                    <TextField label={copy.certificate} value={ice.certFile} update={certFile => changeIce({certFile})} />
                    <TextField label={copy.privateKey} value={ice.keyFile} update={keyFile => changeIce({keyFile})} />
                  </>}
                </div>
              </details>
            </>}
          </>}
        </div>
      </>}
    </fieldset>
    <div style={ui.row}>
      <Arco.Button type="primary" htmlType="submit" disabled={busy}>{copy.save}</Arco.Button>
      <small role="status">{statusLabel}</small>
    </div>
    {error && <p role="alert" style={{margin: 0}}>{error}</p>}
  </form>
}
