import { defineConfig } from 'tsdown'

/**
 * The CLIENT bundle only. The Host half is plain ESM emitted by `tsc` into
 * `lib/`; tsdown produces the browser plugin as a CommonJS factory registered
 * with the harness ModuleLoader. Everything the browser shell already seeds
 * (React, Cordis, the static client libraries) stays external so the bundle
 * shares the platform's single module identity instead of shipping a copy.
 */
const CLIENT_PLUGIN_ID = 'dsh-baton'

export default defineConfig({
  name: 'dsh-baton-client',
  entry: { client: 'src/client/index.ts' },
  outDir: 'lib',
  format: 'cjs',
  platform: 'neutral',
  target: 'es2022',
  // `tsc` already populated lib/; a clean here would delete the Host build.
  clean: false,
  sourcemap: false,
  dts: false,
  outExtensions: () => ({ js: '.js' }),
  external: [
    'react',
    'react/jsx-runtime',
    'react-dom',
    '@deepseek-ai/cordis',
    '@deepseek-ai/dsh-client-store',
    '@deepseek-ai/dsh-client-ui-slots',
    '@deepseek-ai/dsh-client-ui-primitives',
    '@deepseek-ai/dsh-client-ui-dockkit',
  ],
  outputOptions: {
    banner: `window.__ModuleLoader__.load({ id: ${JSON.stringify(CLIENT_PLUGIN_ID)}, factory: (require) => {`,
    intro: 'var module = { exports: {} }; var exports = module.exports;',
    footer: 'return module.exports; } });',
  },
})
