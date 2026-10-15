import { test } from 'node:test';
import assert from 'node:assert/strict';
import { OCEAN_TIME, OCEAN_TIMES, oceanBackdrop, oceanLook, tintColor } from '../src/runtime/ocean/presets.js';
import { wavePhases, waveSet } from '../src/runtime/ocean/waves.js';
import { oceanView, sunDirection, viewRay } from '../src/runtime/ocean/view.js';
import { oceanShader } from '../src/runtime/ocean/shader.js';
import { parseColor, toOklab } from '../src/runtime/color.js';
import { PALETTES } from '../src/runtime/palettes.js';

const COLOURS = ['light', 'zenith', 'horizon', 'glow', 'deep', 'scatter', 'cloud'];
const near = (a, b, eps = 1e-6) => Math.abs(a - b) < eps;

test('every time of day is complete, its colours hex', () => {
	assert.deepEqual(Object.keys(OCEAN_TIMES), ['dawn', 'noon', 'sunset', 'night']);
	assert.ok(Object.isFrozen(OCEAN_TIMES));
	for (const [name, look] of Object.entries(OCEAN_TIMES)) {
		assert.equal(look.time, name);
		for (const key of COLOURS) assert.doesNotThrow(() => parseColor(look[key]), `${name}.${key}`);
		for (const key of ['x', 'elevation', 'size', 'power', 'haze', 'exposure', 'stars']) assert.equal(typeof look[key], 'number', `${name}.${key}`);
	}
	assert.equal(OCEAN_TIMES.night.stars > 0, true);
	assert.equal(OCEAN_TIMES.noon.stars, 0);
});

test('oceanLook resolves the time, sunset by default, and warns for an unknown one', () => {
	assert.deepEqual(oceanLook({}), OCEAN_TIMES[OCEAN_TIME]);
	assert.equal(OCEAN_TIME, 'sunset');
	for (const time of Object.keys(OCEAN_TIMES)) assert.deepEqual(oceanLook({ time }), OCEAN_TIMES[time]);
	const warn = console.warn;
	const said = [];
	console.warn = (...args) => said.push(args.join(' '));
	try {
		assert.deepEqual(oceanLook({ time: 'teatime' }), OCEAN_TIMES.sunset);
		assert.deepEqual(oceanLook({ time: 'toString' }), OCEAN_TIMES.sunset);
	} finally {
		console.warn = warn;
	}
	assert.equal(said.length, 2);
	assert.match(said[0], /teatime/);
});

test('oceanLook returns a copy: the presets cannot be changed through it', () => {
	const look = oceanLook({ time: 'noon' });
	look.zenith = '#000000';
	assert.notEqual(OCEAN_TIMES.noon.zenith, '#000000');
});

test('tintColor moves hue and chroma in Oklab and keeps lightness', () => {
	assert.equal(tintColor('#336699', '#ff0000', 0), '#336699');
	const [L] = toOklab(parseColor('#336699'));
	const tinted = toOklab(parseColor(tintColor('#336699', '#ff8800')));
	assert.ok(near(tinted[0], L, 0.01), 'lightness kept');
	// All the way: the tint's hue (a muted tint, so the gamut does not bend it).
	const [, ta, tb] = toOklab(parseColor('#a07858'));
	const [, fa, fb] = toOklab(parseColor(tintColor('#6a7f99', '#a07858', 1)));
	assert.ok(near(Math.atan2(fb, fa), Math.atan2(tb, ta), 0.05), 'the tint’s hue');
	assert.throws(() => tintColor('blue', '#fff'), TypeError);
});

test('oceanLook tints the sky, the water and the light from colours or a palette', () => {
	const plain = OCEAN_TIMES.dawn;
	const tinted = oceanLook({ time: 'dawn', colors: ['#00ff88', '#ff0066', '#0088ff'] });
	assert.equal(tinted.zenith, tintColor(plain.zenith, '#00ff88'));
	assert.equal(tinted.horizon, tintColor(plain.horizon, '#00ff88'));
	assert.equal(tinted.deep, tintColor(plain.deep, '#ff0066'));
	assert.equal(tinted.glow, tintColor(plain.glow, '#0088ff'));
	assert.equal(tinted.elevation, plain.elevation);
	// One colour tints everything.
	const one = oceanLook({ time: 'dawn', colors: ['#00ff88'] });
	assert.equal(one.light, tintColor(plain.light, '#00ff88'));
	const lagoon = oceanLook({ palette: 'lagoon' });
	assert.equal(lagoon.deep, tintColor(OCEAN_TIMES.sunset.deep, PALETTES.Lagoon.colors[1]));
});

