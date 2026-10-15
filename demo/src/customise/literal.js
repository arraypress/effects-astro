/**
 * Reads a value as the components write it in docs and in Astro markup:
 * JSON, or JavaScript with single quotes and bare keys (`{ x: 0.5 }`,
 * `['#f97316', '#10b981']`). Shared by the script that writes props.json
 * and the panel, which reads each hero's starting line.
 */

/**
 * Reads a literal.
 *
 * @param {string} text The literal.
 * @returns {unknown} Its value; the text itself, trimmed, when it is not a literal.
 */
export function literal(text) {
	const json = text
		.trim()
		.replace(/'([^']*)'/g, (_, s) => JSON.stringify(s))
		.replace(/([{,]\s*)([A-Za-z_]\w*)\s*:/g, '$1"$2":')
		.replace(/,\s*([}\]])/g, '$1');
	try {
		return JSON.parse(json);
	} catch {
		return text.trim();
	}
}
