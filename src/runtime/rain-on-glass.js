/**
 * @module @arraypress/effects-astro/rain-on-glass
 *
 * Rain on a window over a photo, like looking out of a café on a wet
 * evening. Small beads sit on the glass; larger drops slide down it in
 * fits and starts, leaving clear trails that bead up and fog over again.
 * Each drop is a little lens, holding the photo sharp and upside down; the
 * rest of the photo is soft behind the condensation, its lights opened
 * into bokeh. The pointer wipes a clear patch that fogs back over.
 *
 * Transparent until the photo has loaded, then fading in over the `<img>`
 * under it (the component's), which is what shows without WebGL. With
 * reduced motion it is one still frame, drops and all.
 */

import { createStage } from './stage.js';
import { parseColor } from './color.js';
import { trail } from './pointer.js';
import { watchColors } from './mount.js';
import { pickColors } from './palettes.js';
import { loadImage, imageTexture, coverScale } from './image.js';
import { backdrop } from './rain-on-glass/backdrop.js';
import { createWipe } from './rain-on-glass/wipe.js';
import { FRAG } from './rain-on-glass/shader.js';

/**
 * @typedef {object} RainOnGlassConfig
 * @property {string} src The photo behind the glass (same origin, or served with CORS).
 * @property {number} [rain=0.6] How much rain, 0–1: beads on the glass and drops running down it.
 * @property {number} [blur=0.6] How soft the photo is behind the glass, 0–1.
 * @property {number} [fog=0.5] How thick the condensation is, 0–1.
 * @property {number} [speed=1] How fast the drops run and the beads come and go, 0–3.
 * @property {boolean} [interactive=true] The pointer wipes a clear patch that fogs back over.
 * @property {string} [tint='#a3b8cc'] The colour of the fog.
 * @property {number} [bokeh=0.6] How strongly the photo's lights open into bokeh discs, 0–1.
 * @property {string[]} [colors] Colours for the bokeh discs (default: each light's own).
 * @property {string} [palette] A shared palette by name (PALETTES; any case), when there are no `colors`.
 */

/** CSS pixels to a unit of glass, the scale the drops are sized in. */
const UNIT = 720;
/** Seconds into the rain the first frame is, so it opens mid-shower; and the moment the still frame shows. */
const OPENING = 40;
/** The wiping brush's radius, CSS pixels. */
const BRUSH = 58;
/** Seconds the canvas takes to fade in over the `<img>` once the photo has loaded. */
const FADE = 0.9;
/** Cells across the wipe grid. */
const WIPE_CELLS = 96;
/** The largest side the photo is put on the GPU at, pixels. */
const LARGEST = 2560;

/**
 * Starts rain on glass on an element: a canvas inside it, filling it.
 *
 * @param {HTMLElement} el The element (its first canvas is drawn into).
 * @param {RainOnGlassConfig} config The settings.
 * @returns {() => void} Stops it.
 */
