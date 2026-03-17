import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { yakataApiPlugin } from './src/server/api-plugin.ts';

export default defineConfig({
  plugins: [react(), yakataApiPlugin()],
  server: {
    port: 5555,
    open: true,
  },
});
