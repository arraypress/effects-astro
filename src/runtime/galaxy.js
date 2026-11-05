/**
 * @module @arraypress/effects-astro/galaxy
 *
 * Deep space in a palette's colours: soft nebula clouds with darker dust
 * lanes through them, fine glitter that shimmers as a whole, and stars
 * that twinkle each on its own beat (the brightest with a little cross of
 * light), all drifting slowly.
 *
 * The nebula is worked out once, small (400 × 225), from tileable value
 * noise: five octaves for the clouds, three ridged ones for the dust, and a
 * broad field that shifts the colours along the ramp so they wander. Each
 * frame draws it scaled up to cover (it is soft anyway) at a slowly
 * drifting offset, then the glitter and the stars over it, all in device
 * pixels. The ramp runs from near-black through the palette to a pale
 * highlight, blended in Oklab (or plainly in sRGB, `blend: 'srgb'`); new
 * colours (`setColors`) only remap the worked-out field.
 *
 * The sky comes from `seed` (the nebula) and `starSeed` (the glitter and
 * stars), by mulberry32, scattered afresh from `starSeed` on each resize.
 * `rng: 'park-miller'` uses the Park–Miller generator instead, as the
 * Logomarks studio's first galaxy did, with its glitter and stars from one
 * stream that runs on across resizes; with `seed: 7`, `starSeed: 31` and
 * `blend: 'srgb'` that is its sky to the pixel.
 *
 * Canvas 2D, opaque. One still frame with prefers-reduced-motion. A host
 * canvas already claimed for WebGL is swapped for a 2D one (canvas2d.js).
 *
 * From the Logomarks studio's showcase.
 */

import { createCanvas2D } from './canvas2d.js';
import { mixOklab, parseColor, toHex } from './color.js';
import { watchColors } from './mount.js';
import { pickColors } from './palettes.js';
import { randomFrom } from './random.js';

/**
 * @typedef {object} GalaxyConfig
 * @property {string[]} [colors] The nebula's colours, deep to bright, blended in Oklab.
 * @property {string} [palette] A shared palette by name, when there are no `colors`.
 * @property {number} [speed=1] How fast it drifts and twinkles; 0 holds it still.
 * @property {number} [stars=1] How many stars, as a share of the usual.
 * @property {number} [glitter=1] How bright the glitter is, as a share of the usual.
 * @property {number} [seed=7] Which sky: the same seed draws the same nebula and stars.
 * @property {number} [starSeed] The glitter and stars' own seed. Default `seed × 31 + 1`.
 * @property {import('./random.js').RandomName} [rng='mulberry32'] The generator: `park-miller` for the studio's first sky (its scatter runs on across resizes).
 * @property {'oklab' | 'srgb'} [blend='oklab'] How the ramp blends its colours: in Oklab, or plainly in sRGB (and painted exactly along its stops).
 */

/** The colours without `colors` or `palette`: indigo, cornflower, violet and cyan. */
export const COLORS = ['#3a2bd9', '#5c7cff', '#b45cff', '#5cecff'];

/** The worked-out nebula's size, px: small, since it is drawn scaled up and soft. */
export const NEBULA_WIDTH = 400;
export const NEBULA_HEIGHT = 225;

/** The ramp's top: a pale, faintly violet white, as bytes. */
const PALE_BYTES = [245, 240, 255];

/** The ramp's top, 0–1. */
const PALE = /** @type {import('./color.js').Rgb} */ (PALE_BYTES.map((v) => v / 255));

/** The near-black the ramp starts from: the first colour mixed this far to black in Oklab… */
const DEEP_OKLAB = 0.62;

/** …or, blended in sRGB, its bytes scaled by this. */
const DEEP_SRGB = 0.18;

/** Star tints besides the palette's own: white, a violet white and a blue white. */
const WHITES = ['#ffffff', '#f2e9ff', '#e6f6ff'];

/**
 * Tileable value noise on an n × n lattice of random values, eased
 * between (smoothstep), wrapping at 0–1 in both directions.
 *
 * @param {number} n The lattice's size, cells a side.
 * @param {() => number} rnd Random values, 0–1.
 * @returns {(x: number, y: number) => number} The noise at (x, y), 0–1, for x and y in 0–1.
 */
