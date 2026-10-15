/**
 * @module @arraypress/effects-astro/mosaic-reveal
 *
 * A slideshow whose pictures change through a GPU transition: a grid of
 * tiles flipping over in a diagonal wave, the picture melting into sorted
 * streaks that settle as the next, blocks coarsening and refining into the
 * next, or a noise dissolve with a glowing, scorching edge. One fragment
 * shader with the two pictures as textures and the change's progress.
 *
 * The pictures are real `<img>` elements, so they are read out, shown
 * without WebGL, and shown before the canvas has drawn: the canvas lies
 * over them once it has. With prefers-reduced-motion, or without WebGL,
 * the images change with a short crossfade (or at once) instead.
 *
 * It sleeps between changes: the canvas is drawn only while one runs and
 * after a resize. When to change (the timer, keys, swipes, dots) is
 * src/runtime/slideshow.js.
 */

import { createStage } from './stage.js';
import { animate } from './loop.js';
import { parseColor, toOklab, GLSL_OKLAB } from './color.js';
import { prefersReducedMotion } from './device.js';
import { watchColors } from './mount.js';
import { GLSL_NOISE } from './glsl.js';
import { pickColors } from './palettes.js';
import { loadImage, imageTexture, coverScale, GLSL_COVER } from './image.js';
import { slideshow, wrap } from './slideshow.js';

/**
 * @typedef {'tiles' | 'pixel-sort' | 'pixelate' | 'dissolve'} MosaicTransition
 */

/**
 * @typedef {object} MosaicRevealConfig
 * @property {MosaicTransition} [transition='tiles'] How one picture becomes the next.
 * @property {number} [interval=5] Seconds each picture stays.
 * @property {number} [duration=1.6] Seconds a change takes.
 * @property {number} [tiles=9] Tiles across the longer side; also the coarsest blocks for `pixelate`.
 * @property {boolean} [autoplay=true] Move on by itself.
 * @property {string[]} [colors] The dissolve's glowing edge: its outer colour, then its core (default amber, cream).
 * @property {string} [palette] A shared palette by name (PALETTES; any case), when there are no `colors`.
 * @property {string} [background='#0c0b0a'] What shows between the tiles as they flip.
 * @property {'fade' | 'swap'} [reducedMotion='fade'] With prefers-reduced-motion: a short crossfade, or a swap at once.
 */

/** The shader's number for each transition. */
const MODES = { tiles: 0, 'pixel-sort': 1, pixelate: 2, dissolve: 3 };

/** The default glow: amber round a cream core. */
const COLORS = ['#ff6a1a', '#ffe2b0'];

/** How long a calm crossfade takes, ms. */
const FADE = 450;

