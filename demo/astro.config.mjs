import { defineConfig } from 'astro/config';

// The demo: one gallery of every effect, for checking changes in a browser,
// and live at effects.lumithemes.com.
export default defineConfig({
	site: 'https://effects.lumithemes.com',
	server: { port: 4400, host: '127.0.0.1' },
	devToolbar: { enabled: false },
	// The library is linked from the parent folder (file:..), whose own node_modules a clean install of demo/ never fills, so
	// its imports of @logomarks/shaders resolve from the demo's node_modules instead (the Cloudflare build failed without it).
	vite: { resolve: { dedupe: ['@logomarks/shaders'] } },
});
