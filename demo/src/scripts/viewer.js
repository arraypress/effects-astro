/**
 * The gallery's viewer: one hero on show at a time, and a tour through
 * them, every hero or one type's (the filter, `?type=logos` in the
 * address). The tour's stops are the overview's cards, in order, each with
 * its type (src/components/Overview.astro); a hero is shown under its own
 * `#anchor` in the address bar. The hero shown fades in over the one
 * before, whose effect is then taken out (src/scripts/stamp.js), so only
 * one is live. Each change, of hero or filter, is announced as
 * `gallery:hero` on the document.
 */

import { hide, show } from './stamp.js';

/**
 * @typedef {object} Shown
 * @property {HTMLElement} hero The hero on show.
 * @property {HTMLAnchorElement | undefined} stop Its card.
 * @property {number} index Its place in the filter, from 0.
 * @property {number} total How many heroes the filter holds.
 * @property {string} filter The type shown, or empty for every one.
 */

const heroes = /** @type {HTMLElement[]} */ ([...document.querySelectorAll('[data-hero]')]);

/** Every stop in the gallery, in order. */
const stops = /** @type {HTMLAnchorElement[]} */ ([...document.querySelectorAll('[data-stop]')]);

/** The types there are, from the stops. */
const types = new Set(stops.map((stop) => stop.dataset.type));

/** The hero on show, and those fading out under it with their timers. */
let current = /** @type {HTMLElement | null} */ (null);
const leaving = /** @type {Map<HTMLElement, ReturnType<typeof setTimeout>>} */ (new Map());

/** The type shown, or empty for every one. */
let filter = '';

/**
 * A path without a trailing slash, so `/a/` and `/a` match.
 *
 * @param {string} path The path.
 * @returns {string} It, trimmed.
 */
const trim = (path) => path.replace(/(.)\/$/, '$1');

/**
 * The hero a link leads to, if it leads to one on this page.
 *
 * @param {HTMLAnchorElement} link The link.
 * @returns {HTMLElement | undefined} The hero.
 */
function heroAt(link) {
	if (link.origin !== location.origin || trim(link.pathname) !== trim(location.pathname)) return undefined;
	const id = decodeURIComponent(link.hash.slice(1));
	return heroes.find((hero) => hero.id === id);
}

/**
 * A hero's card.
 *
 * @param {HTMLElement | null} hero The hero.
 * @returns {HTMLAnchorElement | undefined} Its card.
 */
const stopOf = (hero) => stops.find((stop) => hero && heroAt(stop) === hero);

/**
 * The stops in the filter, in order.
 *
 * @returns {HTMLAnchorElement[]} The stops.
 */
const shown = () => (filter ? stops.filter((stop) => stop.dataset.type === filter) : stops);

/**
 * Whether a hero is in the filter.
 *
 * @param {HTMLElement} hero The hero.
 * @returns {boolean} True when it is.
 */
const inFilter = (hero) => !filter || stopOf(hero)?.dataset.type === filter;

/**
 * The address of a hero, under the filter.
 *
 * @param {HTMLElement} hero The hero.
 * @returns {string} The address (`/?type=logos#liquid-metal`).
 */
export const addressOf = (hero) => `${location.pathname}${filter ? `?type=${filter}` : ''}#${hero.id}`;

/**
 * The stop some way from the hero on show in the filter, round from the
 * last to the first.
 *
 * @param {number} by How far: 1 for the next, -1 for the one before.
 * @returns {HTMLAnchorElement | undefined} The stop.
 */
export function neighbour(by) {
	const list = shown();
	const at = list.findIndex((stop) => current && heroAt(stop) === current);
	return list[(((at + by) % list.length) + list.length) % list.length];
}

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
 * fading goes now, so no more than two are ever live. Then tells the page,
 * also when only the filter changed.
 *
 * @param {HTMLElement} hero The hero.
 */
function present(hero) {
	if (hero !== current) {
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
		document.title = `${hero.dataset.name} · effects-astro`;
	}
	const list = shown();
	const stop = stopOf(hero);
	const detail = /** @type {Shown} */ ({ hero, stop, index: stop ? list.indexOf(stop) : -1, total: list.length, filter });
	document.dispatchEvent(new CustomEvent('gallery:hero', { detail }));
}

/**
 * Shows a hero and puts it in the history, under the filter; a hero
 * outside the filter clears it.
 *
 * @param {HTMLElement} hero The hero.
 */
function go(hero) {
	if (!inFilter(hero)) filter = '';
	const address = addressOf(hero);
	if (address !== `${location.pathname}${location.search}${location.hash}`) history.pushState(null, '', address);
	present(hero);
}

/**
 * Goes to the hero a stop or link leads to.
 *
 * @param {HTMLAnchorElement | undefined} stop The stop.
 */
function visit(stop) {
	const hero = stop && heroAt(stop);
	if (hero) go(hero);
}

/**
 * Goes to the next stop in the filter, or the one before.
 *
 * @param {number} by 1 for the next, -1 for the one before.
 */
export const step = (by) => visit(neighbour(by));

/**
 * Shows one type, or every one: the hero on show stays if it is in it,
 * else the type's first comes in.
 *
 * @param {string} type The type, or empty for every one.
 */
function only(type) {
	filter = types.has(type) ? type : '';
	const first = shown()[0];
	const hero = current && inFilter(current) ? current : first && heroAt(first);
	if (hero) go(hero);
}

/**
 * Shows what the address names: its filter (`?type=`), and its hero, or
 * the filter's first. A hero outside the filter clears it.
 */
function fromAddress() {
	const type = new URLSearchParams(location.search).get('type') ?? '';
	filter = types.has(type) ? type : '';
	const id = decodeURIComponent(location.hash.slice(1));
	const named = heroes.find((h) => h.id === id);
	if (named && !inFilter(named)) filter = '';
	const first = shown()[0];
	const hero = named ?? (first && heroAt(first)) ?? heroes[0];
	if (hero) present(hero);
}

/**
 * Starts the viewer: the hero the address names on show, the browser's
 * back and forward followed, the bar's filters, and links to a hero shown
 * in place rather than loaded. Call it once the modules that listen for
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
		if (link.dataset.filter !== undefined) {
			e.preventDefault();
			return only(link.dataset.filter);
		}
		if (!heroAt(link)) return;
		e.preventDefault();
		visit(link);
	});
	fromAddress();
}
