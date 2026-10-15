/**
 * Puts a hero's new settings on the page, the way each prop reaches it:
 * into the effect's `data-effect-config` (in its template and on the page)
 * and a restart, into `data-colors` for colours (the effect eases to them
 * where it is), or straight into a CSS custom property or a class.
 * Restarts wait until the settings stop changing, so a dragged slider does
 * not make and drop a GPU context for every step.
 */

import { setColors } from '@arraypress/effects-astro';
import { restamp, templateOf } from '../scripts/stamp.js';

/** @typedef {import('./controls.js').Prop} Prop */

/** How long settings must hold still before the effect restarts, ms. */
const SETTLE = 120;
/** Each hero's pending restart. */
const pending = new WeakMap();

/**
 * Every copy of a component in a hero: in its template, and on the page.
 *
 * @param {HTMLElement} hero The hero.
 * @param {string} selector Matches the component's element.
 * @returns {HTMLElement[]} The elements.
 */
const targets = (hero, selector) => /** @type {HTMLElement[]} */ ([...(templateOf(hero)?.content.querySelectorAll(selector) ?? []), ...hero.querySelectorAll(selector)]);

/**
 * The element that carries a component's settings: its own element, or the
 * first inside it that does.
 *
 * @param {HTMLElement} el The component's element.
 * @returns {HTMLElement | null} The carrier, if any.
 */
const carrier = (el) => (el.matches('[data-effect-config]') ? el : el.querySelector('[data-effect-config]'));

/**
 * Sets one setting in every copy of a component's `data-effect-config`,
 * or takes it out.
 *
 * @param {HTMLElement} hero The hero.
 * @param {string} selector Matches the component's element.
 * @param {string} key The setting.
 * @param {unknown} value Its value; undefined takes it out.
 */
export function writeConfig(hero, selector, key, value) {
	for (const el of targets(hero, selector)) {
		const holder = carrier(el);
		if (!holder) continue;
		const config = JSON.parse(holder.dataset.effectConfig || '{}');
		if (value === undefined) delete config[key];
		else config[key] = value;
		holder.dataset.effectConfig = JSON.stringify(config);
	}
}

/**
 * Sets a prop that reaches the page through CSS: a custom property (with
 * its unit), a class switched on and off, or one class of a set
 * (`is-beam`). Undefined clears it, back to the stylesheet's default.
 *
 * @param {HTMLElement} hero The hero.
 * @param {string} selector Matches the component's element.
 * @param {Prop} prop The prop.
 * @param {unknown} value Its value.
 */
export function writeStyle(hero, selector, prop, value) {
	const route = /** @type {Exclude<Prop['live'], 'config' | undefined>} */ (prop.live);
	for (const el of targets(hero, selector)) {
		if ('css' in route) {
			if (value === undefined) el.style.removeProperty(route.css);
			else el.style.setProperty(route.css, `${value}${route.unit}`);
		} else if ('class' in route) el.classList.toggle(route.class, value === true);
		else {
			el.classList.remove(...(prop.options ?? []).map((option) => route.classPrefix + option));
			if (value !== undefined) el.classList.add(route.classPrefix + value);
		}
	}
}

/**
 * Recolours a component's effects on the page in place, through
 * `data-colors`: they ease to the new colours without restarting.
 *
 * @param {HTMLElement} hero The hero.
 * @param {string} selector Matches the component's element.
 * @param {string[]} colors The colours.
 * @param {string} [glint] A glint colour, for the effects that take one.
 */
export function paint(hero, selector, colors, glint) {
	hero.querySelectorAll(selector).forEach((el) => setColors(el, colors, glint));
}

/**
 * Restarts a component's effects with their settings: a fresh stamp of
 * the hero's template, or, for an element in the copy, a fresh copy of it
 * in its place.
 *
 * @param {HTMLElement} hero The hero.
 * @param {string} selector Matches the component's element.
 */
function restart(hero, selector) {
	if (templateOf(hero)?.content.querySelector(selector)) return restamp(hero);
	hero.querySelectorAll(selector).forEach((el) => {
		const holder = carrier(/** @type {HTMLElement} */ (el));
		holder?.replaceWith(holder.cloneNode(true));
	});
}

/**
 * Restarts a component's effects once its settings have held still for a
 * moment, or now.
 *
 * @param {HTMLElement} hero The hero.
 * @param {string} selector Matches the component's element.
 * @param {boolean} now Restart at once (a slider let go, a button pressed).
 */
export function schedule(hero, selector, now) {
	clearTimeout(pending.get(hero));
	if (now) restart(hero, selector);
	else pending.set(hero, setTimeout(() => restart(hero, selector), SETTLE));
}
