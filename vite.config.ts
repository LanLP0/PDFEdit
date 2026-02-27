import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import electron from 'vite-plugin-electron/simple'
import { resolve } from 'node:path'

const isElectronBuild = process.env.ELECTRON === '1';

// https://vite.dev/config/
export default defineConfig({
  base: isElectronBuild ? './' : '/',
  plugins: [
    react(),
    tailwindcss(),
    ...(isElectronBuild
      ? [
        electron({
          main: {
            entry: 'electron/main.ts',
            onstart(args) {
              // In dev mode, restart Electron whenever main.ts is rebuilt
              args.startup();
            },
            vite: {
              build: {
                outDir: 'dist-electron',
                rollupOptions: {
                  external: ['electron'],
                  output: {
                    // Force CJS so Electron (Node) can require() this file.
                    // "type":"module" in package.json would otherwise produce .mjs
                    format: 'cjs',
                    entryFileNames: 'main.js',
                  },
                },
              },
            },
          },
          preload: {
            input: resolve(__dirname, 'electron/preload.ts'),
            vite: {
              build: {
                outDir: 'dist-electron',
                rollupOptions: {
                  external: ['electron'],
                  output: {
                    // Preload MUST be CJS — contextBridge does not work with ESM
                    format: 'cjs',
                    entryFileNames: 'preload.js',
                  },
                },
              },
            },
          },
        }),
      ]
      : []),
  ],
  build: {
    outDir: 'dist',
  },
})
