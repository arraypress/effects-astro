/**
 * Moving through the tour without the bar: the ← and → keys, unless focus
 * is somewhere that wants them (a field, a slider, the customise panel or
 * the overview), and a swipe left or right on a touch screen.
 */

import { step } from './viewer.js';

/** Where the arrow keys and swipes belong to what is there, not the tour. */
const OWN = 'input, textarea, select, [contenteditable], [role="slider"], [aria-roledescription="carousel"], [data-panel], [data-overview]';

/** How far a swipe must travel across, px, and how long it may take, ms. */
const SWIPE = { distance: 56, time: 700 };

document.addEventListener('keydown', (e) => {
	if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
	const by = { ArrowLeft: -1, ArrowRight: 1 }[e.key];
	if (!by || document.activeElement?.closest(OWN)) return;
	e.preventDefault();
	step(by);
});

/** Where the touch that may be a swipe began, and when. */
let from = /** @type {{ x: number, y: number, t: number } | null} */ (null);

document.addEventListener(
	'touchstart',
	(e) => {
		const touch = e.touches[0];
		from = e.touches.length === 1 && !(/** @type {HTMLElement} */ (e.target).closest(`${OWN}, .bar`)) ? { x: touch.clientX, y: touch.clientY, t: e.timeStamp } : null;
	},
	{ passive: true },
);

document.addEventListener(
	'touchend',
	(e) => {
		if (!from) return;
		const touch = e.changedTouches[0];
		const dx = touch.clientX - from.x;
		const dy = touch.clientY - from.y;
		const quick = e.timeStamp - from.t < SWIPE.time;
		from = null;
		if (quick && Math.abs(dx) > SWIPE.distance && Math.abs(dx) > 2 * Math.abs(dy)) step(dx < 0 ? 1 : -1);
	},
	{ passive: true },
);
