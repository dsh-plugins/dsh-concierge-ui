import { messages, selectLanguage } from './locale.js'
import type {} from '@deepseek-ai/dsh-settings'
import { DEFAULT_PREFERENCE, THEME_PREFERENCE_FIELD, THEME_SETTINGS_NAMESPACE, type ThemePreference } from '@deepseek-ai/dsh-client-ui-theme'
import type { WebCopy } from './locale-types.js'
import { randomBytes } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Context } from '@deepseek-ai/cordis'
import type { WebAuthRequest, WebAdmission, WebRoute } from '@deepseek-ai/dsh-host-webserver'
import type { RegistryPort, TraceEntry } from '@dsh-prism/dsh-orchestrator/core'
import type { ConversationView, MediaAsset } from './conversation.js'
import { documentHtml, faviconPath, stylesheet } from './page.js'
import { missingReply } from './delivery.js'
import { openPrismOnLoad } from './navigation.js'
import { isAppearance } from './appearance.js'

export const name = 'dsh-concierge-ui'
export const inject = ['webServer']

/** Keep authentication and state ownership in the host. The browser never supplies an owner. */
interface ConversationService {
  view(owner: string): Promise<ConversationView>
  message(owner: string, text: string, requestId?: string,
    source?: {channel: string; sender?: string}, attachmentIds?: string[]): Promise<ConversationView>
  stageMedia?(owner: string, input: {bytes: Uint8Array; mimeType: string; name?: string}): Promise<MediaAsset>
  readMedia?(owner: string, id: string): Promise<(MediaAsset & {bytes: Uint8Array}) | undefined>
  selectModel(owner: string, id: string): Promise<ConversationView>
  trace(owner: string, taskId: string): Promise<TraceEntry[]>
  subscribe(owner: string, listener: (view: ConversationView) => void): () => void
}

/** Live appearance preference shared by the HTML route and its authenticated streams. */
interface AppearanceSettings {
  current(): ThemePreference
  subscribe(listener: (preference: ThemePreference) => void): () => void
}

const pages = new Set(['/index.html', '/prism', '/prism/'])
const api = '/prism/api'
const signedCallbacks = new Set(['/prism/im/onebot', '/prism/im/qq'])
const publicPaths = new Set([
  ...pages,
  '/prism/browser.js',
  '/prism/style.css',
  faviconPath,
  `${api}/view`,
  `${api}/events`,
  `${api}/message`,
  `${api}/model`,
  `${api}/trace`,
  `${api}/attachment`,
])

export function restrictPublicSurface(request: WebAuthRequest): WebAdmission | undefined {
  const path = request.url.pathname
  if (
    request.transport === 'http' &&
    (path === '/' || publicPaths.has(path) || (request.method === 'POST' && signedCallbacks.has(path)))
  )
    return
  return { kind: 'deny', status: 403 }
}

const securityHeaders = {
  'Cache-Control': 'private, no-store',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'Content-Security-Policy':
    "default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' data:; media-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'",
}

function reply(res: ServerResponse, status: number, body: unknown, headers: Record<string, string> = {}) {
  res.writeHead(status, { ...securityHeaders, 'Content-Type': 'application/json; charset=utf-8', ...headers })
  res.end(JSON.stringify(body))
}

class RequestError extends Error {
  constructor(
    readonly status: number,
    readonly key: keyof WebCopy,
  ) {
    super(key)
  }
}

async function readBytes(request: IncomingMessage, limit: number): Promise<Buffer> {
  const chunks: Buffer[] = []
  let bytes = 0
  for await (const chunk of request.iterator({ destroyOnReturn: false })) {
    const data = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    bytes += data.length
    if (bytes > limit) {
      request.resume()
      throw new RequestError(413, 'tooLong')
    }
    chunks.push(data)
  }
  return Buffer.concat(chunks)
}

async function readBody(request: IncomingMessage): Promise<Record<string, unknown>> {
  if (request.headers['content-type']?.split(';')[0]?.trim() !== 'application/json') {
    throw new RequestError(415, 'json')
  }
  const bytes = await readBytes(request, 256 * 1024)
  let value: unknown
  try {
    value = JSON.parse(bytes.toString('utf8'))
  } catch {
    throw new RequestError(400, 'format')
  }
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new RequestError(400, 'format')
  return value as Record<string, unknown>
}

const mediaTypes = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/webm', 'video/quicktime'])

