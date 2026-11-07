import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, type Plugin} from 'vite';

// Security headers are injected only into the production build (the dev server needs inline scripts for HMR).
const securityMeta = (): Plugin => ({
  name: 'sdkforge-security-meta',
  apply: 'build',
  transformIndexHtml() {
    const csp = [
      "default-src 'self'",
      "script-src 'self'",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com data:",
      "img-src 'self' data: blob:",
      "connect-src 'self'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'"
    ].join('; ');
    return [
      {tag: 'meta', attrs: {'http-equiv': 'Content-Security-Policy', content: csp}, injectTo: 'head-prepend'},
      {tag: 'meta', attrs: {name: 'referrer', content: 'no-referrer'}, injectTo: 'head-prepend'}
    ];
  }
});

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss(), securityMeta()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
