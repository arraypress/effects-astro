/**
 * Stamping a hero's effect in and out: each hero keeps its effect in a
 * <template> and puts a copy into the section only while it is on show
 * (src/scripts/viewer.js). Effects start and stop themselves as they are added and removed
 * (mount() watches the page), so stamping again restarts them.
 */

/**
 * A hero's template, which holds its effect.
 *
 * @param {HTMLElement} hero The hero.
 * @returns {HTMLTemplateElement | null} The template, if it has one.
 */
export const templateOf = (hero) => hero.querySelector('[data-live-template]');

/**
 * Puts a hero's effect into it, if it is not there already.
 *
 * @param {HTMLElement} hero The hero.
 */
export function show(hero) {
	const live = hero.querySelector('[data-live]');
	const template = templateOf(hero);
	if (!live || !template || live.childElementCount) return;
	live.append(template.content.cloneNode(true));
	hero.classList.add('is-live');
}

/**
 * Takes a hero's effect out, which stops it and frees its GPU context.
 *
 * @param {HTMLElement} hero The hero.
 */
export function hide(hero) {
	hero.querySelector('[data-live]')?.replaceChildren();
	hero.classList.remove('is-live');
}

/**
 * Stamps a hero's effect in again from its template, if it is in now: a
 * fresh start with the template's settings.
 *
 * @param {HTMLElement} hero The hero.
 */
export function restamp(hero) {
	if (!hero.classList.contains('is-live')) return;
	hide(hero);
	show(hero);
}