const FRAG = `
precision highp float;
uniform vec2 uRes;
uniform sampler2D uFrom;
uniform sampler2D uTo;
uniform vec2 uFromScale;
uniform vec2 uToScale;
uniform float uProgress;
uniform float uMode;
uniform float uDir;
uniform vec2 uGrid;
uniform float uPx;
uniform float uSeed;
uniform vec3 uGround;
uniform vec3 uGlow[2];
${GLSL_NOISE}
${GLSL_OKLAB}
${GLSL_COVER}

const float PI = 3.14159265;

// A picture at a 0–1 box coordinate (y up), cropped to cover the box.
vec3 pic(sampler2D t, vec2 scale, vec2 uv) {
	vec2 c = coverUv(uv, scale);
	return texture2D(t, vec2(c.x, 1.0 - c.y)).rgb;
}
vec3 from(vec2 uv) { return pic(uFrom, uFromScale, uv); }
vec3 to(vec2 uv) { return pic(uTo, uToScale, uv); }

// Tiles flipping over in a wave from one corner: the old picture on their
// fronts, the new on their backs, each lifting off the ground as it turns.
vec3 tiles(vec2 uv, float p) {
	vec2 g = uv * uGrid;
	vec2 cell = floor(g);
	vec2 local = fract(g) - 0.5;
	float d = (cell.x + uGrid.y - 1.0 - cell.y) / max(uGrid.x + uGrid.y - 2.0, 1.0);
	d = uDir > 0.0 ? d : 1.0 - d;
	d = d * 0.8 + hash(cell + uSeed) * 0.2;
	float lp = clamp((p - d * 0.58) / 0.42, 0.0, 1.0);
	if (lp <= 0.0) return from(uv);
	if (lp >= 1.0) return to(uv);
	lp = lp < 0.5 ? 4.0 * lp * lp * lp : 1.0 - pow(-2.0 * lp + 2.0, 3.0) * 0.5;
	float a = lp * PI;
	float c = cos(a), s = sin(a);
	// Turning about its vertical axis, in perspective: the near edge grows.
	float lift = 1.0 - 0.14 * s;
	vec2 q = local / lift;
	float den = c + q.x * s * 0.36;
	float xs = q.x / den;
	float ys = q.y * (1.0 - xs * s * 0.36);
	float px = uGrid.y / uRes.y / lift;
	float cover = abs(den) < 1e-4 ? 0.0 : clamp(min((0.5 - abs(xs)) * abs(den), 0.5 - abs(ys)) / px, 0.0, 1.0);
	// Barely lifted, a tile still fills its cell: no seam round it.
	cover = mix(1.0, cover, smoothstep(0.0, 0.3, s));
	vec2 centre = (cell + 0.5) / uGrid;
	vec3 ground = uGround * (0.85 + 0.15 * s) + 0.12 * mix(from(centre), to(centre), lp);
	if (cover <= 0.0) return ground;
	bool front = c > 0.0;
	vec2 at = (cell + 0.5 + vec2(front ? xs : -xs, ys)) / uGrid;
	vec3 col = front ? from(at) : to(at);
	vec3 n = front ? vec3(-s, 0.0, c) : vec3(s, 0.0, -c);
	float shade = mix(0.5, 1.0, abs(c));
	float glint = pow(max(dot(n, normalize(vec3(-0.55, 0.3, 1.0))), 0.0), 16.0) * s * 0.4;
	return mix(ground, col * shade + glint, cover);
}

// Six taps down a span of a column, sorted dark to light, and the colour
// at t (0 at the span's foot, 1 at its head) along the sorted run.
#define ORDER(a, b) if (a.w > b.w) { vec4 t_ = a; a = b; b = t_; }
// Off the top or bottom, a melt reads the picture mirrored rather than smearing its edge.
vec2 mirrorY(vec2 uv) {
	return vec2(uv.x, 1.0 - abs(1.0 - abs(uv.y)));
}
vec4 tap(sampler2D t, vec2 scale, vec2 uv) {
	vec3 c = pic(t, scale, mirrorY(uv));
	return vec4(c, dot(c, vec3(0.2126, 0.7152, 0.0722)));
}
vec3 sortedRun(sampler2D t, vec2 scale, float x, float foot, float len, float at) {
	float k = len / uRes.y;
	float y = foot / uRes.y;
	vec4 s0 = tap(t, scale, vec2(x, y + k * 0.0833));
	vec4 s1 = tap(t, scale, vec2(x, y + k * 0.25));
	vec4 s2 = tap(t, scale, vec2(x, y + k * 0.4167));
	vec4 s3 = tap(t, scale, vec2(x, y + k * 0.5833));
	vec4 s4 = tap(t, scale, vec2(x, y + k * 0.75));
	vec4 s5 = tap(t, scale, vec2(x, y + k * 0.9167));
	ORDER(s0, s5) ORDER(s1, s3) ORDER(s2, s4) ORDER(s1, s2) ORDER(s3, s4) ORDER(s0, s3)
	ORDER(s2, s5) ORDER(s0, s1) ORDER(s2, s3) ORDER(s4, s5) ORDER(s1, s2) ORDER(s3, s4)
	float i = clamp(at, 0.0, 1.0) * 5.0;
	vec3 c = mix(s0.rgb, s1.rgb, clamp(i, 0.0, 1.0));
	c = mix(c, s2.rgb, clamp(i - 1.0, 0.0, 1.0));
	c = mix(c, s3.rgb, clamp(i - 2.0, 0.0, 1.0));
	c = mix(c, s4.rgb, clamp(i - 3.0, 0.0, 1.0));
	return mix(c, s5.rgb, clamp(i - 4.0, 0.0, 1.0));
}

// One picture melted into sorted streaks: its columns slide down and break
// into spans whose colours run dark to light. melt 0 is the picture.
vec3 melt(sampler2D t, vec2 scale, float melt, float fall) {
	float w = 2.0 * uPx;
	float col = floor(gl_FragCoord.x / w);
	float x = (col + 0.5) * w / uRes.x;
	// Neighbouring columns move together in bands, each a little its own way,
	// so the spans line up into runs with ragged ends.
	float band = noise(vec2(col * 0.035, uSeed));
	float grain = hash(vec2(col, uSeed));
	float y = gl_FragCoord.y + fall * melt * melt * uRes.y * 0.3 * (0.25 + 0.75 * band) * uDir;
	float len = max(1.0, melt * uRes.y * (0.1 + 0.45 * band) * (0.85 + 0.3 * grain));
	float off = (noise(vec2(col * 0.02, uSeed + 5.0)) + 0.1 * grain) * len;
	float foot = floor((y + off) / len) * len - off;
	vec3 sorted = sortedRun(t, scale, x, foot, len, (y - foot) / len);
	vec3 plain = pic(t, scale, mirrorY(vec2(gl_FragCoord.x, y) / uRes));
	return mix(plain, sorted, smoothstep(0.0, 0.2, melt));
}

// Each column melts until its own moment, turns to the next picture's
// streaks, and those settle.
vec3 pixelSort(float p) {
	float w = 2.0 * uPx;
	float col = floor(gl_FragCoord.x / w);
	float turn = 0.5 + (noise(vec2(col * 0.06, uSeed + 3.0)) - 0.5) * 0.36;
	float e = p < turn ? p / turn : (1.0 - p) / (1.0 - turn);
	e = e * e * (3.0 - 2.0 * e);
	return p < turn ? melt(uFrom, uFromScale, e, 1.0) : melt(uTo, uToScale, e, -1.0);
}

// Blocks that coarsen in steps to the tile grid and refine again, the
// coarsest blocks turning to the next picture one by one at the peak.
vec3 pixelate(float p) {
	float m = 1.0 - abs(2.0 * p - 1.0);
	m = m * m * (3.0 - 2.0 * m);
	float steps = floor(log2(max(max(uRes.x, uRes.y) / max(uGrid.x, uGrid.y), 2.0)) + 0.5);
	float coarsest = exp2(steps);
	float block = exp2(floor(m * steps + 0.5));
	vec2 frag = gl_FragCoord.xy - uRes * 0.5;
	vec2 at = ((floor(frag / block) + 0.5) * block + uRes * 0.5) / uRes;
	float turn = 0.5 + (hash(floor(frag / coarsest) + uSeed) - 0.5) * 0.22;
	return p < turn ? from(at) : to(at);
}

// The new picture eating through the old along noise, the old scorching
// just ahead of a glowing edge.
vec3 dissolve(vec2 uv, float p) {
	vec2 a = vec2(uv.x * uRes.x / uRes.y, uv.y);
	float n = fbm(a * 2.2 + uSeed) * 0.82 + noise(a * 26.0 - uSeed) * 0.18;
	n = (n - 0.3) / 0.4;
	float w = 0.05;
	float t = mix(-0.5, 1.5, p);
	float d = n - t;
	float fresh = smoothstep(0.004, -0.004, d);
	vec3 old = from(uv) * mix(1.0, 0.18, smoothstep(2.5 * w, 0.0, d));
	vec3 col = mix(old, to(uv), fresh);
	float g = d > 0.0 ? exp(-d / w * 2.6) : exp(d / w * 9.0);
	vec3 glow = fromOklab(mix(uGlow[0], uGlow[1], smoothstep(0.35, 1.0, g)));
	return col + glow * g * 1.6;
}

void main() {
	vec2 uv = gl_FragCoord.xy / uRes;
	float p = uProgress;
	vec3 col;
	if (p <= 0.0) col = from(uv);
	else if (p >= 1.0) col = to(uv);
	else if (uMode < 0.5) col = tiles(uv, p);
	else if (uMode < 1.5) col = pixelSort(p);
	else if (uMode < 2.5) col = pixelate(p);
	else col = dissolve(uv, p);
	gl_FragColor = vec4(col, 1.0);
}
`;

