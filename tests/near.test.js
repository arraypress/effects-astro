import { test } from 'node:test';
import assert from 'node:assert/strict';
import { whenNear, lazyMargin } from '../src/runtime/near.js';
import { liveGradient } from '../src/runtime/live-gradient.js';

/**
 * Just enough of an element: a dataset and live-attribute bookkeeping.
 *
 * @param {Record<string, string>} [dataset] Its data attributes.
 * @returns {any} The element.
 */
function fakeEl(dataset = {}) {
	const attrs = new Set();
	return { dataset, setAttribute: (n) => attrs.add(n), removeAttribute: (n) => attrs.delete(n), has: (n) => attrs.has(n) };
}

test('lazyMargin: the attribute, then the config, else null', () => {
	assert.equal(lazyMargin(fakeEl({ effectLazy: '' }), {}), '200px');
	assert.equal(lazyMargin(fakeEl({ effectLazy: '80px' }), {}), '80px');
	assert.equal(lazyMargin(fakeEl(), { lazy: true }), '200px');
	assert.equal(lazyMargin(fakeEl(), { lazy: '1rem' }), '1rem');
	assert.equal(lazyMargin(fakeEl(), { lazy: false }), null);
	assert.equal(lazyMargin(fakeEl(), {}), null);
});

test('whenNear without IntersectionObserver: starts at once, and stops', () => {
	const el = fakeEl();
	let started = 0,
		stopped = 0;
	const stop = whenNear(el, () => {
		started++;
		return () => stopped++;
	});
	assert.equal(started, 1);
	assert.ok(el.has('data-effect-live'));
	stop();
	stop(); // twice is harmless
	assert.equal(stopped, 1);
	assert.ok(!el.has('data-effect-live'));
});

test('liveGradient: a mesh in the colours, subtle by default, with a still fallback', () => {
	const { config, fallback } = liveGradient(['#ff5c8a', '#ffb347', '#7b3ff2', '#1a0b2e']);
	assert.equal(config.shader, 'mesh-gradient');
	assert.deepEqual(config.colors, ['#ff5c8a', '#ffb347', '#7b3ff2', '#1a0b2e']);
	assert.equal(config.speed, 0.16);
	assert.equal(config.scale, 0.5);
	assert.match(fallback, /radial-gradient\(at 20% 18%, #ff5c8a 0, transparent 60%\)/);
	assert.ok(fallback.endsWith('#1a0b2e'), 'the last colour is the ground');
	assert.equal(liveGradient(['#000', '#fff', '#111', '#222', '#333']).config.colors.length, 4);
	assert.equal(liveGradient(['#000', '#fff'], { speed: 0.5 }).config.speed, 0.5);
	assert.throws(() => liveGradient(['#000']), TypeError);
});
