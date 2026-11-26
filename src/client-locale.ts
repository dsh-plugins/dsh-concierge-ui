import type { WebCopy } from './locale-types.js'

export const locale = document.documentElement.lang
const catalog = document.getElementById('prism-copy')
if (!catalog?.textContent) throw new Error('Missing Prism locale catalog')
export const copy = JSON.parse(catalog.textContent) as WebCopy
