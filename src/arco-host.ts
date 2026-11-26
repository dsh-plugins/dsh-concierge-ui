// The standalone concierge owns its React tree. Bind the component library to the
// same Arco/React instance throughout the page, as in its official standalone preview.
import { createElement, type HTMLAttributes } from 'react'
export * as Arco from '@arco-design/web-react'

/** Loader-compatible stylesheet ownership. Only the server's module script supplies a nonce. */
export function injectStyle(pluginId: string, cssId: string, css: string): () => void {
  if (typeof document === 'undefined') return () => {}
  const id = pluginId + '/' + cssId
  if (document.head.querySelector(`style[data-plugin-css="${CSS.escape(id)}"]`)) return () => {}
  const style = document.createElement('style')
  const entry = document.getElementById('prism-browser')
  if (entry instanceof HTMLScriptElement && entry.nonce) style.nonce = entry.nonce
  style.dataset.plugin = pluginId
  style.dataset.pluginCss = id
  style.textContent = css
  document.head.appendChild(style)
  return () => style.remove()
}

/** Scrollable content in the standalone host retains the platform's keyboard and pointer behavior. */
export function Scrollbar({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
  const names = className ? 'prism-host-scrollbar ' + className : 'prism-host-scrollbar'
  return createElement('div', { ...props, className: names }, children)
}
