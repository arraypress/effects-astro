/**
 * @module @arraypress/effects-astro/components/text
 *
 * The words of a rendered slot, for an attribute that repeats them
 * (`<GlitchText copies="pseudo">`'s `data-text`): its tags dropped and its
 * character references read back into characters, so Astro escapes them
 * once, as the attribute's own.
 */

/** The named references Astro's escaping writes, and the no-break space. */
const NAMED = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

/**
 * A slot's HTML as plain text.
 *
 * @param {string} html The rendered slot.
 * @returns {string} Its text: no tags, each run of white space one space, trimmed, references decoded.
 */
export function plainText(html) {
	return html
		.replace(/<[^>]*>/g, '')
		.replace(/[ \t\n\r\f]+/g, ' ')
		.trim()
		.replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi, (whole, ref) => {
			if (ref[0] !== '#') return NAMED[/** @type {keyof typeof NAMED} */ (ref.toLowerCase())] ?? whole;
			const code = /^#x/i.test(ref) ? parseInt(ref.slice(2), 16) : parseInt(ref.slice(1), 10);
			return code <= 0x10ffff ? String.fromCodePoint(code) : whole;
		});
}
