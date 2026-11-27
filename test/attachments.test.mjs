import assert from 'node:assert/strict'
import test from 'node:test'
import { attachmentAccept, attachmentIssue, attachmentLimit, attachmentSize } from '../dist/attachments.js'

test('the picker applies the media upload limits without accepting arbitrary files', () => {
  assert.equal(attachmentLimit, 8)
  for (const type of attachmentAccept.split(',')) {
    assert.equal(attachmentIssue({ type, size: 16 * 1024 * 1024 }), undefined)
  }
  assert.equal(attachmentIssue({ type: 'application/pdf', size: 100 }), 'format')
  assert.equal(attachmentIssue({ type: '', size: 100 }), 'format')
  assert.equal(attachmentIssue({ type: 'image/svg+xml', size: 100 }), 'format')
  assert.equal(attachmentIssue({ type: 'image/png', size: 0 }), 'empty')
  assert.equal(attachmentIssue({ type: 'video/mp4', size: 16 * 1024 * 1024 + 1 }), 'size')
})

test('file sizes switch units at binary boundaries and use the current language', () => {
  assert.match(attachmentSize(1023, 'en'), /1,023 byte/u)
  assert.match(attachmentSize(1024, 'en'), /^1 kB$/u)
  assert.match(attachmentSize(1024 * 1024, 'en'), /^1 MB$/u)
  assert.match(attachmentSize(1536, 'fr'), /^1,5\s+ko$/u)
})
