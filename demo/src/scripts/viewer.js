/**
 * The gallery's viewer: one hero on show at a time, and a tour through
 * every hero on every page. The tour's stops are the overview's cards, in
 * order (src/components/Overview.astro); a stop on this page is shown in
 * place, under its own `#anchor` in the address bar, and one on another
 * page is a page load. The hero shown fades in over the one before, whose
 * effect is then taken out (src/scripts/stamp.js), so only one is live.
 * Each change is announced as `gallery:hero` on the document, with the hero
 * and its stop.
 */

import { hide, show } from './stamp.js';

/**
 * @typedef {{ hero: HTMLElement, stop: HTMLAnchorElement | undefined, index: number }} Shown
 */

const heroes = /** @type {HTMLElement[]} */ ([...document.querySelectorAll('[data-hero]')]);

/** Every stop in the gallery, in order. */
export const stops = /** @type {HTMLAnchorElement[]} */ ([...document.querySelectorAll('[data-stop]')]);

/** The hero on show, and those fading out under it with their timers. */
let current = /** @type {HTMLElement | null} */ (null);
const leaving = /** @type {Map<HTMLElement, ReturnType<typeof setTimeout>>} */ (new Map());

/**
 * A path without a trailing slash, so `/paper/` and `/paper` match.
 *
 * @param {string} path The path.
 * @returns {string} It, trimmed.
 */
const trim = (path) => path.replace(/(.)\/$/, '$1');

/**
 * The hero a link leads to on this page, if it leads to one here.
 *
 * @param {HTMLAnchorElement} link The link.
 * @returns {HTMLElement | undefined} The hero.
 */
export function heroAt(link) {
	if (link.origin !== location.origin || trim(link.pathname) !== trim(location.pathname)) return undefined;
	const id = decodeURIComponent(link.hash.slice(1));
	return heroes.find((hero) => hero.id === id);
}

/**
 * Where the hero on show is in the tour.
 *
 * @returns {number} Its index; -1 before one is shown.
 */
const at = () => stops.findIndex((stop) => current && heroAt(stop) === current);

/**
 * The stop some way from the hero on show, round from the last to the first.
 *
 * @param {number} by How far: 1 for the next, -1 for the one before.
 * @returns {HTMLAnchorElement | undefined} The stop.
 */
export const neighbour = (by) => stops[(((at() + by) % stops.length) + stops.length) % stops.length];

/**
 * Takes a faded-out hero away: its effect out and the section hidden.
 *
 * @param {HTMLElement} hero The hero.
 */
function settle(hero) {
	clearTimeout(leaving.get(hero));
	leaving.delete(hero);
	hero.classList.remove('is-leaving');
	hide(hero);
	hero.hidden = true;
}

/**
 * Shows a hero over the one before, which fades out under it and goes once
 * the new one is in (at once, when motion is reduced). Any older hero still
 * fading goes now, so no more than two are ever live.
 *
 * @param {HTMLElement} hero The hero.
 */
function present(hero) {
	if (hero === current) return;
	const before = current;
	clearTimeout(leaving.get(hero));
	leaving.delete(hero);
	[...leaving.keys()].forEach(settle);
	hero.classList.remove('is-leaving');
	hero.hidden = false;
	show(hero);
	current = hero;
	if (before) {
		before.classList.add('is-leaving');
		const fade = parseFloat(getComputedStyle(hero).animationDuration) * 1000 || 0;
		leaving.set(before, setTimeout(() => settle(before), fade));
	}
	const index = at();
	document.title = `${hero.dataset.name} · effects-astro`;
	document.dispatchEvent(new CustomEvent('gallery:hero', { detail: /** @type {Shown} */ ({ hero, stop: stops[index], index }) }));
}

/**
 * Goes to a stop: shown in place, in the history, when it is on this page;
 * otherwise its page loads.
 *
 * @param {HTMLAnchorElement | undefined} stop The stop.
 */
export function visit(stop) {
	if (!stop) return;
	const hero = heroAt(stop);
	if (!hero) return location.assign(stop.href);
	if (hero !== current) history.pushState(null, '', `#${hero.id}`);
	present(hero);
}

/**
 * Goes to the next stop, or the one before.
 *
 * @param {number} by 1 for the next, -1 for the one before.
 */
export const step = (by) => visit(neighbour(by));

/**
 * Shows the hero the address names, or the page's first.
 */
function fromAddress() {
	const id = decodeURIComponent(location.hash.slice(1));
	const hero = heroes.find((h) => h.id === id) ?? heroes[0];
	if (hero) present(hero);
}

/**
 * Starts the viewer: the hero the address names on show, the browser's
 * back and forward followed, and links to a hero on this page shown in
 * place rather than loaded. Call it once the modules that listen for
 * `gallery:hero` are in, so they hear the first.
 */
export function start() {
	history.scrollRestoration = 'manual';
	addEventListener('popstate', fromAddress);
	document.addEventListener('click', (e) => {
		if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
		const link = /** @type {HTMLAnchorElement | null} */ (/** @type {HTMLElement} */ (e.target).closest('a[href]'));
		if (!link) return;
		// The copy's placeholder links (`href="#"`) go nowhere, rather than back to the first hero.
		if (link.getAttribute('href') === '#') return e.preventDefault();
		if (!heroAt(link)) return;
		e.preventDefault();
		visit(link);
	});
	fromAddress();
}
