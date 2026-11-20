/**
 * @module @arraypress/effects-astro/kinetic-grid
 *
 * A fine wireframe grid that ripples where drops land. A few drops are
 * alive at once; each sends a damped ring out across the wires, which
 * bunch and spread as it passes and settle behind it, brighter where a
 * wire is stretched. Now and then a thin bright ring sweeps out from a
 * point and lights the wire segments it crosses, so pulses read as dashes
 * running along the lines. On an opaque dark ground by default.
 *
 * Nothing is simulated. Each drop's place and landing time are a seeded
 * function of its slot and its cycle (`dropAt`), so the field is the same
 * at the same second whatever the frame rate, and each drop is a radial
 * wave packet whose displacement and stretch are written out in full
 * (`ripple`): the shader moves each pixel back by the summed waves and
 * draws anti-aliased lines, in CSS px, at the grid's rest place. The drops
 * and pulses alive at a moment (`dropsAt`, `pulsesAt`) are worked out once
 * a frame here and handed to the shader, so the pixel work is a handful
 * of exponentials and nothing else; ten cards can run at once.
 *
 * Its unit is the width, so a card and a hero with the same `cols` look
 * alike. A `quiet` area calms the waves and dims the wires behind copy.
 * Without WebGL nothing is drawn (`gridStill` makes a CSS still of the
 * grid at rest); with prefers-reduced-motion, or `speed: 0`, one still
 * frame with ripples on it.
 *
 * After `grid_bg`, a Processing sketch shared with the owner (2026-11-20):
 * its look (a mass-spring wireframe, raindrop impulses, ring pulses
 * lighting whole wire segments, an additive glow, the blue on near-black)
 * is the sketch's; here the springs are replaced by analytic waves, by
 * the second rather than by the frame. Drops are placed with Dave
 * Hoskins' Hash without Sine (MIT, © 2014 David Hoskins).
 */

import { createStage } from './stage.js';
import { hash33 } from './hash-noise.js';
import { GLSL_OKLAB, parseColor, toOklab, mixOklab, toHex } from './color.js';
import { GLSL_QUIET, quietUniform } from './glsl.js';
import { watchColors } from './mount.js';
import { pickColors } from './palettes.js';

/** Hash without Sine (./hash-noise.js), the drops' and pulses' hash. */
export { hash33 };

/**
 * @typedef {object} KineticGridConfig
 * @property {string[]} [colors] Two CSS hex colours: the wires' and the pulses'. Default the sketch's blue and white.
 * @property {string} [palette] A shared palette by name (PALETTES; any case), when there are no `colors`: its first colour for the wires, its glint for the pulses.
 * @property {string} [background='#0a0a0a'] The ground, a CSS hex colour (opaque, so the canvas covers what is under it); `transparent` leaves it clear.
 * @property {number} [cols=48] Grid cells across, whatever the width (cells are square).
 * @property {number} [width=1] A wire's width, CSS px.
 * @property {number} [rest=0.35] How bright a wire at rest is, 0–1; stretched wires brighten to full.
 * @property {number} [drops=4] Drops alive at once, 0–6 (each slot lands a new one about every five seconds).
 * @property {number} [strength=1] How far the ripples push the wires, 0–1.6 (past that they fold).
 * @property {number} [size=1] The ripples' scale: wavelength, reach and speed together, 0.5–2.
 * @property {number} [pulses=3] Ring pulses alive at once, 0–4 (each slot about every two and a half seconds).
 * @property {number} [speed=1] Plays the clock faster or slower; 0 for one still frame.
 * @property {number} [offset=0] Seeds where and when drops land, so two cards differ.
 * @property {{ x?: number, y?: number, radius?: number, depth?: number } | null} [quiet=null]
 *   An area kept calm and dim: centre (0–1 from the top left), radius (share of the height), depth (0–1).
 */

