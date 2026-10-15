/**
 * @module @arraypress/effects-astro/topography
 *
 * A survey map that never sits still: the contour lines of a slowly
 * evolving landscape, drifting as its hills rise and settle. Every fifth
 * line is an index line, drawn heavier, as on a printed map; where the
 * lines crowd on a steep slope the fine ones fade first, so cliffs read as
 * bands of index lines rather than solid ink. Under the pointer the ground
 * swells a little and its lines glow. Optional elevation numbers sit on a
 * few index lines, the line broken around them, and travel with them.
 *
 * One fragment shader: the height is four octaves of value noise with
 * analytic gradients, so each line is exactly `thickness` CSS px wide at
 * any slope or pixel ratio, and anti-aliased over one pixel. The noise
 * reads a small lattice texture of random values, one fetch an octave, and
 * the same lattice is read on the CPU to place the numbers on the lines.
 *
 * Opaque: it is the whole background of what it fills. Without WebGL the
 * canvas is removed and `background` shows. With prefers-reduced-motion,
 * one still frame.
 */

import { createStage } from './stage.js';
import { GLSL_OKLAB, parseColor, toOklab } from './color.js';
import { GLSL_QUIET, quietUniform } from './glsl.js';
import { GLSL_RAMP } from './ramp.js';
import { gradientUniform, MAX_COLORS } from './dot-surface.js';
import { canHover } from './device.js';
import { pointerIn } from './pointer.js';
import { watchColors } from './mount.js';
import { pickColors } from './palettes.js';

/**
 * @typedef {object} TopographyConfig
 * @property {string[]} [colors] The lines' colour, or a gradient by elevation from the valleys to the peaks (up to five), blended in Oklab. Default a pale blue.
 * @property {string} [palette] A shared palette by name (PALETTES; any case), as a gradient by elevation, when there are no `colors`.
 * @property {string} [background='#0c1a2b'] The ground the lines are drawn on.
 * @property {number} [density=24] About how many lines cross the screen from top to bottom, 6–60.
 * @property {number} [thickness=1] The lines' width, CSS px, 0.5–3; index lines are twice as wide.
 * @property {number} [major=5] Every n-th line is an index line, drawn heavier, 0–10; 0 for none.
 * @property {number} [scale=1] How large the hills are, 0.4–3.
 * @property {number} [speed=1] How fast the land drifts, 0–4; 0 holds it still.
 * @property {number} [glow=1] How strongly the lines glow under the pointer, 0–2; 0 for none.
 * @property {boolean} [interactive=true] Whether the pointer raises the ground and lights its lines.
 * @property {boolean} [labels=false] Small elevation numbers on a few index lines.
 * @property {{ x?: number, y?: number, radius?: number, depth?: number } | null} [quiet=null]
 *   An area kept dim behind copy: centre (0–1 from the top left), radius (a
 *   share of the height) and depth (0–1). The middle with `{}`.
 */

/** The lattice's size: random values on a square this many cells a side, repeating. */
export const LATTICE = 64;
/** Lattice cells across the screen's height for the largest octave, at `scale` 1. */
const BASE = 1.3;
/** Most elevation numbers on screen. */
export const MAX_LABELS = 6;
/** Metres between two lines, for the numbers. */
const METRES = 20;
/** The elevation the numbers count from, metres. */
const DATUM = 400;
/** Index lines' width over the fine lines'. */
const MAJOR_WIDTH = 2;
/** The numbers' size, CSS px. */
const LABEL_SIZE = 10.5;
/** The default ground and line: a night-blue chart in pale ink. */
const BACKGROUND = '#0c1a2b';
const COLOR = '#c9dcec';

/**
 * The octaves: amplitude, then the rows of the matrix that scales and turns
 * the plane for it (lattice cells a uv unit at zoom 1), then its offset and
 * how far it drifts a second. Each drifts its own way, so the hills change
 * shape rather than slide.
 *
 * @type {{ amp: number, rows: [number, number, number, number], offset: [number, number], drift: [number, number] }[]}
 */
