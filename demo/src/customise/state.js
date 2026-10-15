/**
 * What each hero is set to now: its starting line (read from its tag), the
 * values changed since, the page kept in step with them (apply.js), and
 * the line that makes it, written back into the hero's tag. A hero gets
 * its state the first time something changes it.
 */

import { componentOf, describe } from './controls.js';
import { attribute, parseLine, writeLine } from './markup.js';
import { paint, schedule, writeConfig, writeStyle } from './apply.js';
import { colorsOf, foldsColor, leadColour, propOf } from './colours.js';

/**
 * @typedef {import('./controls.js').Component} Component
 * @typedef {{ component: Component, line: import('./markup.js').Line, values: Record<string, unknown> }} State
 */

/** Each hero's state. */
const states = new WeakMap();

/**
 * Whether two values are the same.
 *
 * @param {unknown} a One.
 * @param {unknown} b The other.
 * @returns {boolean} True when they are.
 */
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/**
 * A hero's state, made from its tag the first time it is asked for.
 *
 * @param {HTMLElement} hero The hero.
 * @returns {State | null} Its state; null when the panel cannot configure it.
 */
export function stateOf(hero) {
	if (states.has(hero)) return states.get(hero);
	const code = /** @type {HTMLElement | null} */ (hero.querySelector('[data-copy]'))?.dataset.copy ?? '';
	const component = describe(componentOf(code));
	const line = parseLine(code);
	const state = component && { component, line, values: { ...line.props } };
	states.set(hero, state);
	return state;
}

/**
 * The line that makes what a hero shows now: each prop of its starting
 * line as it is now, then any other changed from its default. A starting
 * prop changed back to its default is left out.
 *
 * @param {State} state The hero's state.
 * @returns {string} The line.
 */
export function lineOf({ component, line, values }) {
	const names = [...line.order, ...component.props.map((p) => p.name).filter((n) => !line.order.includes(n))];
	const attributes = names.flatMap((name) => {
		const value = values[name];
		if (value === undefined) return [];
		if (name in line.props && same(value, line.props[name])) return [attribute(name, value)];
		const prop = propOf(component, name);
		return prop && 'default' in prop && same(value, prop.default) ? [] : [attribute(name, value)];
	});
	return writeLine(line, attributes);
}

/**
 * Puts changed values on the page: each the way its prop reaches it, the
 * colours in place where the effect can take them so, and one restart for
 * everything else. A CSS prop taken out goes back to its default, which
 * the component would have written.
 *
 * @param {HTMLElement} hero The hero.
 * @param {State} state Its state, already changed.
 * @param {string[]} keys The props that changed.
 * @param {boolean} now Restart at once rather than when the values hold still.
 */
function apply(hero, state, keys, now) {
	const { component, values } = state;
	const recolour = /** @type {Set<string>} */ (new Set(['colors', 'palette', 'glint', ...(foldsColor(component) ? ['color'] : [])]));
	const colors = colorsOf(state);
	let painted = false;
	let restart = false;
	for (const key of keys) {
		const prop = propOf(component, key);
		if (!prop?.live) continue;
		if (prop.live !== 'config') writeStyle(hero, component.selector, prop, values[key] ?? prop.default);
		else {
			writeConfig(hero, component.selector, key, values[key]);
			if (recolour.has(key) && colors) painted = true;
			else restart = true;
		}
	}
	if (painted && colors) paint(hero, component.selector, colors, /** @type {string | undefined} */ (values.glint));
	if (restart) schedule(hero, component.selector, now);
}

/**
 * Writes a hero's line into its tag, gives its accented copy the effect's
 * lead colour (`--hero-accent`), and tells the page it changed
 * (`customise:line` on the hero, with the line).
 *
 * @param {HTMLElement} hero The hero.
 * @param {State} state Its state.
 */
function publish(hero, state) {
	const line = lineOf(state);
	const accent = leadColour(state);
	if (accent) hero.style.setProperty('--hero-accent', accent);
	else hero.style.removeProperty('--hero-accent');
	const tag = /** @type {HTMLElement | null} */ (hero.querySelector('[data-copy]'));
	if (tag) {
		tag.dataset.copy = line;
		tag.textContent = line;
	}
	hero.dispatchEvent(new CustomEvent('customise:line', { bubbles: true, detail: line }));
}

/**
 * Changes some of a hero's props, puts them on the page and rewrites its
 * line. A palette takes the place of the hero's own colours; its own
 * colours take the place of a palette.
 *
 * @param {HTMLElement} hero The hero.
 * @param {Record<string, unknown>} changes The props and their new values; undefined takes one out.
 * @param {boolean} [now] Restart at once rather than when the values hold still.
 */
export function change(hero, changes, now = false) {
	const state = stateOf(hero);
	if (!state) return;
	const color = foldsColor(state.component) ? { color: undefined } : {};
	const all = {
		...('palette' in changes ? { colors: undefined, glint: undefined, ...color } : {}),
		...('colors' in changes ? { palette: undefined, ...color } : {}),
		...changes,
	};
	for (const [key, value] of Object.entries(all)) {
		if (value === undefined) delete state.values[key];
		else state.values[key] = value;
	}
	apply(hero, state, Object.keys(all), now);
	publish(hero, state);
}

/**
 * Puts a hero back as its starting line made it.
 *
 * @param {HTMLElement} hero The hero.
 */
export function reset(hero) {
	const state = stateOf(hero);
	if (!state) return;
	const keys = [...new Set([...Object.keys(state.values), ...state.line.order])];
	state.values = { ...state.line.props };
	apply(hero, state, keys, true);
	publish(hero, state);
}