/**
 * The tile grid for a box: `tiles` across its longer side and as many
 * along the shorter as keeps them square, at least one.
 *
 * @param {number} tiles Tiles across the longer side.
 * @param {number} aspect The box's width over its height.
 * @returns {[number, number]} Tiles across and down.
 */
export function tileGrid(tiles, aspect) {
	const n = Math.max(1, Math.round(tiles));
	return aspect >= 1 ? [n, Math.max(1, Math.round(n / aspect))] : [Math.max(1, Math.round(n * aspect)), n];
}

/**
 * The dissolve's glow as `uGlow` takes it: its outer colour and its core,
 * in Oklab, so the shader blends them there. One colour serves as both.
 *
 * @param {string[]} colors The outer colour, then the core.
 * @returns {Float32Array} Six channels.
 */
export function glowUniform(colors) {
	return new Float32Array([colors[0], colors[1] ?? colors[0]].flatMap((c) => toOklab(parseColor(c))));
}

/**
 * @typedef {object} Picture
 * @property {WebGLTexture} texture It, on the GPU.
 * @property {number} aspect Its width over its height.
 */

/**
 * Starts a mosaic slideshow on an element: its `img[data-slide]` pictures,
 * a canvas laid over them, and the `[data-slide-dot]` and `[data-slide-live]` parts
 * slideshow.js runs.
 *
 * @param {HTMLElement} el The element.
 * @param {MosaicRevealConfig} config The settings.
 * @returns {() => void} Stops it.
 */
