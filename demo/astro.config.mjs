import { defineConfig } from 'astro/config';

// The demo: every effect on its own page, for checking changes in a browser.
export default defineConfig({ server: { port: 4400, host: '127.0.0.1' }, devToolbar: { enabled: false } });
