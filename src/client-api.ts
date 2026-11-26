import type { ConversationView } from '@dsh-prism/dsh-orchestrator/contracts'

export const api = '/prism/api'

export function describe(error: unknown): string {
  return error instanceof Error ? error.message : '连接失败，请重试。'
}

export async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(api + path, { credentials: 'same-origin', ...options })
  if (!response.ok) {
    const result = await response.json().catch(() => null)
    throw new Error(typeof result?.error === 'string' ? result.error : `请求失败（${response.status}）。`)
  }
  return response.json() as Promise<T>
}

export function post(path: '/message' | '/model', body: unknown): Promise<ConversationView> {
  return request(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Prism-Request': '1' },
    body: JSON.stringify(body),
  })
}
