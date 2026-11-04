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
 * drifting offset, the glitter over it at full resolution, then the stars
 * from one pre-drawn sprite per tint. The ramp runs from near-black
 * through the palette to a pale highlight, blended in Oklab; new colours
 * (`setColors`) only remap the worked-out field.
 *
 * Canvas 2D, opaque. One still frame with prefers-reduced-motion.
 *
 * From the Logomarks studio's showcase.
 */

import { createCanvas2D } from './canvas2d.js';
import { mixOklab, parseColor } from './color.js';
import { watchColors } from './mount.js';
import { pickColors } from './palettes.js';
import { seededRandom } from './random.js';

/**
 * @typedef {object} GalaxyConfig
 * @property {string[]} [colors] The nebula's colours, deep to bright, blended in Oklab.
 * @property {string} [palette] A shared palette by name, when there are no `colors`.
 * @property {number} [speed=1] How fast it drifts and twinkles; 0 holds it still.
 * @property {number} [stars=1] How many stars, as a share of the usual.
 * @property {number} [glitter=1] How bright the glitter is, as a share of the usual.
 * @property {number} [seed=7] Which sky: the same seed draws the same nebula and stars.
 */

/** The colours without `colors` or `palette`: indigo, cornflower, violet and cyan. */
export const COLORS = ['#3a2bd9', '#5c7cff', '#b45cff', '#5cecff'];

/** The worked-out nebula's size, px: small, since it is drawn scaled up and soft. */
export const NEBULA_WIDTH = 400;
export const NEBULA_HEIGHT = 225;

/** The ramp's top: a pale, faintly violet white. */
const PALE = /** @type {import('./color.js').Rgb} */ ([245 / 255, 240 / 255, 1]);

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
 * @returns {Float32Array} One value a pixel, 0 (dark) to 1 (the pale top), row by row.
 */
