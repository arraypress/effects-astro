/**
 * A component's props as the panel uses them: the generated metadata
 * (props.json) with the demo's overrides applied, and which of them the
 * panel shows as controls.
 */

import PROPS from './props.json';
import { HIDDEN, OFF, TWEAKS } from './overrides.js';

/**
 * @typedef {{ css: string, unit: string } | { class: string } | { classPrefix: string }} Route
 * @typedef {{ name: string, min: number, max: number, step: number }} Field
 * @typedef {{ name: string, kind: string, doc: string, default?: unknown, options?: string[], min?: number, max?: number, step?: number, fields?: Field[], live?: 'config' | Route }} Prop
 * @typedef {{ name: string, selector: string, props: Prop[], controls: Prop[] }} Component
 */

/** The kinds the panel draws a control for (colours and palettes go in its colour group). */
const DRAWN = new Set(['number', 'boolean', 'enum', 'color', 'colors', 'palette', 'point', 'vector']);

/**
 * Whether the panel can show a prop: not hidden, a kind it draws, a way to
 * reach the page live, and, for a number, a range.
 *
 * @param {Prop} prop The prop.
 * @param {string[]} hidden This component's hidden props, besides HIDDEN.
 * @returns {boolean} True when it gets a control.
 */
const drawn = (prop, hidden) => !HIDDEN.has(prop.name) && !hidden.includes(prop.name) && DRAWN.has(prop.kind) && Boolean(prop.live) && (prop.kind !== 'number' || prop.min !== undefined);

/**
 * A component's props and controls, or null when it has no panel.
 *
 * @param {string} name The component, as its tag is written (`HaloRing`).
 * @returns {Component | null} It, with overrides applied.
 */
export function describe(name) {
	const found = /** @type {Record<string, { selector: string | null, props: Prop[] }>} */ (PROPS)[name];
	if (!found?.selector || OFF.has(name)) return null;
	const { hide = [], ...tweaks } = TWEAKS[name] ?? {};
	const props = found.props.map((prop) => ({
		...prop,
		...(prop.kind === 'boolean' && !('default' in prop) ? { default: false } : {}),
		.../** @type {object} */ (tweaks[prop.name] ?? {}),
	}));
	return { name, selector: found.selector, props, controls: props.filter((prop) => drawn(prop, /** @type {string[]} */ (hide))) };
}

/**
 * The component a hero's line makes: the first tag in it.
 *
 * @param {string} code The line (`<HaloRing />`).
 * @returns {string} The component's name; empty when there is none.
 */
export const componentOf = (code) => code.match(/^<([A-Z]\w*)/)?.[1] ?? '';
