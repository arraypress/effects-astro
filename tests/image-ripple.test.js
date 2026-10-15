import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fitScale, dropForce, waterMotion } from '../src/runtime/image-ripple.js';
import { coverScale } from '../src/runtime/image.js';
import { GLSL_HEIGHT_FIELD, MAX_PUSHES } from '../src/runtime/height-field.js';

test('fitScale covers like coverScale, and contains with room to spare', () => {
	assert.deepEqual(fitScale('cover', 1.5, 2), coverScale(1.5, 2));
	assert.deepEqual(fitScale(undefined, 1.5, 0.5), coverScale(1.5, 0.5));
	assert.deepEqual(fitScale('anything', 1, 1), [1, 1]);
	// A wide box: the picture's full height, with room either side.
	assert.deepEqual(fitScale('contain', 1.5, 3), [2, 1]);
	// A tall box: its full width, with room above and below.
	assert.deepEqual(fitScale('contain', 1.5, 0.75), [1, 2]);
});

test('dropForce bobs down and up, smaller each time, and stops', () => {
	assert.equal(dropForce(-0.1), 0);
	assert.equal(dropForce(0), 0);
	assert.ok(dropForce(0.025) > 0, 'it presses down first');
	assert.ok(dropForce(0.075) < 0, 'then lifts');
	assert.ok(Math.abs(dropForce(0.125)) < Math.abs(dropForce(0.025)), 'each bob smaller');
	assert.equal(dropForce(5), 0);
});

test('waterMotion: thicker water keeps less speed and settles sooner', () => {
	const thin = waterMotion(0.5);
	const thick = waterMotion(3);
	assert.ok(thick.motion.keep < thin.motion.keep);
	assert.ok(thick.settle < thin.settle);
	assert.ok(thin.settle <= 9000, 'never waits too long to sleep');
	assert.ok(waterMotion(1).motion.speed <= 0.5, 'stable');
	assert.equal(waterMotion(1).motion.spring, 0, 'water has no rest shape to spring back to');
	assert.ok(Number.isFinite(waterMotion(0).settle));
});

test('the height field sizes its pushes from MAX_PUSHES', () => {
	assert.match(GLSL_HEIGHT_FIELD, new RegExp(`uPush\\[${MAX_PUSHES}\\]`));
	for (const fn of ['waveState', 'waveForce', 'wavePushes', 'wavePack']) assert.match(GLSL_HEIGHT_FIELD, new RegExp(`\\b${fn}\\(`));
});
