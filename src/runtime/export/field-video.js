/**
 * @module @arraypress/effects-astro/export/field-video
 *
 * A live effect (a WebGL or Canvas 2D field) and what sits on it, as a looping video: the effect is held
 * (loop.js `holdFrames`) and started again so it runs from time 0, stepped by hand frame by frame at the video's
 * resolution, each frame read into a live snapshot of its element (the lockup, the words, everything over and under
 * the canvas, as the page shows them) and drawn. The same settings make the same frames every time.
 *
 * Few effects repeat exactly, so the loop is closed by a crossfade: the recording runs `fade` seconds past its end and
 * those last frames are faded into the first ones, which the video starts after. The cut back to the start is then
 * invisible, and nothing jumps. An effect that does repeat exactly says so on its element (`data-effect-cycle`, its
 * period in seconds, as the paint drip does): that loop is recorded whole, with no crossfade.
 */

import { holdFrames } from '../loop.js';
import { snapshot } from './snapshot.js';
import { drawSvg } from './raster.js';
import { record } from './video.js';

/**
 * @typedef {object} FieldVideoOptions
 * @property {number} cycle The loop's length in the effect's own time, seconds.
 * @property {number} [speed=1] How much faster than the effect the video plays (the video lasts `cycle / speed`).
 * @property {number} [fade=0.6] The crossfade that closes the loop, seconds of video.
 * @property {number} width The video's width, px (its height follows the element's).
 * @property {number} [fps=30] Frames a second.
 * @property {() => unknown} [restart] Starts the element's effect again (a fresh run, under the hold, from time 0);
 *   without it the effect is held as it is (the recording then depends on where it was).
 * @property {(t: number, canvas: HTMLCanvasElement) => void | Promise<void>} [over] Draws on each finished frame, at
 *   `t` seconds of video (from 0): something that keeps its own time over the effect, as an animated logo does. It is
 *   drawn after the crossfade, so only the effect is faded into its start; what `over` draws must loop by itself.
 * @property {(done: number) => void} [progress] Called with the share done, 0–1.
 * @property {AbortSignal} [signal] Stops it.
 */

/**
 * Waits for the element's finite animations and transitions to end (a canvas fading in as its effect starts), up to
 * `max` ms: the snapshot reads the styles once, so they must be at rest.
 *
 * @param {HTMLElement} el The element.
 * @param {number} [max] The longest wait, ms. Default 2500.
 * @returns {Promise<void>} Once they're done.
 */
async function settled(el, max = 2500) {
	const finite = el.getAnimations({ subtree: true }).filter((a) => {
		const end = a.effect?.getComputedTiming().endTime;
		return typeof end === 'number' && Number.isFinite(end);
	});
	await Promise.race([Promise.allSettled(finite.map((a) => a.finished)), new Promise((r) => setTimeout(r, max))]);
}

/**
 * Which recorded frame each video frame shows, for a loop closed by a crossfade: the recording runs `total + fade`
 * frames; the video starts at frame `fade`, and its last `fade` frames lay the first `fade` (kept) over the tail, more
 * each frame, so the video's last frame leads straight back into its first. With `fade` 0 the video is the recording.
 *
 * @param {number} total The video's frames.
 * @param {number} fade The crossfade's frames.
 * @returns {(n: number) => { frame: number, over: { frame: number, alpha: number } | null }} For video frame `n`: the
 *   recorded frame it shows, and the kept frame laid over it, at what opacity.
 */
export function loopPlan(total, fade) {
	return (n) => {
		const frame = n + fade;
		return { frame, over: frame >= total ? { frame: frame - total, alpha: (frame - total + 1) / (fade + 1) } : null };
	};
}

/**
 * Frames of a held effect under an element: each `frame(i)` steps the effect to frame `i`'s time and draws the
 * element (effect, lockup and all) onto a canvas. Used by `recordField`, and on its own to read frames (tests, stills).
 *
 * @param {HTMLElement} el The element (shown, laid out, its effect running).
 * @param {{ width: number, fps?: number, speed?: number, restart?: () => unknown }} o The frames' width, rate, speed
 *   and how to start the effect again.
 * @returns {Promise<{ width: number, height: number, cycle: number | null, frame: (i: number, canvas?: HTMLCanvasElement) => Promise<HTMLCanvasElement>, release: () => void }>}
 *   The frames' size, the effect's own exact loop when it declares one (seconds; null otherwise), a frame by number,
 *   and `release` (gives the effect back to the page).
 */
