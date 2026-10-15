/**
 * @module @arraypress/effects-astro/text
 *
 * An element's own text, for effects that measure or redraw it: its text
 * nodes (an effect may have added a canvas inside it), and a Range over
 * them all, whose box is the text's own extent rather than the element's.
 */

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
	if (!texts.length) return null;
	const range = document.createRange();
	range.setStart(texts[0], 0);
	range.setEnd(texts[texts.length - 1], texts[texts.length - 1].length);
	return range;
}
