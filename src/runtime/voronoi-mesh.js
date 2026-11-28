/**
 * @module @arraypress/effects-astro/voronoi-mesh
 *
 * A Voronoi mesh drawn as thin lines on a ground, in two nested tiers.
 * The macro cells come from one seed per square of a grid (`cells`
 * across), each jittered off the square's centre and orbiting slowly
 * around that rest point. Inside each macro cell a handful of inner seeds
 * (`inner`) sit around its seed and pulse: pushed out together to most of
 * the cell and drawn back in, so the inner lines breathe outward from the
 * seed like an event horizon. The inner tier is a Voronoi among only the
 * inner seeds of the pixel's own macro cell, so its lines stop at the
 * macro borders by construction, as the sketch's clipped polygons did.
 *
 * In a fragment shader: the macro tier is a jittered-grid Voronoi with
 * the exact border distance (the nearest seed in a 3×3 neighbourhood,
 * then the distance to each bisector around it, the two-pass F2−F1 border
 * method), the inner tier the same over its few seeds, and both are drawn
 * as anti-aliased lines of a CSS-px width. The unit is a share of the
 * canvas width, so a card and a hero hold the same cells. Its lattice
 * hash is Dave Hoskins' Hash without Sine (MIT, © 2014 David Hoskins),
 * which brings its input under 1 before it multiplies, so the GPU's 32-bit
 * floats and the JavaScript twins here agree; `meshPolygons` and
 * `meshStill` draw the same frame as real polygons (an SVG), for the still
 * a page shows before the shader starts and without WebGL.
 *
 * A slow driver (`breathe`) speeds the clocks, thickens the lines and
 * lifts the macro tier a little and back, over about half a minute, as
 * the sketch's noise driver did; the clocks are closed-form functions of
 * the seconds, never stepped per frame. A `quiet` area fades the lines
 * behind copy. With prefers-reduced-motion, or `speed: 0`, it is one
 * still frame. Colours mix with the ground in Oklab.
 *
 * After `voronoi_bg`, a Processing sketch shared with the owner
 * (2026-11-20): the two tiers, the orbit, the pulse's shape (a squared
 * sine with a dead zone, the seeds of a cell in phase but for a little
 * jitter), the maroon ground and the line colours are its; here it runs
 * on the GPU instead of clipping polygons on the CPU.
 */

import { createStage } from './stage.js';
import { GLSL_HASH33, hash33 } from './hash-noise.js';
import { GLSL_OKLAB, mixOklab, parseColor, toHex, toOklab } from './color.js';
import { GLSL_QUIET, quietUniform } from './glsl.js';
import { watchColors } from './mount.js';
import { pickColors } from './palettes.js';
import { frameNow } from './loop.js';

/** Hash without Sine (./hash-noise.js), the seeds' hash. */
export { hash33 };

/**
 * @typedef {object} VoronoiMeshConfig
 * @property {string[]} [colors] Two CSS hex colours: the macro lines' and the inner lines'. Default a pale stone and a dusty rose.
 * @property {string} [palette] A shared palette by name (PALETTES; any case), when there are no `colors`: its glint for the macro lines, its first colour for the inner.
 * @property {string} [background='#350f0e'] The ground, a CSS hex colour (opaque, so the canvas covers what is behind it); `transparent` draws the lines alone.
 * @property {number} [cells=9] Macro cells across the width.
 * @property {number} [inner=5] Inner seeds per macro cell, 0–8; 0 for the macro tier alone.
 * @property {number} [width=1] The macro lines' width in CSS px; the inner lines are 0.7 of it.
 * @property {[number, number]} [opacity=[0.4, 0.22]] The macro and inner lines' opacity, each 0–1.
 * @property {number} [pulse=1] How far the inner seeds pulse, 0–1: 1 draws them in to the macro seed and out again, 0 holds them still.
 * @property {number} [spread=0.6] How far out the inner seeds push, a share of a cell.
 * @property {number} [jitter=0.75] How far each macro seed rests off its square's centre, 0–1.
 * @property {number} [orbit=1] How wide the macro seeds orbit, 0–1.
 * @property {number} [breathe=0.35] The slow driver, 0–1: how much it speeds the clocks, thickens the lines and lifts the macro tier.
 * @property {number} [speed=1] Plays every clock faster or slower; 0 for one still frame.
 * @property {[number, number]} [offset=[0, 0]] Where the grid starts, in cells, so two cards differ.
 * @property {{ x?: number, y?: number, radius?: number, depth?: number } | null} [quiet=null]
 *   An area kept quiet: centre (0–1 from the top left), radius (share of the height), depth (0–1).
 */