test('oceanBackdrop paints the sky above the horizon and the sea below it', () => {
	const look = OCEAN_TIMES.sunset;
	const css = oceanBackdrop(look, 0.25);
	assert.match(css, /radial-gradient\(/);
	assert.ok(css.includes(`${look.zenith} 0%`));
	assert.ok(css.includes(`${look.horizon} 75.0%`));
	assert.ok(css.includes(`${look.deep} 100%`));
	assert.ok(oceanBackdrop(look).includes(`${look.horizon} 70.0%`), 'the default horizon');
	assert.ok(oceanBackdrop(look, 7).includes(`${look.horizon} 0.0%`), 'clamped');
});

test('waveSet: longest first, unit directions, deep-water speeds, the same every time', () => {
	const set = waveSet(1, 30, 24, 8);
	assert.equal(set.count, 24);
	assert.equal(set.shape.length, 96);
	assert.equal(set.motion.length, 48);
	let previous = Infinity;
	for (let i = 0; i < set.count; i++) {
		const [x, z, k, height] = set.shape.subarray(i * 4, i * 4 + 4);
		assert.ok(near(Math.hypot(x, z), 1, 1e-5), 'unit direction');
		assert.ok(k > 0 && height > 0);
		assert.ok(2 * Math.PI / k < previous * 1.2, 'roughly longest first');
		previous = 2 * Math.PI / k;
		assert.ok(near(set.speed[i], Math.sqrt(9.81 * k), 1e-4), 'ω = √(g·k)');
		assert.ok(set.motion[i * 2 + 1] > 0, 'a crest sharpness');
	}
	assert.ok(2 * Math.PI / set.shape[2] > 15, 'a swell tens of metres long');
	assert.ok(2 * Math.PI / set.shape[(set.count - 1) * 4 + 2] < 0.1, 'down to ripples');
	assert.deepEqual(waveSet(1, 30, 24, 8), set);
});

test('waveSet: the sea state sets the height, and the wind the heading', () => {
	const calm = waveSet(0, 0, 24, 8);
	const fresh = waveSet(1, 0, 24, 8);
	const rough = waveSet(2, 0, 24, 8);
	assert.ok(calm.crest < fresh.crest && fresh.crest < rough.crest);
	assert.ok(calm.crest < 0.2, 'glassy');
	assert.ok(rough.crest > 2, 'rough');
	assert.deepEqual(waveSet(5, 0, 24, 8), rough, 'clamped to 2');
	// The longest wave runs with the wind: 0 towards the viewer (-z), 90 left to right (+x).
	assert.ok(fresh.shape[1] < -0.9);
	const across = waveSet(1, 90, 24, 8);
	assert.ok(across.shape[0] > 0.9);
	assert.ok(near(across.wind[0], 1, 1e-9) && near(fresh.wind[1], -1, 1e-9), 'the wind itself');
});

test('wavePhases moves each wave on at its own speed, wrapped to one turn', () => {
	const set = waveSet(1, 0, 12, 6);
	const start = Array.from(set.start);
	const phases = wavePhases(set, 1000);
	assert.equal(phases, set.motion);
	for (let i = 0; i < set.count; i++) {
		const phase = phases[i * 2];
		assert.ok(phase >= 0 && phase < 2 * Math.PI + 1e-6);
		const expected = (((start[i] - set.speed[i] * 1000) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
		assert.ok(near(phase, expected, 1e-3));
	}
	wavePhases(set, 0);
	for (let i = 0; i < set.count; i++) assert.ok(near(set.motion[i * 2], start[i] % (2 * Math.PI), 1e-5));
});

test('oceanView puts the horizon where it is asked, level, with the camera looking slightly down', () => {
	for (const horizon of [0.2, 0.3, 0.5, 0.7]) {
		const view = oceanView({ height: 4, horizon, aspect: 16 / 9 });
		for (const x of [0, 0.5, 1]) assert.ok(near(viewRay(view, x, horizon)[1], 0, 1e-9), `level at ${horizon}`);
		assert.ok(viewRay(view, 0.5, horizon - 0.1)[1] < 0, 'below it, the sea');
		assert.ok(viewRay(view, 0.5, horizon + 0.1)[1] > 0, 'above it, the sky');
		assert.ok(view.forward[1] < 0, 'looking down');
	}
	const ray = viewRay(oceanView({ height: 4, horizon: 0.3, aspect: 2 }), 0.2, 0.1);
	assert.ok(near(Math.hypot(...ray), 1, 1e-9));
	assert.deepEqual(oceanView({ height: 4, horizon: 0.3, aspect: 2, x: 3, lift: 0.5 }).eye, [3, 4.5, 0]);
	// A phone's tall frame widens the lens.
	assert.ok(oceanView({ height: 4, horizon: 0.3, aspect: 0.5 }).focal < oceanView({ height: 4, horizon: 0.3, aspect: 1.6 }).focal);
});

test('sunDirection: at the time of day, at an override, and never below the horizon', () => {
	const horizon = 0.3;
	const view = oceanView({ height: 4, horizon, aspect: 16 / 9 });
	const sun = sunDirection(view, horizon, { x: 0.68, elevation: 2.4 });
	assert.ok(near(Math.hypot(...sun), 1, 1e-9));
	assert.ok(near(Math.asin(sun[1]), (2.4 * Math.PI) / 180, 1e-9));
	assert.ok(sun[0] > 0 && sun[2] > 0, 'ahead and to the right');
	// The override lands it behind that point on the frame.
	const ray = viewRay(view, 0.2, 0.6);
	const placed = sunDirection(view, horizon, { x: 0.68, elevation: 2.4 }, { x: 0.2, y: 0.6 });
	placed.forEach((c, i) => assert.ok(near(c, ray[i], 1e-9)));
	// Only x: the time's elevation, at that place across.
	assert.ok(near(Math.asin(sunDirection(view, horizon, { x: 0.68, elevation: 10 }, { x: 0.1 })[1]), Math.PI / 18, 1e-9));
	// Below the horizon, it is lifted clear of it.
	assert.ok(sunDirection(view, horizon, { x: 0.5, elevation: 5 }, { y: 0.05 })[1] > 0);
	assert.ok(sunDirection(view, horizon, { x: 0.5, elevation: -3 })[1] > 0);
});

test('oceanShader compiles its budget into the loops', () => {
	const glsl = oceanShader({ waves: 18, geometry: 6, steps: 10, refine: 3 });
	assert.match(glsl, /#define WAVES 18\b/);
	assert.match(glsl, /#define GEO 6\b/);
	assert.match(glsl, /#define STEPS 10\b/);
	assert.match(glsl, /#define REFINE 3\b/);
	assert.match(glsl, /void main\(\)/);
	assert.match(glsl, /uniform vec4 uQuiet;/);
});