function lattice(n, rnd) {
	const v = Float32Array.from({ length: n * n }, () => rnd());
	/**
	 * A lattice value, wrapped.
	 *
	 * @param {number} i Across.
	 * @param {number} j Down.
	 * @returns {number} The value there.
	 */
	const at = (i, j) => v[(((j % n) + n) % n) * n + (((i % n) + n) % n)];
	return (x, y) => {
		const fx = x * n;
		const fy = y * n;
		const x0 = Math.floor(fx);
		const y0 = Math.floor(fy);
		const tx = fx - x0;
		const ty = fy - y0;
		const sx = tx * tx * (3 - 2 * tx);
		const sy = ty * ty * (3 - 2 * ty);
		const a = at(x0, y0) + (at(x0 + 1, y0) - at(x0, y0)) * sx;
		const b = at(x0, y0 + 1) + (at(x0 + 1, y0 + 1) - at(x0, y0 + 1)) * sx;
		return a + (b - a) * sy;
	};
}

/**
 * The nebula as places on the colour ramp: clouds of layered noise, cut
 * by ridged dust lanes, nudged along the ramp by a broad second field so
 * the colours wander. Tileable.
 *
 * @param {number} width Across, px.
 * @param {number} height Down, px.
 * @param {number} [seed=7] The same seed gives the same nebula.
 * @param {import('./random.js').RandomName} [rng='mulberry32'] The generator.
 * @returns {Float64Array} One value a pixel, 0 (dark) to 1 (the pale top), row by row.
 */
export function nebulaField(width, height, seed = 7, rng = 'mulberry32') {
	const rnd = randomFrom(rng, seed);
	const octaves = [3, 6, 12, 24, 48].map((n) => lattice(n, rnd));
	const dust = [5, 10, 20].map((n) => lattice(n, rnd));
	const hue = lattice(2, rnd);
	const out = new Float64Array(width * height);
	for (let y = 0; y < height; y++) {
		for (let x = 0; x < width; x++) {
			const u = x / width;
			const v = y / height;
			let n = 0;
			let amp = 0.5;
			for (const o of octaves) {
				n += o(u, v) * amp;
				amp *= 0.5;
			}
			n /= 0.97;
			// Ridged dust lanes: dark filaments through the clouds.
			let r = 0;
			for (const o of dust) r += 1 - Math.abs(o(u, v) * 2 - 1);
			r /= dust.length;
			let t = Math.min(1, Math.max(0, (n - 0.3) * 2.3));
			t = Math.max(0, t * (1 - Math.max(0, r - 0.72) * 2.2));
			out[y * width + x] = Math.min(1, Math.max(0, t * 0.8 + (hue(u, v) - 0.5) * 0.6));
		}
	}
	return out;
}

/**
 * The colours as channels, the default four when there are none.
 *
 * @param {string[]} colors The colours, as CSS hex.
 * @returns {import('./color.js').Rgb[]} Their channels, 0–1.
 * @throws {TypeError} When a colour is not hex.
 */
function parsed(colors) {
	return (colors.length ? colors : COLORS).map(parseColor);
}

/**
 * The ramp's stops: near-black (the first colour darkened), the colours
 * in order, then the pale top. Darkened in Oklab, or, for `srgb`, by
 * scaling the colour's bytes (unrounded, as the studio's first ramp did).
 *
 * @param {string[]} colors The colours, as CSS hex; the default four when empty.
 * @param {'oklab' | 'srgb'} [blend='oklab'] How the ramp blends.
 * @returns {Float64Array} One RGB triple a stop, 0–255, unrounded.
 * @throws {TypeError} When a colour is not hex.
 */
export function galaxyStops(colors, blend = 'oklab') {
	const cs = parsed(colors);
	const bytes = cs.map((c) => c.map((v) => Math.round(v * 255)));
	const deep = blend === 'srgb' ? bytes[0].map((v) => v * DEEP_SRGB) : mixOklab(cs[0], [0, 0, 0], DEEP_OKLAB).map((v) => v * 255);
	return Float64Array.from([deep, ...bytes, PALE_BYTES].flat());
}

/**
 * The colour ramp the nebula is painted along: near-black (the first
 * colour, darkened), the colours in order, then a pale highlight, each
 * stretch blended in Oklab (or plainly in sRGB).
 *
 * @param {string[]} colors The colours, as CSS hex.
 * @param {number} [steps=256] How many entries.
 * @param {'oklab' | 'srgb'} [blend='oklab'] How the stretches blend.
 * @returns {Uint8ClampedArray} `steps` RGB triples, 0–255.
 * @throws {TypeError} When a colour is not hex.
 */
export function galaxyRamp(colors, steps = 256, blend = 'oklab') {
	const out = new Uint8ClampedArray(steps * 3);
	if (blend === 'srgb') {
		const stops = galaxyStops(colors, 'srgb');
		for (let s = 0; s < steps; s++) along(stops, s / (steps - 1), out, s * 3);
		return out;
	}
	const cs = parsed(colors);
	const stops = [mixOklab(cs[0], [0, 0, 0], DEEP_OKLAB), ...cs, PALE];
	for (let s = 0; s < steps; s++) {
		const k = (s / (steps - 1)) * (stops.length - 1);
		const i = Math.min(stops.length - 2, Math.floor(k));
		const rgb = mixOklab(stops[i], stops[i + 1], k - i);
		for (let ch = 0; ch < 3; ch++) out[s * 3 + ch] = Math.round(rgb[ch] * 255);
	}
	return out;
}

