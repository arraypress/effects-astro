/**
 * @module @arraypress/effects-astro/swarm
 *
 * A flock of particles, each held to a home point of its own by a spring
 * and pushed along a curl-noise flow, so together they hold a shape but
 * never sit still. Now and then two neighbours trade homes and pass each
 * other, so it keeps flowing inside; a pointer pushes them away and
 * round it, and the springs bring them streaming back.
 *
 * Pure numbers, stepped on the CPU in whatever units the effect likes
 * (heights of the canvas, say): the effect draws it.
 */

import { curl } from './curl.js';

/**
 * @typedef {object} Swarm
 * @property {number} count How many particles.
 * @property {Float32Array} pos Positions, x, y pairs.
 * @property {Float32Array} vel Velocities, x, y pairs, units a second.
 * @property {Float32Array} home Homes, x, y pairs.
 * @property {Float32Array} grip How tightly each is held to its home, 0–1:
 *   most are held close, a few are loose and stray round the shape.
 * @property {number} time Seconds stepped since it was last dispersed.
 */

/**
 * @typedef {object} SwarmForces
 * @property {number} [pull=40] The springs' stiffness at full grip, a second squared.
 * @property {number} [flow=0.5] How hard the flow pushes, units a second squared.
 * @property {number} [scale=6] The flow's swirls a unit: larger for smaller swirls.
 * @property {number} [damping=4] How fast a particle loses speed, a share a second (exponential).
 * @property {number} [wander=0.05] Each particle's chance a second of trading homes with a neighbour.
 * @property {number} [arrive=2.2] Seconds the springs take to come on after `disperse`.
 * @property {{ x: number, y: number, radius: number, force: number } | null} [pointer]
 *   A pointer to flee: where it is, how far it reaches, how hard it pushes at its centre.
 * @property {() => number} [random=Math.random] The random source.
 */

/** Scratch for one flow sample. */
const flowAt = [0, 0];
/** How far apart, in the homes' order, two particles trading homes may be: near neighbours, so no one crosses a gap in the shape. */
const REACH = 24;
/** The bands homes are ordered in, units tall: thin enough that neighbours in the order are neighbours on the shape. */
const BAND = 0.04;

/**
 * Makes a swarm, every particle at the origin until it is dispersed and
 * given homes.
 *
 * @param {number} count How many particles.
 * @param {() => number} [random=Math.random] The random source.
 * @returns {Swarm} The swarm.
 */
export function createSwarm(count, random = Math.random) {
	const grip = new Float32Array(count);
	// One in twenty is loose: those stray round the shape and trace its outline in wisps.
	for (let i = 0; i < count; i++) grip[i] = random() < 0.05 ? 0.12 + random() * 0.2 : 0.7 + random() * 0.3;
	return {
		count,
		pos: new Float32Array(count * 2),
		vel: new Float32Array(count * 2),
		home: new Float32Array(count * 2),
		grip,
		time: 0,
	};
}

/**
 * Throws the swarm into a loose cloud, moving every which way, and starts
 * its clock again: from there the springs come on and it gathers.
 *
 * @param {Swarm} swarm The swarm.
 * @param {number} x The cloud's centre, across.
 * @param {number} y The cloud's centre, up.
 * @param {number} spread The cloud's spread (one standard deviation).
 * @param {() => number} [random=Math.random] The random source.
 */
export function disperse(swarm, x, y, spread, random = Math.random) {
	for (let i = 0; i < swarm.count; i++) {
		// Box–Muller: two normal deviates from two uniform ones.
		const r = Math.sqrt(-2 * Math.log(1 - random()));
		const a = random() * Math.PI * 2;
		swarm.pos[i * 2] = x + Math.cos(a) * r * spread;
		swarm.pos[i * 2 + 1] = y + Math.sin(a) * r * spread;
		swarm.vel[i * 2] = (random() - 0.5) * spread;
		swarm.vel[i * 2 + 1] = (random() - 0.5) * spread;
	}
	swarm.time = 0;
}

/**
 * Gives the particles their homes, ordered along thin bands that run
 * back and forth across the shape (a serpentine), so particles close in
 * the order have homes close on the shape: trades are made between them.
 *
 * @param {Swarm} swarm The swarm.
 * @param {Float32Array} homes x, y pairs, one a particle.
 */
