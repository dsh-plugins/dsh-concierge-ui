const en = {
  layer: '{layer} available models',
  fallback: 'A layer with no selected models follows the DSH default model.',
  empty: 'No models are available. Configure a provider in DSH model settings.',
  loading: 'Loading models…',
  failed: 'Could not load models.',
  partial: 'Some providers could not load their models.',
  unavailable: 'Model settings are unavailable.',
  removed: 'Currently unavailable',
  refresh: 'Reload models',
  edit: 'Edit {model}',
  description: 'Model description',
  prompt: 'Model prompt',
  save: 'Save',
  saving: 'Saving…',
  cancel: 'Cancel',
  conflict: 'The model settings changed elsewhere. Reopen the editor and try again.',
  saveFailed: 'Could not save the model settings.',
}

const zh: typeof en = {
  layer: '{layer} 可选择的模型',
  fallback: '某层未勾选模型时，跟随 DSH 的默认模型。',
  empty: '暂无可用模型。请在 DSH 的模型设置中配置供应商。',
  loading: '正在加载模型…',
  failed: '模型列表加载失败。',
  partial: '部分供应商的模型列表加载失败。',
  unavailable: '模型配置暂不可用。',
  removed: '当前不可用',
  refresh: '重新加载模型',
  edit: '编辑 {model}',
  description: '模型介绍',
  prompt: '模型提示词',
  save: '保存',
  saving: '正在保存…',
  cancel: '取消',
  conflict: '模型设置已在其他位置更改。请重新打开编辑弹窗后重试。',
  saveFailed: '模型设置保存失败。',
}

export function modelSettingsCopy(language: string): typeof en {
  return /^zh(?:[-_]|$)/iu.test(language) ? zh : en
}
