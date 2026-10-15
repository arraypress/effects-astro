/**
 * The customise panel's behaviour: opens for the hero whose "Customise"
 * was pressed, draws a control for each prop its effect can change live
 * (palettes and colours, then sliders, segmented buttons and switches),
 * passes every change to the hero (src/customise/state.js), and keeps the
 * line that makes it on show, ready to copy. Escape or the close button
 * shuts it and hands focus back to the button that opened it. Left open as
 * the gallery moves on, it follows to the next hero, or shuts if that hero
 * has nothing to customise.
 */

import { findPalette } from '@arraypress/effects-astro/runtime/palettes';
import { change, lineOf, reset, stateOf } from '../customise/state.js';
import { colorsOf, foldsColor } from '../customise/colours.js';
import { make, picker, point, segments, slider, toggle } from '../customise/fields.js';

/** @typedef {import('../customise/controls.js').Prop} Prop */
/** @typedef {import('../customise/state.js').State} State */

const panel = /** @type {HTMLElement} */ (document.querySelector('[data-panel]'));

/**
 * One of the panel's parts.
 *
 * @param {string} name Its `data-panel-…` name.
 * @returns {HTMLElement} The part.
 */
const part = (name) => /** @type {HTMLElement} */ (panel.querySelector(`[data-panel-${name}]`));

const title = part('title');
const colourGroup = part('colour');
const swatches = part('swatches');
const paletteName = part('palette');
const colours = part('colours');
const settingsGroup = part('settings');
const controls = part('controls');
const code = part('code');
const copy = part('copy');

/** The hero the panel is open for, and the button that opened it. */
let hero = /** @type {HTMLElement | null} */ (null);
let opener = /** @type {HTMLElement | null} */ (null);

/** The kinds drawn in the colour group. */
const COLOUR_KINDS = new Set(['palette', 'colors', 'color']);

/**
 * Where a number's slider starts: its value now, else its default; the
 * range widened to take it, should the hero start outside it.
 *
 * @param {Prop} prop The prop.
 * @param {unknown} value Its value now.
 * @returns {{ min: number, max: number, step: number, value: number }} The slider's range and value.
 */
function numberSpec(prop, value) {
	const v = typeof value === 'number' ? value : Number(prop.default ?? prop.min);
	return { min: Math.min(/** @type {number} */ (prop.min), v), max: Math.max(/** @type {number} */ (prop.max), v), step: /** @type {number} */ (prop.step), value: v };
}

/**
 * A point's or a vector's fields as values by name: its value now, else
 * its default, else the middle of each field's range.
 *
 * @param {Prop} prop The prop.
 * @param {unknown} value Its value now: an object, or a list for a vector.
 * @returns {Record<string, number>} The values by field.
 */
function fieldValues(prop, value) {
	const given = /** @type {any} */ (value ?? prop.default ?? {});
	const fields = prop.fields ?? [];
	return Object.fromEntries(fields.map((f, i) => [f.name, Number((Array.isArray(given) ? given[i] : given[f.name]) ?? (f.min + f.max) / 2)]));
}

/**
 * Passes one change to the hero the panel is open for.
 *
 * @param {Record<string, unknown>} changes The props and their new values.
 * @param {boolean} done Whether it was let go (restart at once).
 */
const send = (changes, done) => hero && change(hero, changes, done);

/**
 * The control for one prop in the settings group.
 *
 * @param {Prop} prop The prop.
 * @param {Record<string, unknown>} values The hero's values now.
 * @returns {HTMLElement | null} The control; null for a kind drawn elsewhere.
 */
function control(prop, values) {
	const { name, doc } = prop;
	const value = values[name];
	if (prop.kind === 'number') return slider({ name, doc, ...numberSpec(prop, value) }, (v, done) => send({ [name]: v }, done));
	if (prop.kind === 'boolean') return toggle({ name, doc, value: Boolean(value ?? prop.default) }, (v, done) => send({ [name]: v }, done));
	if (prop.kind === 'enum') return segments({ name, doc, options: prop.options ?? [], value: String(value ?? prop.default ?? '') }, (v, done) => send({ [name]: v }, done));
	if (prop.kind === 'point' || prop.kind === 'vector') {
		const fields = prop.fields ?? [];
		return point({ name, doc, fields, value: fieldValues(prop, value) }, (v, done) => send({ [name]: prop.kind === 'vector' ? fields.map((f) => v[f.name]) : v }, done));
	}
	return null;
}

/**
 * Presses the palette a hero shows now, if it shows one, and names it.
 *
 * @param {State} state The hero's state.
 */
function markPalette({ values }) {
	const chosen = values.colors ? undefined : findPalette(/** @type {string | undefined} */ (values.palette));
	swatches.querySelectorAll('[data-swatch]').forEach((s) => s.setAttribute('aria-pressed', String(Boolean(chosen) && findPalette(/** @type {HTMLElement} */ (s).dataset.swatch) === chosen)));
	paletteName.textContent = chosen ? `· ${values.palette}` : values.colors ? '· your own' : '';
}

/** A colour as a picker takes it: six-digit hex. */
const HEX = /^#[\da-f]{6}$/i;

/**
 * A row of pickers for a list of colours, under the prop's name unless it
 * is the effect's own `colors`.
 *
 * @param {Prop} prop The prop.
 * @param {string[]} list Its colours now.
 * @param {() => void} after Called after each change (to unpress a palette).
 * @returns {HTMLElement} The row.
 */
