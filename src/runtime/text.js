/**
 * @module @arraypress/effects-astro/text
 *
 * An element's own text, for effects that measure or redraw it: its text
 * nodes (an effect may have added a canvas inside it), a Range over them
 * all, whose box is the text's own extent rather than the element's, and
 * its letters, each in a span of its own, for effects that move or restyle
 * them one by one. Split letters stay real text: selectable, found by
 * search and read as words.
 */

/** Marks a letter's span. */
const LETTER = 'data-letter';

/**
 * The element's non-empty text nodes.
 *
 * @param {HTMLElement} el The element.
 * @returns {Text[]} Its text nodes, in order.
 */
export function textNodes(el) {
	return /** @type {Text[]} */ ([...el.childNodes].filter((n) => n.nodeType === Node.TEXT_NODE && !!n.textContent?.trim()));
}

/**
 * A Range over all of an element's own text.
 *
 * @param {HTMLElement} el The element.
 * @returns {Range | null} The range, or null when it has no text.
 */
export function textRange(el) {
	const texts = textNodes(el);
	const range = document.createRange();
	if (!texts.length) {
		// Split into letters: the range is over them.
		if (!el.querySelector(`[${LETTER}]`)) return null;
		range.selectNodeContents(el);
		return range;
	}
	range.setStart(texts[0], 0);
	range.setEnd(texts[texts.length - 1], texts[texts.length - 1].length);
	return range;
}

/**
 * Splits an element's text into one span a letter (`[data-letter]`),
 * leaving spaces as text, so the line still wraps between words. Text
 * already split (a copy of a split element) is reused as it is.
 *
 * @param {HTMLElement} el The element.
 * @returns {HTMLElement[]} Its letters, in order.
 */
export function splitLetters(el) {
	const done = /** @type {HTMLElement[]} */ ([...el.querySelectorAll(`[${LETTER}]`)]);
	if (done.length) return done;
	const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
	/** @type {Text[]} */
	const texts = [];
	while (walker.nextNode()) if (walker.currentNode.textContent?.trim()) texts.push(/** @type {Text} */ (walker.currentNode));
	const segmenter = typeof Intl !== 'undefined' && 'Segmenter' in Intl ? new Intl.Segmenter(undefined, { granularity: 'grapheme' }) : null;
	/** @type {HTMLElement[]} */
	const letters = [];
	for (const text of texts) {
		const parts = segmenter ? [...segmenter.segment(text.data)].map((s) => s.segment) : Array.from(text.data);
		const fragment = document.createDocumentFragment();
		for (const part of parts) {
			if (/^\s+$/.test(part)) {
				fragment.append(part);
				continue;
			}
			const span = document.createElement('span');
			span.setAttribute(LETTER, '');
			span.textContent = part;
			fragment.append(span);
			letters.push(span);
		}
		text.replaceWith(fragment);
	}
	return letters;
}

/**
 * Puts split letters back as plain text.
 *
 * @param {HTMLElement} el The element.
 */
export function joinLetters(el) {
	el.querySelectorAll(`[${LETTER}]`).forEach((span) => span.replaceWith(span.textContent ?? ''));
	el.normalize();
}
