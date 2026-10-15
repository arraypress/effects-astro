/**
 * The bar's arrows and count: they follow the hero on show, the arrows
 * leading to the stops either side of it (src/scripts/viewer.js shows a
 * stop on this page in place, so a press only loads a page at its edge).
 */

import { neighbour } from './viewer.js';

const count = document.querySelector('[data-count]');
const arrows = /** @type {HTMLAnchorElement[]} */ ([...document.querySelectorAll('[data-step]')]);

document.addEventListener('gallery:hero', (e) => {
	const { index } = /** @type {CustomEvent<import('./viewer.js').Shown>} */ (e).detail;
	if (count) count.textContent = String(index + 1);
	for (const arrow of arrows) {
		const stop = neighbour(Number(arrow.dataset.step));
		if (!stop) continue;
		arrow.href = stop.href;
		arrow.title = stop.querySelector('.card__name')?.textContent ?? '';
	}
});
