/**
 * The bar's filters, arrows and count: they follow the hero on show and
 * the filter, the filter's link marked, the arrows leading to the stops
 * either side in the filter (src/scripts/viewer.js shows them in place),
 * and the count reading the hero's place in the filter and its group.
 */

import { addressOf, neighbour } from './viewer.js';

const count = document.querySelector('[data-count]');
const total = document.querySelector('[data-total]');
const group = document.querySelector('[data-count-group]');
const filters = /** @type {HTMLAnchorElement[]} */ ([...document.querySelectorAll('[data-filter]')]);
const arrows = /** @type {HTMLAnchorElement[]} */ ([...document.querySelectorAll('[data-step]')]);

document.addEventListener('gallery:hero', (e) => {
	const { stop, index, total: all, filter } = /** @type {CustomEvent<import('./viewer.js').Shown>} */ (e).detail;
	if (count) count.textContent = String(index + 1);
	if (total) total.textContent = String(all);
	if (group) group.textContent = stop?.dataset.group ?? '';
	for (const link of filters) {
		if (link.dataset.filter === filter) link.setAttribute('aria-current', 'true');
		else link.removeAttribute('aria-current');
	}
	for (const arrow of arrows) {
		const next = neighbour(Number(arrow.dataset.step));
		const hero = next && document.getElementById(decodeURIComponent(next.hash.slice(1)));
		if (!next || !hero) continue;
		arrow.href = addressOf(hero);
		arrow.title = next.querySelector('.card__name')?.textContent ?? '';
	}
});
