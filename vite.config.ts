import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { yakataApiPlugin } from './src/server/api-plugin.ts';

export default defineConfig({
  base: process.env.GITHUB_ACTIONS ? '/yakata-editor/' : '/',
  plugins: [react(), yakataApiPlugin()],
  server: {
    port: 5555,
    open: true,
  },
});