async function attachment(core: ConversationService, owner: string, req: IncomingMessage, res: ServerResponse, url: URL) {
  if (req.method === 'GET') {
    const id = requiredString(url.searchParams.get('id'), 128)
    const asset = await core.readMedia?.(owner, id)
    if (!asset || !mediaTypes.has(asset.mimeType)) {
      throw new RequestError(404, 'unavailable')
    }
    res.writeHead(200, {...securityHeaders, 'Content-Type': asset.mimeType, 'Content-Length': asset.bytes.byteLength})
    res.end(asset.bytes)
    return
  }
  if (req.method !== 'POST') {
    reply(res, 405, {}, {Allow: 'GET, POST'})
    return
  }
  if (req.headers['x-prism-request'] !== '1') {
    throw new RequestError(403, 'origin')
  }
  const mimeType = req.headers['content-type']?.split(';')[0]?.trim() ?? ''
  if (!mediaTypes.has(mimeType)) {
    throw new RequestError(415, 'format')
  }
  if (!core.stageMedia) {
    throw new RequestError(503, 'unavailable')
  }
  const name = url.searchParams.get('name')?.slice(0, 255)
  const bytes = await readBytes(req, 16 * 1024 * 1024)
  reply(res, 201, await core.stageMedia(owner, {bytes, mimeType, name}))
}

function requiredString(value: unknown, limit: number): string {
  if (typeof value !== 'string' || !value.trim() || value.length > limit)
    throw new RequestError(400, 'invalidOption')
  return value.trim()
}

/** Serialize only the channel contract, even if a host adds private fields to its view. */
function project(view: ConversationView, copy: WebCopy): ConversationView {
  return {
    modelId: view.modelId,
    ...(view.mediaEnabled === true && {mediaEnabled: true}),
    models: view.models.map(model => ({
      id: model.id,
      description: model.description,
      ...('label' in model && typeof model.label === 'string' && {label: model.label}),
    })),
    messages: view.messages.map(message => ({
      id: message.id,
      role: message.role,
      text: message.text,
      at: message.at,
      ...(message.source && {source: {channel: message.source.channel, sender: message.source.sender}}),
      ...(message.attachments?.length && {attachments: message.attachments.map(({assetId, mimeType, name}) => ({assetId, mimeType, name}))}),
      ...(message.delivery ? { delivery: message.delivery } : {}),
      ...(missingReply(message) ? { deliveryError: 'no_response' as const } : {}),
    })),
    tasks: view.tasks.map(({ id, title, status, at, parentId }) => ({
      id,
      title: parentId ? copy.step : title,
      status,
      at,
      ...(parentId ? { parentId } : {}),
    })),
  }
}

async function streamView(
  core: ConversationService,
  owner: string,
  response: ServerResponse,
  signal: AbortSignal,
  copy: WebCopy,
  appearance?: AppearanceSettings,
) {
  response.writeHead(200, {
    ...securityHeaders,
    'Content-Type': 'text/event-stream',
    'X-Accel-Buffering': 'no',
  })
  response.flushHeaders()
  let received = false,
    paused = false
  let latest: ConversationView | undefined
  let latestAppearance: ThemePreference | undefined
  const emitAppearance = (preference: ThemePreference) => {
    if (response.destroyed || response.writableEnded) { return }
    if (paused) {
      latestAppearance = preference
      return
    }
    paused = !response.write(`event: appearance\ndata: ${preference}\n\n`)
  }
  const emit = (view: ConversationView) => {
    received = true
    if (response.destroyed || response.writableEnded) return
    if (paused) {
      latest = view
      return
    }
    paused = !response.write(`data: ${JSON.stringify(project(view, copy))}\n\n`)
  }
  const drain = () => {
    paused = false
    const preference = latestAppearance
    latestAppearance = undefined
    if (preference) { emitAppearance(preference) }
    const snapshot = latest
    latest = undefined
    if (snapshot) emit(snapshot)
  }
  response.on('drain', drain)
  emitAppearance(appearance?.current() ?? DEFAULT_PREFERENCE)
  const unsubscribeAppearance = appearance?.subscribe(emitAppearance)
  const unsubscribe = core.subscribe(owner, emit)
  const heartbeat = setInterval(() => {
    if (!paused) paused = !response.write(': heartbeat\n\n')
  }, 20000)
  heartbeat.unref()
  const revoke = () => response.end()
  const cleanup = () => {
    clearInterval(heartbeat)
    unsubscribeAppearance?.()
    unsubscribe()
    response.removeListener('drain', drain)
    signal.removeEventListener('abort', revoke)
  }
  response.once('close', cleanup)
  signal.addEventListener('abort', revoke, { once: true })
  if (signal.aborted || response.destroyed) {
    response.removeListener('close', cleanup)
    response.end()
    cleanup()
    return
  }
  try {
    const initial = await core.view(owner)
    if (!received) emit(initial)
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'NO_PROJECT') {
      response.write('event: no-project\ndata: {}\n\n')
    }
    response.end()
  }
}

