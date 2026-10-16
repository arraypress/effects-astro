import { test } from 'node:test';
import assert from 'node:assert/strict';
import { paperLookSettings, quietMask } from '../src/runtime/paper-look.js';
import { paperSettings } from '../src/runtime/paper.js';
import { PAPER_LOOKS } from '../src/runtime/paper-looks.js';
import { PRESETS } from '../src/vendor/paper/presets.js';
import { readComponent } from '../scripts/props.mjs';
import { literal } from '../demo/src/customise/literal.js';

/**
 * A look's component, read: `color-panels` → ColorPanels.astro.
 *
 * @param {string} look The look.
 * @returns {import('../scripts/props.mjs').Component} Its component.
 */
const componentOf = (look) => readComponent(`${look.replace(/(^|-)(\w)/g, (_, dash, c) => c.toUpperCase())}.astro`);

test('paperLookSettings maps plain props onto Paper settings, over the look preset', () => {
	const config = paperLookSettings({ look: 'color-panels', density: 4, skewLeft: 0.2, fadeOuter: 0.5, offset: [0.1, -0.2], zoom: 1.5, background: '#000000', speed: 1 });
	assert.equal(config.shader, 'color-panels');
	assert.equal(config.preset, 'Opening');
	assert.deepEqual(config.params, { colorBack: '#000000', scale: 1.5, offsetX: 0.1, offsetY: -0.2, density: 4, angle1: 0.2, fadeOut: 0.5 });
	assert.equal(config.speed, 1);
	assert.equal(config.colors, undefined, 'no colours given: the preset keeps its own');
	const settings = paperSettings(config);
	assert.equal(settings.angle2, -1, 'a prop left out keeps the preset setting');
	assert.equal(settings.density, 4);
});

test('paperLookSettings takes another preset, colours and palettes', () => {
	assert.equal(paperLookSettings({ look: 'color-panels', preset: 'Glass' }).preset, 'Glass');
	assert.deepEqual(paperLookSettings({ look: 'color-panels', colors: ['#ff0000'] }).colors, ['#ff0000']);
	assert.equal(paperLookSettings({ look: 'color-panels', palette: 'lagoon' }).colors?.length, 3);
	assert.equal(paperLookSettings({ look: 'color-panels', palette: 'nope' }).colors, undefined);
	assert.throws(() => paperLookSettings({ look: /** @type {any} */ ('nope') }), /No Paper look/);
});

test('every look maps onto settings its shader has, and documents its preset values as defaults', () => {
	for (const [name, look] of Object.entries(PAPER_LOOKS)) {
		const presets = PRESETS[look.shader];
		const preset = presets.find((p) => p.name === look.preset);
		assert.ok(preset, `${name}: preset ${look.preset}`);
		for (const setting of Object.values(look.props)) assert.ok(setting in preset.params, `${name}: ${setting}`);
		const { rows } = componentOf(name);
		const union = rows.find((r) => r.name === 'preset')?.type.split('|').map((t) => t.trim().slice(1, -1));
		assert.deepEqual(union?.sort(), presets.map((p) => p.name).sort(), `${name}: its preset union`);
		// Each prop set to its documented default changes nothing: the default is the preset's.
		const base = paperSettings(paperLookSettings({ look: /** @type {any} */ (name) }));
		for (const row of rows) {
			const written = row.doc.match(/\bDefault\s+`?([^`]+?)`?\.$/)?.[1];
			if (written === undefined) continue;
			assert.deepEqual(paperSettings(paperLookSettings({ look: /** @type {any} */ (name), [row.name]: literal(written) })), base, `${name}: ${row.name}`);
		}
	}
});

test('quietMask dims the centre to 1 - depth, sized in the height', () => {
	assert.equal(quietMask({ x: 0.25, y: 0.5, radius: 0.5, depth: 0.8 }), 'radial-gradient(circle calc(0.5 * 100cqh) at 25% 50%, rgb(0 0 0 / 0.2) calc(0.03 * 100cqh), #000)');
});