/** The settings' defaults. */
export const KINETIC_DEFAULTS = {
	background: '#0a0a0a',
	cols: 48,
	width: 1,
	rest: 0.35,
	drops: 4,
	strength: 1,
	size: 1,
	pulses: 3,
	speed: 1,
	offset: 0,
};

/** The default colours, the sketch's: a clear blue for the wires, white for the pulses. */
const SKETCH = ['#3197ff', '#ffffff'];

/** Most drop slots (the shader's array). */
export const MAX_DROPS = 6;
/** Most pulse slots (the shader's array). */
export const MAX_PULSES = 4;

/**
 * A drop's timing, in seconds: a slot lands a drop every `period`, up to
 * `jitter` late, and it lasts `life`. Its amplitude falls by e every `decay`.
 */
export const DROP_TIMING = { period: 5, jitter: 0.8, life: 4.2, decay: 1.8, rise: 0.15 };

/**
 * A pulse's timing, in seconds: a slot fires every `period`, up to
 * `jitter` late, and a ring takes `life` to reach its widest and fade.
 */
export const PULSE_TIMING = { period: 2.6, jitter: 1.1, life: 1.5 };

/**
 * The ripple's shape at `size` 1, in widths: how fast the front travels (a
 * second), the wavelength, the packet's half-width at landing and how fast
 * it widens (a second), the calm core at the centre, the height at
 * `strength` 1, and a pulse ring's widest radius.
 */
export const WAVE = { speed: 0.1, wavelength: 0.14, sigma: 0.03, spread: 0.018, core: 0.02, amp: 0.006, reach: 0.17 };

/** How much strain lights a wire fully. */
const FULL_STRAIN = 0.22;

/** A pulse ring's half-width, in cells: the wire segments whose middles fall within it light up. */
const PULSE_BAND = 0.55;

/**
 * Where and when a slot's drop for a cycle lands.
 *
 * @param {number} slot The slot, 0 up.
 * @param {number} cycle The cycle, any whole number (negative before the clock starts).
 * @param {number} [offset=0] The seed.
 * @returns {{ x: number, y: number, start: number }} Its place, 0–1 of the width and height from the top
 *   left (kept off the very edge), and when it lands, seconds.
 */
export function dropAt(slot, cycle, offset = 0) {
	const [hx, hy, ht] = hash33(slot + 1.37, cycle + 0.5, offset + 7.11);
	const { period, jitter } = DROP_TIMING;
	// the slots are spread through the period, so drops land one at a time
	const phase = (slot / MAX_DROPS) * period;
	return { x: 0.06 + 0.88 * hx, y: 0.06 + 0.88 * hy, start: cycle * period + phase + ht * jitter };
}

/**
 * A drop's height over its life: a quick rise, then falling by e every
 * `decay` seconds, eased to nothing by the end of its life.
 *
 * @param {number} age Seconds since it landed.
 * @returns {number} 0–1 (0 before it lands and after it ends).
 */
export function dropEnvelope(age) {
	const { life, decay, rise } = DROP_TIMING;
	if (age <= 0 || age >= life) return 0;
	const up = smooth(0, rise, age);
	const down = 1 - smooth(life * 0.7, life, age);
	return up * down * Math.exp(-age / decay);
}

/**
 * The drops alive at a moment: each slot's current (or last) drop, while
 * it lasts.
 *
 * @param {number} time Seconds on the clock (already at its speed).
 * @param {{ drops?: number, offset?: number }} [config] How many slots, and the seed.
 * @returns {{ x: number, y: number, age: number, amp: number }[]} Each live drop: its place (0–1 of the
 *   width and height), its age in seconds, and its envelope (0–1).
 */