export function createRoutes(
  getService: () => ConversationService | undefined,
  javascript: string,
  componentCss = '',
  hostPreference: () => string | undefined = () => undefined,
  integrated = false,
  appearance?: AppearanceSettings,
): WebRoute[] {
  const css = componentCss + '\n' + stylesheet
  const handler: WebRoute['handler'] = async (req, res, peer) => {
    const language = selectLanguage(req.headers['accept-language'], hostPreference())
    const copy = messages(language)
    res.setHeader('Content-Language', language)
    res.setHeader('Vary', 'Accept-Language')
    if (!peer || peer.signal.aborted || peer.principal.kind !== 'owner') {
      reply(res, 403, { error: copy.identity })
      return
    }
    const owner = 'web:owner'
    const url = new URL(req.url ?? '/', 'http://dsh.invalid')
    const path = url.pathname
    try {
      if (pages.has(path) || path === '/prism/browser.js' || path === '/prism/style.css' || path === faviconPath) {
        if (req.method !== 'GET' && req.method !== 'HEAD') {
          reply(res, 405, {}, { Allow: 'GET, HEAD' })
          return
        }
        if (pages.has(path)) {
          const nonce = randomBytes(18).toString('base64')
          res.writeHead(200, {
            ...securityHeaders,
            'Content-Type': 'text/html; charset=utf-8',
            'Content-Security-Policy': securityHeaders['Content-Security-Policy'].replace(
              "style-src 'self'", `style-src 'self' 'nonce-${nonce}'; style-src-attr 'unsafe-inline'`,
            ),
          })
          res.end(req.method === 'HEAD' ? undefined : documentHtml(nonce, language, integrated, appearance?.current()))
          return
        }
        if (path === faviconPath) {
          const icon = req.method === 'HEAD' ? undefined : await readFile(new URL('../favicon.svg', import.meta.url))
          res.writeHead(200, { ...securityHeaders, 'Content-Type': 'image/svg+xml' })
          res.end(icon)
          return
        }
        const isScript = path === '/prism/browser.js'
        const mime = isScript ? 'text/javascript' : 'text/css'
        res.writeHead(200, { ...securityHeaders, 'Content-Type': `${mime}; charset=utf-8` })
        res.end(req.method === 'HEAD' ? undefined : isScript ? javascript : css)
        return
      }
      const write = path === `${api}/message` || path === `${api}/model`
      const core = getService()
      if (path === `${api}/attachment`) {
        if (!core) { throw new RequestError(503, 'starting') }
        await attachment(core, owner, req, res, url)
        return
      }
      const method = write ? 'POST' : 'GET'
      if (req.method !== method) {
        reply(res, 405, {}, { Allow: method })
        return
      }
      if (write && req.headers['x-prism-request'] !== '1') throw new RequestError(403, 'origin')
      if (!core) throw new RequestError(503, 'starting')
      if (path === `${api}/events`) {
        await streamView(core, owner, res, peer.signal, copy, appearance)
        return
      }
      if (path === `${api}/trace`) {
        const trace = await core.trace(owner, requiredString(url.searchParams.get('task'), 256))
        reply(
          res,
          200,
          trace.map(({ role, text, at }) => ({ role, text, at })),
        )
        return
      }
      if (!write) {
        reply(res, 200, project(await core.view(owner), copy))
        return
      }
      const body = await readBody(req)
      if (path === `${api}/model`) {
        reply(res, 200, project(await core.selectModel(owner, requiredString(body.modelId, 256)), copy))
        return
      }
      if (body.attachments !== undefined && (!Array.isArray(body.attachments) || body.attachments.length > 8)) {
        throw new RequestError(400, 'invalidOption')
      }
      const ids = Array.isArray(body.attachments) ? body.attachments.map(id => requiredString(id, 128)) : []
      const message = ids.length && body.text === '' ? '' : requiredString(body.text, 32000)
      const id = requiredString(body.requestId, 128)
      const view = ids.length ? await core.message(owner, message, id, undefined, ids) : await core.message(owner, message, id)
      reply(res, 200, project(view, copy))
    } catch (error) {
      if (res.headersSent) {
        res.end()
        return
      }
      const code = error && typeof error === 'object' && 'code' in error ? error.code : undefined
      if (error instanceof RequestError) reply(res, error.status, { error: copy[error.key] })
      else if (code === 'NOT_FOUND') reply(res, 404, { error: copy.missingTask })
      else if (code === 'NO_PROJECT') reply(res, 409, { error: copy.noProject })
      else if (code === 'INVALID_INPUT') reply(res, 400, { error: copy.badModel })
      else reply(res, 503, { error: copy.unavailable })
    }
  }
  return [...publicPaths].filter(path => !integrated || path !== '/index.html').map((path) => ({ path, kind: 'exact', auth: 'required', handler }))
}

