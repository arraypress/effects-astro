import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
	KINETIC_DEFAULTS,
	MAX_DROPS,
	MAX_PULSES,
	DROP_TIMING,
	PULSE_TIMING,
	WAVE,
	hash33,
	dropAt,
	dropEnvelope,
	dropsAt,
	pulsesAt,
	ripple,
	displacement,
	gridColors,
	gridStill,
} from '../src/runtime/kinetic-grid.js';
import { PALETTES } from '../src/runtime/palettes.js';

test('hash33 gives three values in 0–1, the same for the same input, spread for nearby ones', () => {
	const seen = new Set();
	for (let s = 0; s < 6; s++)
		for (let c = -50; c < 50; c++) {
			const h = hash33(s, c, 3.7);
			assert.ok(h.every((v) => v >= 0 && v < 1), `${s}, ${c}: ${h}`);
			seen.add(h[0].toFixed(4));
		}
	assert.deepEqual(hash33(1, 2, 3), hash33(1, 2, 3));
	assert.ok(seen.size > 570, `${seen.size} distinct of 600`);
});

test('dropAt is a function of slot, cycle and seed: on the frame, within its cycle', () => {
	const d = dropAt(2, 7, 1.5);
	assert.deepEqual(dropAt(2, 7, 1.5), d);
	assert.ok(d.x > 0 && d.x < 1 && d.y > 0 && d.y < 1);
	const cycleStart = 7 * DROP_TIMING.period;
	assert.ok(d.start >= cycleStart && d.start < cycleStart + DROP_TIMING.period);
	assert.notDeepEqual(dropAt(2, 7, 9.5), d, 'another seed, another drop');
	assert.notDeepEqual(dropAt(2, 8, 1.5), d, 'another cycle, another drop');
	assert.notDeepEqual(dropAt(3, 7, 1.5), d, 'another slot, another drop');
});

test('dropEnvelope rises from nothing, decays, and ends at nothing (no pop)', () => {
	assert.equal(dropEnvelope(-1), 0);
	assert.equal(dropEnvelope(0), 0);
	assert.ok(dropEnvelope(0.01) < 0.05, 'eases in');
	assert.ok(dropEnvelope(0.3) > dropEnvelope(2));
	assert.ok(dropEnvelope(DROP_TIMING.life - 0.01) < 0.01, 'eases out');
	assert.equal(dropEnvelope(DROP_TIMING.life), 0);
	// a slot's drop is over before its next can land, so a slot is one drop at a time
	assert.ok(DROP_TIMING.life + DROP_TIMING.jitter <= DROP_TIMING.period);
});

test('dropsAt depends only on the time: the same second gives the same drops, whatever the frame rate', () => {
	const config = { drops: 5, offset: 4.2 };
	assert.deepEqual(dropsAt(12.5, config), dropsAt(12.5, config));
	// it keeps no state: stepping through other moments first (30 fps, then 144) changes nothing
	const fresh = dropsAt(12.5, config);
	for (let n = 0; n < 375; n++) dropsAt(n / 30, config);
	assert.deepEqual(dropsAt(12.5, config), fresh);
	for (let n = 0; n < 1800; n++) dropsAt(n / 144, config);
	assert.deepEqual(dropsAt(12.5, config), fresh);
	// and a drop's age is the clock's: a frame later it is a frame older
	const later = dropsAt(12.5 + 1 / 60, config);
	for (const d of later) {
		const before = fresh.find((e) => e.x === d.x && e.y === d.y);
		if (before) assert.ok(Math.abs(d.age - before.age - 1 / 60) < 1e-9);
	}
});

test('dropsAt keeps to its slots, and something is rippling at almost every moment (the still frame too)', () => {
	let empty = 0;
	for (let t = 0; t < 120; t += 0.25) {
		const live = dropsAt(t, { drops: 4 });
		assert.ok(live.length <= 4);
		for (const d of live) {
			assert.ok(d.age > 0 && d.age < DROP_TIMING.life);
			assert.ok(d.amp > 0 && d.amp <= 1);
		}
		if (!live.length) empty++;
	}
	assert.ok(empty < 10, `${empty} empty moments of 480`);
	assert.ok(dropsAt(0, {}).length > 0, 'the first frame has ripples on it');
	assert.equal(dropsAt(5, { drops: 0 }).length, 0);
	assert.ok(dropsAt(5, { drops: 99 }).length <= MAX_DROPS);
	assert.notDeepEqual(dropsAt(5, { offset: 1 }), dropsAt(5, { offset: 2 }), 'two cards differ');
});