export function dropsAt(time, config = {}) {
	const slots = clampInt(config.drops ?? KINETIC_DEFAULTS.drops, 0, MAX_DROPS);
	const offset = config.offset ?? 0;
	const { period } = DROP_TIMING;
	const live = [];
	for (let slot = 0; slot < slots; slot++) {
		const phase = (slot / MAX_DROPS) * period;
		const cycle = Math.floor((time - phase) / period);
		// this cycle's drop may not have landed yet (it lands up to `jitter` late): then the last one may still be running
		for (const c of [cycle, cycle - 1]) {
			const d = dropAt(slot, c, offset);
			const amp = dropEnvelope(time - d.start);
			if (amp > 0) {
				live.push({ x: d.x, y: d.y, age: time - d.start, amp });
				break;
			}
		}
	}
	return live;
}

/**
 * The pulse rings alive at a moment.
 *
 * @param {number} time Seconds on the clock (already at its speed).
 * @param {{ pulses?: number, offset?: number, size?: number }} [config] How many slots, the seed and the scale.
 * @returns {{ x: number, y: number, radius: number, glow: number }[]} Each live ring: its centre (0–1 of
 *   the width and height), its radius in widths, and its brightness (0–1).
 */
export function pulsesAt(time, config = {}) {
	const slots = clampInt(config.pulses ?? KINETIC_DEFAULTS.pulses, 0, MAX_PULSES);
	const offset = config.offset ?? 0;
	const size = config.size ?? 1;
	const { period, jitter, life } = PULSE_TIMING;
	const live = [];
	for (let slot = 0; slot < slots; slot++) {
		const phase = (slot / MAX_PULSES) * period;
		const cycle = Math.floor((time - phase) / period);
		const [hx, hy, ht] = hash33(slot + 11.7, cycle + 0.5, offset + 3.3);
		const a = (time - (cycle * period + phase + ht * jitter)) / life;
		if (a <= 0 || a >= 1) continue;
		// eased out: fast at first, slowing as it fades
		const radius = WAVE.reach * size * (1 - (1 - a) * (1 - a));
		live.push({ x: 0.05 + 0.9 * hx, y: 0.05 + 0.9 * hy, radius, glow: smooth(0, 0.08, a) * (1 - a) ** 1.5 });
	}
	return live;
}

/**
 * One drop's ripple at a distance from where it landed: a wave packet
 * (a sine under a widening Gaussian) whose front travels out, calm at
 * the very centre. Positive pushes outward.
 *
 * @param {number} r Distance from the drop, widths.
 * @param {number} age Seconds since it landed.
 * @param {number} [size=1] The ripples' scale.
 * @returns {[number, number]} The radial displacement (widths, before the drop's envelope and the
 *   strength) and its rate of change with distance (the radial strain).
 */
export function ripple(r, age, size = 1) {
	const front = WAVE.speed * size * age;
	const sigma = (WAVE.sigma + WAVE.spread * age) * size;
	const k = (2 * Math.PI) / (WAVE.wavelength * size);
	const eps = WAVE.core * size;
	const s = r - front;
	const g = Math.exp(-(s * s) / (sigma * sigma));
	const e = Math.exp(-(r * r) / (eps * eps));
	const h = 1 - e;
	const sin = Math.sin(k * s);
	const f = sin * g * h;
	const df = g * h * (k * Math.cos(k * s) - ((2 * s) / (sigma * sigma)) * sin) + sin * g * ((2 * r) / (eps * eps)) * e;
	return [f, df];
}

/**
 * How far the grid is moved at a point: every live drop's ripple, summed,
 * as the shader sums them (before any quiet area).
 *
 * @param {number} x Across, widths from the left.
 * @param {number} y Down, widths from the top.
 * @param {number} time Seconds on the clock (already at its speed).
 * @param {KineticGridConfig} [config] The settings.
 * @param {number} [aspect=1] The target's height over its width.
 * @returns {[number, number]} The displacement, widths, x and y (y down).
 */
