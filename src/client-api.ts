import { copy } from './client-locale.js'
import type { ConversationView, MediaAsset } from './conversation.js'

export const api = '/prism/api'

export function describe(error: unknown): string {
  return error instanceof Error ? error.message : copy.offline
}

export async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(api + path, { credentials: 'same-origin', ...options })
  if (!response.ok) {
    const result = await response.json().catch(() => null)
    throw new Error(typeof result?.error === 'string' ? result.error : copy.requestFailed.replace('{status}', String(response.status)))
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

export function upload(file: File): Promise<MediaAsset> {
  return request('/attachment?' + new URLSearchParams({name: file.name}), {
    method: 'POST',
    headers: {'Content-Type': file.type, 'X-Prism-Request': '1'},
    body: file,
  })
}