/** The settings' defaults, shared by the shader and the JavaScript twins. */
export const MESH_DEFAULTS = {
	background: '#350f0e',
	cells: 9,
	inner: 5,
	width: 1,
	opacity: /** @type {[number, number]} */ ([0.4, 0.22]),
	pulse: 1,
	spread: 0.6,
	jitter: 0.75,
	orbit: 1,
	breathe: 0.35,
};

/** The sketch's line colours: a pale stone for the macro lines, a dusty rose for the inner. */
const STONE = ['#c1c2bc', '#a67676'];

/** The most inner seeds a cell takes (the shader's loop bound). */
const MAX_INNER = 8;
/**
 * The furthest a macro seed rests off its square's centre (along each
 * axis) and the widest it orbits, in cells. Together under half a cell
 * (0.42) along each axis, so every seed stays inside its own square and
 * the nearest is always within the pixel's 3×3 neighbourhood.
 */
const JITTER_REACH = 0.22;
const ORBIT_REACH = 0.2;
/** The orbit's and the pulse's rates, cycles a second (the sketch's). */
const ORBIT_HZ = 0.03;
const PULSE_HZ = 0.05;
/** The pulse's dead zone (a share of its cycle at rest in the middle) and how far a seed's phase strays from its cell's. */
const DEAD_ZONE = 0.08;
const PHASE_JITTER = 0.12;
/** The driver's two slow waves (radians a second) and the second's phase. */
const W1 = 2 * Math.PI * 0.031;
const W2 = 2 * Math.PI * 0.013;
const PHI = 1.3;
/** How much the driver speeds the clocks (the sketch's), and thickens the lines (gentler than the sketch's 6, for thin card lines). */
const SPEED_BOOST = 2;
const WIDTH_BOOST = 1.2;
/** The inner lines' width, a share of the macro lines'. */
const INNER_WIDTH = 0.7;
const TAU = 2 * Math.PI;

/**
 * GLSL (ES 1.00): the hash, the seeds and the pulse, the twins of
 * `hash33`, `macroSeed`, `innerSeed` and `pulseWave` below.
 */
const GLSL_SEEDS = `
const float TAU = 6.28318530718;
${GLSL_HASH33}vec2 macroSeed(vec2 c) {
	vec3 a = hash33(vec3(c, 0.0));
	vec3 b = hash33(vec3(c, 1.0));
	float ph = TAU * (${ORBIT_HZ} * uClock + a.z);
	return c + 0.5 + (a.xy - 0.5) * 2.0 * uJitter + vec2(cos(ph), sin(ph)) * uOrbit * (0.7 + 0.3 * b.x);
}
float pulseWave(float t) {
	float u = clamp((t - ${DEAD_ZONE / 2}) / ${1 - DEAD_ZONE}, 0.0, 1.0);
	float s = sin(3.14159265 * u);
	return s * s;
}
vec2 innerSeed(vec2 c, vec2 s, vec3 b, float k) {
	vec3 h = hash33(vec3(c, 2.0 + k));
	float ang = TAU * ((k + 0.5 + 0.6 * (h.x - 0.5)) / uInner + b.z);
	float t = fract(${PULSE_HZ} * uClock + b.y + (h.y - 0.5) * ${2 * PHASE_JITTER});
	float r = uSpread * (0.7 + 0.4 * h.z) * (1.0 - uPulse * (1.0 - pulseWave(t)));
	return s + r * vec2(cos(ang), sin(ang));
}
`;

