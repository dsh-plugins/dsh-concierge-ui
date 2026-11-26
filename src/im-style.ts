import type { CSSProperties } from 'react'

const border = '1px solid var(--dsw-alias-border-secondary, #c8ccc9)'
export const ui = {
  stack: {display: 'grid', gap: 12},
  field: {display: 'grid', gap: 5},
  row: {display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap'},
  panel: {display: 'grid', gap: 12, padding: 16, border, borderRadius: 12},
  button: {border, borderRadius: 7, padding: '6px 12px', cursor: 'pointer', background: 'transparent', color: 'inherit', font: 'inherit'},
  input: {border, borderRadius: 6, backgroundColor: 'var(--dsw-alias-bg-primary, transparent)', color: 'inherit', font: 'inherit',
    padding: '7px 10px', width: '100%', boxSizing: 'border-box'},
} satisfies Record<string, CSSProperties>
