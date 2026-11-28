/**
 * @module @arraypress/effects-astro/flow-field
 *
 * A Perlin-style flow field with hundreds of short, fine trails riding
 * it: each trail is born somewhere at random, follows the field (its
 * heading is the noise there, turned up to two whole turns, so trails
 * gather into streams and swing round in loops), fades in, lives a few
 * seconds and fades out, its tail thinning as it goes. The field itself
 * evolves slowly, and two slow signals drift the look: one how many
 * trails there are, how fast new ones travel and how fast the field
 * changes; the other how heavy the lines are.
 *
 * The simulation (`createFlow`) is plain JavaScript and steps at a fixed
 * 60 ticks a second whatever the frame rate, with every clock in seconds;
 * it is seeded (`seed`), so two cards differ and the same card is the
 * same on every load. Trail counts follow the element's area (`density`
 * is trails per 100 × 100 CSS px) and the field's features follow its
 * size (`scale` across √(width × height)), so a card and a hero look
 * alike. It starts settled: the trails are already full, so the first
 * frame (and the still frame with prefers-reduced-motion or `speed: 0`)
 * is a field in motion, not an empty one.
 *
 * Canvas 2D, opaque: each frame fills the `background` and draws every
 * trail's tail over it, segment by segment, each fainter than the last,
 * so trails fade into the ground colour exactly (no smear). Segments are
 * grouped by colour and alpha so a frame is a few dozen strokes, not
 * thousands. Colours blend in Oklab, along each trail's life or by its
 * speed. A `quiet` area spawns fewer trails and dims those passing
 * through, behind a centred lockup. Canvas 2D rather than WebGL: fine
 * antialiased hairlines come free, and a wall of cards takes no WebGL
 * contexts from the effects beside it.
 *
 * After `perlin_field_bg`, a Processing sketch shared with the owner
 * (2026-11-20): the heading as noise × 4π, the tail of thirty steps drawn
 * every third, fading from the head, and the two slow drives are its;
 * here the field is sampled smoothly rather than on a 40px grid, trails
 * live and die rather than run on, and everything is by the second.
 */

import { createCanvas2D } from './canvas2d.js';
import { mixOklab, parseColor } from './color.js';
import { noiseGrad } from './curl.js';
import { quietUniform } from './glsl.js';
import { watchColors } from './mount.js';
import { pickColors } from './palettes.js';
import { seededRandom } from './random.js';
import { frameNow } from './loop.js';

/**
 * @typedef {object} FlowFieldConfig
 * @property {string[]} [colors] The trails' colours, CSS hex, blended in Oklab along each trail's life (or by its speed). Default white.
 * @property {string} [palette] A shared palette by name (PALETTES; any case), when there are no `colors`.
 * @property {string} [background='#000000'] The ground, CSS hex: filled every frame, so the canvas is opaque.
 * @property {'life' | 'speed' | 'random'} [colorBy='life'] What picks a trail's colour along `colors`: its age, how fast it travels, or one colour each at random.
 * @property {number} [density=12] Trails per 100 × 100 CSS px, on average.
 * @property {number} [length=0.5] How much of its path a trail shows behind it, seconds.
 * @property {number} [weight=0.7] Line width, CSS px.
 * @property {number} [opacity=0.75] A trail head's opacity, 0–1; the tail fades from it.
 * @property {number} [pace=110] How fast trails travel, CSS px a second, on average.
 * @property {number} [scale=2] How many noise features span the element (across √(width × height)); higher is busier.
 * @property {number} [evolve=0.15] How fast the field changes, noise units a second.
 * @property {number} [life=4] A trail's average life, seconds (each lives half to one and a half times it).
 * @property {number} [vary=0.7] How far the slow drives swing density, pace, weight and evolution, 0–1; 0 holds them.
 * @property {number} [speed=1] Plays every clock faster or slower; 0 for one still frame.
 * @property {number} [seed=1] Which field and which trails: the same seed draws the same.
 * @property {{ x?: number, y?: number, radius?: number, depth?: number } | null} [quiet=null]
 *   An area with fewer, fainter trails: centre (0–1 from the top left), radius (share of the height), depth (0–1).
 */

/** The settings' defaults. */
export const FLOW_DEFAULTS = Object.freeze({
	background: '#000000',
	colorBy: /** @type {'life' | 'speed' | 'random'} */ ('life'),
	density: 12,
	length: 0.5,
	weight: 0.7,
	opacity: 0.75,
	pace: 110,
	scale: 2,
	evolve: 0.15,
	life: 4,
	vary: 0.7,
	speed: 1,
	seed: 1,
});