export const OCTAVES = [
	[0.5, 1, 0, [0, 0], 0.012, 0.4],
	[0.27, 2.03, 0.9, [13.7, 7.1], 0.02, 2.6],
	[0.14, 4.11, 1.85, [29.3, 41.9], 0.028, 4.4],
	[0.07, 8.3, 2.7, [5.9, 23.3], 0.036, 5.8],
].map(([amp, freq, turn, offset, rate, heading]) => ({
	amp: Number(amp),
	rows: /** @type {[number, number, number, number]} */ ([Math.cos(Number(turn)), -Math.sin(Number(turn)), Math.sin(Number(turn)), Math.cos(Number(turn))].map((v) => v * Number(freq))),
	offset: /** @type {[number, number]} */ (offset),
	drift: /** @type {[number, number]} */ ([Math.cos(Number(heading)) * Number(rate), Math.sin(Number(heading)) * Number(rate)]),
}));

/**
 * The height's working range, valleys to peaks: the gradient runs across
 * it. The field reaches a little past both ends now and then.
 */
export const LOW = 0.22;
export const HIGH = 0.75;

/**
 * The mean steepness of the field up the screen, height units a uv unit at
 * zoom 1, so `density` can be lines across the screen whatever `scale`.
 * Measured over a large area (see tests/topography.test.js).
 */
export const MEAN_SLOPE = 0.373;

/**
 * The lattice as the shader reads it: a seeded random value at every
 * cell, each texel holding its own and its three neighbours' (right, up,
 * up-right), so one fetch gives a cell's four corners.
 *
 * @param {number} [seed=0x7a3d91] The seed.
 * @returns {Uint8Array} RGBA, LATTICE × LATTICE texels.
 */
export function latticeData(seed = 0x7a3d91) {
	let s = seed >>> 0;
	/**
	 * mulberry32: the next value of a small seeded generator.
	 *
	 * @returns {number} 0–255.
	 */
	const next = () => {
		s = (s + 0x6d2b79f5) >>> 0;
		let t = Math.imul(s ^ (s >>> 15), 1 | s);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) % 256;
	};
	const values = Uint8Array.from({ length: LATTICE * LATTICE }, next);
	/**
	 * The value at a cell, wrapping.
	 *
	 * @param {number} x Column.
	 * @param {number} y Row.
	 * @returns {number} 0–255.
	 */
	const at = (x, y) => values[(y % LATTICE) * LATTICE + (x % LATTICE)];
	const out = new Uint8Array(LATTICE * LATTICE * 4);
	for (let y = 0; y < LATTICE; y++) {
		for (let x = 0; x < LATTICE; x++) {
			out.set([at(x, y), at(x + 1, y), at(x, y + 1), at(x + 1, y + 1)], (y * LATTICE + x) * 4);
		}
	}
	return out;
}

/**
 * Each octave's offset at a moment: where it started plus how far it has
 * drifted, as the shader's `uDrift` takes them.
 *
 * @param {number} time The land's clock, seconds.
 * @returns {Float32Array} Two floats an octave.
 */
export function driftAt(time) {
	return new Float32Array(OCTAVES.flatMap(({ offset, drift }) => [offset[0] + drift[0] * time, offset[1] + drift[1] * time]));
}

/**
 * Value noise with its gradient, from the lattice: quintic between the
 * four corners, as the shader's `noised`.
 *
 * @param {Uint8Array} lattice From `latticeData`.
 * @param {number} x Lattice units.
 * @param {number} y Lattice units.
 * @returns {[number, number, number]} The value (0–1) and its slope along x and y.
 */
function noised(lattice, x, y) {
	const ix = Math.floor(x);
	const iy = Math.floor(y);
	const fx = x - ix;
	const fy = y - iy;
	const ux = fx * fx * fx * (fx * (fx * 6 - 15) + 10);
	const uy = fy * fy * fy * (fy * (fy * 6 - 15) + 10);
	const dx = 30 * fx * fx * (fx * (fx - 2) + 1);
	const dy = 30 * fy * fy * (fy * (fy - 2) + 1);
	const i = ((((iy % LATTICE) + LATTICE) % LATTICE) * LATTICE + (((ix % LATTICE) + LATTICE) % LATTICE)) * 4;
	const [a, b, c, d] = [lattice[i] / 255, lattice[i + 1] / 255, lattice[i + 2] / 255, lattice[i + 3] / 255];
	const k = a - b - c + d;
	return [a + (b - a) * ux + (c - a) * uy + k * ux * uy, dx * (b - a + k * uy), dy * (c - a + k * ux)];
}