export function mosaicReveal(el, config) {
	const slides = /** @type {HTMLImageElement[]} */ ([...el.querySelectorAll('img[data-slide]')]);
	if (slides.length < 2) return () => {};
	const duration = Math.max(0.1, config.duration ?? 1.6) * 1000;
	const reduced = prefersReducedMotion();
	let glow = glowUniform(pickColors(config, COLORS, (palette) => [palette.colors[0], palette.glint]));
	/** Where the slideshow is: the picture on show, and the change being drawn. */
	const state = {
		current: 0,
		/** @type {{ from: Picture, to: Picture, dir: 1 | -1, start: number, seed: number, done: () => void } | null} */
		run: null,
		stopped: false,
	};
	/** @type {Map<number, Promise<Picture | null>>} */
	const pictures = new Map();
	/** @type {Picture | null} */
	let shown = null;
	let retired = false;

	/**
	 * Shows one image element, laid over any other left showing, and hides
	 * the rest from sight and from assistive technology.
	 *
	 * @param {number} i The slide.
	 * @param {number} [keep] A slide to leave showing beneath it.
	 */
	const present = (i, keep = -1) => {
		slides.forEach((img, k) => {
			img.hidden = k !== i && k !== keep;
			img.classList.toggle('is-front', k === i);
		});
	};

	/**
	 * A change made with the image elements alone: a crossfade, or a swap
	 * when `ms` is 0.
	 *
	 * @param {number} to The slide coming in.
	 * @param {number} from The slide going.
	 * @param {number} ms How long the fade takes.
	 * @returns {Promise<void>} Settles when it is done.
	 */
	const fade = async (to, from, ms) => {
		const img = slides[to];
		present(to, from);
		await img.decode().catch(() => {});
		if (ms > 0 && !state.stopped) await img.animate([{ opacity: 0 }, { opacity: 1 }], { duration: ms, easing: 'ease' }).finished.catch(() => {});
		if (!state.stopped && state.current === to) present(to);
	};

	/**
	 * Loads the image element's picture ahead of time, for a crossfade.
	 *
	 * @param {number} i The slide.
	 */
	const warm = (i) => {
		loadImage(slides[wrap(i, slides.length)].src).catch(() => {});
	};

	const calm = reduced ? (config.reducedMotion === 'swap' ? 0 : FADE) : FADE;
	/**
	 * Without the GPU: crossfade (or swap), and load the next picture.
	 *
	 * @param {number} to The slide coming in.
	 * @param {number} from The slide going.
	 * @param {1 | -1} dir Which way it went.
	 * @returns {Promise<void>} Settles when it is done.
	 */
	const fallback = (to, from, dir) => {
		state.current = to;
		warm(to + dir);
		return fade(to, from, calm);
	};

	// With reduced motion the images do it all: no canvas, no GPU context.
	if (reduced) el.querySelector('canvas')?.remove();
	/** @type {{ stage: import('./stage.js').Stage | null, stop: () => void }} */
	const gpu = reduced ? { stage: null, stop: () => {} } : createStage(el, {
		fragment: FRAG,
		alpha: false,
		still: true,
		setup({ gl, uniform }) {
			gl.uniform1i(uniform('uFrom'), 0);
			gl.uniform1i(uniform('uTo'), 1);
			gl.uniform1f(uniform('uMode'), MODES[config.transition ?? 'tiles'] ?? 0);
			gl.uniform3fv(uniform('uGround'), parseColor(config.background ?? '#0c0b0a'));
			return () => {
				for (const picture of pictures.values()) picture.then((p) => p && gl.deleteTexture(p.texture));
			};
		},
		uniforms({ gl, uniform, canvas, ratio }) {
			const box = canvas.width / canvas.height;
			const run = state.run;
			const from = run ? run.from : shown;
			const to = run ? run.to : shown;
			if (!from || !to) return;
			gl.activeTexture(gl.TEXTURE0);
			gl.bindTexture(gl.TEXTURE_2D, from.texture);
			gl.activeTexture(gl.TEXTURE1);
			gl.bindTexture(gl.TEXTURE_2D, to.texture);
			gl.uniform2fv(uniform('uFromScale'), coverScale(from.aspect, box));
			gl.uniform2fv(uniform('uToScale'), coverScale(to.aspect, box));
			gl.uniform1f(uniform('uProgress'), run ? Math.min(1, (performance.now() - run.start) / duration) : 0);
			gl.uniform1f(uniform('uDir'), run?.dir ?? 1);
			gl.uniform1f(uniform('uSeed'), run?.seed ?? 0);
			gl.uniform2fv(uniform('uGrid'), tileGrid(config.tiles ?? 9, box));
			gl.uniform1f(uniform('uPx'), ratio);
			gl.uniform3fv(uniform('uGlow'), glow);
		},
	});
	const { stage } = gpu;

	/**
	 * A slide's picture on the GPU, loaded once.
	 *
	 * @param {number} i The slide.
	 * @returns {Promise<Picture | null>} The picture, or null when it cannot be loaded.
	 */
	const picture = (i) => {
		const k = wrap(i, slides.length);
		let found = pictures.get(k);
		if (!found) {
			found = loadImage(slides[k].src).then(
				(img) => {
					if (state.stopped || !stage) return null;
					const { gl } = stage;
					gl.activeTexture(gl.TEXTURE0);
					const texture = imageTexture(gl, img, { mipmap: true });
					return texture && { texture, aspect: img.naturalWidth / img.naturalHeight };
				},
				() => null,
			);
			pictures.set(k, found);
		}
		return found;
	};

	/**
	 * Lets go of the pictures not on show, about to be, or just before:
	 * a long gallery keeps three on the GPU, not all of them.
	 */
	const trim = () => {
		const keep = new Set([state.current, wrap(state.current + 1, slides.length), wrap(state.current - 1, slides.length)]);
		for (const [k, found] of pictures) {
			if (keep.has(k)) continue;
			pictures.delete(k);
			found.then((p) => p && stage?.gl.deleteTexture(p.texture));
		}
	};

	/** Gives up on the GPU (a picture it cannot load): the image elements show from now on. */
	const retire = () => {
		retired = true;
		el.classList.remove('is-drawn');
		gpu.stop();
		stage?.gl.getExtension('WEBGL_lose_context')?.loseContext();
		stage?.canvas.remove();
	};

	/**
	 * A change drawn on the GPU, once both pictures are there.
	 *
	 * @param {number} to The slide coming in.
	 * @param {number} from The slide going.
	 * @param {1 | -1} dir Which way it went.
	 * @returns {Promise<void>} Settles when it is done.
	 */
	const transition = async (to, from, dir) => {
		present(to);
		const [a, b] = await Promise.all([picture(from), picture(to)]);
		if (state.stopped) return;
		if (!a || !b || !el.classList.contains('is-drawn')) {
			retire();
			return fallback(to, from, dir);
		}
		picture(to + dir);
		await new Promise((done) => {
			state.run = { from: a, to: b, dir, start: performance.now(), seed: Math.random() * 100, done: () => done(undefined) };
		});
		state.current = to;
		shown = b;
		trim();
	};

	/** Draws the change while one runs, and finishes it at the end. */
	const frame = () => {
		const run = state.run;
		if (!run || !stage) return;
		stage.redraw();
		if (performance.now() - run.start < duration) return;
		state.run = null;
		run.done();
	};

	/**
	 * Lays the canvas over the images once the picture on show is on the
	 * GPU (a change made before then is a crossfade, and tries again).
	 */
	const reveal = () => {
		const i = state.current;
		picture(i).then((first) => {
			if (!first || !stage || state.stopped || state.current !== i || el.classList.contains('is-drawn')) return;
			shown = first;
			stage.redraw();
			el.classList.add('is-drawn');
			picture(i + 1);
		});
	};

	const stopFrames = stage ? animate(el, frame) : () => {};
	if (stage) reveal();
	else warm(1);

	const show = slideshow(el, {
		count: slides.length,
		interval: config.interval ?? 5,
		autoplay: config.autoplay ?? true,
		describe: (i) => slides[i].alt,
		show: (to, from, dir) => {
			if (stage && el.classList.contains('is-drawn')) return transition(to, from, dir);
			const done = fallback(to, from, dir);
			if (stage && !retired) reveal();
			return done;
		},
	});

	const unwatch = watchColors(el, (next) => {
		glow = glowUniform(next.glint ? [next.colors[0], next.glint] : next.colors);
	});

	return () => {
		state.stopped = true;
		state.run?.done();
		show.stop();
		stopFrames();
		unwatch();
		gpu.stop();
	};
}
