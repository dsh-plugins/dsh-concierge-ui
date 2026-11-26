import assert from 'node:assert/strict'
import { test } from 'node:test'
import { formatProjectPrincipals, parseProjectPrincipals } from '../dist/dsh-client.js'

// The gateway constructs its exact registry identity from channel, chat and sender.
const tuple = ['telegram', 'chat,west', 'u"ser,web:owner']
const im = 'im:' + JSON.stringify(tuple)

test('native project editing preserves each exact IM grant through reopening and saving', () => {
  const initial = [im, 'web:owner', 'legacy,alias', ' custom with spaces ']
  const rendered = formatProjectPrincipals(initial)
  assert.equal(rendered, initial.join('\n'))
  assert.deepEqual(parseProjectPrincipals(rendered, initial), initial)
  assert.deepEqual(parseProjectPrincipals(rendered + '\nalice', initial), [...initial, 'alice'])
  assert.deepEqual(parseProjectPrincipals('legacy,alias', ['legacy,alias']), ['legacy,alias'])
  assert.deepEqual(parseProjectPrincipals(' legacy,alias ', ['legacy,alias']), ['legacy,alias'])
  assert.deepEqual(parseProjectPrincipals('', []), [])
})

test('pasting an IM identity authorizes only that channel, chat and sender', () => {
  assert.deepEqual(parseProjectPrincipals(im, ['web:owner']), [im])
  const spaced = 'im:[' + tuple.map(value => JSON.stringify(value)).join(', ') + ']'
  assert.deepEqual(parseProjectPrincipals(spaced + '\r\nweb:owner', []), [im, 'web:owner'])
  assert.deepEqual(parseProjectPrincipals('im:["qq","web:owner","*"]', []), ['im:["qq","web:owner","*"]'])
  for (const malformed of ['im:["qq","chat",web:owner', 'im:["qq","chat"]', 'im:["qq","chat",42]',
    'web:owner, ' + im, im + ', web:owner', 'web:owner, *', 'web:owner\n*', '*', 'a\tb']) {
    assert.equal(parseProjectPrincipals(malformed, []), undefined)
  }
})

test('ordinary identities retain support for the previous comma-separated input', () => {
  assert.deepEqual(parseProjectPrincipals('web:owner', []), ['web:owner'])
  assert.deepEqual(parseProjectPrincipals('web:owner, team:alice, bob, bob, ', []), ['web:owner','team:alice','bob'])
  assert.deepEqual(parseProjectPrincipals('web:owner\nalice', []), ['web:owner','alice'])
})
