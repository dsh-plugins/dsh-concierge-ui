import assert from 'node:assert/strict'
import { test } from 'node:test'
import { officialLink } from '../dist/ImQr.js'
import { activeLogin, admin, AdminError, editedFields, publicFields, savedSecrets } from '../dist/im-admin.js'

function view(channel, saved = {}) {
  return {channel, fields: saved, revision: 2, secrets: {}, status: 'disabled', enabled: false, registered: false}
}

test('removing the Feishu app ID and domain explicitly clears the manual overrides', () => {
  const original = publicFields(view('feishu', {appId: 'sample-app', domain: 'lark', allowedUserIds: ['user1']}))
  const auto = publicFields(view('feishu', {allowedUserIds: ['user1']}))
  assert.deepEqual(editedFields('feishu', original, auto), {appId: '', domain: '', allowedUserIds: ['user1']})
  const merged = {...original, ...editedFields('feishu', original, auto)}
  assert.deepEqual(publicFields(view('feishu', merged)), auto)
  assert.deepEqual(editedFields('feishu', auto, auto), {allowedUserIds: ['user1']})
  assert.deepEqual(editedFields('onebot', {selfId: 'u', apiBase: 'https://example.org'}, {allowedUserIds: []}),
    {selfId: '', apiBase: '', allowedUserIds: []})
})

test('blank passwords keep the stored value, explicit clearing and replacement are distinct', () => {
  assert.deepEqual(savedSecrets({accessToken: '', eventSecret: ''}, []), {})
  assert.deepEqual(savedSecrets({accessToken: '', eventSecret: 'replacement'}, ['accessToken']),
    {accessToken: null, eventSecret: 'replacement'})
})

test('QR challenge links stay on the selected service and terminal states stop polling', () => {
  assert.equal(officialLink('feishu', 'https://accounts.feishu.cn/login'), 'https://accounts.feishu.cn/login')
  assert.equal(officialLink('wechat', 'https://weixin.qq.com/login'), 'https://weixin.qq.com/login')
  for (const value of ['https://feishu.cn.example.org/', 'http://feishu.cn/', 'https://x@feishu.cn/', 'javascript:alert(1)']) {
    assert.equal(officialLink('feishu', value), undefined)
  }
  assert.equal(officialLink('wechat', 'https://feishu.cn/'), undefined)
  for (const status of ['starting', 'waiting', 'code']) assert.equal(activeLogin(status), true)
  for (const status of ['cancelled', 'expired', 'complete', 'error']) assert.equal(activeLogin(status), false)
})

test('the owner settings client keeps reads passive and writes same-origin tagged JSON', async (t) => {
  const request = t.mock.method(globalThis, 'fetch', async () => Response.json({channels: []}))
  await admin()
  await admin({op: 'loginCancel', channel: 'wechat', loginId: 'test-login'})
  const [read, write] = request.mock.calls.map(call => call.arguments)
  assert.equal(read[0], '/prism/im/admin')
  assert.equal(read[1].method, 'GET')
  assert.equal(read[1].body, undefined)
  assert.equal(write[1].credentials, 'same-origin')
  assert.equal(write[1].cache, 'no-store')
  assert.equal(write[1].headers['X-Prism-Request'], '1')
  assert.deepEqual(JSON.parse(write[1].body), {op: 'loginCancel', channel: 'wechat', loginId: 'test-login'})
  request.mock.mockImplementation(async () => Response.json({error: 'conflict'}, {status: 409}))
  await assert.rejects(() => admin({op: 'save'}), e => e instanceof AdminError && e.code === 'conflict')
})