/** The default trail colour: white, as the sketch drew. */
const WHITE = ['#ffffff'];

/** Simulation ticks a second: the sketch's frame rate, now fixed. */
export const TICKS = 60;

/** One tick, seconds. */
const TICK = 1 / TICKS;

/** How many segments a tail is drawn in (the sketch: thirty steps, every third). */
const SEGMENTS = 10;

/** Alpha steps segments are grouped by. */
const ALPHA_LEVELS = 10;

/** Colour steps along `colors` segments are grouped by (one colour needs one). */
const COLOR_LEVELS = 10;

/** Seconds a trail takes to fade in, and to fade out. */
const FADE_IN = 0.4;
const FADE_OUT = 0.7;

/** How fast the two slow drives wander, noise units a second (the sketch's `driveSpeed`). */
const DRIVE_RATE = 0.12;

/** How long a new canvas is run before its first frame, seconds, so it starts settled. */
const WARM = 2.5;

/** Scratch for one noise sample. */
const sample = new Float64Array(3);

/**
 * The field's noise in three dimensions: value noise across, blended
 * smoothly between independent slices in time, its spread kept even
 * between slices (a plain blend of two would go flat halfway).
 *
 * @param {number} x Across, noise units.
 * @param {number} y Down, noise units.
 * @param {number} z Time, noise units.
 * @returns {number} Around 0–1, centred on 0.5.
 */
export function flowNoise(x, y, z) {
	const iz = Math.floor(z);
	const f = z - iz;
	const u = f * f * (3 - 2 * f);
	const a = noiseGrad(x + iz * 31.7, y + iz * 17.3, sample)[0];
	const b = noiseGrad(x + (iz + 1) * 31.7, y + (iz + 1) * 17.3, sample)[0];
	const spread = Math.sqrt((1 - u) * (1 - u) + u * u);
	return 0.5 + (a + (b - a) * u - 0.5) / spread;
}

/**
 * The field's heading at a point, as the sketch turned it: the noise
 * times two whole turns.
 *
 * @param {number} x Across, noise units.
 * @param {number} y Down, noise units.
 * @param {number} z Time, noise units.
 * @returns {number} Radians.
 */
export function flowAngle(x, y, z) {
	return flowNoise(x, y, z) * Math.PI * 4;
}

/**
 * One of the slow drives: a signal that wanders 0–1 over tens of
 * seconds, stretched (as the sketch stretched its noise) so it reaches
 * both ends.
 *
 * @param {number} t Seconds.
 * @param {number} channel Which drive (each is independent).
 * @returns {number} 0–1.
 */
export function driveAt(t, channel) {
	const v = noiseGrad(t * DRIVE_RATE + channel * 57.31, channel * 13.7 + 0.5, sample)[0];
	return Math.min(1, Math.max(0, (v - 0.2) / 0.6));
}

/**
 * How much a quiet area lets through at a point: the GLSL quiet's
 * falloff (`quietOpen` in glsl.js), in CSS px.
 *
 * @param {number} x Across, CSS px from the left.
 * @param {number} y Down, CSS px from the top.
 * @param {number} width The element's width, CSS px.
 * @param {number} height Its height, CSS px.
 * @param {FlowFieldConfig['quiet']} quiet The area, or none.
 * @returns {number} 1 − depth at the area's centre, rising to 1 at its edge and beyond; 1 without one.
 */
export function quietFactor(x, y, width, height, quiet) {
	const [qx, qy, radius, depth] = quietUniform(quiet, width / height);
	if (radius <= 0) return 1;
	const d = Math.hypot((x - width / 2) / height - qx, (height / 2 - y) / height - qy);
	const t = Math.min(1, Math.max(0, (d - radius * 0.06) / (radius * 0.94)));
	return 1 - depth + depth * t * t * (3 - 2 * t);
}

/**
 * How many trails an element holds on average.
 *
 * @param {number} width CSS px.
 * @param {number} height CSS px.
 * @param {number} [density=12] Trails per 100 × 100 CSS px.
 * @returns {number} A whole number, at least 1 for any area.
 */
export function trailCount(width, height, density = FLOW_DEFAULTS.density) {
	return Math.max(width > 0 && height > 0 && density > 0 ? 1 : 0, Math.round(((width * height) / 10000) * Math.max(0, density)));
}

