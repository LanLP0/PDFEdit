import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
const isElectronBuild = process.env.ELECTRON === '1';
const isGithubActions = process.env.GITHUB_ACTIONS === 'true';

const baseUrl = (() => {
  switch (true) {
    case isGithubActions: return "/PDFEdit/";
    case isElectronBuild: return "./";
    default: return "/";
  }
})()

// https://vite.dev/config/
export default defineConfig({
  base: baseUrl,
  plugins: [
    react(),
    tailwindcss(),
  ]
})