export interface Config { integrated?: boolean }

function hostAppearance(ctx: Context): AppearanceSettings {
  const subscribers = new Set<(preference: ThemePreference) => void>()
  const read = () => {
    const descriptor = ctx.get('settings')?.describe({ redactSecrets: true }).find(entry => entry.ns === THEME_SETTINGS_NAMESPACE)
    const value = (descriptor?.value as Record<string, unknown> | undefined)?.[THEME_PREFERENCE_FIELD]
    return isAppearance(value) ? value : DEFAULT_PREFERENCE
  }
  let preference: ThemePreference | undefined
  ctx.on('settings/document-updated', ns => {
    if (ns !== THEME_SETTINGS_NAMESPACE) { return }
    // Settings emits before finishing its descriptor, so read the effective value afterward.
    queueMicrotask(() => {
      const next = read()
      if (next === preference) { return }
      preference = next
      for (const listener of subscribers) { listener(next) }
    })
  })
  return {
    current: () => preference ??= read(),
    subscribe(listener) {
      subscribers.add(listener)
      return () => { subscribers.delete(listener) }
    },
  }
}

export async function apply(ctx: Context, config: Config = {}) {
  // The native remote-connection plugin owns the exact root. Preserve the token
  // exchange there and send the resulting authenticated navigation to our page.
  if (!config.integrated) {
    ctx.on(
      'webserver/request',
      async (req, res, next) => {
        const url = new URL(req.url ?? '/', 'http://dsh.invalid')
        if (url.pathname !== '/' || (req.method === 'GET' && url.searchParams.has('token'))) {
          await next()
          return
        }
        if (req.method !== 'GET' && req.method !== 'HEAD') {
          reply(res, 405, {}, { Allow: 'GET, HEAD' })
          return
        }
        res.writeHead(303, { ...securityHeaders, Location: '/prism' })
        res.end()
      },
      { prepend: true },
    )
    ctx.on('webserver/authorize', restrictPublicSurface, { prepend: true })
  } else {
    ctx.on('webserver/index-inject', (rows, peer) => {
      const registry = ctx.get('prismRegistry') as Pick<RegistryPort, 'query'> | undefined
      if (peer.principal.kind === 'owner' && registry?.query('web:owner').length && ctx.get('prism')) {
        rows.push({ kind: 'script', placement: 'head', text: openPrismOnLoad })
      }
    })
  }
  const [js, css] = await Promise.all([
    readFile(new URL('./client/prism.js', import.meta.url), 'utf8'),
    readFile(new URL('./client/prism.css', import.meta.url), 'utf8'),
  ])
  // Read DSH's live locale preference once per settings revision. Standalone hosts
  // without the settings service negotiate each request through Accept-Language.
  let preference: string | null | undefined
  ctx.on('settings/document-updated', ns => { if (ns === 'locale') preference = undefined })
  const hostPreference = () => {
    if (preference === undefined) {
      const form = ctx.get('settings')?.describe({ redactSecrets: true }).find(entry => entry.ns === 'locale')
      const value = (form?.value as { preference?: unknown } | undefined)?.preference
      preference = typeof value === 'string' ? value : null
    }
    return preference ?? undefined
  }
  const appearance = hostAppearance(ctx)
  for (const route of createRoutes(() => ctx.get('prism') as ConversationService | undefined, js, css, hostPreference, config.integrated, appearance)) {
    ctx.effect(() => ctx.webServer.register(route), `concierge ${route.path}`)
  }
}