const FRAG = `
precision highp float;
uniform vec2 uRes;
uniform float uCells;
uniform vec2 uOffset;
uniform float uClock;
uniform float uJitter;
uniform float uOrbit;
uniform float uInner;
uniform float uSpread;
uniform float uPulse;
uniform vec2 uWidth;
uniform vec2 uAlpha;
uniform vec3 uMacro;
uniform vec3 uInnerCol;
uniform vec4 uBg;
${GLSL_OKLAB}
${GLSL_QUIET}
${GLSL_SEEDS}

// A line's coverage at d device px from its centre, w device px wide;
// under a pixel wide it fades rather than thins, so it never breaks up.
float line(float d, float w) {
	return clamp(0.5 + 0.5 * max(w, 1.0) - d, 0.0, 1.0) * min(w, 1.0);
}

void main() {
	// Counted from the top left, as the still's polygons are.
	vec2 px = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y);
	float unit = uRes.x / uCells;
	vec2 p = px / unit + uOffset;
	vec2 ip = floor(p);

	// The macro tier: the nearest seed, then the nearest bisector around it.
	float best = 1e9;
	vec2 bc = ip;
	vec2 bs = ip;
	for (int j = -1; j <= 1; j++)
		for (int i = -1; i <= 1; i++) {
			vec2 c = ip + vec2(float(i), float(j));
			vec2 s = macroSeed(c);
			float d = dot(s - p, s - p);
			if (d < best) { best = d; bc = c; bs = s; }
		}
	float edge = 1e9;
	for (int j = -1; j <= 1; j++)
		for (int i = -1; i <= 1; i++) {
			if (i == 0 && j == 0) continue;
			vec2 s = macroSeed(bc + vec2(float(i), float(j)));
			vec2 n = s - bs;
			float l = length(n);
			if (l > 1e-5) edge = min(edge, dot(0.5 * (s + bs) - p, n / l));
		}

	// The inner tier: the same among only this cell's inner seeds.
	float iedge = 1e9;
	if (uInner > 0.5) {
		vec3 b = hash33(vec3(bc, 1.0));
		float ib = 1e9;
		vec2 iseed = bs;
		float ik = -1.0;
		for (int k = 0; k < ${MAX_INNER}; k++) {
			if (float(k) >= uInner) break;
			vec2 q = innerSeed(bc, bs, b, float(k));
			float d = dot(q - p, q - p);
			if (d < ib) { ib = d; iseed = q; ik = float(k); }
		}
		for (int k = 0; k < ${MAX_INNER}; k++) {
			if (float(k) >= uInner) break;
			if (float(k) == ik) continue;
			vec2 q = innerSeed(bc, bs, b, float(k));
			vec2 n = q - iseed;
			float l = length(n);
			if (l > 1e-5) iedge = min(iedge, dot(0.5 * (q + iseed) - p, n / l));
		}
	}

	vec2 uv = vec2(px.x - 0.5 * uRes.x, 0.5 * uRes.y - px.y) / uRes.y;
	float hush = mix(1.0 - uQuiet.w, 1.0, quietOpen(uv));
	float am = line(edge * unit, uWidth.x) * uAlpha.x * hush;
	float ai = line(iedge * unit, uWidth.y) * uAlpha.y * hush;
	if (uBg.a > 0.5) {
		// On the ground: inner, then macro over it, mixed in Oklab.
		vec3 lab = mix(mix(uBg.rgb, uInnerCol, ai), uMacro, am);
		gl_FragColor = vec4(fromOklab(lab), 1.0);
	} else {
		// No ground: premultiplied, macro over inner.
		vec3 col = fromOklab(uMacro) * am + fromOklab(uInnerCol) * ai * (1.0 - am);
		gl_FragColor = vec4(col, am + ai * (1.0 - am));
	}
}
`;

/**
 * The settings over the defaults; a setting left undefined keeps its default.
 *
 * @param {VoronoiMeshConfig} [config] The settings.
 * @returns {typeof MESH_DEFAULTS & VoronoiMeshConfig} Every setting.
 */
function withDefaults(config = {}) {
	const set = Object.fromEntries(Object.entries(config).filter(([, v]) => v !== undefined));
	return { ...MESH_DEFAULTS, ...set };
}

/**
 * The slow driver at a time: two slow sines, 0 to `breathe`.
 *
 * @param {number} t Seconds (already at the effect's speed).
 * @param {number} [breathe=0.35] How much there is of it, 0–1.
 * @returns {number} 0 to `breathe`.
 */
export function driveAt(t, breathe = MESH_DEFAULTS.breathe) {
	return breathe * (0.5 + 0.3 * Math.sin(W1 * t) + 0.2 * Math.sin(W2 * t + PHI));
}

/**
 * The seeds' clock at a time: the seconds, run faster while the driver is
 * up. The integral of `1 + 2 · driveAt`, in closed form, so it is the same
 * whatever the frame rate and never stepped.
 *
 * @param {number} t Seconds (already at the effect's speed).
 * @param {number} [breathe=0.35] The driver's amount, 0–1.
 * @returns {number} The clock, in seconds; 0 at 0.
 */
