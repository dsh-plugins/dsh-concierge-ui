import { useSyncExternalStore } from 'react'
import type { LocaleRuntime } from '@deepseek-ai/dsh-client-locale/client'
import type { SlotCore } from '@deepseek-ai/dsh-client-ui-slots'
import type { SidebarFooterActionOwnerProps } from '@deepseek-ai/dsh-client-ui-sidebar/client'
import type { ConfigForms, SettingsSectionIconOwnerProps } from '@deepseek-ai/dsh-client-ui-settings/client'
import { settingsCopy } from './settings-copy.js'
import { ImSettings } from './ImSettings.js'
import { imCopy } from './im-copy.js'
import { PrismShortcut } from './PrismShortcut.js'
import { ModelSettings, modelSettingsNamespace, type ModelDirectoryRemote, type ModelSelections } from './ModelSettings.js'

const configSection = 'prism-projects'
const imSection = 'prism-im'

function SettingsIcon({ size, section }: { size: number; section: 'config' | 'im' }) {
  return <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.25"
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {section === 'config' ?
      <path d="M2 4h4m3 0h5M2 8h8m3 0h1M2 12h2m3 0h7M6 2.5v3m4 1v3m-6 1v3" /> :
      <><path d="M13.5 7.5a4.5 4.5 0 0 1-4.5 4.5H6l-3.5 2v-4a4.5 4.5 0 0 1-1-2.5A4.5 4.5 0 0 1 6 3h3a4.5 4.5 0 0 1 4.5 4.5Z" />
        <path d="M5 7.5h5" /></>}
  </svg>
}

export const inject = ['slots', 'locale', 'configForms', 'remote', 'remote.session', 'dshLoaderUi']
interface BrowserContext {
  locale: Pick<LocaleRuntime, 'subscribe' | 'getSnapshot'>
  configForms: Pick<ConfigForms, 'get'>
  remote: ModelDirectoryRemote
  slots: Pick<SlotCore, 'register'> & {
    inject(name: 'settings.section' | 'settings.section.icon' | 'sidebar.footer.action', mount: () => () => void): void
  }
}
export function apply(ctx: BrowserContext) {
  const modelForm = ctx.configForms.get<ModelSelections>(modelSettingsNamespace)
  function useLanguage() {
    return useSyncExternalStore(listener => ctx.locale.subscribe(listener), () => ctx.locale.getSnapshot().active)
  }
  function PrismSettings() {
    const language = useLanguage()
    const copy = settingsCopy(language)
    return <section style={{ display: 'grid', gap: 14, maxWidth: 620, padding: '8px 0 20px' }}>
      <h2 style={{ margin: 0 }}>{copy.title}</h2>
      <p style={{ margin: 0 }}>{copy.workspaceHelp}</p>
      <p style={{ margin: 0 }}>{copy.modelHelp}</p>
      <ModelSettings form={modelForm} remote={ctx.remote} language={language} />
    </section>
  }
  function PrismIm() {
    return <ImSettings copy={imCopy(useLanguage())} />
  }
  function PrismButton({ wide }: SidebarFooterActionOwnerProps) {
    const copy = settingsCopy(useLanguage())
    return <PrismShortcut wide={wide} label={copy.title} title={copy.open} />
  }
  ctx.slots.inject('settings.section', () => ctx.slots.register({
    name: 'settings.section', id: configSection, order: 60, label: () => {
      const copy = settingsCopy(ctx.locale.getSnapshot().active)
      return `${copy.title}/${copy.config}`
    },
  }, PrismSettings))
  ctx.slots.inject('settings.section', () => ctx.slots.register({
    name: 'settings.section', id: imSection, order: 61,
    label: () => `${settingsCopy(ctx.locale.getSnapshot().active).title}/IM`,
  }, PrismIm))
  ctx.slots.inject('settings.section.icon', () => ctx.slots.register({
    name: 'settings.section.icon', id: configSection,
  }, ({ size }: SettingsSectionIconOwnerProps) => <SettingsIcon size={size} section="config" />))
  ctx.slots.inject('settings.section.icon', () => ctx.slots.register({
    name: 'settings.section.icon', id: imSection,
  }, ({ size }: SettingsSectionIconOwnerProps) => <SettingsIcon size={size} section="im" />))
  ctx.slots.inject('sidebar.footer.action', () => ctx.slots.register({
    name: 'sidebar.footer.action', id: 'prism-chat', order: 60,
  }, PrismButton))
}