/**
 * The land's height at a point, and its slope: the CPU's copy of the
 * shader's `field`, so the numbers land on the lines.
 *
 * @param {Uint8Array} lattice From `latticeData`.
 * @param {Float32Array | number[]} drift From `driftAt`.
 * @param {number} zoom Lattice cells a uv unit for the largest octave.
 * @param {number} x Across, uv (the screen's height is 1, 0 its middle).
 * @param {number} y Up, uv.
 * @returns {[number, number, number]} Height (about 0–1) and its slope along x and y, a uv unit.
 */
export function fieldAt(lattice, drift, zoom, x, y) {
	const px = x * zoom;
	const py = y * zoom;
	let h = 0;
	let gx = 0;
	let gy = 0;
	OCTAVES.forEach(({ amp, rows: [a, b, c, d] }, k) => {
		const [n, nx, ny] = noised(lattice, a * px + b * py + drift[k * 2], c * px + d * py + drift[k * 2 + 1]);
		h += amp * n;
		gx += amp * (nx * a + ny * c);
		gy += amp * (nx * b + ny * d);
	});
	return [h, gx * zoom, gy * zoom];
}

/**
 * Walks a point onto a contour: a few Newton steps along the slope.
 *
 * @param {(x: number, y: number) => [number, number, number]} height The land: height and slope at a point.
 * @param {number} x Where to start, uv.
 * @param {number} y Where to start, uv.
 * @param {number} level The contour's height.
 * @param {number} [steps=3] Steps to take.
 * @returns {{ x: number, y: number, gx: number, gy: number, miss: number } | null} The point, the slope
 *   there and how far off the contour it still is (uv), or null on flat ground.
 */
export function onContour(height, x, y, level, steps = 3) {
	let px = x;
	let py = y;
	for (let i = 0; i <= steps; i++) {
		const [h, gx, gy] = height(px, py);
		const g2 = gx * gx + gy * gy;
		if (g2 < 1e-6) return null;
		if (i === steps) return { x: px, y: py, gx, gy, miss: Math.abs(h - level) / Math.sqrt(g2) };
		const k = (h - level) / g2;
		px -= k * gx;
		py -= k * gy;
	}
	return null;
}

/**
 * A number's digits as the shader takes them: up to four, -1 for none.
 *
 * @param {number} value A whole number, 0–9999.
 * @returns {[number, number, number, number]} The digits, left to right.
 */
export function digitsOf(value) {
	const text = String(Math.max(0, Math.min(9999, Math.round(value))));
	return /** @type {[number, number, number, number]} */ ([0, 1, 2, 3].map((i) => (i < text.length ? Number(text[i]) : -1)));
}

/**
 * The point `i` of the Halton sequence in bases 2 and 3: evenly spread
 * places to try a number, across a 0–1 square.
 *
 * @param {number} i Its index, from 1.
 * @returns {[number, number]} The point.
 */
export function halton(i) {
	/**
	 * The radical inverse of `i` in a base.
	 *
	 * @param {number} base The base.
	 * @returns {number} 0–1.
	 */
	const inverse = (base) => {
		let f = 1;
		let r = 0;
		for (let n = i; n > 0; n = Math.floor(n / base)) {
			f /= base;
			r += f * (n % base);
		}
		return r;
	};
	return [inverse(2), inverse(3)];
}

