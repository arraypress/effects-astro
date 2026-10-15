import { test } from 'node:test';
import assert from 'node:assert/strict';
import { paperSettings, paperUniforms } from '../src/runtime/paper.js';
import { PRESETS } from '../src/vendor/paper/presets.js';

test('every Paper shader has a module and at least one preset', async () => {
	for (const [name, presets] of Object.entries(PRESETS)) {
		assert.ok(presets.length > 0, name);
		const module = await import(`../src/vendor/paper/shaders/${name}.js`);
		const camel = name.replace(/-(\w)/g, (_, c) => c.toUpperCase());
		assert.match(module[`${camel}FragmentShader`], /^#version 300 es/, name);
	}
});

test('paperSettings starts from the named preset, any case, and lays settings over it', () => {
	const beach = paperSettings({ shader: 'mesh-gradient', preset: 'BEACH', params: { swirl: 0.9 } });
	assert.deepEqual(beach.colors, ['#bcecf6', '#00aaff', '#00f7ff', '#ffd447']);
	assert.equal(beach.swirl, 0.9);
	assert.equal(paperSettings({ shader: 'mesh-gradient', preset: 'nope' }).colors.length, 4);
	assert.deepEqual(paperSettings({ shader: 'mesh-gradient', colors: ['#000000'] }).colors, ['#000000']);
	assert.throws(() => paperSettings({ shader: /** @type {any} */ ('nope') }), /No Paper shader/);
});

test('paperUniforms turns settings into uniforms', () => {
	const u = paperUniforms('dithering', { size: 3, shape: 'swirl', type: '4x4', fit: 'cover', colorFront: '#ff0000', speed: 2 });
	assert.equal(u.u_pxSize, 3, 'size is renamed for dithering');
	assert.equal(u.u_shape, 6, 'named shape → its number');
	assert.equal(u.u_type, 3);
	assert.equal(u.u_fit, 2);
	assert.deepEqual(u.u_colorFront, [1, 0, 0, 1]);
	assert.equal(u.u_speed, undefined, 'speed steers the host, it is not a uniform');
	const c = paperUniforms('mesh-gradient', { colors: ['#ffffff', '#000000'] });
	assert.equal(c.u_colorsCount, 2);
	assert.deepEqual(c.u_colors, [[1, 1, 1, 1], [0, 0, 0, 1]]);
});
