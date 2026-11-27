export const modelSettingsStyle = `
.prism-model-settings {
  --prism-model-border: var(--dsw-alias-border-secondary, var(--color-border-2, #8b9095));
  --prism-model-muted: var(--dsw-alias-label-secondary, var(--color-text-2, currentColor));
  display: grid;
  gap: 14px;
}
.prism-model-settings p { margin: 0; }
.prism-model-settings fieldset {
  border: 1px solid var(--prism-model-border);
  border-radius: 12px;
  margin: 0;
  padding: 4px 10px 8px;
  min-inline-size: 0;
}
.prism-model-settings legend { padding: 0 5px; }
.prism-model-group + .prism-model-group {
  border-top: 1px solid var(--prism-model-border);
  margin-top: 5px;
}
.prism-model-provider { padding: 7px 6px 3px; color: var(--prism-model-muted); font-size: 12px; }
.prism-model-row { display: flex; align-items: center; gap: 10px; min-width: 0; padding: 2px 6px; }
.prism-model-row label { display: flex; flex: 1; align-items: center; gap: 9px; min-width: 0; padding: 6px 0; }
.prism-model-row input { margin: 0; flex: none; }
.prism-model-route, .prism-model-unavailable {
  display: block;
  color: var(--prism-model-muted);
  font-size: 12px;
  overflow-wrap: anywhere;
}
.prism-model-name { font-weight: 550; overflow-wrap: anywhere; }
.prism-model-edit {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: none;
  width: 30px;
  height: 30px;
  border: 0;
  border-radius: 7px;
  background: transparent;
  color: inherit;
  cursor: pointer;
}
.prism-model-edit:hover:not(:disabled) { background: var(--dsw-alias-interactive-bg-hover, var(--color-fill-2)); }
.prism-model-edit:disabled { opacity: .45; cursor: default; }
.prism-model-editor-fields { display: grid; gap: 12px; }
.prism-model-editor-fields small { overflow-wrap: anywhere; }
.prism-model-editor-fields label { display: grid; gap: 5px; }
.prism-model-editor-fields textarea {
  box-sizing: border-box;
  width: 100%;
  resize: vertical;
  padding: 8px;
  color: inherit;
  background: transparent;
  border: 1px solid var(--color-border-2, #8b9095);
  border-radius: 7px;
  font: inherit;
}
`
