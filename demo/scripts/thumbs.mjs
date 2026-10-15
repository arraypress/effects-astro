/**
 * Captures the gallery's thumbnails: opens every effect's page in headless
 * Chrome (with the GPU on, so WebGL draws), sweeps the pointer across the
 * middle so the interactive ones respond, and saves a 640×400 JPEG to
 * public/thumbs/<slug>.jpg. Needs the demo running (`npm run dev`) and
 * Google Chrome; macOS only, as it converts with `sips`.
 *
 *   node scripts/thumbs.mjs [base-url] [slug…]
 */

import { spawn, execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { GALLERY, pageOf } from '../src/gallery.js';

const [base = 'http://127.0.0.1:4400', ...only] = process.argv.slice(2);
const out = join(dirname(fileURLToPath(import.meta.url)), '../public/thumbs');
const WIDTH = 1280;
const HEIGHT = 800;
const PORT = 9471;
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

/**
 * Waits.
 *
 * @param {number} ms Milliseconds.
 * @returns {Promise<void>} Resolves after them.
 */
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const profile = mkdtempSync(join(tmpdir(), 'thumbs-'));
const chrome = spawn(CHROME, ['--headless=new', '--hide-scrollbars', '--enable-gpu', '--ignore-gpu-blocklist', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' });

/** @type {{ webSocketDebuggerUrl: string } | undefined} */
let target;
for (let i = 0; i < 50 && !target; i++) {
	await sleep(200);
	try {
		target = (await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()).find((/** @type {any} */ t) => t.type === 'page');
	} catch {
		// Chrome is still starting.
	}
}
if (!target) throw new Error('Chrome did not start');

const socket = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve) => socket.addEventListener('open', resolve));
let id = 0;
/** @type {Map<number, (result: any) => void>} */
const waiting = new Map();
socket.addEventListener('message', (e) => {
	const message = JSON.parse(String(e.data));
	waiting.get(message.id)?.(message.result);
	waiting.delete(message.id);
});

/**
 * Sends a DevTools command.
 *
 * @param {string} method The command.
 * @param {object} [params] Its parameters.
 * @returns {Promise<any>} Its result.
 */
const send = (method, params = {}) =>
	new Promise((resolve) => {
		waiting.set(++id, resolve);
		socket.send(JSON.stringify({ id, method, params }));
	});

await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride', { width: WIDTH, height: HEIGHT, deviceScaleFactor: 1, mobile: false });

for (const entry of GALLERY.filter((e) => !only.length || only.includes(e.slug))) {
	await send('Page.navigate', { url: `${base}${entry.thumb ?? pageOf(entry)}?bare` });
	await sleep(2200);
	for (let k = 0; k <= 30; k++) {
		const t = k / 30;
		await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: WIDTH * (0.3 + t * 0.4), y: HEIGHT * (0.5 + Math.sin(t * 5) * 0.08) });
		await sleep(16);
	}
	await sleep(500);
	const shot = await send('Page.captureScreenshot', { format: 'png' });
	const png = join(profile, `${entry.slug}.png`);
	writeFileSync(png, Buffer.from(shot.data, 'base64'));
	execFileSync('sips', ['-z', '400', '640', '-s', 'format', 'jpeg', '-s', 'formatOptions', '78', png, '--out', join(out, `${entry.slug}.jpg`)], { stdio: 'ignore' });
	console.log(entry.slug);
}

socket.close();
// Let Chrome finish writing its profile before it is removed.
const exited = new Promise((resolve) => chrome.once('exit', resolve));
chrome.kill();
await exited;
rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
