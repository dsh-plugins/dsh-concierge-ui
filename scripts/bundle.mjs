import { build } from 'esbuild'
import { fileURLToPath } from 'node:url'

// This authenticated page has its own React root. Bundle one copy of the
// control library and provide its three host UI primitives locally.
const root = fileURLToPath(new URL('../', import.meta.url))
await build({
  absWorkingDir: root,
  stdin: {
    contents: "import './src/arco-theme.css'; import './src/browser.tsx'",
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