/**
 * Writes the colour a place along some stops comes to, blended linearly
 * between the two either side of it.
 *
 * @param {ArrayLike<number>} stops RGB triples.
 * @param {number} t Where along them, 0–1.
 * @param {Uint8ClampedArray} out Where to write it (rounded as it is stored).
 * @param {number} at The index of its red.
 */
function along(stops, t, out, at) {
	const n = stops.length / 3;
	const k = t * (n - 1);
	const i = Math.min(n - 2, Math.floor(k));
	const f = k - i;
	for (let ch = 0; ch < 3; ch++) {
		const a = stops[i * 3 + ch];
		out[at + ch] = a + (stops[(i + 1) * 3 + ch] - a) * f;
	}
}

/**
 * Paints a nebula field along a ramp: each value takes the nearest entry,
 * or, `smooth`, the blend of the two either side of it (for a ramp given
 * only at its stops, such as galaxyStops with `srgb`, which paints it
 * exactly).
 *
 * @param {ArrayLike<number>} field From nebulaField.
 * @param {ArrayLike<number>} ramp From galaxyRamp (or galaxyStops, `smooth`).
 * @param {boolean} [smooth=false] Blend between entries rather than take the nearest.
 * @returns {Uint8ClampedArray} RGBA, opaque, one pixel per value of the field.
 */
export function nebulaPixels(field, ramp, smooth = false) {
	const last = ramp.length / 3 - 1;
	const out = new Uint8ClampedArray(field.length * 4);
	for (let p = 0; p < field.length; p++) {
		if (smooth) along(ramp, field[p], out, p * 4);
		else {
			const i = Math.round(field[p] * last) * 3;
			out[p * 4] = ramp[i];
			out[p * 4 + 1] = ramp[i + 1];
			out[p * 4 + 2] = ramp[i + 2];
		}
		out[p * 4 + 3] = 255;
	}
	return out;
}

/**
 * Paints a star's glow: a radial gradient in the tint, solid at the
 * centre, two thirds at a quarter of the way out, gone at the edge.
 *
 * @param {CanvasRenderingContext2D} ctx The context, in device px.
 * @param {number} x Its centre across.
 * @param {number} y Its centre down.
 * @param {number} radius The glow's radius.
 * @param {string} tint `#rrggbb`.
 */
function starGlow(ctx, x, y, radius, tint) {
	const glow = ctx.createRadialGradient(x, y, 0, x, y, radius);
	glow.addColorStop(0, tint);
	glow.addColorStop(0.25, `${tint}aa`);
	glow.addColorStop(1, `${tint}00`);
	ctx.fillStyle = glow;
	ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
}

/**
 * Starts the galaxy on an element (its first canvas is drawn into, or a
 * 2D one in its place when the host made it for WebGL).
 *
 * @param {HTMLElement} el The element.
 * @param {GalaxyConfig} config The settings.
 * @returns {() => void} Stops it.
 */