const FRAG = `
precision highp float;
uniform vec2 uRes;
uniform float uRatio;
uniform float uZoom;
uniform vec2 uDrift[${OCTAVES.length}];
uniform float uLevels;
uniform float uMajor;
uniform float uWidth;
uniform vec3 uGround;
uniform vec4 uPointer;
uniform float uRise;
uniform float uGlow;
uniform sampler2D uLattice;
uniform sampler2D uAtlas;
uniform vec4 uLab[${MAX_LABELS}];
uniform vec4 uLabDigits[${MAX_LABELS}];
uniform vec2 uLabMeta[${MAX_LABELS}];
uniform float uLabs;
uniform vec2 uCell;
${GLSL_OKLAB}
${GLSL_RAMP}
${GLSL_QUIET}

// Value noise and its gradient: one fetch gives the cell's four corners.
vec3 noised(vec2 p) {
	vec2 i = floor(p);
	vec2 f = p - i;
	vec2 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
	vec2 du = 30.0 * f * f * (f * (f - 2.0) + 1.0);
	vec4 c = texture2D(uLattice, (i + 0.5) / ${LATTICE.toFixed(1)});
	float k = c.x - c.y - c.z + c.w;
	return vec3(c.x + (c.y - c.x) * u.x + (c.z - c.x) * u.y + k * u.x * u.y, du * vec2(c.y - c.x + k * u.y, c.z - c.x + k * u.x));
}

// The land: height and its slope, a uv unit.
vec3 field(vec2 uv) {
	vec2 p = uv * uZoom;
	vec3 h = vec3(0.0);
	vec3 n;
${OCTAVES.map(({ amp, rows: [a, b, c, d] }, k) => {
	const r0 = `vec2(${a.toFixed(6)}, ${b.toFixed(6)})`;
	const r1 = `vec2(${c.toFixed(6)}, ${d.toFixed(6)})`;
	return `	n = noised(vec2(dot(p, ${r0}), dot(p, ${r1})) + uDrift[${k}]);
	h += ${amp.toFixed(4)} * vec3(n.x, n.y * ${r0} + n.z * ${r1});`;
}).join('\n')}
	h.yz *= uZoom;
	return h;
}

// Coverage of a line d px from its middle, w px wide, anti-aliased over a pixel.
float line(float d, float w) {
	return clamp(max(w, 1.0) * 0.5 + 0.5 - d, 0.0, 1.0) * min(w, 1.0);
}

void main() {
	vec2 uv = (gl_FragCoord.xy - 0.5 * uRes) / uRes.y;
	vec3 h = field(uv);

	// The pointer: a low mound under it, and a glow a little wider.
	vec2 toP = uv - uPointer.xy;
	float r2 = dot(toP, toP) / (uPointer.w * uPointer.w);
	float mound = exp(-r2) * uPointer.z * uRise;
	h.x += mound;
	h.yz += toP * (-2.0 / (uPointer.w * uPointer.w)) * mound;
	float glow = exp(-r2 * 0.55) * uPointer.z * uGlow;

	// Distance to the nearest line and the nearest index line, in px.
	float slope = max(length(h.yz) / uRes.y * uLevels, 1e-6);
	float spacing = 1.0 / slope;
	float x = h.x * uLevels;
	float d = abs(x - floor(x + 0.5)) * spacing;
	float w = uWidth * (1.0 + 0.45 * min(glow, 1.0));
	float fine = line(d, w) * mix(0.42, 0.75, min(glow, 1.0));
	// Fine lines fade where they crowd closer than a few px.
	fine *= smoothstep(w + 1.0, w + 4.0 * uRatio, spacing);
	float index = 0.0;
	if (uMajor > 0.5) {
		float xm = x / uMajor;
		float dm = abs(xm - floor(xm + 0.5)) * spacing * uMajor;
		float wm = w * ${MAJOR_WIDTH.toFixed(1)};
		index = line(dm, wm) * mix(0.8, 1.0, min(glow, 1.0)) * smoothstep(wm + 1.0, wm + 4.0 * uRatio, spacing * uMajor);
	}
	// A soft halo round the lines where they glow.
	float halo = glow * 0.22 * exp(-d / (2.5 * uRatio)) * smoothstep(2.0, 8.0 * uRatio, spacing);

	// Breaks in the lines for the numbers, and the numbers.
	float gap = 0.0;
	float text = 0.0;
	for (int i = 0; i < ${MAX_LABELS}; i++) {
		if (float(i) >= uLabs) break;
		vec4 l = uLab[i];
		vec2 meta = uLabMeta[i];
		vec2 o = gl_FragCoord.xy - l.xy;
		vec2 q = vec2(dot(o, l.zw), dot(o, vec2(-l.w, l.z)));
		float hw = meta.y * uCell.x * 0.5;
		vec2 box = abs(q) - vec2(hw + uCell.y * 0.4, uCell.y * 0.42);
		gap = max(gap, (1.0 - smoothstep(-uRatio, uRatio, max(box.x, box.y))) * meta.x);
		if (abs(q.x) < hw && abs(q.y) < uCell.y * 0.5) {
			float cx = (q.x + hw) / uCell.x;
			float digit = dot(uLabDigits[i], vec4(equal(vec4(floor(cx)), vec4(0.0, 1.0, 2.0, 3.0))));
			text = max(text, texture2D(uAtlas, vec2((digit + fract(cx)) / 10.0, 0.5 - q.y / uCell.y)).a * meta.x);
		}
	}

	float t = (h.x - ${LOW.toFixed(3)}) / ${(HIGH - LOW).toFixed(3)};
	vec3 ink = ramp(t);
	// Lit lines move away from the ground: lighter on a dark map, deeper on paper.
	float away = ink.x > uGround.x ? 1.0 : -1.0;
	ink.x += away * 0.1 * min(glow, 1.0);
	// The ground shades a touch with height, and warms under the glow.
	vec3 ground = uGround;
	ground.x += (clamp(t, 0.0, 1.0) - 0.5) * 0.03 * away;
	ground = mix(ground, ink, 0.06 * min(glow, 1.0));

	float calm = mix(1.0 - uQuiet.w, 1.0, quietOpen(uv));
	float ink1 = clamp(max(fine, index) * (1.0 - gap) + halo, 0.0, 1.0) * calm;
	vec3 col = mix(ground, ink, ink1);
	col = mix(col, ink, text * 0.9 * calm);
	gl_FragColor = vec4(fromOklab(col), 1.0);
}
`;