export async function fieldFrames(el, { width, fps = 30, speed = 1, restart }) {
	const ratio = width / Math.max(1, el.offsetWidth);
	const hold = holdFrames(el, { ratio });
	try {
		if (restart) await restart();
		await hold.ready();
		hold.seek(0);
		// the card shows its canvas once the effect runs (a fade): read its styles once that has ended
		await settled(el);
		hold.seek(0);
		const snap = await snapshot(el, { live: true });
		const k = width / snap.width;
		// even sizes: a video encoder takes nothing else
		const w = 2 * Math.round((snap.width * k) / 2),
			h = 2 * Math.round((snap.height * k) / 2);
		let first = true;
		const host = /** @type {HTMLElement | null} */ (el.matches('[data-effect-cycle]') ? el : el.querySelector('[data-effect-cycle]'));
		const declared = Number(host?.dataset.effectCycle);
		return {
			width: w,
			height: h,
			cycle: declared > 0 ? declared : null,
			async frame(i, canvas = document.createElement('canvas')) {
				hold.seek(((i / fps) * speed) * 1000);
				snap.canvases();
				// the first frame waits for the SVG's fonts; after that they're cached
				await drawSvg(snap.svg(k), w, h, canvas, first ? 300 : 0);
				first = false;
				return canvas;
			},
			release: () => hold.release(),
		};
	} catch (e) {
		hold.release();
		throw e;
	}
}

/**
 * Records a live effect and what sits on it as a seamless looping video (MP4, or WebM where the browser can't encode
 * H.264), from a fresh start at time 0.
 *
 * @param {HTMLElement} el The element (shown, laid out, its effect running).
 * @param {FieldVideoOptions} o The loop and the video.
 * @returns {Promise<{ blob: Blob, ext: string, type: string }>} The video.
 */
export async function recordField(el, o) {
	const fps = o.fps ?? 30;
	const speed = o.speed ?? 1;
	const src = await fieldFrames(el, { width: o.width, fps, speed, restart: o.restart });
	try {
		// an effect that repeats exactly is recorded for its own loop, whole; any other for `cycle`, closed by a crossfade
		const exact = src.cycle;
		const duration = (exact ?? o.cycle) / speed;
		const total = Math.round(duration * fps);
		const fadeN = exact ? 0 : Math.min(Math.round((o.fade ?? 0.6) * fps), Math.floor(total / 2));
		const plan = loopPlan(total, fadeN);
		// the first `fadeN` frames are kept: the video starts after them, and its last frames fade into them
		/** @type {ImageBitmap[]} */
		const head = [];
		const scratch = document.createElement('canvas');
		for (let i = 0; i < fadeN; i++) {
			if (o.signal?.aborted) throw new DOMException('Recording stopped', 'AbortError');
			await src.frame(i, scratch);
			head.push(await createImageBitmap(scratch));
		}
		const video = await record({
			width: src.width,
			height: src.height,
			fps,
			duration,
			signal: o.signal,
			progress: o.progress,
			draw: async (t, canvas) => {
				const { frame, over } = plan(Math.round(t * fps));
				await src.frame(frame, canvas);
				if (over) {
					// the tail fades into the head: the video's last frame leads straight back into its first
					const ctx = /** @type {CanvasRenderingContext2D} */ (canvas.getContext('2d'));
					ctx.save();
					ctx.globalAlpha = over.alpha;
					ctx.drawImage(head[over.frame], 0, 0, canvas.width, canvas.height);
					ctx.restore();
				}
				if (o.over) await o.over(t, canvas);
			},
		});
		for (const b of head) b.close();
		return video;
	} finally {
		src.release();
		// the effect runs on afresh, on the page's own clock
		if (o.restart) await o.restart();
	}
}