/**
 * The colours as strokes take them: steps along `colors`, blended in
 * Oklab from the first to the last.
 *
 * @param {string[]} colors CSS hex colours, at least one.
 * @param {number} [steps=10] How many (one colour gives one).
 * @returns {string[]} `rgb(…)` strings.
 * @throws {TypeError} When a colour is not hex.
 */
export function flowRamp(colors, steps = COLOR_LEVELS) {
	const cs = colors.map(parseColor);
	const css = (/** @type {number[]} */ c) => `rgb(${c.map((v) => Math.round(Math.min(1, Math.max(0, v)) * 255)).join(' ')})`;
	if (cs.length < 2) return [css(cs[0] ?? [1, 1, 1])];
	return Array.from({ length: steps }, (_, s) => {
		const k = (s / (steps - 1)) * (cs.length - 1);
		const i = Math.min(cs.length - 2, Math.floor(k));
		return css(mixOklab(cs[i], cs[i + 1], k - i));
	});
}

/**
 * A trail's opacity from its age: fading in at birth, out at the end.
 *
 * @param {number} age Seconds since it was born.
 * @param {number} life Seconds it lives.
 * @returns {number} 0–1.
 */
export function lifeAlpha(age, life) {
	return Math.max(0, Math.min(1, age / FADE_IN, (life - age) / FADE_OUT));
}

/**
 * @typedef {object} Trail
 * @property {boolean} alive Whether it is drawn and moving.
 * @property {number} x Its head, CSS px.
 * @property {number} y Its head, CSS px.
 * @property {Float32Array} path Its last positions, a ring of x, y pairs.
 * @property {number} head The ring's newest pair.
 * @property {number} age Seconds since birth.
 * @property {number} life Seconds it lives.
 * @property {number} pace Its speed, CSS px a second, set at birth.
 * @property {number} tone Where it sits along the colours for `colorBy: 'speed'` or `'random'`, 0–1.
 */

/**
 * @typedef {object} Flow
 * @property {Trail[]} trails The pool, every trail it may hold.
 * @property {number} width CSS px.
 * @property {number} height CSS px.
 * @property {number} steps Positions a trail keeps.
 * @property {number} time Seconds simulated.
 * @property {number} target How many trails it wants now.
 * @property {number} weight The line width now, CSS px.
 * @property {(seconds: number) => void} advance Steps the simulation on by some seconds (at fixed ticks; a remainder carries over).
 * @property {(buckets: number[][]) => number} segments Fills `buckets[colour × ALPHA_LEVELS + alpha − 1]` with each segment's points; returns how many segments.
 */

/**
 * The simulation, without a canvas: a pool of trails following the
 * field over an area, stepped at fixed ticks and run on until settled.
 *
 * @param {FlowFieldConfig} config The settings.
 * @param {number} width The area's width, CSS px.
 * @param {number} height Its height, CSS px.
 * @param {{ warm?: number }} [options] `warm`: seconds to run before the first frame (default 2.5).
 * @returns {Flow} The simulation.
 */
