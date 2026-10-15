/**
 * @module @arraypress/effects-astro/components/style
 *
 * One `style` attribute from a component's own custom properties and the
 * style a site passes: the site's comes last, so it can override, but no
 * longer replaces the properties the effect needs.
 */

/**
 * Joins a component's own style with the one it was given.
 *
 * @param {string | false | null | undefined} own The component's declarations.
 * @param {unknown} given The `style` prop, if any (a string; other values are ignored).
 * @returns {string | undefined} The joined declarations, or undefined when there are none.
 */
export function withStyle(own, given) {
	const parts = [own, typeof given === 'string' ? given : ''].map((part) => (part || '').trim().replace(/;$/, '')).filter(Boolean);
	return parts.length ? parts.join('; ') : undefined;
}
