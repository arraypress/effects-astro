import { test } from 'node:test';
import assert from 'node:assert/strict';
import { inkFieldSettings, inkFallback } from '../src/runtime/ink-field.js';
import { PALETTES } from '../src/runtime/palettes.js';
import { DISPLAY } from '../src/runtime/ink-field/shaders.js';
import { colorPools } from '../src/runtime/pools.js';
import { parseColor } from '../src/runtime/color.js';
import { GLSL_NOISE } from '../src/runtime/glsl.js';


test('inkFieldSettings fills every default from Lumetri', () => {
	assert.deepEqual(inkFieldSettings(), {
		colors: ['#2532ef', '#0957ff', '#f69d03'],
		glint: '#FFFDCF',
		lamp: { x: 0.14, y: 0.14 },
		interactive: true,
		drops: false,
		still: false,
		scale: 0.5,
	});
});

test('inkFieldSettings takes a named palette, and Lumetri for an unknown one', () => {
	assert.deepEqual(inkFieldSettings({ palette: 'Saffron' }).colors, PALETTES.Saffron.colors);
	assert.equal(inkFieldSettings({ palette: 'saffron' }).glint, PALETTES.Saffron.glint);
	assert.deepEqual(inkFieldSettings({ palette: 'Nope' }).colors, PALETTES.Lumetri.colors);
});

test('colours given override the palette, looped to three; the glint stays the palette’s unless given', () => {
	const own = inkFieldSettings({ palette: 'Ruby', colors: ['#111111', '#222222', '#333333'] });
	assert.deepEqual(own.colors, ['#111111', '#222222', '#333333']);
	assert.equal(own.glint, PALETTES.Ruby.glint);
	assert.deepEqual(inkFieldSettings({ colors: ['#abcdef'] }).colors, ['#abcdef', '#abcdef', '#abcdef']);
	assert.deepEqual(inkFieldSettings({ colors: ['#aaaaaa', '#bbbbbb'] }).colors, ['#aaaaaa', '#bbbbbb', '#aaaaaa']);
	assert.deepEqual(inkFieldSettings({ colors: [] }).colors, PALETTES.Lumetri.colors);
	assert.equal(inkFieldSettings({ glint: '#ffffff' }).glint, '#ffffff');
});

test('inkFieldSettings reads the rest, and leaves the palettes alone', () => {
	const s = inkFieldSettings({ lamp: { x: 0.8 }, interactive: false, still: true, scale: 1 });
	assert.deepEqual(s.lamp, { x: 0.8, y: 0.14 });
	assert.equal(s.interactive, false);
	assert.equal(s.still, true);
	assert.equal(s.scale, 1);
	s.colors[0] = '#000000';
	assert.equal(PALETTES.Lumetri.colors[0], '#2532ef');
});

test('the fallback is the colours as pools of light on the water', () => {
	const css = inkFallback(['#ff0000', '#00ff00', '#0000ff']);
	assert.equal(css, colorPools(['#ff0000', '#00ff00', '#0000ff'], '#08080a'));
	assert.match(css, /20% 25%, #ff0000 0%.*80% 30%, #00ff00 0%.*70% 85%, #0000ff 0%.*#08080a$/);
	assert.match(colorPools(['#123456'], 'black'), /#123456[\s\S]*#123456[\s\S]*#123456[\s\S]*black$/);
});

test('the display keeps Trirat’s look: his constants, the shared noise, his palette loop', () => {
	assert.ok(DISPLAY.includes(GLSL_NOISE));
	for (const line of ['const float BUMP = 0.05;', 'const float LAMP_Z = 0.5;', 'const float AMBIENT = 0.38;', 'const float SHEEN = 0.08;', 'float ink = 1.0 - exp(-dye.r * 2.1);', 'vec3 pal(float t)']) {
		assert.ok(DISPLAY.includes(line), line);
	}
});