export function createFlow(config, width, height, options = {}) {
	const o = { ...FLOW_DEFAULTS, ...config };
	const rnd = seededRandom(o.seed);
	const vary = Math.min(1, Math.max(0, o.vary));
	const steps = Math.max(2, Math.round(o.length * TICKS) + 1);
	const per = (steps - 1) / Math.min(SEGMENTS, steps - 1);
	const unit = o.scale / Math.sqrt(Math.max(1, width * height));
	const ox = rnd() * 4096;
	const oy = rnd() * 4096;
	const drift = rnd() * 512;
	const base = trailCount(width, height, o.density);
	const margin = 0.06 * Math.sqrt(width * height);
	const paceLo = o.pace * (1 - 0.8 * vary);
	const paceHi = o.pace * (1 + 0.8 * vary);
	let z = rnd() * 256;
	let carry = 0;

	/** @type {Trail[]} */
	const trails = Array.from({ length: Math.ceil(base * (1 + 0.7 * vary)) }, () => ({
		alive: false,
		x: 0,
		y: 0,
		path: new Float32Array(steps * 2),
		head: 0,
		age: 0,
		life: 1,
		pace: o.pace,
		tone: 0,
	}));

	/** @type {Flow} */
	const flow = { trails, width, height, steps, time: 0, target: base, weight: o.weight, advance, segments };

	/**
	 * The drives now, as factors around 1.
	 *
	 * @returns {{ density: number, pace: number, evolve: number, weight: number }} The factors.
	 */
	function drives() {
		const wide = driveAt(flow.time + drift, 0) - 0.5;
		const low = driveAt(flow.time + drift, 1) - 0.5;
		return {
			density: 1 + vary * wide * 1.4,
			pace: 1 + vary * wide * 1.6,
			evolve: 1 + vary * wide * 1.6,
			weight: 1 + vary * low * 1.2,
		};
	}

	/**
	 * Gives a trail a new life at a random place, fewer in a quiet area.
	 *
	 * @param {Trail} p The trail.
	 * @param {number} pace Its speed, CSS px a second.
	 */
	function spawn(p, pace) {
		let x = 0;
		let y = 0;
		for (let tries = 0; tries < 6; tries++) {
			x = -margin + rnd() * (width + 2 * margin);
			y = -margin + rnd() * (height + 2 * margin);
			if (rnd() < quietFactor(x, y, width, height, o.quiet)) break;
		}
		p.alive = true;
		p.x = x;
		p.y = y;
		p.path.fill(0);
		for (let i = 0; i < steps; i++) {
			p.path[i * 2] = x;
			p.path[i * 2 + 1] = y;
		}
		p.head = 0;
		p.age = 0;
		p.life = o.life * (0.5 + rnd());
		p.pace = pace * (0.85 + rnd() * 0.3);
		p.tone = o.colorBy === 'speed' ? Math.min(1, Math.max(0, (p.pace - paceLo) / Math.max(1e-6, paceHi - paceLo))) : rnd();
	}

	/** One tick: the drives move, trails are born and retired toward the count wanted, each trail steps along the field. */
	function tick() {
		flow.time += TICK;
		const d = drives();
		z += o.evolve * d.evolve * TICK;
		flow.target = Math.min(trails.length, Math.round(base * d.density));
		flow.weight = o.weight * d.weight;
		// Births refill the count wanted over about half a second, not all at once.
		let births = Math.max(1, Math.ceil(trails.length * TICK * 2));
		for (let i = 0; i < trails.length; i++) {
			const p = trails[i];
			if (!p.alive) {
				if (i < flow.target && births > 0) {
					spawn(p, o.pace * d.pace);
					births--;
				}
				continue;
			}
			p.age += TICK;
			if (p.age >= p.life) {
				p.alive = false;
				continue;
			}
			// Past the count wanted, or off the edge: fade out early (the sketch's death fade).
			const out = p.x < -margin || p.y < -margin || p.x > width + margin || p.y > height + margin;
			if ((i >= flow.target || out) && p.life - p.age > FADE_OUT) p.life = p.age + FADE_OUT;
			const a = flowAngle(p.x * unit + ox, p.y * unit + oy, z);
			p.x += Math.cos(a) * p.pace * TICK;
			p.y += Math.sin(a) * p.pace * TICK;
			p.head = (p.head + 1) % steps;
			p.path[p.head * 2] = p.x;
			p.path[p.head * 2 + 1] = p.y;
		}
	}

	/**
	 * Steps the simulation on.
	 *
	 * @param {number} seconds How long, seconds (a remainder under a tick carries over).
	 */
	function advance(seconds) {
		carry += Math.max(0, seconds);
		while (carry >= TICK) {
			carry -= TICK;
			tick();
		}
	}

	/**
	 * Lays every visible segment into buckets by colour and alpha, for a
	 * stroke each: a tail is `SEGMENTS` pieces from the head back, each
	 * fainter (the sketch's fade), times the trail's life fade and the
	 * quiet area at the piece's middle.
	 *
	 * @param {number[][]} buckets One list of points a bucket (`COLOR_LEVELS × ALPHA_LEVELS`), emptied first; each segment is its point count, then x, y pairs.
	 * @returns {number} How many segments were laid.
	 */
	function segments(buckets) {
		for (const b of buckets) b.length = 0;
		const tones = buckets.length / ALPHA_LEVELS;
		const pieces = Math.round((steps - 1) / per);
		let laid = 0;
		for (const p of trails) {
			if (!p.alive) continue;
			const fade = lifeAlpha(p.age, p.life);
			if (fade <= 0) continue;
			const tone = o.colorBy === 'life' ? p.age / p.life : p.tone;
			const ci = tones > 1 ? Math.min(tones - 1, Math.floor(tone * tones)) : 0;
			for (let k = 0; k < pieces; k++) {
				const from = Math.round(k * per);
				const to = Math.round((k + 1) * per);
				const mid = (p.head - ((from + to) >> 1) + steps) % steps;
				const q = o.quiet ? quietFactor(p.path[mid * 2], p.path[mid * 2 + 1], width, height, o.quiet) : 1;
				const level = Math.round((1 - from / (steps - 1)) * fade * q * ALPHA_LEVELS);
				if (level <= 0) continue;
				const out = buckets[ci * ALPHA_LEVELS + Math.min(ALPHA_LEVELS, level) - 1];
				out.push(to - from + 1);
				for (let s = from; s <= to; s++) {
					const at = (p.head - s + steps) % steps;
					out.push(p.path[at * 2], p.path[at * 2 + 1]);
				}
				laid++;
			}
		}
		return laid;
	}

	// Born at random ages and run on, so the first frame is already a field in motion.
	const start = drives();
	for (let i = 0; i < Math.min(trails.length, base); i++) {
		spawn(trails[i], o.pace * start.pace);
		trails[i].age = rnd() * trails[i].life * 0.8;
	}
	advance(options.warm ?? WARM);
	return flow;
}