export function nebulaField(width, height, seed = 7) {
	const rnd = seededRandom(seed);
	const octaves = [3, 6, 12, 24, 48].map((n) => lattice(n, rnd));
	const dust = [5, 10, 20].map((n) => lattice(n, rnd));
	const hue = lattice(2, rnd);
	const out = new Float32Array(width * height);
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
 * The colour ramp the nebula is painted along: near-black (the first
 * colour, darkened), the colours in order, then a pale highlight, each
 * stretch blended in Oklab.
 *
 * @param {string[]} colors The colours, as CSS hex.
 * @param {number} [steps=256] How many entries.
 * @returns {Uint8ClampedArray} `steps` RGB triples, 0–255.
 * @throws {TypeError} When a colour is not hex.
 */
export function galaxyRamp(colors, steps = 256) {
	const cs = (colors.length ? colors : COLORS).map(parseColor);
	const stops = [mixOklab(cs[0], [0, 0, 0], 0.62), ...cs, PALE];
	const out = new Uint8ClampedArray(steps * 3);
	for (let s = 0; s < steps; s++) {
		const k = (s / (steps - 1)) * (stops.length - 1);
		const i = Math.min(stops.length - 2, Math.floor(k));
		const rgb = mixOklab(stops[i], stops[i + 1], k - i);
		for (let ch = 0; ch < 3; ch++) out[s * 3 + ch] = Math.round(rgb[ch] * 255);
	}
	return out;
}

/**
 * Paints a nebula field along a ramp.
 *
 * @param {Float32Array} field From nebulaField.
 * @param {Uint8ClampedArray} ramp From galaxyRamp.
 * @returns {Uint8ClampedArray} RGBA, opaque, one pixel per value of the field.
 */
export function nebulaPixels(field, ramp) {
	const last = ramp.length / 3 - 1;
	const out = new Uint8ClampedArray(field.length * 4);
	for (let p = 0; p < field.length; p++) {
		const i = Math.round(field[p] * last) * 3;
		out[p * 4] = ramp[i];
		out[p * 4 + 1] = ramp[i + 1];
		out[p * 4 + 2] = ramp[i + 2];
		out[p * 4 + 3] = 255;
	}
	return out;
}

/**
 * A star's glow, drawn once: a radial gradient in the tint, solid at the
 * centre and gone at the edge.
 *
 * @param {string} tint CSS hex.
 * @returns {HTMLCanvasElement} 64 × 64.
 */
function starSprite(tint) {
	const [r, g, b] = parseColor(tint).map((v) => Math.round(v * 255));
	const sprite = document.createElement('canvas');
	sprite.width = sprite.height = 64;
	const s = /** @type {CanvasRenderingContext2D} */ (sprite.getContext('2d'));
	const glow = s.createRadialGradient(32, 32, 0, 32, 32, 32);
	glow.addColorStop(0, `rgb(${r} ${g} ${b})`);
	glow.addColorStop(0.25, `rgb(${r} ${g} ${b} / 0.67)`);
	glow.addColorStop(1, `rgb(${r} ${g} ${b} / 0)`);
	s.fillStyle = glow;
	s.fillRect(0, 0, 64, 64);
	return sprite;
}

/**
 * Starts the galaxy on an element (its first canvas is drawn into).
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
	let colors = pickColors(config, COLORS);

	const field = nebulaField(NEBULA_WIDTH, NEBULA_HEIGHT, SEED);
	const nebula = document.createElement('canvas');
	nebula.width = NEBULA_WIDTH;
	nebula.height = NEBULA_HEIGHT;
	const nctx = nebula.getContext('2d');
	/** @type {HTMLCanvasElement[]} */
	let sprites = [];

	/** Paints the nebula and the star sprites in the current colours. */
	const paint = () => {
		nctx?.putImageData(new ImageData(nebulaPixels(field, galaxyRamp(colors)), NEBULA_WIDTH, NEBULA_HEIGHT), 0, 0);
		sprites = [...WHITES, ...colors].map(starSprite);
	};
	paint();

	/** @type {HTMLCanvasElement | null} */
	let glitter = null;
	/** @type {{ x: number, y: number, r: number, phase: number, rate: number, cross: boolean, tint: number }[]} */
	let stars = [];
	let dpr = 1;
	const start = performance.now();

	/**
	 * Scatters the glitter and stars over the new size, the same way for
	 * the same seed and size.
	 *
	 * @param {import('./canvas2d.js').Canvas2D} c The canvas.
	 */
	const resize = (c) => {
		dpr = c.canvas.width / c.width;
		const rnd = seededRandom(SEED * 31 + 1);
		// Glitter: fine bright speckle at device resolution.
		glitter = document.createElement('canvas');
		glitter.width = c.canvas.width;
		glitter.height = c.canvas.height;
		const g = glitter.getContext('2d');
		if (g) {
			for (let k = 0; k < (glitter.width * glitter.height) / 70; k++) {
				const x = rnd() * glitter.width;
				const y = rnd() * glitter.height;
				g.fillStyle = `rgb(255 255 255 / ${0.2 + rnd() ** 2.5 * 0.8})`;
				const size = rnd() < 0.9 ? dpr : dpr * 1.6;
				g.fillRect(x, y, size, size);
			}
		}
		stars = Array.from({ length: Math.round(((c.width * c.height) / 9000) * STARS) }, () => ({
			x: rnd() * c.width,
			y: rnd() * c.height,
			r: 0.6 + rnd() ** 4 * 3.4,
			phase: rnd() * Math.PI * 2,
			rate: 0.6 + rnd() * 1.8,
			cross: rnd() < 0.12,
			tint: Math.floor(rnd() * 64),
		}));
	};

	/**
	 * One frame: the nebula drifting, the glitter shimmering over it, the
	 * stars twinkling.
	 *
	 * @param {import('./canvas2d.js').Canvas2D} c The canvas.
	 * @param {number} now The time, ms.
	 */
	const draw = (c, now) => {
		const { ctx, width: w, height: h } = c;
		const t = c.still ? 0 : ((now - start) / 1000) * SPEED;
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
			ctx.drawImage(glitter, 0, 0, w, h);
		}
		const hair = 1 / dpr;
		for (const s of stars) {
			const a = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(s.phase + t * s.rate));
			ctx.globalAlpha = a;
			ctx.drawImage(sprites[s.tint % sprites.length], s.x - s.r * 4, s.y - s.r * 4, s.r * 8, s.r * 8);
			if (s.cross) {
				ctx.fillStyle = '#ffffff';
				const arm = s.r * 9 * a;
				ctx.fillRect(s.x - arm, s.y - hair / 2, arm * 2, hair);
				ctx.fillRect(s.x - hair / 2, s.y - arm, hair, arm * 2);
			}
		}
		ctx.globalAlpha = 1;
		ctx.globalCompositeOperation = 'source-over';
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
