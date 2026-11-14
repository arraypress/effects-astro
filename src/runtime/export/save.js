/**
 * @module @arraypress/effects-astro/export/save
 *
 * A file handed to the browser to save, and a name for it made from any
 * text.
 */

/**
 * Hands a file to the browser to save.
 *
 * @param {Blob | string} data The file (a Blob, or text saved as `type`).
 * @param {string} filename Its name.
 * @param {string} [type] The text's media type. Default `image/svg+xml`.
 */
export function save(data, filename, type = 'image/svg+xml') {
	const blob = typeof data === 'string' ? new Blob([data], { type }) : data;
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	a.download = filename;
	a.rel = 'noopener';
	document.body.append(a);
	a.click();
	a.remove();
	setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

/**
 * A file name's part from any text: accents dropped, lower case, letters
 * and digits with hyphens between.
 *
 * @param {string} s The text.
 * @returns {string} The slug; `export` when nothing is left.
 */
export const fileSlug = (s) =>
	s
		.normalize('NFKD')
		.replace(/[̀-ͯ]/g, '')
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-|-$/g, '') || 'export';