export function displacement(x, y, time, config = {}, aspect = 1) {
	const size = config.size ?? 1;
	const height = WAVE.amp * size * (config.strength ?? 1);
	let dx = 0;
	let dy = 0;
	for (const d of dropsAt(time, config)) {
		const vx = x - d.x;
		const vy = y - d.y * aspect;
		const r = Math.hypot(vx, vy);
		if (r < 1e-9) continue;
		const [f] = ripple(r, d.age, size);
		dx += (vx / r) * f * d.amp * height;
		dy += (vy / r) * f * d.amp * height;
	}
	return [dx, dy];
}

/**
 * The two colours as the shader takes them.
 *
 * @param {KineticGridConfig} config The settings.
 * @returns {[string, string]} The wires' colour and the pulses'.
 */
export function gridColors(config) {
	const colors = pickColors(config, SKETCH, (palette) => [palette.colors[0], palette.glint]);
	return [colors[0], colors[1] ?? colors[0]];
}

/**
 * A CSS background of the grid at rest, for what shows before the shader
 * starts and without WebGL: the ground with the wires at their rest
 * brightness, laid as the shader lays them (square cells, `cols` across,
 * centred down the height).
 *
 * @param {KineticGridConfig} [config] The settings.
 * @param {number} [aspect=1.25] The target's height over its width (a 4:5 card is 1.25).
 * @returns {string} A CSS `background` value.
 */
export function gridStill(config = {}, aspect = 1.25) {
	const o = { ...KINETIC_DEFAULTS, ...config };
	const [line] = gridColors(config);
	const ground = !o.background || o.background === 'transparent' ? null : o.background;
	const wire = ground ? toHex(mixOklab(parseColor(ground), parseColor(line), o.rest)) : line;
	const w = `${o.width}px`;
	const cell = `calc(100% / ${o.cols})`;
	const rows = aspect * o.cols;
	// the shader centres the rows: the first line sits half the left-over part of a cell down
	const y = `calc(100% * ${((rows - Math.floor(rows)) / 2 / rows).toFixed(5)} - ${o.width / 2}px)`;
	const across = `linear-gradient(90deg, ${wire} 0 ${w}, transparent ${w}) -${o.width / 2}px 0 / ${cell} 100%`;
	const down = `linear-gradient(${wire} 0 ${w}, transparent ${w}) 0 ${y} / 100% calc(100% / ${rows.toFixed(3)})`;
	return ground ? `${across}, ${down}, ${ground}` : `${across}, ${down}`;
}

