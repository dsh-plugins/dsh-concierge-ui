const shortcutStyle = `
.prism-sidebar-shortcut {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  height: 32px;
  padding: 6px calc(var(--dsh-sidebar-row-padding, 12px) - var(--dsh-sidebar-paint-inset, 0px));
  box-sizing: border-box;
  border: 0;
  border-inline: var(--dsh-sidebar-paint-inset, 0px) solid transparent;
  border-radius: var(--dsw-radius-md, 8px);
  background: transparent padding-box;
  color: var(--dsw-alias-label-primary, inherit);
  font: inherit;
  font-size: 14px;
  line-height: 20px;
  cursor: pointer;
  user-select: none;
}
.prism-sidebar-shortcut:hover { background-color: var(--dsw-alias-interactive-bg-hover); }
.prism-sidebar-shortcut:focus-visible {
  outline: var(--dsw-focus-ring-width, 2px) solid var(--dsw-focus-ring-color, currentColor);
  outline-offset: -2px;
}
.prism-sidebar-shortcut[data-rail] {
  justify-content: center;
  width: 36px;
  height: 36px;
  padding: 0;
  border-inline: 0;
}
.prism-sidebar-shortcut > span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.prism-sidebar-shortcut > svg { flex: none; }
`

export function PrismShortcut({ wide, label, title }: { wide: boolean; label: string; title: string }) {
  return <>
    <style>{shortcutStyle}</style>
    <button type="button" className="prism-sidebar-shortcut" data-rail={!wide || undefined} aria-label={label}
      title={title} onClick={() => window.location.assign('/prism')}>
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3"
        strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M8 2 2 13h12L8 2Zm0 0v7m-6 4 6-4 6 4" />
      </svg>
      {wide && <span>{label}</span>}
    </button>
  </>
}