test('ripple gives the displacement and its exact slope, still at the centre and far from the front', () => {
	for (const age of [0.2, 1, 2.5])
		for (const r of [0.01, 0.05, 0.1, 0.2, 0.3]) {
			const [, df] = ripple(r, age);
			const e = 1e-6;
			const numeric = (ripple(r + e, age)[0] - ripple(r - e, age)[0]) / (2 * e);
			assert.ok(Math.abs(df - numeric) < 1e-4 * Math.max(1, Math.abs(df)), `r ${r}, age ${age}: ${df} vs ${numeric}`);
		}
	assert.ok(Math.abs(ripple(0, 1)[0]) < 1e-12, 'nothing moves at the centre');
	const front = WAVE.speed * 2;
	assert.ok(Math.abs(ripple(front + 0.3, 2)[0]) < 1e-6, 'nothing ahead of the front');
	assert.ok(Math.abs(ripple(front + 0.03, 2)[0]) > 0.05, 'the front itself moves');
	// size scales it: the same shape at twice the distance
	assert.ok(Math.abs(ripple(0.2, 1, 2)[0] - ripple(0.1, 1, 1)[0]) < 1e-12);
});

test('the grid never folds: the stretch stays well under one, even at the most strength', () => {
	let most = 0;
	for (let age = 0.05; age < DROP_TIMING.life; age += 0.05)
		for (let r = 0.001; r < 0.6; r += 0.002) {
			const [f, df] = ripple(r, age);
			const scale = WAVE.amp * 1.6 * dropEnvelope(age);
			most = Math.max(most, Math.abs(df) * scale, Math.abs(f / r) * scale);
		}
	assert.ok(most < 0.8, `most stretch ${most}`);
	assert.ok(most > 0.2, `but it shows: ${most}`);
});

test('displacement sums the live drops, scales with strength, and is zero without drops', () => {
	const config = { offset: 3 };
	const [x, y] = [0.4, 0.5];
	const at = displacement(x, y, 3, config, 1.25);
	const twice = displacement(x, y, 3, { ...config, strength: 2 }, 1.25);
	assert.ok(Math.abs(twice[0] - 2 * at[0]) < 1e-12 && Math.abs(twice[1] - 2 * at[1]) < 1e-12);
	assert.deepEqual(displacement(x, y, 3, { drops: 0 }), [0, 0]);
	// somewhere on the frame moves
	let most = 0;
	for (let i = 0; i < 40; i++) for (let j = 0; j < 50; j++) most = Math.max(most, Math.hypot(...displacement(i / 40, j / 40, 3, config, 1.25)));
	assert.ok(most > 0.001, `${most}`);
	assert.ok(most < 0.02, 'gentle: under a fiftieth of the width');
});

test('pulsesAt: rings grow and fade, and never more than three flashes a second', () => {
	let starts = 0;
	let prev = new Set();
	const step = 1 / 60;
	for (let t = 0; t < 60; t += step) {
		const live = pulsesAt(t, { pulses: MAX_PULSES });
		assert.ok(live.length <= MAX_PULSES);
		for (const p of live) {
			assert.ok(p.radius > 0 && p.radius <= WAVE.reach + 1e-12);
			assert.ok(p.glow >= 0 && p.glow <= 1);
		}
		const keys = new Set(live.map((p) => `${p.x}`));
		for (const k of keys) if (!prev.has(k)) starts++;
		prev = keys;
	}
	assert.ok(starts / 60 <= 3, `${starts / 60} a second`);
	assert.ok(starts / 60 >= 1, 'but there are some');
	assert.equal(pulsesAt(3, { pulses: 0 }).length, 0);
	assert.ok(PULSE_TIMING.life + PULSE_TIMING.jitter <= PULSE_TIMING.period);
});

test('gridColors: the sketch by default, own colours, a palette as its colour and glint', () => {
	assert.deepEqual(gridColors({}), ['#3197ff', '#ffffff']);
	assert.deepEqual(gridColors({ colors: ['#c8ff00'] }), ['#c8ff00', '#c8ff00']);
	assert.deepEqual(gridColors({ colors: ['#c8ff00', '#ffffff'] }), ['#c8ff00', '#ffffff']);
	assert.deepEqual(gridColors({ palette: 'azure' }), [PALETTES.Azure.colors[0], PALETTES.Azure.glint]);
});

test('gridStill lays the resting grid on the ground in CSS', () => {
	const css = gridStill({ colors: ['#c8ff00', '#ffffff'], background: '#0b0b0b', cols: 32 });
	assert.match(css, /linear-gradient\(90deg, #[0-9a-f]{6} 0 1px, transparent 1px\)/i);
	assert.match(css, /calc\(100% \/ 32\)/);
	assert.match(css, /calc\(100% \/ 40\.000\)/, 'a 4:5 card has 40 rows of 32');
	assert.ok(css.trim().endsWith('#0b0b0b'), 'the ground under it');
	assert.ok(!/#c8ff00/i.test(css), 'the wires at their rest brightness, not full');
	assert.ok(!gridStill({ background: 'transparent' }).includes('#0a0a0a'));
	assert.equal(KINETIC_DEFAULTS.cols, 48);
});