export function setHomes(swarm, homes) {
	const n = Math.min(swarm.count, homes.length >> 1);
	/**
	 * Where a home falls in the serpentine order.
	 *
	 * @param {number} i The home's index.
	 * @returns {number} Its key: lower comes first.
	 */
	const key = (i) => {
		const band = Math.floor(homes[i * 2 + 1] / BAND);
		const x = homes[i * 2];
		return band * 1e6 + (band & 1 ? -x : x);
	};
	const keys = Float64Array.from({ length: n }, (_, i) => key(i));
	const order = Array.from({ length: n }, (_, i) => i).sort((a, b) => keys[a] - keys[b]);
	order.forEach((from, to) => {
		swarm.home[to * 2] = homes[from * 2];
		swarm.home[to * 2 + 1] = homes[from * 2 + 1];
	});
}

/**
 * Puts every particle at its home, at rest: the settled swarm, for a still frame.
 *
 * @param {Swarm} swarm The swarm.
 */
export function settle(swarm) {
	swarm.pos.set(swarm.home);
	swarm.vel.fill(0);
	// Long since arrived: the springs are fully on.
	swarm.time = 60;
}

/**
 * Moves the swarm on by a step: springs, flow, the pointer and damping,
 * integrated semi-implicitly (velocity first), which stays stable at the
 * stiffness used here for any step up to a twentieth of a second.
 *
 * @param {Swarm} swarm The swarm.
 * @param {number} dt The step, seconds.
 * @param {SwarmForces} [forces] The forces.
 */
export function stepSwarm(swarm, dt, forces = {}) {
	if (dt <= 0) return;
	const { pull = 40, flow = 0.5, scale = 6, damping = 4, wander = 0.05, arrive = 2.2, pointer = null, random = Math.random } = forces;
	const { count, pos, vel, home, grip } = swarm;
	swarm.time += dt;
	const t = swarm.time;
	// The springs come on over `arrive`; till then the flow swirls them harder.
	const k = Math.min(1, t / arrive);
	const on = k * k * (3 - 2 * k);
	const spring = pull * (0.08 + 0.92 * on);
	// The swarm breathes: the flow swells and eases, loosening the shape and drawing it in.
	const push = flow * (1 + 2 * (1 - on)) * (0.85 + 0.35 * Math.sin(t * 0.8));
	const keep = Math.exp(-damping * dt);
	const reach2 = pointer ? pointer.radius * pointer.radius : 0;

	// Trading homes: a few pairs of neighbours a step, so the inside of the shape keeps flowing.
	const trades = Math.min(count >> 1, Math.floor(count * wander * dt + random()));
	for (let n = 0; n < trades; n++) {
		const a = Math.floor(random() * count);
		const i = a * 2;
		const j = Math.min(count - 1, Math.max(0, a + Math.round((random() * 2 - 1) * REACH))) * 2;
		const hx = home[i];
		const hy = home[i + 1];
		home[i] = home[j];
		home[i + 1] = home[j + 1];
		home[j] = hx;
		home[j + 1] = hy;
	}

	for (let i = 0; i < count; i++) {
		const x = i * 2;
		const y = x + 1;
		const px = pos[x];
		const py = pos[y];
		const g = spring * grip[i];
		curl(px * scale, py * scale, t * 0.35, flowAt);
		let ax = g * (home[x] - px) + flowAt[0] * push;
		let ay = g * (home[y] - py) + flowAt[1] * push;
		if (pointer) {
			const dx = px - pointer.x;
			const dy = py - pointer.y;
			const d2 = dx * dx + dy * dy;
			if (d2 < reach2 && d2 > 1e-10) {
				const d = Math.sqrt(d2);
				const f = 1 - d / pointer.radius;
				const s = (pointer.force * f * f) / d;
				// Away, and round: half one way, half the other, so it parts like water.
				const turn = i & 1 ? 0.7 : -0.7;
				ax += (dx - dy * turn) * s;
				ay += (dy + dx * turn) * s;
			}
		}
		vel[x] = vel[x] * keep + ax * dt;
		vel[y] = vel[y] * keep + ay * dt;
		pos[x] = px + vel[x] * dt;
		pos[y] = py + vel[y] * dt;
	}
}