/**
 * Draws the digits 0–9 side by side, white on clear, for the shader to
 * cut the numbers from: one cell a digit, `size` px tall.
 *
 * @param {number} size The type's size, device px.
 * @returns {{ canvas: HTMLCanvasElement, cell: [number, number] }} The strip and a cell's size, px.
 */
function digitStrip(size) {
	const canvas = document.createElement('canvas');
	const ctx = /** @type {CanvasRenderingContext2D} */ (canvas.getContext('2d'));
	const font = `600 ${size}px system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif`;
	ctx.font = font;
	const widest = Math.max(...[...'0123456789'].map((c) => ctx.measureText(c).width));
	const cell = /** @type {[number, number]} */ ([Math.ceil(widest + size * 0.08), Math.ceil(size * 1.3)]);
	canvas.width = cell[0] * 10;
	canvas.height = cell[1];
	ctx.font = font;
	ctx.fillStyle = '#fff';
	ctx.textAlign = 'center';
	ctx.textBaseline = 'middle';
	for (let i = 0; i < 10; i++) ctx.fillText(String(i), cell[0] * (i + 0.5), cell[1] * 0.54);
	return { canvas, cell };
}

/**
 * Starts the topography on an element: an opaque canvas inside it, filling it.
 *
 * @param {HTMLElement} el The element (its first canvas is drawn into).
 * @param {TopographyConfig} config The settings.
 * @returns {() => void} Stops it.
 */
