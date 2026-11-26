import { messages, selectLanguage } from './locale.js'
import type {} from '@deepseek-ai/dsh-settings'
import type { WebCopy } from './locale-types.js'
import { randomBytes } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Context } from '@deepseek-ai/cordis'
import type { WebAuthRequest, WebAdmission, WebRoute } from '@deepseek-ai/dsh-host-webserver'
import type { ConversationView, TraceEntry } from '@dsh-prism/dsh-orchestrator/core'
import { documentHtml, stylesheet } from './page.js'

export const name = 'dsh-concierge-ui'
export const inject = ['webServer']

/** Keep authentication and state ownership in the host. The browser never supplies an owner. */
interface ConversationService {
  view(owner: string): Promise<ConversationView>
  message(owner: string, text: string, requestId?: string): Promise<ConversationView>
  selectModel(owner: string, id: string): Promise<ConversationView>
  trace(owner: string, taskId: string): Promise<TraceEntry[]>
  subscribe(owner: string, listener: (view: ConversationView) => void): () => void
}

const pages = new Set(['/index.html', '/prism', '/prism/'])
const api = '/prism/api'
const signedCallbacks = new Set(['/prism/mesh/v1', '/prism/im/onebot', '/prism/im/qq'])
const publicPaths = new Set([
  ...pages,
  '/prism/browser.js',
  '/prism/style.css',
  `${api}/view`,
  `${api}/events`,
  `${api}/message`,
  `${api}/model`,
  `${api}/trace`,
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
    "default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' data:; frame-ancestors 'none'; base-uri 'none'; form-action 'none'",
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

async function readBody(request: IncomingMessage): Promise<Record<string, unknown>> {
  if (request.headers['content-type']?.split(';')[0]?.trim() !== 'application/json')
    throw new RequestError(415, 'json')
  const chunks: Buffer[] = []
  let bytes = 0
  for await (const chunk of request.iterator({ destroyOnReturn: false })) {
    const data = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    bytes += data.length
    if (bytes > 256 * 1024) {
      request.resume()
      throw new RequestError(413, 'tooLong')
    }
    chunks.push(data)
  }
  let value: unknown
  try {
    value = JSON.parse(Buffer.concat(chunks).toString('utf8'))
  } catch {
    throw new RequestError(400, 'format')
  }
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new RequestError(400, 'format')
  return value as Record<string, unknown>
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
    models: view.models.map(({ id, description }) => ({ id, description })),
    messages: view.messages.map(({ id, role, text, at, delivery }) => ({
      id,
      role,
      text,
      at,
      ...(delivery ? { delivery } : {}),
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
    const snapshot = latest
    latest = undefined
    if (snapshot) emit(snapshot)
  }
  response.on('drain', drain)
  const unsubscribe = core.subscribe(owner, emit)
  const heartbeat = setInterval(() => {
    if (!paused) paused = !response.write(': heartbeat\n\n')
  }, 20000)
  heartbeat.unref()
  const revoke = () => response.end()
  const cleanup = () => {
    clearInterval(heartbeat)
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
      if (pages.has(path) || path === '/prism/browser.js' || path === '/prism/style.css') {
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
          res.end(req.method === 'HEAD' ? undefined : documentHtml(nonce, language, integrated))
          return
        }
        const isScript = path === '/prism/browser.js'
        const mime = isScript ? 'text/javascript' : 'text/css'
        res.writeHead(200, { ...securityHeaders, 'Content-Type': `${mime}; charset=utf-8` })
        res.end(req.method === 'HEAD' ? undefined : isScript ? javascript : css)
        return
      }
      const write = path === `${api}/message` || path === `${api}/model`
      const method = write ? 'POST' : 'GET'
      if (req.method !== method) {
        reply(res, 405, {}, { Allow: method })
        return
      }
      if (write && req.headers['x-prism-request'] !== '1') throw new RequestError(403, 'origin')
      const core = getService()
      if (!core) throw new RequestError(503, 'starting')
      if (path === `${api}/events`) {
        await streamView(core, owner, res, peer.signal, copy)
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
      const view =
        path === `${api}/model`
          ? await core.selectModel(owner, requiredString(body.modelId, 256))
          : await core.message(owner, requiredString(body.text, 32000), requiredString(body.requestId, 128))
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
  for (const route of createRoutes(() => ctx.get('prism') as ConversationService | undefined, js, css, hostPreference, config.integrated)) {
    ctx.effect(() => ctx.webServer.register(route), `concierge ${route.path}`)
  }
}
