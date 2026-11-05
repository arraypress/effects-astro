import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { NAMES } from '@logomarks/shaders/load';
import { validateOptions, LOOK_PARAMS } from '@logomarks/shaders';
import { sceneSettings } from '../src/runtime/scene.js';
import { PALETTES } from '../src/runtime/palettes.js';
import { readComponent } from '../scripts/props.mjs';

test("the scene names in the types are @logomarks/shaders' scenes", () => {
	const types = readFileSync(new URL('../src/runtime/scene.d.ts', import.meta.url), 'utf8');
	const union = types.slice(types.indexOf('export type SceneName'), types.indexOf(';', types.indexOf('export type SceneName')));
	assert.deepEqual([...union.matchAll(/'([a-z0-9-]+)'/g)].map((m) => m[1]), NAMES);
});

test('sceneSettings finds the palette by name, in any case, and passes lazy on as near', () => {
	const { name, options } = sceneSettings({ name: 'marble', palette: 'barbie', params: { scale: 1.2 }, speed: undefined });
	assert.equal(name, 'marble');
	assert.equal(options.palette, PALETTES.Barbie);
	assert.deepEqual(options.params, { scale: 1.2 });
	assert.equal(options.lazy, true, 'lazy by default');
	assert.ok(!('speed' in options), 'props left out are left out');
	assert.equal(sceneSettings({ name: 'topo', near: '400px' }).options.lazy, '400px');
	assert.equal(sceneSettings({ name: 'topo', near: false }).options.lazy, false);
});

test('sceneSettings warns about an unknown palette and keeps the scene’s own colours', () => {
	const warn = console.warn;
	/** @type {unknown[]} */
	const said = [];
	console.warn = (...args) => said.push(args.join(' '));
	const { options } = sceneSettings({ name: 'marble', palette: 'Teal' });
	console.warn = warn;
	assert.equal(options.palette, undefined);
	assert.match(String(said[0]), /No palette "Teal"/);
});

test('every palette suits every scene', () => {
	for (const name of NAMES) for (const palette of Object.keys(PALETTES)) assert.doesNotThrow(() => validateOptions(name, sceneSettings({ name, palette }).options), `${name} · ${palette}`);
});

test('<Scene> takes every look setting, and keeps lazy away from mount()', () => {
	const { rows, text } = readComponent('Scene.astro');
	const props = rows.map((r) => r.name);
	for (const key of [...LOOK_PARAMS.map((p) => p.key), 'tint', 'colors', 'glint', 'palette', 'params', 'fps', 'scale', 'lazy']) assert.ok(props.includes(key), key);
	// mount() treats a `lazy` in an element's settings as its own; the scene's lazy goes as `near`.
	assert.match(text, /lazy = true[^}]*\.\.\.config \} = Astro\.props/);
	assert.match(text, /Object\.assign\(config, \{ near: lazy \}\)/);
});

test('sceneSettings passes on only the scene’s own options (Astro hands a component its `slot` too)', () => {
	const { options } = sceneSettings(/** @type {any} */ ({ name: 'marble', slot: 'effect', fixed: true, hue: 20 }));
	assert.deepEqual(Object.keys(options).sort(), ['hue', 'lazy']);
	assert.doesNotThrow(() => validateOptions('marble', options));
});
