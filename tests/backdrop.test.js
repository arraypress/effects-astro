import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { BACKDROPS, readColor, hueRotate, backdropPalette, backdropSettings, fallbackBackground } from '../src/runtime/backdrop.js';
import { parseColor, mixOklab } from '../src/runtime/color.js';

/**
 * Asserts two colours match to within rounding.
 *
 * @param {number[]} actual The colour got.
 * @param {number[]} expected The colour wanted.
 */
const near = (actual, expected) => actual.forEach((v, i) => assert.ok(Math.abs(v - expected[i]) < 1e-6, `${actual} ≉ ${expected}`));

test('every backdrop name has a shader, a file and nothing else', () => {
	const types = readFileSync(new URL('../src/runtime/backdrop.d.ts', import.meta.url), 'utf8');
	const union = types.slice(types.indexOf('export type BackdropName'), types.indexOf(';', types.indexOf('export type BackdropName')));
	const names = [...union.matchAll(/'([a-z-]+)'/g)].map((m) => m[1]);
	assert.equal(names.length, 6);
	assert.deepEqual(Object.keys(BACKDROPS).sort(), [...names].sort());
	const files = readdirSync(new URL('../src/runtime/backdrops/', import.meta.url)).filter((f) => f !== 'common.js');
	assert.deepEqual(files.map((f) => f.replace(/\.js$/, '')).sort(), [...names].sort());
});

test('every shader starts from the shared header and premultiplies what it writes', () => {
	for (const [name, source] of Object.entries(BACKDROPS)) {
		assert.match(source, /precision highp float;[\s\S]*vec4 premultiply\(vec4 c\)/, name);
		assert.match(source, /void main\(\)/, name);
		const writes = source.match(/gl_FragColor\s*=/g) ?? [];
		const wrapped = source.match(/gl_FragColor = premultiply\(/g) ?? [];
		assert.ok(writes.length > 0 && writes.length === wrapped.length, `${name} writes a straight colour`);
		assert.doesNotMatch(source, /\bu_[a-z]/, `${name} has an unrenamed uniform`);
	}
});

test('only mesh-gradient, grain-gradient and silk read the fourth colour', () => {
	// The header declares it once; a shader that reads it names it again.
	const fourth = Object.keys(BACKDROPS).filter((name) => BACKDROPS[name].split('uColor4').length > 2);
	assert.deepEqual(fourth.sort(), ['grain-gradient', 'mesh-gradient', 'silk']);
});

test('readColor reads hex and rgb(), and nothing else', () => {
	assert.deepEqual(readColor('#ff0000'), [1, 0, 0]);
	assert.deepEqual(readColor(' #0f0 '), [0, 1, 0]);
	assert.deepEqual(readColor('rgb(0, 0, 255)'), [0, 0, 1]);
	assert.deepEqual(readColor('rgba(255 255 255 / 0.5)'), [1, 1, 1]);
	assert.equal(readColor('oklch(70% 0.2 150)'), null);
	assert.equal(readColor('red'), null);
	assert.equal(readColor(''), null);
});

test('hueRotate turns the hue and leaves greys alone', () => {
	near(hueRotate([1, 0, 0], 120), [0, 1, 0]);
	near(hueRotate([1, 0, 0], -120), [0, 0, 1]);
	near(hueRotate([0.2, 0.5, 0.8], 360), [0.2, 0.5, 0.8]);
	assert.deepEqual(hueRotate([0.4, 0.4, 0.4], 90), [0.4, 0.4, 0.4]);
});

test('backdropPalette derives all four colours from the accent and background', () => {
	const accent = parseColor('#00e472');
	const bg = parseColor('#ffffff');
	const [c1, c2, c3, c4] = backdropPalette({ accent: '#00e472', background: '#ffffff' });
	assert.deepEqual(c1, accent);
	near(c2, mixOklab(accent, bg, 0.55));
	near(c3, hueRotate(accent, 36));
	near(c4, hueRotate(accent, -32).map((c) => Math.min(1, c * 1.2)));
	// On a light page the second is a pale tint, not a dark shade.
	assert.ok(c2.every((c, i) => c >= accent[i]));
});

test('backdropPalette falls back to a green accent on black', () => {
	const [c1, c2] = backdropPalette({ accent: '', background: 'not a colour' });
	assert.deepEqual(c1, [0, 0.89, 0.45]);
	near(c2, mixOklab([0, 0.89, 0.45], [0, 0, 0], 0.55));
});

test('backdropPalette puts given colours first, skipping unreadable ones', () => {
	const derived = backdropPalette({ accent: '#00e472' });
	const palette = backdropPalette({ accent: '#00e472', colors: ['nope', '#ff0000', 'rgb(0, 0, 255)'] });
	assert.deepEqual(palette[0], [1, 0, 0]);
	assert.deepEqual(palette[1], [0, 0, 1]);
	assert.deepEqual(palette.slice(2), derived.slice(2));
	assert.equal(backdropPalette({ colors: ['#111111', '#222222', '#333333', '#444444', '#555555'] }).length, 4);
});

test('backdropSettings clamps speed to 0–4 and intensity to 0–2', () => {
	assert.deepEqual(backdropSettings({}), { speed: 1, intensity: 1, frame: 12 });
	assert.deepEqual(backdropSettings({ speed: 9, intensity: 5, frame: 3 }), { speed: 4, intensity: 2, frame: 3 });
	assert.deepEqual(backdropSettings({ speed: -1, intensity: -1 }), { speed: 0, intensity: 0, frame: 12 });
	assert.deepEqual(backdropSettings({ speed: 0, intensity: 0 }), { speed: 0, intensity: 0, frame: 12 });
	assert.deepEqual(backdropSettings(/** @type {any} */ ({ speed: 'fast', intensity: null })), { speed: 1, intensity: 1, frame: 12 });
});

test('fallbackBackground paints the first and third colours as soft pools', () => {
	const css = fallbackBackground([[1, 0, 0], [0, 1, 0], [0, 0, 1], [1, 1, 1]]);
	assert.match(css, /radial-gradient\(ellipse 55% 70% at 75% 25%, rgba\(255,0,0,0\.14\), transparent 65%\)/);
	assert.match(css, /radial-gradient\(ellipse 60% 70% at 20% 75%, rgba\(0,0,255,0\.1\), transparent 65%\)/);
});

test('Backdrop fades the bottom by default and passes the rest to the runtime', () => {
	const source = readFileSync(new URL('../src/components/Backdrop.astro', import.meta.url), 'utf8');
	assert.match(source, /fade = 'bottom'/);
	assert.match(source, /<EffectCanvas\s+name="backdrop"/);
	assert.match(source, /mount\('\[data-effect-backdrop\]', backdrop\)/);
});
