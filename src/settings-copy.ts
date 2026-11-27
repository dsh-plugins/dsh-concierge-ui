import type { Language } from './locale.js'

const en = {
  title: 'Prism',
  config: 'Configuration',
  open: 'Open Prism',
  modelHelp: 'Configure model providers in DSH model settings.',
  workspaceHelp: 'Prism uses the workspaces registered in DSH as projects.',
}

const copies: Record<Language, typeof en> = {
  en,
  zh: {
    title: '棱镜',
    config: '配置',
    open: '打开棱镜',
    modelHelp: '请先在 DSH 的模型设置中配置模型供应商。',
    workspaceHelp: '棱镜直接使用 DSH 中已登记的工作区。',
  },
  de: {
    title: 'Prism',
    config: 'Konfiguration',
    open: 'Prism öffnen',
    modelHelp: 'Richten Sie die Modellanbieter in den Modelleinstellungen von DSH ein.',
    workspaceHelp: 'Prism verwendet die in DSH registrierten Arbeitsbereiche als Projekte.',
  },
  es: {
    title: 'Prism',
    config: 'Configuración',
    open: 'Abrir Prism',
    modelHelp: 'Configura los proveedores de modelos en los ajustes de DSH.',
    workspaceHelp: 'Prism usa como proyectos los espacios de trabajo registrados en DSH.',
  },
  fr: {
    title: 'Prism',
    config: 'Configuration',
    open: 'Ouvrir Prism',
    modelHelp: 'Configurez les fournisseurs de modèles dans les paramètres DSH.',
    workspaceHelp: 'Prism utilise comme projets les espaces de travail enregistrés dans DSH.',
  },
  ja: {
    title: 'Prism',
    config: '設定',
    open: 'Prism を開く',
    modelHelp: 'DSH のモデル設定でプロバイダーを設定してください。',
    workspaceHelp: 'Prism は DSH に登録されたワークスペースをプロジェクトとして使用します。',
  },
  pt: {
    title: 'Prism',
    config: 'Configuração',
    open: 'Abrir o Prism',
    modelHelp: 'Configure os provedores de modelos nas configurações do DSH.',
    workspaceHelp: 'O Prism usa como projetos os espaços de trabalho registrados no DSH.',
  },
  ru: {
    title: 'Prism',
    config: 'Настройки',
    open: 'Открыть Prism',
    modelHelp: 'Настройте поставщиков моделей в параметрах DSH.',
    workspaceHelp: 'Prism использует рабочие области, зарегистрированные в DSH, как проекты.',
  },
}

export function settingsCopy(language: string): typeof en {
  const base = language.trim().toLowerCase().split(/[-_]/u)[0]
  return Object.hasOwn(copies, base) ? copies[base as Language] : en
}
