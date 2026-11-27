import type { Language } from './locale.js'

const en = {
  title: 'Prism',
  config: 'Configuration',
  open: 'Open Prism',
  modelHelp: 'Configure your provider and model in DSH model settings, then select that model in a DSH chat.',
  workspaceHelp: 'Prism uses the workspaces registered in DSH as projects.',
}

const copies: Record<Language, typeof en> = {
  en,
  zh: {
    title: '棱镜',
    config: '配置',
    open: '打开棱镜',
    modelHelp: '在 DSH 的模型设置中配置供应商和模型，然后在 DSH 对话中选用该模型。',
    workspaceHelp: '棱镜直接使用 DSH 中已登记的工作区。',
  },
  de: {
    title: 'Prism',
    config: 'Konfiguration',
    open: 'Prism öffnen',
    modelHelp: 'Richten Sie Anbieter und Modell in den Modelleinstellungen von DSH ein. Wählen Sie das Modell anschließend in einem DSH-Chat aus.',
    workspaceHelp: 'Prism verwendet die in DSH registrierten Arbeitsbereiche als Projekte.',
  },
  es: {
    title: 'Prism',
    config: 'Configuración',
    open: 'Abrir Prism',
    modelHelp: 'Configura el proveedor y el modelo en los ajustes de modelos de DSH. Después, selecciona ese modelo en un chat de DSH.',
    workspaceHelp: 'Prism usa como proyectos los espacios de trabajo registrados en DSH.',
  },
  fr: {
    title: 'Prism',
    config: 'Configuration',
    open: 'Ouvrir Prism',
    modelHelp: 'Configurez le fournisseur et le modèle dans les paramètres des modèles de DSH, puis sélectionnez ce modèle dans une conversation DSH.',
    workspaceHelp: 'Prism utilise comme projets les espaces de travail enregistrés dans DSH.',
  },
  ja: {
    title: 'Prism',
    config: '設定',
    open: 'Prism を開く',
    modelHelp: 'DSH のモデル設定でプロバイダーとモデルを設定し、DSH のチャットでそのモデルを選択してください。',
    workspaceHelp: 'Prism は DSH に登録されたワークスペースをプロジェクトとして使用します。',
  },
  pt: {
    title: 'Prism',
    config: 'Configuração',
    open: 'Abrir o Prism',
    modelHelp: 'Configure o provedor e o modelo nas configurações de modelos do DSH. Depois, selecione esse modelo em uma conversa do DSH.',
    workspaceHelp: 'O Prism usa como projetos os espaços de trabalho registrados no DSH.',
  },
  ru: {
    title: 'Prism',
    config: 'Настройки',
    open: 'Открыть Prism',
    modelHelp: 'Укажите поставщика и модель в настройках моделей DSH, затем выберите эту модель в чате DSH.',
    workspaceHelp: 'Prism использует рабочие области, зарегистрированные в DSH, как проекты.',
  },
}

export function settingsCopy(language: string): typeof en {
  const base = language.trim().toLowerCase().split(/[-_]/u)[0]
  return Object.hasOwn(copies, base) ? copies[base as Language] : en
}