const FRAG = `
precision highp float;
uniform vec2 uRes;
uniform float uCols;
uniform float uWidth;
uniform float uRatio;
uniform float uRest;
uniform float uHeight;
uniform vec4 uWave;
uniform float uCore;
uniform vec4 uDrops[${MAX_DROPS}];
uniform vec4 uPulses[${MAX_PULSES}];
uniform vec3 uLine;
uniform vec3 uPulse;
uniform vec4 uBg;
${GLSL_OKLAB}
${GLSL_QUIET}

// Coverage of a line (or dot) of width w device px at a distance d px from its middle, anti-aliased.
float cover(float d, float w) {
	return clamp(0.5 * max(w, 1.0) + 0.5 - d, 0.0, 1.0) * min(w, 1.0);
}

// A pulse ring's light on a wire segment whose middle is m (cells).
float pulseOn(vec2 m) {
	float p = 0.0;
	for (int i = 0; i < ${MAX_PULSES}; i++) {
		vec4 q = uPulses[i];
		if (q.w <= 0.0) continue;
		float b = max(0.0, 1.0 - abs(length(m - q.xy) - q.z) / ${PULSE_BAND.toFixed(3)});
		p = max(p, b * q.w);
	}
	return p;
}

void main() {
	// widths from the top left
	vec2 px = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y);
	vec2 q = px / uRes.x;
	vec2 quv = vec2(px.x - 0.5 * uRes.x, 0.5 * uRes.y - px.y) / uRes.y;
	float calm = mix(1.0 - uQuiet.w, 1.0, quietOpen(quv));

	// every drop's ripple: the displacement D and its Jacobian J (xx, xy, yy; it is symmetric)
	vec2 D = vec2(0.0);
	vec3 J = vec3(0.0);
	for (int i = 0; i < ${MAX_DROPS}; i++) {
		vec4 d = uDrops[i];
		if (d.w <= 0.0) continue;
		vec2 v = q - d.xy;
		float r = max(length(v), 1e-5);
		float front = uWave.x * d.z;
		float sig = uWave.z + uWave.w * d.z;
		float s = r - front;
		if (abs(s) > 3.2 * sig) continue;
		float g = exp(-(s * s) / (sig * sig));
		float e = exp(-(r * r) / (uCore * uCore));
		float h = 1.0 - e;
		float sn = sin(uWave.y * s);
		float a = d.w * uHeight;
		float f = a * sn * g * h;
		float df = a * (g * h * (uWave.y * cos(uWave.y * s) - 2.0 * s / (sig * sig) * sn) + sn * g * 2.0 * r / (uCore * uCore) * e);
		vec2 u = v / r;
		float fr = f / r;
		D += u * f;
		J += vec3(df * u.x * u.x + fr * (1.0 - u.x * u.x), (df - fr) * u.x * u.y, df * u.y * u.y + fr * (1.0 - u.y * u.y));
	}
	D *= calm;
	J *= calm;

	// the grid's rest place under this pixel, in cells, the rows centred down the height
	float rows = uRes.y / uRes.x * uCols;
	vec2 X = (q - D) * uCols - vec2(0.0, 0.5 * fract(rows));
	vec2 n = floor(X + 0.5);
	vec2 f = X - n;
	float cell = uRes.x / uCols;
	// distance to the nearest vertical and horizontal wire, device px, through the stretch
	float dV = abs(f.x) * cell / length(vec2(1.0 - J.x, J.y));
	float dH = abs(f.y) * cell / length(vec2(J.y, 1.0 - J.z));
	float cV = cover(dV, uWidth);
	float cH = cover(dH, uWidth);
	// a wire brightens where it is stretched or squeezed along its length
	float tV = clamp((abs(J.z) + 0.5 * abs(J.y)) / ${FULL_STRAIN.toFixed(3)}, 0.0, 1.0);
	float tH = clamp((abs(J.x) + 0.5 * abs(J.y)) / ${FULL_STRAIN.toFixed(3)}, 0.0, 1.0);
	// and where it is carried off its place, so the ring reads all the way round
	float moved = clamp(length(D) * uCols / 0.3, 0.0, 1.0);
	tV = max(tV, 0.7 * moved);
	tH = max(tH, 0.7 * moved);
	float lV = cV * mix(uRest, 1.0, tV);
	float lH = cH * mix(uRest, 1.0, tH);
	float glowW = 3.0 * uRatio;
	float glow = 0.28 * (exp(-dV * dV / (glowW * glowW)) * tV + exp(-dH * dH / (glowW * glowW)) * tH);
	// the knots light while they move
	float knot = cover(length(vec2(dV, dH)), 2.4 * uWidth) * moved;
	float line = 1.0 - (1.0 - lV) * (1.0 - lH);
	line = clamp(line + glow + 0.6 * knot, 0.0, 1.0) * calm;

	// ring pulses light whole segments: each wire's segment is judged by its middle
	float pV = pulseOn(vec2(n.x, floor(X.y) + 0.5));
	float pH = pulseOn(vec2(floor(X.x) + 0.5, n.y));
	float pulse = clamp(1.4 * (cV * pV + cH * pH) + knot * max(pV, pH), 0.0, 1.0) * calm;

	vec3 lab = mix(uLine, uPulse, pulse);
	float alpha = max(line, pulse);
	if (uBg.a > 0.0) {
		gl_FragColor = vec4(fromOklab(mix(uBg.rgb, lab, alpha)), 1.0);
	} else {
		gl_FragColor = vec4(fromOklab(lab) * alpha, alpha);
	}
}
`;

