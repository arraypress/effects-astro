import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BOKEH_GLASS, MAX_LIGHTS, bokehLights, bokehAt, reedSample, bokehColors, bokehStill } from '../src/runtime/fluted-bokeh.js';

test('the lights come from the seed: the same seed, the same lights; another seed, others', () => {
	const a = bokehLights({ seed: 4, lights: 5 });
	assert.deepEqual(a, bokehLights({ seed: 4, lights: 5 }));
	assert.notDeepEqual(a, bokehLights({ seed: 5, lights: 5 }));
	assert.equal(a.length, 5);
	assert.equal(bokehLights({ lights: 40 }).length, MAX_LIGHTS);
	for (const l of a) assert.ok(l.x > 0 && l.x < 1 && l.y > 0 && l.y < 1);
});

test('a light is brightest at its centre and fades away from it', () => {
	const c = { lights: 1, seed: 2, drift: 0, colors: ['#ffffff', '#ffffff'] };
	const [l] = bokehLights(c);
	const at = bokehAt(c, l.x, l.y, 0.8)[1];
	const near = bokehAt(c, l.x, Math.min(0.99, l.y + 0.1), 0.8)[1];
	const far = bokehAt(c, l.x < 0.5 ? 0.98 : 0.02, l.y < 0.5 ? 0.98 : 0.02, 0.8)[1];
	assert.ok(at > near && near > far && at > 0.9 && far < 0.05, `${at} ${near} ${far}`);
});

test('the lights wander with time', () => {
	const c = { lights: 3, seed: 1, rate: 0.3 };
	let moved = 0;
	for (let y = 0.05; y < 1; y += 0.1) for (let x = 0.05; x < 1; x += 0.1) moved += Math.abs(bokehAt(c, x, y, 0.8, 0)[0] - bokehAt(c, x, y, 0.8, 1.7)[0]);
	assert.ok(moved > 0.3, `${moved}`);
});

test('each flute shows a squeezed slice about its own centre', () => {
	const flutes = 20;
	for (let i = 0; i < flutes; i++) {
		const centre = (i + 0.5) / flutes;
		assert.ok(Math.abs(reedSample(centre, flutes, 0.3).x - centre) < 1e-9);
		const a = reedSample(i / flutes + 1e-6, flutes, 0.3);
		const b = reedSample((i + 1) / flutes - 1e-6, flutes, 0.3);
		assert.ok(Math.abs(b.x - a.x - 0.3 / flutes) < 1e-4);
	}
});

test('two to four colours, and a CSS-only still with the glass over the lights', () => {
	assert.equal(bokehColors({ colors: ['#111111', '#222222', '#333333', '#444444', '#555555'] }).length, 4);
	for (const mode of BOKEH_GLASS) {
		const css = bokehStill({ mode, background: '#050302' });
		assert.doesNotMatch(css, /url\(|data:/);
		assert.match(css, /^repeating-linear-gradient\(90deg/);
		assert.match(css, /, #050302$/);
	}
});
