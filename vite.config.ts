import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  // GitHub Pages serves project sites from /<repo-name>/, so scope asset
  // URLs to that path when building in CI. Local dev still runs at /.
  base: process.env.GITHUB_ACTIONS ? '/into-the-wild/' : '/',
  plugins: [vue()],
})