export function clockAt(t, breathe = MESH_DEFAULTS.breathe) {
	const integral = 0.5 * t + (0.3 * (1 - Math.cos(W1 * t))) / W1 + (0.2 * (Math.cos(PHI) - Math.cos(W2 * t + PHI))) / W2;
	return t + SPEED_BOOST * breathe * integral;
}

/**
 * The pulse's shape over one cycle: at rest through the dead zone around
 * 0, then a squared sine out to 1 halfway and back.
 *
 * @param {number} t Where in the cycle, 0–1.
 * @returns {number} 0–1.
 */
export function pulseWave(t) {
	const u = Math.min(1, Math.max(0, (t - DEAD_ZONE / 2) / (1 - DEAD_ZONE)));
	const s = Math.sin(Math.PI * u);
	return s * s;
}

/**
 * The settings as the seeds take them, each in cells.
 *
 * @typedef {object} SeedOptions
 * @property {number} jitter The furthest a seed rests off its square's centre.
 * @property {number} orbit The widest it orbits.
 * @property {number} inner Inner seeds per cell.
 * @property {number} spread How far out the inner seeds push.
 * @property {number} pulse How far they pulse, 0–1.
 */

/**
 * The settings, with defaults, as the seeds take them.
 *
 * @param {VoronoiMeshConfig} [config] The settings.
 * @returns {SeedOptions} The seeds' options, in cells.
 */
export function seedOptions(config = {}) {
	const o = withDefaults(config);
	const clamp01 = (/** @type {number} */ n) => Math.min(1, Math.max(0, n));
	return {
		jitter: clamp01(o.jitter) * JITTER_REACH,
		orbit: clamp01(o.orbit) * ORBIT_REACH,
		inner: Math.round(Math.min(MAX_INNER, Math.max(0, o.inner))),
		spread: Math.max(0, o.spread),
		pulse: clamp01(o.pulse),
	};
}

/**
 * A macro seed: the one for the grid square whose corner is (cx, cy),
 * jittered off its centre and orbiting it (the shader's `macroSeed`).
 *
 * @param {number} cx The square's x (an integer, in cells).
 * @param {number} cy The square's y.
 * @param {number} clock The seeds' clock (`clockAt`).
 * @param {SeedOptions} [options] From `seedOptions` (the defaults if none).
 * @returns {[number, number]} The seed, in cells.
 */
export function macroSeed(cx, cy, clock, options = seedOptions()) {
	const [ax, ay, az] = hash33(cx, cy, 0);
	const [bx] = hash33(cx, cy, 1);
	const ph = TAU * (ORBIT_HZ * clock + az);
	const r = options.orbit * (0.7 + 0.3 * bx);
	return [cx + 0.5 + (ax - 0.5) * 2 * options.jitter + Math.cos(ph) * r, cy + 0.5 + (ay - 0.5) * 2 * options.jitter + Math.sin(ph) * r];
}

/**
 * A macro cell's inner seeds: spread around its seed at even angles (a
 * little jittered), pushed out and drawn back in together by the pulse,
 * each a touch out of phase (the shader's `innerSeed`).
 *
 * @param {number} cx The macro cell's grid square x.
 * @param {number} cy Its y.
 * @param {number} clock The seeds' clock (`clockAt`).
 * @param {SeedOptions} [options] From `seedOptions` (the defaults if none).
 * @returns {[number, number][]} The inner seeds, in cells.
 */
export function innerSeeds(cx, cy, clock, options = seedOptions()) {
	const [sx, sy] = macroSeed(cx, cy, clock, options);
	const [, by, bz] = hash33(cx, cy, 1);
	return Array.from({ length: options.inner }, (_, k) => {
		const [hx, hy, hz] = hash33(cx, cy, 2 + k);
		const ang = TAU * ((k + 0.5 + 0.6 * (hx - 0.5)) / options.inner + bz);
		const t = PULSE_HZ * clock + by + (hy - 0.5) * 2 * PHASE_JITTER;
		const r = options.spread * (0.7 + 0.4 * hz) * (1 - options.pulse * (1 - pulseWave(t - Math.floor(t))));
		return /** @type {[number, number]} */ ([sx + r * Math.cos(ang), sy + r * Math.sin(ang)]);
	});
}

