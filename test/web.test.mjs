import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { once } from 'node:events'
import { test } from 'node:test'
import { createRoutes, restrictPublicSurface } from '../dist/index.js'

function state() {
  return {
    modelId: 'flash',
    models: [{ id: 'flash', description: '快速交互', prompt: 'private system prompt' }],
    messages: [{ id: 'm', role: 'user', text: '你好', at: '2026-01-01T00:00:00.000Z', delivery: 'failed' }],
    tasks: [
      {
        id: 'my-task',
        title: '整理方案',
        status: 'running',
        at: '2026-01-01T00:00:00.000Z',
        cwd: '/private/project',
      },
    ],
    sessionId: 'private',
  }
}

test('public web gate allows concierge and exact authenticated callback routes', () => {
  const decide = (path, method = 'GET', transport = 'http') =>
    restrictPublicSurface({ url: new URL(path, 'http://test.invalid'), headers: {}, method, transport })
  for (const path of ['/', '/prism/browser.js', '/prism/api/events']) assert.equal(decide(path), undefined)
  for (const path of ['/prism/mesh/v1', '/prism/im/onebot', '/prism/im/qq']) {
    assert.equal(decide(path, 'POST'), undefined)
    assert.equal(decide(path, 'GET').status, 403)
    assert.equal(decide(path + '/', 'POST').status, 403)
    assert.equal(decide(path, 'POST', 'upgrade').status, 403)
  }
  for (const path of [
    '/assets/index.js',
    '/connect',
    '/api/workspaces',
    '/api/remote.mux',
    '/plugins',
    '/prism/mesh/v1',
    '/prism/unknown',
    '/prism/api/%2e%2e/foo',
  ])
    assert.equal(decide(path).status, 403)
  assert.equal(decide('/prism/api/view', 'GET', 'upgrade').status, 403)
})

test('channel endpoints restrict identity, writable methods and output fields', async (t) => {
  const calls = [],
    view = state()
  const core = {
    view: async () => view,
    message: async (...args) => {
      calls.push(args)
      return view
    },
    trace: async (owner, id) => {
      if (owner !== 'web:owner' || id !== 'my-task')
        throw Object.assign(new Error('missing'), { code: 'NOT_FOUND' })
      return [{ role: 'assistant', text: '详情', workspace: '/private/project' }]
    },
  }
  const routes = createRoutes(() => core, '')
  const controller = new AbortController()
  const server = createServer((req, res) => {
    const route = routes.find(({ path }) => path === new URL(req.url, 'http://test.invalid').pathname)
    if (!route) {
      res.writeHead(404)
      res.end()
      return
    }
    const peer = req.headers.authorization
      ? { principal: { kind: 'owner' }, signal: controller.signal }
      : undefined
    void route.handler(req, res, peer)
  })
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  t.after(
    () =>
      new Promise((resolve) => {
        server.close(resolve)
        server.closeAllConnections()
      }),
  )
  const base = `http://127.0.0.1:${server.address().port}/prism/api`
  assert.equal((await fetch(base + '/view')).status, 403)
  const headers = { authorization: 'test', 'content-type': 'application/json', 'x-prism-request': '1' }
  const visible = await (await fetch(base + '/view', { headers })).json()
  assert.equal(visible.messages[0].delivery, 'failed')
  assert.doesNotMatch(JSON.stringify(visible), /private|prompt|workspace|sessionId/)
  assert.equal((await fetch(base + '/trace?task=unknown', { headers })).status, 404)
  assert.equal((await fetch(base + '/trace?task=my-task', { headers, method: 'POST' })).status, 405)
  assert.deepEqual(await (await fetch(base + '/trace?task=my-task', { headers })).json(), [
    { role: 'assistant', text: '详情' },
  ])
  const body = JSON.stringify({ owner: 'another', text: '你好', requestId: 'request-1' })
  assert.equal(
    (await fetch(base + '/message', { method: 'POST', headers: { ...headers, 'x-prism-request': '' }, body }))
      .status,
    403,
  )
  assert.equal((await fetch(base + '/message', { method: 'POST', headers, body })).status, 200)
  assert.deepEqual(calls, [['web:owner', '你好', 'request-1']])
})

test('Prism negotiates native DSH languages for both the browser and API errors', async () => {
  const { languages, messages, selectLanguage } = await import('../dist/locale.js')
  const { documentHtml } = await import('../dist/page.js')
  assert.equal(selectLanguage('zh-TW;q=0.5,de-DE;q=0.9'), 'de')
  assert.equal(selectLanguage('fr-CA', 'ja-JP'), 'ja')
  assert.equal(selectLanguage('pt-BR', 'unsupported'), 'pt')
  assert.equal(selectLanguage('xx,zh;q=0'), 'en')
  const keys = Object.keys(messages('en')).sort()
  for (const language of languages) {
    const copy = messages(language)
    assert.deepEqual(Object.keys(copy).sort(), keys)
    const html = documentHtml('nonce', language)
    assert.ok(html.includes(`<html lang="${language}">`))
    assert.ok(html.includes(`<title>${copy.title}</title>`))
    const payload = JSON.parse(/id="prism-copy"[^>]*>([^<]*)<\/script>/.exec(html)[1])
    assert.equal(payload.welcome, copy.welcome)
    assert.equal(payload.currentModel.split('{model}').length, 2)
  }
  const route = createRoutes(() => undefined, '').find(route => route.path === '/prism/api/view')
  const headers = new Map()
  let error
  const res = { setHeader: (key, value) => headers.set(key, value), writeHead: () => {}, end: data => { error = JSON.parse(data) } }
  await route.handler({method:'GET', url:'/prism/api/view', headers:{'accept-language':'fr-CA'}}, res)
  assert.equal(headers.get('Content-Language'), 'fr')
  assert.deepEqual(error, {error: messages('fr').identity})
})
