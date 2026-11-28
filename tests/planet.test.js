import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sunLift, sunPlace, planetStill, planetPeriod, PLANET_DEFAULTS } from '../src/runtime/planet.js';

test('the sun rises over the limb and sets back once a period, starting at sunrise', () => {
	const c = { period: 96, rise: 0.05 };
	const at = (/** @type {number} */ t) => sunLift(c, t);
	// it starts cresting (phase 0.22), climbs to its highest half way through the cycle, and goes back behind the limb
	assert.ok(at(0) > -0.018 && at(0) < 0.05, 'cresting at time 0');
	const peak = ((0.5 - PLANET_DEFAULTS.phase + 1) % 1) * 96;
	assert.ok(Math.abs(at(peak) - 0.05) < 1e-9, 'at its highest it is `rise` over the limb');
	const hidden = ((0.0 - PLANET_DEFAULTS.phase + 1) % 1) * 96;
	assert.ok(at(hidden) < 0, 'and part of the cycle it is behind the planet');
	assert.ok(Math.abs(at(5) - at(5 + 96)) < 1e-9, 'the cycle repeats every period');
	assert.equal(planetPeriod(c), 96);
	assert.ok(Math.abs(sunLift({ ...c, rises: 2 }, 5) - sunLift({ ...c, rises: 2 }, 53)) < 1e-9, 'two rises a period: every 48 s');
});

test('the sun sits on the limb at sunX, the limb below the middle of the frame, and its place is a pure function of time', () => {
	const c = { sunX: 0.3, horizon: 0.8, curve: 2 };
	const a = sunPlace(c, 0.8, 12),
		b = sunPlace(c, 0.8, 12);
	assert.deepEqual(a, b);
	assert.ok(Math.abs(a.x - (0.3 - 0.5) * 0.8) < 1e-12);
	// the limb (the sun's place less its lift) lies near `horizon`: 0.8 from the top is 0.3 below the middle
	const limb = a.y - a.lift;
	assert.ok(limb < -0.2 && limb > -0.36, `limb at ${limb}`);
	// a tighter curve (higher camera) bends the limb: off-centre it sits lower than at the middle
	const mid = sunPlace({ ...c, sunX: 0.5 }, 0.8, 12);
	assert.ok(a.y - a.lift < mid.y - mid.lift, 'the horizon curves down to the sides');
});

test('the still is space, the planet, its limb and the sun with its streak, in the planet\'s colours', () => {
	const css = planetStill({ sunX: 0.4, air: '#4f93ff' });
	assert.match(css, /radial-gradient\(circle at 40% /);
	assert.match(css, /#4f93ff/);
	assert.ok(css.trim().endsWith('#000000'), 'space behind everything');
	// the moon has no air: no blue limb
	assert.ok(!planetStill({ kind: 'moon', air: '#4f93ff' }).includes('#4f93ff'));
});

test('the flare ghosts climb past the lockup to the space above it, to the side away from the sun', async () => {
	const { ghostCentre } = await import('../src/runtime/planet.js');
	const aspect = 0.8;
	// a sun to the right puts the ghosts' line to the left, and the other way round
	assert.ok(ghostCentre({ seed: 1 }, aspect, { x: 0.2, y: -0.25 })[0] < 0);
	assert.ok(ghostCentre({ seed: 1 }, aspect, { x: -0.2, y: -0.25 })[0] > 0);
	// a central sun still sends them to one side, picked by the seed, never straight up the middle
	for (const seed of [0, 0.1, 0.25, 0.37]) assert.ok(Math.abs(ghostCentre({ seed }, aspect, { x: 0, y: -0.25 })[0]) > 0.2 * aspect);
	// high in the frame (y down: smaller is higher), above where a lockup sits
	const [, y] = ghostCentre({ seed: 0 }, aspect, { x: 0, y: -0.25 });
	assert.ok(y < -0.3);
});