/**
 * The macro tier at a point, as the shader finds it: the nearest seed in
 * the point's 3×3 neighbourhood, then the distance to the nearest
 * bisector between it and the seeds around it.
 *
 * @param {number} x The point, in cells.
 * @param {number} y The point, in cells.
 * @param {number} clock The seeds' clock (`clockAt`).
 * @param {SeedOptions} [options] From `seedOptions` (the defaults if none).
 * @returns {{ cell: [number, number], seed: [number, number], edge: number }} The nearest seed's square, the seed, and the distance to its cell's border, in cells.
 */
export function macroAt(x, y, clock, options = seedOptions()) {
	const ix = Math.floor(x);
	const iy = Math.floor(y);
	let best = Infinity;
	/** @type {[number, number]} */
	let cell = [ix, iy];
	/** @type {[number, number]} */
	let seed = [ix, iy];
	for (let j = -1; j <= 1; j++)
		for (let i = -1; i <= 1; i++) {
			const s = macroSeed(ix + i, iy + j, clock, options);
			const d = (s[0] - x) ** 2 + (s[1] - y) ** 2;
			if (d < best) [best, cell, seed] = [d, [ix + i, iy + j], s];
		}
	let edge = Infinity;
	for (let j = -1; j <= 1; j++)
		for (let i = -1; i <= 1; i++) {
			if (i === 0 && j === 0) continue;
			const s = macroSeed(cell[0] + i, cell[1] + j, clock, options);
			const nx = s[0] - seed[0];
			const ny = s[1] - seed[1];
			const l = Math.hypot(nx, ny);
			if (l > 1e-5) edge = Math.min(edge, ((s[0] + seed[0]) / 2 - x) * (nx / l) + ((s[1] + seed[1]) / 2 - y) * (ny / l));
		}
	return { cell, seed, edge };
}

/**
 * Keeps the part of a polygon on `site`'s side of the bisector between
 * `site` and `other` (one Sutherland–Hodgman step, as the sketch clips).
 *
 * @param {[number, number][]} poly The polygon.
 * @param {[number, number]} site The seed whose side is kept.
 * @param {[number, number]} other The other seed.
 * @returns {[number, number][]} The clipped polygon (fewer than three points when nothing is left).
 */
function clipHalfPlane(poly, site, other) {
	const mx = (site[0] + other[0]) / 2;
	const my = (site[1] + other[1]) / 2;
	const nx = other[0] - site[0];
	const ny = other[1] - site[1];
	if (nx * nx + ny * ny < 1e-12) return poly;
	/** @type {[number, number][]} */
	const out = [];
	for (let i = 0; i < poly.length; i++) {
		const a = poly[i];
		const b = poly[(i + 1) % poly.length];
		const da = (a[0] - mx) * nx + (a[1] - my) * ny;
		const db = (b[0] - mx) * nx + (b[1] - my) * ny;
		if (da <= 0) out.push(a);
		if (da <= 0 !== db <= 0) {
			const t = da / (da - db);
			out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
		}
	}
	return out;
}

/**
 * One frame's cells as polygons, in CSS px from the top left: what the
 * shader draws, as the sketch drew it (each cell clipped against its
 * neighbours' bisectors, the inner cells against their macro cell).
 *
 * @param {VoronoiMeshConfig} config The settings (the same as the shader's).
 * @param {number} width The target's width, CSS px.
 * @param {number} height Its height.
 * @param {number} [time=0] Seconds, as the shader's clock (already at its speed).
 * @returns {{ macro: [number, number][][], inner: [number, number][][] }} The macro cells and the inner cells.
 */
