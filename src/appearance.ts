import type { ThemePreference } from '@deepseek-ai/dsh-client-ui-theme'

export const paletteBackground = { light: '#fafbf8', dark: '#151e1a' } as const

export function isAppearance(value: unknown): value is ThemePreference {
  return value === 'light' || value === 'dark' || value === 'system'
}

export function startAppearance() {
  const html = document.documentElement
  const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')
  const system = window.matchMedia('(prefers-color-scheme: dark)')
  const apply = (preference: unknown) => {
    if (!isAppearance(preference)) { return }
    html.dataset.dsThemeSource = preference
    const dark = preference === 'dark' || (preference === 'system' && system.matches)
    document.body.toggleAttribute('data-ds-dark-theme', dark)
    if (dark) {
      document.body.setAttribute('arco-theme', 'dark')
    } else {
      document.body.removeAttribute('arco-theme')
    }
    if (meta) { meta.content = paletteBackground[dark ? 'dark' : 'light'] }
  }
  system.addEventListener('change', () => apply(html.dataset.dsThemeSource))
  apply(html.dataset.dsThemeSource)
  return apply
}