function colourList(prop, list, after) {
	const now = [...list];
	const pickers = now.map((color, i) =>
		picker({ label: `${prop.name} ${i + 1}`, value: color }, (v, done) => {
			now[i] = v;
			send({ [prop.name]: [...now] }, done);
			after();
		}),
	);
	const row = make('div', { class: 'colours__list' }, pickers);
	return prop.name === 'colors' ? row : make('div', { class: 'colours__named', title: prop.doc }, [make('span', { class: 'control__name' }, [prop.name]), row]);
}

/**
 * Draws the colour group: the palettes, the chosen one pressed; each list
 * of colours as pickers, when they can be known; and a picker for each
 * single colour (a glint, a ground).
 *
 * @param {State} state The hero's state.
 */
function drawColours(state) {
	const { component, values } = state;
	const shown = component.controls.filter((p) => COLOUR_KINDS.has(p.kind) && !(p.name === 'color' && foldsColor(component)));
	swatches.hidden = !shown.some((p) => p.kind === 'palette');
	markPalette(state);

	const rows = [];
	for (const prop of shown) {
		const value = prop.name === 'colors' ? colorsOf(state) : (values[prop.name] ?? prop.default);
		if (prop.kind === 'colors' && Array.isArray(value) && value.every((c) => HEX.test(c))) rows.push(colourList(prop, value, () => markPalette(state)));
		else if (prop.name === 'colors' && !swatches.hidden) rows.push(make('p', { class: 'panel__hint' }, ['Its own colours. Pick a palette to edit them.']));
		else if (prop.kind === 'color' && typeof value === 'string' && HEX.test(value)) {
			rows.push(make('div', { class: 'colours__one', title: prop.doc }, [make('span', { class: 'control__name' }, [prop.name]), picker({ label: prop.name, value }, (v, done) => send({ [prop.name]: v }, done))]));
		}
	}
	colours.replaceChildren(...rows);
	colourGroup.hidden = swatches.hidden && !rows.length;
}

/**
 * Draws everything for the hero the panel is open for.
 */
function draw() {
	const state = hero && stateOf(hero);
	if (!hero || !state) return;
	title.textContent = hero.dataset.name ?? state.component.name;
	drawColours(state);
	const rest = state.component.controls.filter((p) => !COLOUR_KINDS.has(p.kind)).map((p) => control(p, state.values));
	controls.replaceChildren(.../** @type {HTMLElement[]} */ (rest.filter(Boolean)));
	settingsGroup.hidden = !rest.length;
	code.textContent = lineOf(state);
}

/**
 * Opens the panel for a hero.
 *
 * @param {HTMLElement} target The hero.
 * @param {HTMLElement} button Its "Customise" button.
 * @param {boolean} [focus] Move focus into the panel. Default true.
 */
function open(target, button, focus = true) {
	opener?.setAttribute('aria-expanded', 'false');
	hero = target;
	opener = button;
	button.setAttribute('aria-expanded', 'true');
	draw();
	panel.hidden = false;
	if (!focus) return;
	const first = /** @type {HTMLElement[]} */ ([...panel.querySelectorAll('.panel__body button, .panel__body input')]).find((el) => el.getClientRects().length);
	first?.focus({ preventScroll: true });
}

/**
 * Closes the panel.
 *
 * @param {boolean} [refocus] Hand focus back to the button that opened it. Default true.
 */
function close(refocus = true) {
	panel.hidden = true;
	opener?.setAttribute('aria-expanded', 'false');
	if (refocus) opener?.focus({ preventScroll: true });
	hero = null;
	opener = null;
}

document.addEventListener('click', (e) => {
	const button = /** @type {HTMLElement | null} */ (/** @type {HTMLElement} */ (e.target).closest('[data-customise]'));
	if (!button) return;
	const target = /** @type {HTMLElement} */ (button.closest('[data-hero]'));
	if (target === hero) close();
	else open(target, button);
});

panel.addEventListener('click', (e) => {
	const target = /** @type {HTMLElement} */ (e.target);
	if (target.closest('[data-panel-close]')) return close();
	if (!hero) return;
	const swatch = /** @type {HTMLElement | null} */ (target.closest('[data-swatch]'));
	if (swatch) {
		change(hero, { palette: swatch.dataset.swatch }, true);
		const state = stateOf(hero);
		if (state) drawColours(state);
		return;
	}
	if (target.closest('[data-panel-reset]')) {
		reset(hero);
		return draw();
	}
	if (target.closest('[data-panel-copy]')) {
		navigator.clipboard?.writeText(code.textContent ?? '').then(() => {
			copy.textContent = 'Copied';
			setTimeout(() => (copy.textContent = 'Copy code'), 1200);
		});
	}
});

document.addEventListener('keydown', (e) => {
	if (e.key === 'Escape' && !panel.hidden) close();
});

// The line, as the hero's tag shows it, after every change.
document.addEventListener('customise:line', (e) => {
	if (e.target === hero) code.textContent = /** @type {CustomEvent<string>} */ (e).detail;
});

// Another hero on show: the panel follows it, if it can configure it.
document.addEventListener('gallery:hero', (e) => {
	if (panel.hidden) return;
	const next = /** @type {CustomEvent<import('./viewer.js').Shown>} */ (e).detail.hero;
	const button = /** @type {HTMLElement | null} */ (next.querySelector('[data-customise]'));
	if (button) open(next, button, false);
	else close(false);
});
