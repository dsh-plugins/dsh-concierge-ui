import { readFileSync } from 'node:fs'
import type { WebCopy } from './locale-types.js'

export const languages = ['de', 'en', 'es', 'fr', 'ja', 'pt', 'ru', 'zh'] as const
export type Language = typeof languages[number]
const dictionaries = new Map<Language, WebCopy>()

/** Select the most preferred supported language range (e.g. pt-BR → pt). */
export function selectLanguage(header = '', preference?: string): Language {
  const preferred = languages.find(language => language === preference?.toLowerCase().split('-')[0])
  if (preferred) return preferred
  const ranges = header.toLowerCase().split(',').flatMap(range => {
    const match = /^\s*([a-z]{2,8}(?:-[a-z0-9]{1,8})*|\*)\s*(?:;\s*q=(0(?:\.\d{0,3})?|1(?:\.0{0,3})?))?\s*$/.exec(range)
    if (!match) return []
    const weight = Number(match[2] ?? 1)
    return weight > 0 ? [{ code: match[1].split('-')[0], weight }] : []
  })
  for (const range of ranges.sort((a, b) => b.weight - a.weight)) {
    if (range.code === '*') continue
    const supported = languages.find(language => language === range.code)
    if (supported) return supported
  }
  return 'en'
}

export function messages(language: Language): WebCopy {
  let copy = dictionaries.get(language)
  if (!copy) {
    const url = new URL(`../locale/${language}.json`, import.meta.url)
    const catalog = JSON.parse(readFileSync(url, 'utf8')) as { messages: WebCopy }
    copy = Object.freeze(catalog.messages)
    dictionaries.set(language, copy)
  }
  return copy
}