export function rainOnGlass(el, config) {
	const speed = config.speed ?? 1;
	const blur = clamp01(config.blur ?? 0.6);
	const bokeh = clamp01(config.bokeh ?? 0.6);
	const interactive = config.interactive ?? true;
	let colors = pickColors(config, []);
	const strokes = trail(el, { step: 0.01, max: 24 });
	const start = performance.now();
	/** @type {HTMLImageElement | null} */
	let photo = null;
	/** @type {WebGLTexture | null} */
	let softTexture = null;
	/** @type {WebGLTexture | null} */
	let photoTexture = null;
	/** @type {WebGLTexture | null} */
	let wipeTexture = null;
	let wipe = createWipe(1, 1);
	let shown = 0;
	let stopped = false;

	const { stage, stop } = createStage(el, {
		fragment: FRAG,
		setup({ gl, uniform }) {
			gl.uniform1i(uniform('uPhoto'), 0);
			gl.uniform1i(uniform('uSoft'), 1);
			gl.uniform1i(uniform('uWipe'), 2);
			gl.uniform1f(uniform('uRain'), clamp01(config.rain ?? 0.6));
			gl.uniform1f(uniform('uFog'), clamp01(config.fog ?? 0.5));
			gl.uniform1f(uniform('uClearBias'), 0.5 + blur * 1.5);
			gl.uniform3fv(uniform('uTint'), parseColor(config.tint ?? '#a3b8cc'));
			gl.activeTexture(gl.TEXTURE2);
			wipeTexture = gl.createTexture();
			gl.bindTexture(gl.TEXTURE_2D, wipeTexture);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
			return () => [photoTexture, softTexture, wipeTexture].forEach((t) => gl.deleteTexture(t));
		},
		resize(s) {
			s.gl.uniform1f(s.uniform('uUnit'), s.ratio * UNIT);
			fit(s);
			// A fresh, fogged wipe grid in the canvas's proportions.
			wipe = createWipe(WIPE_CELLS, Math.min(240, Math.max(12, Math.round((WIPE_CELLS * s.canvas.height) / s.canvas.width))));
			upload(s.gl, true);
		},
		uniforms({ gl, uniform, still }, now, dt) {
			if (photo && shown < 1) {
				shown = still ? 1 : Math.min(1, shown + dt / FADE);
				if (shown === 1) el.dataset.drawn = '';
			}
			if (interactive && !still) {
				const radius = BRUSH / Math.max(1, el.clientHeight);
				for (const p of strokes.read(dt)) wipe.stamp(p.x, p.y, radius);
			}
			if (wipe.settle(dt)) upload(gl, false);
			gl.uniform1f(uniform('uTime'), OPENING + (still ? 0 : ((now - start) / 1000) * speed));
			gl.uniform1f(uniform('uShow'), shown * shown * (3 - 2 * shown));
		},
	});
	if (!stage) return stop;
	const { gl } = stage;

	/**
	 * Sets how the photo is cropped to cover the canvas, once it has loaded.
	 *
	 * @param {import('./stage.js').Stage} s The stage.
	 */
	function fit(s) {
		if (!photo) return;
		s.gl.useProgram(s.program);
		s.gl.uniform2fv(s.uniform('uCover'), coverScale(photo.width / photo.height, s.canvas.width / s.canvas.height));
	}

	/**
	 * Puts the wipe grid on the GPU.
	 *
	 * @param {import('./gl.js').GL} gl The context.
	 * @param {boolean} fresh The grid is new (a new size): allocate the texture again.
	 */
	function upload(gl, fresh) {
		gl.activeTexture(gl.TEXTURE2);
		gl.bindTexture(gl.TEXTURE_2D, wipeTexture);
		gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
		if (fresh) gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, wipe.width, wipe.height, 0, gl.LUMINANCE, gl.UNSIGNED_BYTE, wipe.bytes);
		else gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, wipe.width, wipe.height, gl.LUMINANCE, gl.UNSIGNED_BYTE, wipe.bytes);
	}

	/** Makes the soft, bokeh'd copy of the photo in the current colours and puts it on the GPU. */
	function soften() {
		if (!photo) return;
		gl.activeTexture(gl.TEXTURE1);
		gl.deleteTexture(softTexture);
		softTexture = imageTexture(gl, backdrop(photo, { blur, bokeh, colors }));
	}

	loadImage(config.src)
		.then((img) => {
			if (stopped) return;
			photo = img;
			gl.activeTexture(gl.TEXTURE0);
			photoTexture = imageTexture(gl, within(img, Math.min(LARGEST, gl.getParameter(gl.MAX_TEXTURE_SIZE))), { mipmap: true });
			soften();
			fit(stage);
			if (stage.still) stage.redraw();
		})
		.catch((error) => {
			console.warn('[effects-astro]', error);
			stop();
		});

	const unwatch = watchColors(el, (next) => {
		colors = next.colors;
		soften();
		if (stage.still) stage.redraw();
	});
	return () => {
		stopped = true;
		stop();
		unwatch();
		delete el.dataset.drawn;
	};
}

/**
 * A picture no larger than `largest` on either side: itself, or a copy
 * scaled down on a canvas.
 *
 * @param {HTMLImageElement} img The picture.
 * @param {number} largest The most pixels a side may have.
 * @returns {HTMLImageElement | HTMLCanvasElement} It, or its smaller copy.
 */
function within(img, largest) {
	const scale = largest / Math.max(img.width, img.height);
	if (scale >= 1) return img;
	const canvas = document.createElement('canvas');
	canvas.width = Math.round(img.width * scale);
	canvas.height = Math.round(img.height * scale);
	canvas.getContext('2d')?.drawImage(img, 0, 0, canvas.width, canvas.height);
	return canvas;
}

/**
 * Clamps a number to 0–1.
 *
 * @param {number} n The number.
 * @returns {number} It, clamped.
 */
function clamp01(n) {
	return Math.min(1, Math.max(0, n));
}
