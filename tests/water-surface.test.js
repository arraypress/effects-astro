import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
	waterWaves,
	waterHeight,
	waterSettings,
	waterStill,
	waterStillSvg,
	waterTime,
	wavePhases,
	focusDistance,
	sunDirection,
	ringOf,
	WATER_LOOKS,
	MAX_WAVES,
} from '../src/runtime/water-surface.js';

test('the surface is a function of the time: the same moment is the same water, and it repeats exactly every loop', () => {
	const c = { seed: 3, loop: 30 };
	for (const [x, z] of [[0.1, 1.2], [-0.4, 2.5], [0.7, 0.9]]) {
		assert.equal(waterHeight(c, x, z, 7.25), waterHeight(c, x, z, 7.25));
		assert.ok(Math.abs(waterHeight(c, x, z, 4.1) - waterHeight(c, x, z, 4.1 + 30)) < 1e-9, 'one loop later, the same water');
		assert.notEqual(waterHeight(c, x, z, 4.1), waterHeight(c, x, z, 5.6), 'and it moves');
	}
	// every wave makes whole turns in the loop
	const whole = (x) => Math.abs(x - Math.round(x)) < 1e-9;
	for (const w of waterWaves(c)) assert.ok(whole((w.omega * 30) / (2 * Math.PI)));
	assert.equal(waterTime({ speed: 2 }, 1500), 3);
	assert.equal(waterTime({ speed: 0 }, 1500), 0);
});

test('the waves are real water waves: long ones faster, steep enough to be lively but never folding, seeded', () => {
	const ws = waterWaves({ seed: 1 });
	assert.equal(ws.length, MAX_WAVES);
	for (const w of ws) {
		assert.ok(w.amp * w.k < 0.35, 'no wave folds over');
		assert.ok(Math.abs(Math.hypot(...w.dir) - 1) < 1e-9);
		// the deep-water dispersion relation, to within the rounding to whole turns of the loop
		assert.ok(Math.abs(w.omega - Math.sqrt(9.81 * w.k)) < (2 * Math.PI) / 30 + 1e-9);
	}
	const long = ws[0],
		short = ws[ws.length - 1];
	assert.ok(long.omega / long.k > short.omega / short.k, 'long waves travel faster');
	assert.deepEqual(waterWaves({ seed: 1 }), ws);
	assert.notDeepEqual(waterWaves({ seed: 2 }), ws);
});

test('five looks; the sharp band where asked; the sun in front, low and to one side; a ring of ripples out on the water', () => {
	assert.deepEqual(Object.keys(WATER_LOOKS), ['dusk', 'teal', 'night', 'golden', 'ink']);
	const o = waterSettings({});
	assert.equal(o.lookColors.deep, WATER_LOOKS.dusk.deep);
	assert.equal(waterSettings({ look: 'night' }).lookColors.sun, WATER_LOOKS.night.sun);
	assert.equal(waterSettings({ colors: { deep: '#000000' } }).lookColors.deep, '#000000');
	assert.ok(focusDistance(waterSettings({ focus: 0.2 })) > focusDistance(waterSettings({ focus: 0.8 })), 'higher in the frame is further out');
	const [sx, sy, sz] = sunDirection(o);
	assert.ok(sz > 0.8 && sy > 0 && sy < 0.4 && sx < 0, 'ahead, low, to the left');
	const ring = ringOf(o);
	const turns = (ring.omega * o.loop) / (2 * Math.PI);
	assert.ok(ring.z > 1 && Math.abs(turns - Math.round(turns)) < 1e-9);
	assert.equal(ringOf(waterSettings({ rings: 0 })).amp, 0);
});

test('a still that looks like water: a CSS one and an SVG one, both in the look\'s colours', () => {
	for (const look of Object.keys(WATER_LOOKS)) {
		const css = waterStill({ look });
		assert.doesNotMatch(css, /url\(|data:/);
		assert.match(css, new RegExp(WATER_LOOKS[look].deep, 'i'));
		const svg = waterStillSvg({ look, seed: 2 }, `t-${look}`);
		assert.match(svg, /^<svg class="wc-noise wc-water"/);
		assert.match(svg, /feTurbulence/);
		assert.match(svg, /feSpecularLighting/);
		assert.match(svg, new RegExp(`id="t-${look}s"`));
		assert.match(svg, /<\/svg>$/);
	}
});

test('the water is rounded mounds from crossing swells, with peaked ripples riding them', async () => {
	const { waterWaves } = await import('../src/runtime/water-surface.js');
	const ws = waterWaves({ seed: 3 });
	const longest = ws[0], shortest = ws.at(-1);
	assert.ok((2 * Math.PI) / longest.k > 0.9, 'the longest swell is about a metre');
	assert.ok(longest.peaked < 0.35, 'the swells are rounded, not peaked');
	assert.ok(shortest.peaked > 0.9, 'the ripples are peaked');
	// the swells carry the height: the six longest outweigh all the rest
	const swell = ws.slice(0, 6).reduce((t, w) => t + w.amp, 0), rest = ws.slice(6).reduce((t, w) => t + w.amp, 0);
	assert.ok(swell > rest);
	// and come from more than one heading, so they cross into mounds rather than rows
	const headings = ws.slice(0, 6).map((w) => Math.atan2(w.dir[1], w.dir[0]));
	assert.ok(Math.max(...headings) - Math.min(...headings) > 1);
});

test('each wave\'s phase is worked out once a frame: the wave\'s own, wrapped to a turn, the same a loop later', () => {
	const c = { seed: 3, loop: 30 };
	const waves = waterWaves(c);
	const a = wavePhases(waves, 4.1, 30);
	const b = wavePhases(waves, 34.1, 30);
	assert.equal(a.length, waves.length * 2);
	waves.forEach((w, i) => {
		assert.ok(Math.abs(a[i * 2]) <= 2 * Math.PI, 'within a turn, so single precision keeps it exact enough');
		// the same angle as the wave's own phase less its travel
		const want = w.phase - w.omega * 4.1;
		assert.ok(Math.abs(Math.sin(a[i * 2]) - Math.sin(want)) < 1e-5 && Math.abs(Math.cos(a[i * 2]) - Math.cos(want)) < 1e-5);
		assert.equal(a[i * 2], b[i * 2], 'one loop later, the same phase');
		assert.equal(a[i * 2 + 1], 0, 'the slots between are left alone');
	});
	// filled in place, with no new array each frame
	const out = new Float32Array(MAX_WAVES * 2);
	assert.equal(wavePhases(waves, 1, 30, out), out);
});
