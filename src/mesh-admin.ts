/** 已保存的 Mesh 服务端配置，凭据只显示保存状态。 */
export interface MeshServerConfig {
  enabled: boolean
  host: string
  signaling: {enabled: boolean; port: number; localTest: boolean; certFile?: string; keyFile?: string}
  ice: {
    enabled: boolean
    port: number
    relay: boolean
    tlsPort?: number
    minPort: number
    maxPort: number
    behindNat: boolean
    externalIp?: string
    certFile?: string
    keyFile?: string
    auth: {mode: 'long-term' | 'shared-secret'; realm: string; username?: string; hasPassword?: boolean; hasSecret?: boolean}
  }
}

/** 当前 Profile 的连接、配对和监听状态。 */
export interface MeshView {
  nodeId: string
  mode: 'managed' | 'static'
  client?: {signalingUrl: string; iceUrls: string[]; turnUsername?: string; hasTurnPassword?: boolean}
  pairing: {status: 'idle' | 'waiting' | 'error'; error?: string}
  nodes: {id: string; status: 'connecting' | 'connected' | 'offline'; managed: boolean}[]
  server: {config: MeshServerConfig; status: 'stopped' | 'starting' | 'running' | 'error'; error?: string}
}

type AuthDraft = MeshServerConfig['ice']['auth'] & {password?: string; secret?: string}
type ServerUpdate = Omit<MeshServerConfig, 'ice'> & {ice: Omit<MeshServerConfig['ice'], 'auth'> & {
  auth: Omit<AuthDraft, 'hasPassword' | 'hasSecret'>
}}
type ClientUpdate = {signalingUrl: string; iceUrls: string[]; turnUsername?: string; turnPassword?: string}

/** 凭据只允许在保存配置与连接时明文提交。 */
export type MeshCommand =
  | ({op: 'connect'; code: string} & ClientUpdate)
  | ({op: 'saveClient'} & ClientUpdate)
  | {op: 'cancel'}
  | {op: 'forget'; nodeId: string}
  | {op: 'applyServer'; config: ServerUpdate}

/** 属主当次生成的短期凭据。 */
export interface TurnCredentials {username: string; password: string; expiresAt: number | string}

async function request<T>(signal: AbortSignal, body?: MeshCommand | {op: 'issueTurnCredentials'}): Promise<T> {
  const response = await fetch('/prism/mesh/admin', {
    method: body ? 'POST' : 'GET', credentials: 'same-origin', cache: 'no-store', signal,
    headers: {'X-Prism-Request': '1', ...(body && {'Content-Type': 'application/json'})},
    ...(body && {body: JSON.stringify(body)}),
  })
  if (!response.ok) {
    const result = await response.json().catch(() => undefined)
    throw new Error(typeof result?.error === 'string' ? result.error : `HTTP ${response.status}`)
  }
  return response.json() as Promise<T>
}

export function loadMesh(signal: AbortSignal): Promise<MeshView> {
  return request(signal)
}

export function changeMesh(signal: AbortSignal, command: MeshCommand): Promise<MeshView> {
  return request(signal, command)
}

export function issueTurnCredentials(signal: AbortSignal): Promise<TurnCredentials> {
  return request(signal, {op: 'issueTurnCredentials'})
}
