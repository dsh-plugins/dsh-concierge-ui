export const channels = ['telegram', 'wechat', 'feishu', 'wecom', 'qq', 'onebot', 'discord'] as const
export type Channel = typeof channels[number]
export type LoginChannel = 'wechat' | 'feishu'
export type ChannelStatus = 'disabled' | 'starting' | 'running' | 'error'
export interface ChannelView {
  channel: Channel
  revision: number
  username?: string
  accountId?: string
  enabled: boolean
  status: ChannelStatus
  fields: Record<string, string | string[]>
  secrets: Record<string, boolean>
  registered: boolean
}
export type LoginStatus = 'starting' | 'waiting' | 'code' | 'complete' | 'cancelled' | 'expired' | 'error'
export interface LoginView {
  loginId: string
  channel: LoginChannel
  status: LoginStatus
  url?: string
  expiresAt: number
}
export type AdminErrorCode = 'invalid' | 'conflict' | 'unavailable' | 'forbidden' | 'not_found'
export class AdminError extends Error {
  constructor(readonly code: AdminErrorCode) { super(code) }
}

/** The gateway authenticates the host owner and redacts all stored credentials. */
export async function admin<T>(body?: Record<string, unknown>, signal?: AbortSignal): Promise<T> {
  const response = await fetch('/prism/im/admin', {
    method: body ? 'POST' : 'GET', credentials: 'same-origin', cache: 'no-store', signal,
    ...(body && {headers: {'Content-Type': 'application/json', 'X-Prism-Request': '1'}, body: JSON.stringify(body)}),
  })
  if (!response.ok) {
    const result = await response.json().catch(() => ({}))
    const accepted = ['invalid', 'conflict', 'unavailable', 'forbidden', 'not_found']
    throw new AdminError(accepted.includes(result?.error) ? result.error :
      response.status === 403 ? 'forbidden' : response.status === 409 ? 'conflict' : 'unavailable')
  }
  return response.json() as Promise<T>
}

export const fields: Record<Channel, {public: string[]; private: string[]}> = {
  telegram: {public: [], private: ['token']},
  wechat: {public: [], private: []},
  feishu: {public: ['domain', 'appId'], private: ['appSecret']},
  wecom: {public: ['botId'], private: ['secret']},
  qq: {public: ['appId'], private: ['appSecret']},
  onebot: {public: ['selfId', 'apiBase'], private: ['accessToken', 'eventSecret']},
  discord: {public: [], private: ['token']},
}

export function publicFields(view: ChannelView): Record<string, string | string[]> {
  const result: Record<string, string | string[]> = {}
  for (const name of fields[view.channel].public) {
    const value = view.fields[name]
    if (typeof value === 'string' && value) result[name] = value
  }
  result.allowedUserIds = Array.isArray(view.fields.allowedUserIds) ? [...view.fields.allowedUserIds] : []
  return result
}

/** The admin API merges public fields. Explicitly clear values removed in the form. */
export function editedFields(channel: Channel, base: ChannelView['fields'], draft: ChannelView['fields']): ChannelView['fields'] {
  const changes = { ...draft }
  for (const name of fields[channel].public) {
    if (Object.hasOwn(base, name) && !Object.hasOwn(draft, name)) changes[name] = ''
  }
  return changes
}

export function savedSecrets(draft: Record<string, string>, clear: string[]): Record<string, string | null> {
  const changes: Record<string, string | null> = {}
  for (const name of clear) changes[name] = null
  for (const [name, value] of Object.entries(draft)) if (value) changes[name] = value
  return changes
}

export function activeLogin(status: LoginStatus): boolean {
  return status === 'starting' || status === 'waiting' || status === 'code'
}
