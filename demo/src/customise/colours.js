/**
 * A hero's colours, read from its props: the list its effect shows, and
 * its lead colour, which the hero's accented copy takes (`--hero-accent`).
 * Shared by the hero, which seeds the accent from its starting line, and
 * the panel, which keeps it in step.
 */

import { findPalette } from '@arraypress/effects-astro/runtime/palettes';

/**
 * @typedef {import('./controls.js').Component} Component
 * @typedef {import('./controls.js').Prop} Prop
 */

/** A CSS hex colour. */
const HEX = /^#[\da-f]{3,8}$/i;

/**
 * A component's prop by name.
 *
 * @param {Component} component The component.
 * @param {string} name The prop.
 * @returns {Prop | undefined} The prop, if it has it.
 */
export const propOf = (component, name) => component.props.find((p) => p.name === name);

/**
 * Whether a component's single `color` is another way to give its colours
 * (its palette's doc says it stands in for `color` too), so it is edited
 * as the colour list.
 *
 * @param {Component} component The component.
 * @returns {boolean} True when it is.
 */
export const foldsColor = (component) => Boolean(propOf(component, 'color') && propOf(component, 'palette')?.doc.includes('`color`'));

/**
 * The colours an effect shows with these props, as a list: its own, else
 * its palette's, else its documented default. Null when it takes no colour
 * list or they cannot be known (a default described in words).
 *
 * @param {{ component: Component, values: Record<string, unknown> }} hero The component and its props.
 * @returns {string[] | null} The colours.
 */
export function colorsOf({ component, values }) {
	const colors = propOf(component, 'colors');
	if (colors?.kind !== 'colors') return null;
	if (Array.isArray(values.colors) && values.colors.length) return /** @type {string[]} */ (values.colors);
	if (foldsColor(component) && typeof values.color === 'string') return [values.color];
	const palette = findPalette(/** @type {string | undefined} */ (values.palette ?? propOf(component, 'palette')?.default));
	if (palette) return [...palette.colors];
	return Array.isArray(colors.default) ? /** @type {string[]} */ (colors.default) : null;
}

/**
 * The lead colour of an effect with these props: the first of its colours,
 * else its single `color`. Null when it cannot be known.
 *
 * @param {{ component: Component, values: Record<string, unknown> }} hero The component and its props.
 * @returns {string | null} The colour.
 */
export function leadColour(hero) {
	const first = colorsOf(hero)?.[0];
	if (first) return first;
	const color = hero.values.color ?? propOf(hero.component, 'color')?.default;
	return typeof color === 'string' && HEX.test(color) ? color : null;
}
