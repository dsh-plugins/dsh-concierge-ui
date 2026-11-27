import { build } from 'esbuild'
import { fileURLToPath } from 'node:url'

// This authenticated page has its own React root. Bundle one copy of the
// control library and provide its three host UI primitives locally.
const root = fileURLToPath(new URL('../', import.meta.url))
await build({
  absWorkingDir: root,
  stdin: {
    contents: "import './src/arco-theme.css'; import './src/composer-attachments.css'; import './src/browser.tsx'",
    resolveDir: root,
    sourcefile: 'prism-client.ts',
  },
  outfile: 'dist/client/prism.js',
  bundle: true,
  format: 'esm',
  platform: 'browser',
  target: 'es2022',
  minify: true,
  legalComments: 'inline',
  alias: {
    '@dsh-plugin/dsh-loader/client': './src/arco-host.ts',
  },
  define: {
    'process.env.NODE_ENV': '"production"',
  },
})

// The native DSH shell loads Cordis client plugins as named module factories.
// Shared React must come from the shell that owns the settings and sidebar slots.
await build({
  absWorkingDir: root,
  entryPoints: ['src/dsh-client.tsx'],
  outfile: 'dist/client/dsh.js',
  bundle: true,
  format: 'cjs',
  platform: 'browser',
  target: 'es2022',
  minify: true,
  external: ['react', 'react/jsx-runtime', 'react-dom', 'react-dom/client', '@dsh-plugin/dsh-loader/client'],
  banner: { js: "window.__ModuleLoader__.load({id:'@dsh-prism/dsh-concierge-ui',factory:require=>{const module={exports:{}};const exports=module.exports;" },
  footer: { js: 'return module.exports}});' },
})
