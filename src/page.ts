import { messages, type Language } from './locale.js'

export function documentHtml(nonce: string, language: Language = 'en', integrated = false): string {
  const copy = messages(language)
  // Catalogs are bundled assets. Escape script delimiters even in an inert JSON block.
  const serialized = JSON.stringify(copy).replaceAll('<', '\\u003c')

  return /* HTML */ `
  <!doctype html>
  <html lang="${language}">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover" />
      <meta name="theme-color" content="#fafbf8" />
      <link rel="icon" href="data:," />
      <link rel="stylesheet" href="/prism/style.css" />
      <title>${copy.title}</title>
    </head>
    <body>
      <div id="root" data-integrated="${integrated}"></div>
      <noscript>${copy.noScript}</noscript>
      <script type="application/json" id="prism-copy" nonce="${nonce}">${serialized}</script>
      <script type="module" id="prism-browser" nonce="${nonce}" src="/prism/browser.js"></script>
    </body>
  </html>
`
}

export const stylesheet = /* CSS */ `
:root {
  color-scheme: light;
  --paper: #fafbf8;
  --card: #fff;
  --ink: #172c27;
  --secondary: #50645d;
  --muted: #61716c;
  --line: #dce4de;
  --green: #14694e;
  --pale: #e7f2e9;
  --font: Inter, 'PingFang SC', 'Microsoft YaHei', 'Noto Sans CJK SC', system-ui, sans-serif;
  font-family: var(--font);
  color: var(--ink);
  background: var(--paper);
  font-synthesis: none;
}
* {
  box-sizing: border-box;
}
body {
  margin: 0;
  background: var(--paper);
  min-height: 100vh;
  min-height: 100dvh;
}
button,
textarea {
  font: inherit;
  color: inherit;
}
button {
  cursor: pointer;
}
button:disabled {
  cursor: default;
}
button:focus-visible,
summary:focus-visible,
textarea:focus-visible {
  outline: 2px solid #23765b;
  outline-offset: 4px;
}
[hidden] {
  display: none !important;
}
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}
.topbar {
  height: 74px;
  border-bottom: 1px solid var(--line);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 clamp(18px, 4vw, 60px);
  background: #fcfdfa;
  position: relative;
  z-index: 3;
}
.brand {
  display: flex;
  align-items: center;
  gap: 10px;
  font-weight: 650;
  letter-spacing: 0.025em;
  font-size: 18px;
}
.brand-en {
  font:
    normal italic 19px Georgia,
    serif;
  color: #62776c;
  letter-spacing: -0.05em;
  border-left: 1px solid var(--line);
  padding-left: 11px;
  margin-left: 1px;
}
.prism {
  display: inline-block;
  position: relative;
  width: 27px;
  height: 29px;
  flex-shrink: 0;
}
.prism i {
  position: absolute;
  inset: 0;
}
.prism i:nth-child(1) {
  background: #68ad8a;
  clip-path: polygon(56% 0, 0 72%, 48% 58%);
}
.prism i:nth-child(2) {
  background: #215e48;
  clip-path: polygon(0 72%, 48% 58%, 100% 83%, 51% 100%);
}
.prism i:nth-child(3) {
  background: #9dcc9d;
  clip-path: polygon(56% 0, 48% 58%, 100% 83%);
}
.models {
  margin-inline-start: auto;
  min-width: 0;
}
#composer .model-toggle {
  max-width: min(50vw, 290px);
  min-height: 36px;
  display: flex;
  align-items: center;
  gap: 9px;
  background: #fff;
  border: 1px solid var(--line);
  border-radius: 20px;
  padding: 5px 13px;
  font-size: 12px;
  font-weight: 550;
}
#composer .model-toggle:hover,
.icon-button:hover {
  background: var(--pale);
}
#model-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.chevron {
  display: inline-block;
  width: 7px;
  height: 7px;
  border-right: 1.5px solid currentColor;
  border-bottom: 1.5px solid currentColor;
  transform: rotate(45deg);
  flex-shrink: 0;
  margin: 0 2px 4px;
}
.prism-model-popup .arco-popover-content {
  border: 1px solid var(--line);
  border-radius: 14px;
  background: var(--card);
  box-shadow: 0 12px 32px #193a251c;
  color: var(--ink);
}
.prism-model-popup .arco-popover-inner { padding: 8px; }
#model-menu { width: min(290px, calc(100vw - 64px)); max-height: min(48dvh, 320px); overflow: auto; }
#model-menu h2 { font-size: 12px; font-weight: 500; color: var(--muted); margin: 5px 9px 8px; }
#models .choice {
  display: flex;
  height: auto;
  min-height: 50px;
  width: 100%;
  align-items: center;
  justify-content: space-between;
  gap: 7px;
  text-align: left;
  white-space: normal;
  border: 0;
  border-radius: 9px;
  background: transparent;
  padding: 8px 11px;
  color: var(--ink);
}
#models .choice[aria-selected='true'], #models .choice:hover { background: var(--pale); }
#models .choice:focus-visible { outline-offset: -2px; }
.model-option { display: grid; gap: 3px; min-width: 0; }
.model-option strong { font-weight: 600; font-size: 14px; line-height: 1.5; overflow-wrap: anywhere; }
.model-option small { font-size: 12px; line-height: 1.65; color: var(--secondary); overflow-wrap: anywhere; }
main {
  min-height: calc(100vh - 74px);
  min-height: calc(100dvh - 74px);
  display: flex;
  flex-direction: column;
}
main.empty {
  justify-content: center;
  padding-bottom: clamp(24px, 9vh, 120px);
}
#welcome {
  text-align: center;
  margin: 0 auto 33px;
  padding: 20px 22px 0;
}
.hero-symbol {
  width: 90px;
  height: 76px;
  margin: auto;
  display: grid;
  place-items: center;
  background: radial-gradient(ellipse, #d5e9cda6, transparent 68%);
}
.hero-symbol .prism {
  width: 51px;
  height: 55px;
}
h1 {
  font-size: clamp(30px, 4vw, 46px);
  font-family: 'Noto Serif CJK SC', 'Songti SC', 'STSong', serif;
  letter-spacing: -0.045em;
  font-weight: 500;
  margin: 14px 0 9px;
  line-height: 1.4;
}
.dock {
  position: sticky;
  bottom: 0;
  margin-top: auto;
  background: linear-gradient(transparent, var(--paper) 16px);
  padding: 18px 22px max(11px, env(safe-area-inset-bottom));
  z-index: 2;
}
.empty .dock {
  position: static;
  margin: 0;
  background: transparent;
  padding-top: 0;
}
.dock-inner,
#timeline {
  max-width: 720px;
  margin: auto;
}
#composer {
  background: var(--card);
  border: 1px solid #cbd9cd;
  border-radius: 20px;
  padding: 16px 15px 12px 20px;
  box-shadow: 0 6px 22px #1d44280b;
}
#composer:focus-within {
  border-color: #7da38c;
  box-shadow:
    0 0 0 3px #6598790e,
    0 6px 22px #1d44280b;
}
#draft {
  border: 0;
  outline: none !important;
  resize: none;
  width: 100%;
  background: transparent;
  min-height: 49px;
  max-height: 160px;
  font-size: 15px;
  line-height: 1.65;
  padding: 7px 10px;
}
#draft::placeholder {
  color: var(--muted);
  opacity: 1;
}
.composer-foot {
  position: relative;
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 8px;
  margin-top: 3px;
}
.key-hint {
  font-size: 10.5px;
  color: var(--muted);
}
kbd {
  font: inherit;
}
.key-hint span {
  padding: 0 4px;
}
#send {
  display: grid;
  place-items: center;
  width: 34px;
  height: 34px;
  padding: 0;
  flex-shrink: 0;
  border: 0;
  border-radius: 50%;
  background: #195d46;
  color: white;
}
#send:hover:not(:disabled) {
  background: #0c4632;
}
#send > svg { display: block; }
#send:disabled {
  background: #e5ece5;
  color: #819688;
}
#feedback {
  font-size: 12px;
  line-height: 1.6;
  color: #794c30;
  text-align: center;
  min-height: 22px;
  margin: 5px 0 0;
  overflow-wrap: anywhere;
}
#thread {
  flex: 1;
  padding: 32px 22px 0;
}
#timeline {
  display: flex;
  flex-direction: column;
  gap: 20px;
  min-width: 0;
}
.message {
  max-width: 90%;
  display: grid;
  gap: 6px;
  justify-items: start;
  min-width: 0;
}
.message.user {
  align-self: flex-end;
  justify-items: end;
}
.speaker,
.time {
  font-size: 11px;
  color: var(--muted);
}
.speaker {
  display: flex;
  align-items: center;
  gap: 7px;
}
.speaker .prism {
  width: 15px;
  height: 16px;
}
.message.user > p {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  line-height: 1.8;
  font-size: 15px;
  margin: 0;
  background: var(--pale);
  border-radius: 15px 15px 3px 15px;
  padding: 9px 14px;
}
.prism-markdown {
  min-width: 0;
  max-width: 100%;
  font-size: 15px;
  line-height: 1.7;
  overflow-wrap: anywhere;
}
.prism-markdown > :first-child { margin-top: 0; }
.prism-markdown > :last-child { margin-bottom: 0; }
.prism-markdown ul, .prism-markdown ol { padding-inline-start: 1.5em; }
.prism-markdown a { color: var(--green); }
.prism-markdown code {
  padding: .1em .3em;
  border-radius: 4px;
  background: var(--pale);
}
.prism-markdown pre {
  max-width: 100%;
  padding: 10px 12px;
  overflow-x: auto;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--card);
}
.prism-markdown pre code { padding: 0; background: transparent; }
.prism-markdown blockquote {
  margin-inline: 0;
  padding-inline-start: 12px;
  border-inline-start: 3px solid var(--line);
  color: var(--muted);
}
.prism-markdown table { max-width: 100%; border-collapse: collapse; }
.prism-markdown th, .prism-markdown td { padding: 4px 8px; border: 1px solid var(--line); }
.task {
  border: 1px solid var(--line);
  border-radius: 14px;
  overflow: hidden;
  background: var(--card);
}
.task summary {
  display: flex;
  gap: 10px;
  align-items: center;
  font-size: 13px;
  padding: 13px 15px;
  cursor: pointer;
  list-style: none;
}
.task summary::-webkit-details-marker {
  display: none;
}
.task strong {
  font-weight: 550;
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.speaker strong { color: var(--secondary); font-weight: 600; }
.speaker time { color: var(--muted); font-size: 10px; }
.task-name { flex: 1; display: grid; gap: 3px; min-width: 0; }
.task-name small { color: var(--muted); font-size: 10px; letter-spacing: .08em; }
.status { display: inline-flex; align-items: center; gap: 5px; }
.status:before { content: ''; background: currentColor; width: 5px; height: 5px; border-radius: 50%; }
.task-glyph {
  width: 13px;
  height: 14px;
  border: 1.4px solid #729281;
  border-radius: 3px;
  position: relative;
  flex-shrink: 0;
}
.task-glyph:after {
  content: '';
  position: absolute;
  inset: 4px 2px;
  border-block: 1px solid #729281;
}
.status {
  font-size: 11px;
  white-space: nowrap;
  color: var(--secondary);
  border-radius: 10px;
  background: #edf1ed;
  padding: 2px 7px;
}
.status.running {
  background: #faf0dd;
  color: #79561c;
}
.status.completed {
  background: #e5f3e9;
  color: #23684c;
}
.status.failed {
  background: #fbeae6;
  color: #944b3b;
}
.task[open] > summary .chevron {
  transform: rotate(225deg);
  margin-bottom: -3px;
}
.task-body {
  border-top: 1px solid var(--line);
  padding: 12px 15px;
}
.prism-task-surface.arco-card { border: 0; border-radius: 14px; overflow: hidden; }
.task-body .prism-task-surface { margin-top: 10px; }
@media (max-width: 560px) {
  .topbar {
    height: 60px;
  }
  main {
    min-height: calc(100dvh - 60px);
  }
  .brand {
    font-size: 16px;
  }
.brand-en {
    font-size: 16px;
  }
  .dock {
    padding-inline: 14px;
  }
  #thread {
    padding: 22px 15px 0;
  }
  .message {
    max-width: 95%;
  }
  .task summary {
    padding: 12px 10px;
  }
  .key-hint {
    display: none;
  }
  .composer-foot {
    justify-content: flex-end;
  }
  #welcome {
    margin-bottom: 24px;
  }
  .hero-symbol {
    height: 66px;
  }
  main.empty {
    padding-bottom: 7vh;
  }
}
@media (prefers-reduced-motion: no-preference) {
  button,
  .task,
  #composer .model-toggle {
    transition:
      background 0.15s,
      border-color 0.15s;
  }
}
`