/**
 * Starts the flow field on an element (its first canvas is drawn into,
 * or a 2D one in its place when the host made it for WebGL).
 *
 * @param {HTMLElement} el The element.
 * @param {FlowFieldConfig} config The settings.
 * @returns {() => void} Stops it.
 */
export function flowField(el, config) {
	const o = { ...FLOW_DEFAULTS, ...config };
	const speed = Math.max(0, o.speed);
	const opacity = Math.min(1, Math.max(0, o.opacity));
	let ramp = flowRamp(pickColors(config, WHITE));
	/** @type {number[][]} */
	let buckets = [];
	/** @type {Flow | null} */
	let flow = null;
	let fresh = true;

	/**
	 * A new simulation for the new size (the same seed, so the same field).
	 *
	 * @param {import('./canvas2d.js').Canvas2D} c The canvas.
	 */
	const resize = (c) => {
		flow = createFlow(config, c.width, c.height);
		buckets = Array.from({ length: ramp.length * ALPHA_LEVELS }, () => []);
		fresh = true;
	};

	/**
	 * One frame: the simulation stepped on, the ground filled, the tails
	 * stroked a bucket at a time. Held after one frame when `speed` is 0.
	 *
	 * @param {import('./canvas2d.js').Canvas2D} c The canvas.
	 * @param {number} _now The time, ms.
	 * @param {number} dt Seconds since the last frame.
	 */
	const draw = (c, _now, dt) => {
		if (!flow || (!fresh && (c.still || speed === 0))) return;
		fresh = false;
		if (!c.still) flow.advance(dt * speed);
		const { ctx } = c;
		ctx.globalAlpha = 1;
		ctx.fillStyle = o.background;
		ctx.fillRect(0, 0, c.width, c.height);
		flow.segments(buckets);
		ctx.lineWidth = flow.weight;
		ctx.lineCap = 'butt';
		ctx.lineJoin = 'round';
		for (let b = 0; b < buckets.length; b++) {
			const pts = buckets[b];
			if (!pts.length) continue;
			ctx.strokeStyle = ramp[Math.floor(b / ALPHA_LEVELS)];
			ctx.globalAlpha = (((b % ALPHA_LEVELS) + 1) / ALPHA_LEVELS) * opacity;
			ctx.beginPath();
			for (let i = 0; i < pts.length; ) {
				const n = pts[i++];
				ctx.moveTo(pts[i], pts[i + 1]);
				for (let s = 1; s < n; s++) ctx.lineTo(pts[i + s * 2], pts[i + s * 2 + 1]);
				i += n * 2;
			}
			ctx.stroke();
		}
		ctx.globalAlpha = 1;
	};

	const { c, stop } = createCanvas2D(el, { draw, resize });
	if (!c) return stop;
	const unwatch = watchColors(el, (next) => {
		ramp = flowRamp(next.colors);
		buckets = Array.from({ length: ramp.length * ALPHA_LEVELS }, () => []);
		fresh = true;
		draw(c, frameNow(), 0);
	});
	return () => {
		stop();
		unwatch();
	};
}
