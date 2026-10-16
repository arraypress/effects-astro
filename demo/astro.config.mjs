import { defineConfig } from 'astro/config';

// The demo: one gallery of every effect, for checking changes in a browser,
// and live at effects.lumithemes.com.
export default defineConfig({
	site: 'https://effects.lumithemes.com',
	server: { port: 4400, host: '127.0.0.1' },
	devToolbar: { enabled: false },
});