export function meshPolygons(config, width, height, time = 0) {
	const o = withDefaults(config);
	const options = seedOptions(config);
	const clock = clockAt(time, o.breathe);
	const unit = width / o.cells;
	const [ox, oy] = config.offset ?? [0, 0];
	const x0 = ox;
	const y0 = oy;
	const x1 = ox + o.cells;
	const y1 = oy + height / unit;
	/** @type {[number, number][]} */
	const bound = [
		[x0 - 1, y0 - 1],
		[x1 + 1, y0 - 1],
		[x1 + 1, y1 + 1],
		[x0 - 1, y1 + 1],
	];
	const toPx = (/** @type {[number, number][]} */ poly) => poly.map(([x, y]) => /** @type {[number, number]} */ ([(x - x0) * unit, (y - y0) * unit]));
	/** @type {[number, number][][]} */
	const macro = [];
	/** @type {[number, number][][]} */
	const inner = [];
	for (let cy = Math.floor(y0) - 2; cy <= Math.floor(y1) + 2; cy++)
		for (let cx = Math.floor(x0) - 2; cx <= Math.floor(x1) + 2; cx++) {
			const seed = macroSeed(cx, cy, clock, options);
			let poly = bound;
			for (let j = -2; j <= 2 && poly.length > 2; j++)
				for (let i = -2; i <= 2 && poly.length > 2; i++) if (i || j) poly = clipHalfPlane(poly, seed, macroSeed(cx + i, cy + j, clock, options));
			if (poly.length < 3) continue;
			macro.push(toPx(poly));
			const seeds = innerSeeds(cx, cy, clock, options);
			for (const [k, q] of seeds.entries()) {
				let cell = poly;
				for (const [m, r] of seeds.entries()) if (m !== k && cell.length > 2) cell = clipHalfPlane(cell, q, r);
				if (cell.length > 2) inner.push(toPx(cell));
			}
		}
	return { macro, inner };
}

/**
 * The two line colours as the shader takes them.
 *
 * @param {VoronoiMeshConfig} config The settings.
 * @returns {[string, string]} The macro lines' colour and the inner lines'.
 */
export function meshColors(config) {
	const colors = pickColors(config, STONE, (palette) => [palette.glint, palette.colors[0]]);
	return [colors[0], colors[1] ?? colors[0]];
}

/**
 * One frame as an SVG, the polygons of `meshPolygons` stroked in the
 * line colours over the ground, with the quiet area as a mask: the still
 * a page shows before the shader starts and without WebGL.
 *
 * @param {VoronoiMeshConfig} config The settings (the same as the shader's).
 * @param {number} width The target's width, CSS px.
 * @param {number} height Its height.
 * @param {number} [time=0] Seconds, as the shader's clock.
 * @returns {string} The SVG's markup.
 */