export function galaxy(el, config) {
	const SPEED = config.speed ?? 1;
	const STARS = Math.max(0, config.stars ?? 1);
	const GLITTER = Math.max(0, config.glitter ?? 1);
	const SEED = config.seed ?? 7;
	const STAR_SEED = config.starSeed ?? SEED * 31 + 1;
	const RNG = config.rng ?? 'mulberry32';
	const BLEND = config.blend === 'srgb' ? 'srgb' : 'oklab';
	let colors = pickColors(config, COLORS);

	const field = nebulaField(NEBULA_WIDTH, NEBULA_HEIGHT, SEED, RNG);
	const nebula = document.createElement('canvas');
	nebula.width = NEBULA_WIDTH;
	nebula.height = NEBULA_HEIGHT;
	const nctx = nebula.getContext('2d');
	/** @type {string[]} */
	let tints = [];

	/** Paints the nebula and picks the star tints in the current colours. */
	const paint = () => {
		const pixels = BLEND === 'srgb' ? nebulaPixels(field, galaxyStops(colors, 'srgb'), true) : nebulaPixels(field, galaxyRamp(colors));
		nctx?.putImageData(new ImageData(pixels, NEBULA_WIDTH, NEBULA_HEIGHT), 0, 0);
		tints = [...WHITES, ...colors].map((c) => toHex(parseColor(c)));
	};
	paint();

	/** @type {HTMLCanvasElement | null} */
	let glitter = null;
	/** Each star in device px; `tint` is a 0–1 pick from the tints, so new colours keep it. */
	/** @type {{ x: number, y: number, r: number, phase: number, rate: number, cross: boolean, tint: number }[]} */
	let stars = [];
	// Park–Miller's scatter is one stream that runs on across resizes; mulberry32's starts afresh each time.
	const running = RNG === 'park-miller' ? randomFrom(RNG, STAR_SEED) : null;
	const start = performance.now();

	/**
	 * Scatters the glitter and stars over the new size, in device px.
	 *
	 * @param {import('./canvas2d.js').Canvas2D} c The canvas.
	 */
	const resize = (c) => {
		// Nothing to scatter over while the element has no size (and no numbers spent).
		if (!el.clientWidth || !el.clientHeight) {
			glitter = null;
			stars = [];
			return;
		}
		const { dpr } = c;
		const w = c.canvas.width;
		const h = c.canvas.height;
		const rnd = running ?? randomFrom(RNG, STAR_SEED);
		// Glitter: fine bright speckle at device resolution.
		glitter = document.createElement('canvas');
		glitter.width = w;
		glitter.height = h;
		const g = glitter.getContext('2d');
		if (g) {
			for (let k = 0; k < (w * h) / 70; k++) {
				const x = rnd() * w;
				const y = rnd() * h;
				g.fillStyle = `rgb(255 255 255 / ${0.2 + rnd() ** 2.5 * 0.8})`;
				const size = rnd() < 0.9 ? dpr : dpr * 1.6;
				g.fillRect(x, y, size, size);
			}
		}
		stars = Array.from({ length: Math.round(((w * h) / (dpr * dpr * 9000)) * STARS) }, () => ({
			x: rnd() * w,
			y: rnd() * h,
			r: (0.6 + rnd() ** 4 * 3.4) * dpr,
			phase: rnd() * Math.PI * 2,
			rate: 0.6 + rnd() * 1.8,
			cross: rnd() < 0.12,
			tint: rnd(),
		}));
	};

	/**
	 * One frame, in device px: the nebula drifting, the glitter shimmering
	 * over it, the stars twinkling.
	 *
	 * @param {import('./canvas2d.js').Canvas2D} c The canvas.
	 * @param {number} now The time, ms.
	 */
	const draw = (c, now) => {
		const { ctx, dpr } = c;
		const w = c.canvas.width;
		const h = c.canvas.height;
		const t = c.still ? 0 : ((now - start) / 1000) * SPEED;
		ctx.setTransform(1, 0, 0, 1, 0, 0);
		// The nebula, scaled to cover with a margin to drift through.
		const k = Math.max(w / NEBULA_WIDTH, h / NEBULA_HEIGHT) * 1.12;
		const nw = NEBULA_WIDTH * k;
		const nh = NEBULA_HEIGHT * k;
		const ox = -(nw - w) / 2 + Math.sin(t * 0.05) * (nw - w) * 0.4;
		const oy = -(nh - h) / 2 + Math.cos(t * 0.04) * (nh - h) * 0.4;
		ctx.globalCompositeOperation = 'source-over';
		ctx.globalAlpha = 1;
		ctx.imageSmoothingEnabled = true;
		ctx.imageSmoothingQuality = 'high';
		ctx.drawImage(nebula, ox, oy, nw, nh);
		ctx.globalCompositeOperation = 'lighter';
		if (glitter && GLITTER > 0) {
			ctx.globalAlpha = Math.min(1, (0.75 + Math.sin(t * 1.7) * 0.12) * GLITTER);
			ctx.drawImage(glitter, 0, 0);
		}
		for (const s of stars) {
			const a = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(s.phase + t * s.rate));
			ctx.globalAlpha = a;
			starGlow(ctx, s.x, s.y, s.r * 4, tints[Math.floor(s.tint * tints.length)]);
			if (s.cross) {
				// A cross of light, a CSS px thick.
				ctx.fillStyle = '#ffffff';
				const arm = s.r * 9 * a;
				ctx.fillRect(s.x - arm, s.y - dpr * 0.5, arm * 2, dpr);
				ctx.fillRect(s.x - dpr * 0.5, s.y - arm, dpr, arm * 2);
			}
		}
		ctx.globalAlpha = 1;
		ctx.globalCompositeOperation = 'source-over';
		ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
	};

	const { c, stop } = createCanvas2D(el, { draw, resize });
	if (!c) return stop;
	const unwatch = watchColors(el, (next) => {
		colors = next.colors;
		paint();
		if (c.still) draw(c, performance.now());
	});
	return () => {
		stop();
		unwatch();
	};
}