/**
 * Starts the grid on an element: a canvas inside it (its first), filling it.
 *
 * @param {HTMLElement} el The element.
 * @param {KineticGridConfig} config The settings.
 * @returns {() => void} Stops it.
 */
export function kineticGrid(el, config) {
	const o = { ...KINETIC_DEFAULTS, ...config };
	const speed = Math.max(0, o.speed);
	const size = Math.max(0.25, o.size);
	const lab = (/** @type {string} */ c) => toOklab(parseColor(c));
	let [line, pulse] = gridColors(config).map(lab);
	const opaque = o.background && o.background !== 'transparent';
	const bg = opaque ? [...lab(o.background), 1] : [0, 0, 0, 0];
	const drops = new Float32Array(MAX_DROPS * 4);
	const pulses = new Float32Array(MAX_PULSES * 4);
	const start = performance.now();
	let aspect = 1;

	const { stage, stop } = createStage(el, {
		fragment: FRAG,
		still: speed <= 0,
		setup({ gl, uniform }) {
			gl.uniform1f(uniform('uRest'), o.rest);
			gl.uniform1f(uniform('uHeight'), WAVE.amp * size * Math.min(1.6, Math.max(0, o.strength)));
			gl.uniform4f(uniform('uWave'), WAVE.speed * size, (2 * Math.PI) / (WAVE.wavelength * size), WAVE.sigma * size, WAVE.spread * size);
			gl.uniform1f(uniform('uCore'), WAVE.core * size);
			gl.uniform4f(uniform('uBg'), bg[0], bg[1], bg[2], bg[3]);
		},
		resize({ gl, uniform, canvas, ratio }) {
			aspect = canvas.height / canvas.width;
			gl.uniform1f(uniform('uCols'), Math.max(1, o.cols));
			gl.uniform1f(uniform('uWidth'), o.width * ratio);
			gl.uniform1f(uniform('uRatio'), ratio);
			gl.uniform4f(uniform('uQuiet'), ...quietUniform(config.quiet, canvas.width / canvas.height));
		},
		uniforms({ gl, uniform }, now) {
			const time = ((now - start) / 1000) * speed;
			drops.fill(0);
			dropsAt(time, o).forEach((d, i) => drops.set([d.x, d.y * aspect, d.age, d.amp], i * 4));
			pulses.fill(0);
			// pulse centres and radii in cells, the rows centred as the grid's are
			const shift = 0.5 * (aspect * o.cols - Math.floor(aspect * o.cols));
			pulsesAt(time, { ...o, size }).forEach((p, i) => pulses.set([p.x * o.cols, p.y * aspect * o.cols - shift, p.radius * o.cols, p.glow], i * 4));
			gl.uniform4fv(uniform('uDrops[0]'), drops);
			gl.uniform4fv(uniform('uPulses[0]'), pulses);
			gl.uniform3f(uniform('uLine'), line[0], line[1], line[2]);
			gl.uniform3f(uniform('uPulse'), pulse[0], pulse[1], pulse[2]);
		},
	});
	if (!stage) return stop;

	const unwatch = watchColors(el, (next) => {
		[line, pulse] = gridColors({ colors: next.glint ? [next.colors[0], next.glint] : next.colors }).map(lab);
		if (stage.still) stage.redraw();
	});
	return () => {
		stop();
		unwatch();
	};
}

/**
 * Hermite smoothstep.
 *
 * @param {number} e0 Where it starts.
 * @param {number} e1 Where it ends.
 * @param {number} x The value.
 * @returns {number} 0–1.
 */
function smooth(e0, e1, x) {
	const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
	return t * t * (3 - 2 * t);
}

/**
 * A whole number within bounds.
 *
 * @param {number} n The number.
 * @param {number} lo The least.
 * @param {number} hi The most.
 * @returns {number} It, rounded and clamped.
 */
function clampInt(n, lo, hi) {
	return Math.min(hi, Math.max(lo, Math.round(n)));
}
