/**
 * @module @arraypress/effects-astro/fit-text
 *
 * One line of text sized to exactly span its parent's content width,
 * whatever the text and the window: a footer wordmark that runs edge to
 * edge. A viewport-based CSS size cannot do it (it does not know how long
 * the text is, and stops growing at its cap).
 *
 * The text is measured with a Range (the text itself, not its box) at a
 * reference size and scaled from there. It refits when the parent's width
 * changes and once web fonts have loaded (a fallback font is a different
 * width). The CSS size stays as the fallback without script.
 *
 * From the SampleGrid (WaveGrid) theme.
 */

import { textRange } from './text.js';

/** The size the text is measured at, in px. */
const REFERENCE = 100;

/**
 * Fits one element's text to its parent's content box.
 *
 * @param {HTMLElement} el The element whose text should fill the line.
 */
export function fit(el) {
	const parent = el.parentElement;
	if (!parent) return;
	const cs = getComputedStyle(parent);
	const available = parent.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
	if (!(available > 0)) return;
	el.style.fontSize = `${REFERENCE}px`;
	const natural = textRange(el)?.getBoundingClientRect().width ?? 0;
	if (!(natural > 0)) return;
	// A hair under the exact fit, so rounding never wraps or clips the last letter.
	el.style.fontSize = `${Math.floor(((REFERENCE * available) / natural) * 0.995 * 100) / 100}px`;
}

/**
 * Keeps an element's text fitted to its parent's width.
 *
 * @param {HTMLElement} el The element.
 * @returns {() => void} Stops refitting.
 */
export function fitText(el) {
	fit(el);
	document.fonts?.ready.then(() => fit(el)).catch(() => {});
	// Only a width change refits: the refit itself changes the parent's
	// height, and reacting to that would loop.
	let width = -1;
	const observer = new ResizeObserver(([entry]) => {
		const w = Math.round(entry.contentRect.width);
		if (w === width) return;
		width = w;
		fit(el);
	});
	if (el.parentElement) observer.observe(el.parentElement);
	return () => observer.disconnect();
}