export function topography(el, config) {
	const speed = config.speed ?? 1;
	const interactive = config.interactive !== false;
	const major = Math.max(0, Math.round(config.major ?? 5));
	const step = major || 5;
	const zoom = BASE / (config.scale ?? 1);
	const levels = (config.density ?? 24) / (MEAN_SLOPE * zoom);
	const rise = 2.2 / levels;
	const ground = toOklab(parseColor(config.background ?? BACKGROUND));
	const start = pickColors(config, [COLOR]);
	let ramp = gradientUniform(start);
	let ramps = Math.min(MAX_COLORS, start.length);
	const lattice = latticeData();
	// The land's own clock: it advances with `speed`, so pausing does not jump.
	let time = 40;
	let drift = driftAt(time);
	/** The pointer's mound: where it is heading and where it is (uv), and how strong (0–1). */
	const mound = { tx: 0, ty: 0, x: 0, y: 0, on: 0, r: 0.2 };
	/** The numbers on screen, by slot: where (uv), which line, how far faded in, and which way the line runs. @type {({ x: number, y: number, level: number, alpha: number, tx: number, ty: number } | null)[]} */
	const slots = [];
	let tried = 0;
	let cell = [8, 13];
	/** @type {WebGLTexture | null} */
	let atlas = null;
	const lab = new Float32Array(MAX_LABELS * 4);
	const labDigits = new Float32Array(MAX_LABELS * 4).fill(-1);
	const labMeta = new Float32Array(MAX_LABELS * 2);

	/**
	 * The land as it is now, with the pointer's mound.
	 *
	 * @param {number} x Across, uv.
	 * @param {number} y Up, uv.
	 * @returns {[number, number, number]} Height and slope.
	 */
	const height = (x, y) => {
		const f = fieldAt(lattice, drift, zoom, x, y);
		if (mound.on < 1e-3) return f;
		const dx = x - mound.x;
		const dy = y - mound.y;
		const m = Math.exp(-(dx * dx + dy * dy) / (mound.r * mound.r)) * mound.on * rise;
		const k = (-2 / (mound.r * mound.r)) * m;
		return [f[0] + m, f[1] + dx * k, f[2] + dy * k];
	};

	/**
	 * Follows the pointer: the mound eases towards it, and fades when it leaves.
	 *
	 * @param {number} aspect The canvas's width over height.
	 * @param {number} dt Seconds since the last frame.
	 */
	const follow = (aspect, dt) => {
		const p = pointerIn(el);
		if (p.inside) {
			mound.tx = (p.x - 0.5) * aspect;
			mound.ty = p.y - 0.5;
			if (mound.on < 0.01) Object.assign(mound, { x: mound.tx, y: mound.ty });
		}
		const k = 1 - Math.exp(-dt * 4);
		mound.x += (mound.tx - mound.x) * k;
		mound.y += (mound.ty - mound.y) * k;
		mound.on += ((p.inside ? 1 : 0) - mound.on) * (1 - Math.exp(-dt * 2.5));
	};

	/**
	 * Which way a contour runs at a point: across the slope, turned so type
	 * set along it stands upright.
	 *
	 * @param {{ gx: number, gy: number }} at The slope there.
	 * @returns {{ tx: number, ty: number }} The direction, a unit vector pointing rightwards.
	 */
	const along = ({ gx, gy }) => {
		const k = (gy >= 0 ? 1 : -1) / Math.hypot(gx, gy);
		return { tx: gy * k, ty: -gx * k };
	};

	/**
	 * Whether a number fits where it is: inside the frame, out of the quiet
	 * area and away from the others, on a line straight enough over its
	 * length, with room between its neighbours.
	 *
	 * @param {{ x: number, y: number, gx: number, gy: number, miss: number }} at The point on the line.
	 * @param {number} level The line's height.
	 * @param {number} slot Its slot, so it is not kept from itself.
	 * @param {number} aspect Width over height.
	 * @param {number} px The canvas's height, device px.
	 * @param {[number, number, number, number]} quiet The quiet area, as `uQuiet`.
	 * @returns {boolean} True when it fits.
	 */
	const fits = (at, level, slot, aspect, px, quiet) => {
		const g = Math.hypot(at.gx, at.gy);
		const half = (cell[0] * 2 + cell[1]) / px;
		if (at.miss * px > 0.5) return false;
		if (Math.abs(at.x) > aspect / 2 - half - 0.04 || Math.abs(at.y) > 0.5 - half - 0.04) return false;
		if (quiet[2] > 0 && Math.hypot(at.x - quiet[0], at.y - quiet[1]) < quiet[2] * 0.85) return false;
		if (px / (levels * g) < cell[1]) return false;
		for (let i = 0; i < slots.length; i++) {
			const o = slots[i];
			if (i !== slot && o && Math.hypot(o.x - at.x, o.y - at.y) < 0.3) return false;
		}
		// Steeper than about 55 degrees, the type would be hard to read.
		const tx = -at.gy / g;
		const ty = at.gx / g;
		if (Math.abs(ty) > 0.82) return false;
		for (const e of [-half, half]) {
			const [h, gx, gy] = height(at.x + tx * e, at.y + ty * e);
			if ((Math.abs(h - level) / Math.hypot(gx, gy)) * px > cell[1] * 0.4) return false;
		}
		return true;
	};

	/**
	 * Moves the numbers with their lines, fades out any that no longer fit
	 * and finds new places for them, then writes the label uniforms.
	 *
	 * @param {number} aspect Width over height.
	 * @param {number} px The canvas's height, device px.
	 * @param {number} dt Seconds since the last frame; 0 settles them at once (a still frame).
	 * @returns {number} How many slots there are.
	 */
	const place = (aspect, px, dt) => {
		const width = px * aspect;
		const count = Math.max(2, Math.min(MAX_LABELS, Math.round((el.clientWidth * el.clientHeight) / 180000)));
		const quiet = quietUniform(config.quiet, aspect);
		const ease = dt ? 1 - Math.exp(-dt * 2) : 1;
		for (let i = 0; i < count; i++) {
			let s = slots[i] ?? null;
			if (s) {
				const at = onContour(height, s.x, s.y, s.level / levels, 2);
				const ok = Boolean(at && fits(at, s.level / levels, i, aspect, px, quiet));
				if (at && ok) Object.assign(s, { x: at.x, y: at.y, ...along(at) });
				s.alpha += ((ok ? 1 : 0) - s.alpha) * ease;
				if (!ok && s.alpha < 0.02) s = slots[i] = null;
			}
			// An empty slot looks for a place: a few tries a frame, more for a still frame.
			for (let k = 0; !s && k < (dt ? 2 : 40); k++) {
				const [hx, hy] = halton(++tried);
				const x = (hx - 0.5) * aspect;
				const y = hy - 0.5;
				const level = Math.round((height(x, y)[0] * levels) / step) * step;
				const at = onContour(height, x, y, level / levels);
				if (at && fits(at, level / levels, i, aspect, px, quiet)) s = slots[i] = { x: at.x, y: at.y, level, alpha: dt ? 0 : 1, ...along(at) };
			}
		}
		slots.length = Math.min(slots.length, count);
		slots.forEach((s, i) => {
			const digits = s ? digitsOf(DATUM + s.level * METRES) : [-1, -1, -1, -1];
			lab.set(s ? [s.x * px + width / 2, s.y * px + px / 2, s.tx, s.ty] : [0, 0, 1, 0], i * 4);
			labDigits.set(digits, i * 4);
			labMeta.set([s ? s.alpha : 0, digits.filter((d) => d >= 0).length], i * 2);
		});
		return slots.length;
	};

	const { stage, stop } = createStage(el, {
		fragment: FRAG,
		alpha: false,
		still: speed === 0 && !interactive,
		setup({ gl, uniform }) {
			const grid = gl.createTexture();
			gl.activeTexture(gl.TEXTURE0);
			gl.bindTexture(gl.TEXTURE_2D, grid);
			gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
			gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, LATTICE, LATTICE, 0, gl.RGBA, gl.UNSIGNED_BYTE, lattice);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
			gl.uniform1i(uniform('uLattice'), 0);
			gl.uniform1i(uniform('uAtlas'), 1);
			gl.uniform1f(uniform('uZoom'), zoom);
			gl.uniform1f(uniform('uLevels'), levels);
			gl.uniform1f(uniform('uMajor'), major);
			gl.uniform1f(uniform('uRise'), rise);
			gl.uniform1f(uniform('uGlow'), interactive ? (config.glow ?? 1) : 0);
			gl.uniform3fv(uniform('uGround'), ground);
			return () => {
				gl.deleteTexture(grid);
				if (atlas) gl.deleteTexture(atlas);
			};
		},
		resize({ gl, uniform, ratio }) {
			gl.uniform1f(uniform('uRatio'), ratio);
			gl.uniform1f(uniform('uWidth'), (config.thickness ?? 1) * ratio);
			if (!config.labels) return;
			const strip = digitStrip(Math.round(LABEL_SIZE * ratio));
			cell = strip.cell;
			atlas ??= gl.createTexture();
			gl.activeTexture(gl.TEXTURE1);
			gl.bindTexture(gl.TEXTURE_2D, atlas);
			gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, strip.canvas);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
			gl.activeTexture(gl.TEXTURE0);
			gl.uniform2f(uniform('uCell'), cell[0], cell[1]);
		},
		uniforms({ gl, uniform, canvas, still }, _now, dt) {
			const aspect = canvas.width / canvas.height;
			if (!still) {
				time += dt * speed;
				drift = driftAt(time);
				if (interactive && canHover()) follow(aspect, dt);
			}
			gl.uniform2fv(uniform('uDrift'), drift);
			gl.uniform4f(uniform('uPointer'), mound.x, mound.y, mound.on, mound.r);
			gl.uniform4f(uniform('uQuiet'), ...quietUniform(config.quiet, aspect));
			gl.uniform3fv(uniform('uRamp'), ramp);
			gl.uniform1f(uniform('uRamps'), ramps);
			const labs = config.labels ? place(aspect, canvas.height, still ? 0 : dt) : 0;
			gl.uniform1f(uniform('uLabs'), labs);
			if (labs) {
				gl.uniform4fv(uniform('uLab'), lab);
				gl.uniform4fv(uniform('uLabDigits'), labDigits);
				gl.uniform2fv(uniform('uLabMeta'), labMeta);
			}
		},
	});
	if (!stage) return stop;

	const unwatch = watchColors(el, (next) => {
		ramp = gradientUniform(next.colors);
		ramps = Math.min(MAX_COLORS, next.colors.length);
		if (stage.still) stage.redraw();
	});
	return () => {
		stop();
		unwatch();
	};
}