export function meshSvg(config, width, height, time = 0) {
	const o = withDefaults(config);
	const { macro, inner } = meshPolygons(config, width, height, time);
	const [macroColor, innerColor] = meshColors(config);
	const drive = driveAt(time, o.breathe);
	const w = o.width * (1 + drive * WIDTH_BOOST);
	const alpha = [Math.min(1, o.opacity[0] * (1 + drive)), o.opacity[1]];
	const r = (/** @type {number} */ n) => Math.round(n * 10) / 10;
	const path = (/** @type {[number, number][][]} */ polys) => polys.map((poly) => `M${poly.map(([x, y]) => `${r(x)} ${r(y)}`).join('L')}Z`).join('');
	const [qx, qy, radius, depth] = quietUniform(config.quiet, width / height);
	let mask = '';
	let use = '';
	if (radius > 0) {
		const stops = [0, 0.06, 0.25, 0.5, 0.75, 1].map((at) => {
			const t = Math.min(1, Math.max(0, (at - 0.06) / 0.94));
			const v = Math.round((1 - depth + depth * t * t * (3 - 2 * t)) * 255);
			return `<stop offset="${at}" stop-color="rgb(${v},${v},${v})"/>`;
		});
		mask = `<radialGradient id="q" gradientUnits="userSpaceOnUse" cx="${r(width / 2 + qx * height)}" cy="${r(height / 2 - qy * height)}" r="${r(radius * height)}">${stops.join('')}</radialGradient><mask id="m"><rect width="${width}" height="${height}" fill="url(#q)"/></mask>`;
		use = ' mask="url(#m)"';
	}
	const opaque = Boolean(o.background) && o.background !== 'transparent';
	const ground = opaque ? `<rect width="${width}" height="${height}" fill="${o.background}"/>` : '';
	/**
	 * A tier's stroke: on a ground, the line colour mixed into it in Oklab at
	 * the tier's opacity (as the shader mixes) and drawn solid; with none,
	 * the colour itself at that opacity.
	 *
	 * @param {string} color The line colour.
	 * @param {number} a The tier's opacity.
	 * @returns {string} The path's stroke attributes.
	 */
	const stroke = (color, a) =>
		opaque ? `stroke="${toHex(mixOklab(parseColor(o.background), parseColor(color), a))}"` : `stroke="${color}" opacity="${r(a * 100) / 100}"`;
	const lines = [
		inner.length && o.inner > 0 ? `<path d="${path(inner)}" ${stroke(innerColor, alpha[1])} stroke-width="${r(w * INNER_WIDTH * 100) / 100}"/>` : '',
		`<path d="${path(macro)}" ${stroke(macroColor, alpha[0])} stroke-width="${r(w * 100) / 100}"/>`,
	].join('');
	return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${mask ? `<defs>${mask}</defs>` : ''}${ground}<g fill="none" stroke-linejoin="round"${use}>${lines}</g></svg>`;
}

/**
 * One frame as a CSS `background`: the SVG of `meshSvg` as a data URL,
 * stretched to the box, over the ground colour. For the element's
 * `background` (or a card's) so the mesh shows before the shader starts
 * and without WebGL. Made for one size: a box of another shape stretches
 * it, so give the box's own size.
 *
 * @param {VoronoiMeshConfig} config The settings (the same as the shader's).
 * @param {number} width The box's width, CSS px.
 * @param {number} height Its height.
 * @param {number} [time=0] Seconds, as the shader's clock.
 * @returns {string} A CSS `background` value.
 */
export function meshStill(config, width, height, time = 0) {
	const svg = meshSvg(config, width, height, time).replace(/[#%<>"]/g, (c) => encodeURIComponent(c));
	const ground = config.background === 'transparent' ? 'transparent' : config.background ?? MESH_DEFAULTS.background;
	return `url("data:image/svg+xml,${svg}") 0 0 / 100% 100% no-repeat, ${ground}`;
}

/**
 * Starts the mesh on an element: a canvas inside it (its first), filling it.
 *
 * @param {HTMLElement} el The element.
 * @param {VoronoiMeshConfig} config The settings.
 * @returns {() => void} Stops it.
 */
export function voronoiMesh(el, config) {
	const o = withDefaults(config);
	const options = seedOptions(config);
	const speed = config.speed ?? 1;
	const lab = (/** @type {string} */ c) => toOklab(parseColor(c));
	let [macro, inner] = meshColors(config).map(lab);
	const opaque = Boolean(o.background) && o.background !== 'transparent';
	const bg = opaque ? [...lab(o.background), 1] : [0, 0, 0, 0];
	const start = frameNow();
	let ratio = 1;

	const { stage, stop } = createStage(el, {
		fragment: FRAG,
		still: speed <= 0,
		setup({ gl, uniform }) {
			gl.uniform1f(uniform('uCells'), Math.max(0.5, o.cells));
			gl.uniform2f(uniform('uOffset'), ...(config.offset ?? [0, 0]));
			gl.uniform1f(uniform('uJitter'), options.jitter);
			gl.uniform1f(uniform('uOrbit'), options.orbit);
			gl.uniform1f(uniform('uInner'), options.inner);
			gl.uniform1f(uniform('uSpread'), options.spread);
			gl.uniform1f(uniform('uPulse'), options.pulse);
			gl.uniform4f(uniform('uBg'), bg[0], bg[1], bg[2], bg[3]);
		},
		resize({ gl, uniform, canvas, ratio: r }) {
			ratio = r;
			gl.uniform4f(uniform('uQuiet'), ...quietUniform(config.quiet, canvas.width / canvas.height));
		},
		uniforms({ gl, uniform }, now) {
			const t = ((now - start) / 1000) * Math.max(0, speed);
			const drive = driveAt(t, o.breathe);
			const w = o.width * (1 + drive * WIDTH_BOOST) * ratio;
			gl.uniform1f(uniform('uClock'), clockAt(t, o.breathe));
			gl.uniform2f(uniform('uWidth'), w, w * INNER_WIDTH);
			gl.uniform2f(uniform('uAlpha'), Math.min(1, o.opacity[0] * (1 + drive)), o.inner > 0 ? o.opacity[1] : 0);
			gl.uniform3f(uniform('uMacro'), macro[0], macro[1], macro[2]);
			gl.uniform3f(uniform('uInnerCol'), inner[0], inner[1], inner[2]);
		},
	});
	if (!stage) return stop;

	const unwatch = watchColors(el, (next) => {
		[macro, inner] = meshColors({ colors: next.colors }).map(lab);
		if (stage.still) stage.redraw();
	});
	return () => {
		stop();
		unwatch();
	};
}
