/**
 * @module @arraypress/effects-astro/ocean/waves
 *
 * The sea's waves: a set of directional, steep-crested waves from a long
 * swell down to ripples a few centimetres long, made once on the CPU and
 * handed to the shader as uniforms.
 *
 * Wavelengths fall by a steady ratio, each jittered so no two line up and
 * the sum never repeats. Each runs near the wind's direction, the long
 * ones closely and the short ones spread wider, as a wind-driven sea
 * does, with one long swell crossing from another quarter. Heights follow
 * a steady steepness (height times wavenumber), so every scale is as
 * rough as real water is. Each runs at its deep-water speed (ω = √(g·k)),
 * which is what gives the sea its scale: a twenty-metre swell rolls by at
 * about five and a half metres a second, ripples dance.
 *
 * The phases advance on the CPU each frame and are wrapped to one turn,
 * so the shader's sums keep their precision however long the page is open.
 */

/** Gravity, m/s². */
const G = 9.81;
/** The shortest wave, metres. */
const SHORTEST = 0.04;
/** The longest wave at a moderate sea, metres. */
const LONGEST = 38;
/** One turn. */
const TAU = Math.PI * 2;

/**
 * @typedef {object} WaveSet
 * @property {number} count How many waves.
 * @property {Float32Array} shape Four floats a wave: direction (x, z), wavenumber k (rad/m) and height (m).
 * @property {Float32Array} motion Two floats a wave: its phase now (rad) and how sharp its crest is.
 * @property {Float32Array} speed One float a wave: its angular speed ω (rad/s).
 * @property {Float32Array} start One float a wave: its phase at time 0.
 * @property {number} crest The highest the long waves can lift the sea, metres: the bracket the shader marches in.
 * @property {number} slope How steep the long waves get (twice their rms slope): how far the shader may stride.
 * @property {[number, number]} wind Where the wind drives the sea: a unit vector (x, z).
 */

/**
 * A repeatable number in -1–1 for a wave, so the sea is the same on every load.
 *
 * @param {number} i The wave.
 * @param {number} salt Which number for it.
 * @returns {number} The number.
 */
function jitter(i, salt) {
	const s = Math.sin(i * 127.1 + salt * 311.7) * 43758.5453;
	return (s - Math.floor(s)) * 2 - 1;
}

/**
 * Makes the sea's waves.
 *
 * @param {number} sea The sea state, 0 glassy to 2 rough.
 * @param {number} wind Where the waves run, degrees: 0 straight towards the viewer, 90 from left to right.
 * @param {number} count How many waves, at least 2.
 * @param {number} geometry How many of the longest shape the surface (the rest only light it).
 * @returns {WaveSet} The waves, longest first.
 */
export function waveSet(sea, wind, count, geometry) {
	const state = Math.min(2, Math.max(0, sea));
	const n = Math.max(2, Math.round(count));
	const longest = LONGEST * (0.55 + 0.45 * state);
	const ratio = (SHORTEST / longest) ** (1 / (n - 1));
	// Towards the viewer is -z (the camera looks down +z); left to right is +x.
	const heading = ((180 - wind) * Math.PI) / 180;
	const shape = new Float32Array(n * 4);
	const motion = new Float32Array(n * 2);
	const speed = new Float32Array(n);
	const start = new Float32Array(n);
	let crest = 0;
	let slope2 = 0;
	for (let i = 0; i < n; i++) {
		const t = i / (n - 1);
		const length = longest * ratio ** (i + 0.35 * jitter(i, 1));
		const k = TAU / length;
		// The long waves follow the wind closely; the short spread wide. The
		// second is a swell from another quarter, so the crests cross.
		const spread = 0.3 + 1.1 * Math.sqrt(t);
		const angle = heading + (i === 1 ? 0.9 : jitter(i, 2) * spread);
		// Steepness: the long waves build with the sea state, ripples less so.
		const build = i < geometry ? 0.08 + 0.92 * state : 0.35 + 0.65 * Math.min(1, state) + 0.2 * Math.max(0, state - 1);
		const steep = (0.034 + 0.036 * Math.sin(Math.PI * t ** 0.8) - 0.01 * t + 0.01 * jitter(i, 3)) * build;
		const height = steep / k;
		shape.set([Math.sin(angle), Math.cos(angle), k, height], i * 4);
		// Sharper crests on the bigger waves of a rougher sea.
		motion[i * 2 + 1] = (0.8 + 1.2 * Math.sin(Math.PI * Math.min(1, t * 1.4))) * Math.min(1.4, 0.5 + 0.6 * state);
		speed[i] = Math.sqrt(G * k);
		start[i] = (jitter(i, 4) + 1) * Math.PI;
		if (i < geometry) {
			crest += height;
			// Mean square slope: (a·k)² · 0.4·S for this profile.
			slope2 += steep * steep * 0.4 * motion[i * 2 + 1];
		}
	}
	/** @type {[number, number]} */
	const toward = [Math.sin(heading), Math.cos(heading)];
	const set = { count: n, shape, motion, speed, start, crest, slope: 2 * Math.sqrt(slope2) + 0.02, wind: toward };
	wavePhases(set, 0);
	return set;
}

/**
 * Moves every wave on to a time, writing its phase into `set.motion`.
 *
 * @param {WaveSet} set The waves.
 * @param {number} time The sea's clock, seconds.
 * @returns {Float32Array} `set.motion`, updated.
 */
export function wavePhases(set, time) {
	for (let i = 0; i < set.count; i++) {
		const phase = (set.start[i] - set.speed[i] * time) % TAU;
		set.motion[i * 2] = phase < 0 ? phase + TAU : phase;
	}
	return set.motion;
}
