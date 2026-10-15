import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PALETTES, findPalette, pickColors } from '../src/runtime/palettes.js';
import { parseColor } from '../src/runtime/color.js';

const TRIRAT = ['Lumetri', 'Forest', 'Cadmium', 'Peacock', 'Vermillion', 'Barbie', 'Uranium', 'Azure', 'Ruby', 'Ultramarine', 'Saffron', 'Crimson'];

test("the palettes start with Trirat's twelve, in order, each three hex colours and a glint", () => {
	assert.deepEqual(Object.keys(PALETTES).slice(0, 12), TRIRAT);
	assert.ok(Object.isFrozen(PALETTES));
	for (const [name, palette] of Object.entries(PALETTES)) {
		assert.equal(palette.colors.length, 3, name);
		[...palette.colors, palette.glint].forEach((c) => assert.doesNotThrow(() => parseColor(c), `${name}: ${c}`));
	}
});

test('the palette names in the types are the palettes', () => {
	const types = readFileSync(new URL('../src/runtime/palettes.d.ts', import.meta.url), 'utf8');
	const union = types.slice(types.indexOf('export type PaletteName'), types.indexOf(';', types.indexOf('export type PaletteName')));
	assert.deepEqual([...union.matchAll(/'([A-Za-z]+)'/g)].map((m) => m[1]), Object.keys(PALETTES));
});

test('findPalette finds a palette in any case, and nothing for an unknown name', () => {
	assert.equal(findPalette('Peacock'), PALETTES.Peacock);
	assert.equal(findPalette('peacock'), PALETTES.Peacock);
	assert.equal(findPalette('ULTRAMARINE'), PALETTES.Ultramarine);
	assert.equal(findPalette('Teal'), undefined);
	assert.equal(findPalette(undefined), undefined);
	assert.equal(findPalette(''), undefined);
});

test('pickColors: own colours win, then the palette shaped, then the defaults', () => {
	const fallback = ['#000000'];
	assert.deepEqual(pickColors({ colors: ['#ffffff'], palette: 'Ruby' }, fallback), ['#ffffff']);
	assert.deepEqual(pickColors({ palette: 'barbie' }, fallback), PALETTES.Barbie.colors);
	assert.deepEqual(pickColors({ palette: 'Barbie' }, fallback, (p) => [p.colors[0], p.glint]), ['#ff0bce', '#ff00ff']);
	assert.deepEqual(pickColors({}, fallback), fallback);
	assert.deepEqual(pickColors({ colors: [] }, fallback), fallback);
	const warn = console.warn;
	console.warn = () => {};
	assert.deepEqual(pickColors({ palette: 'Nope' }, fallback), fallback);
	console.warn = warn;
});
