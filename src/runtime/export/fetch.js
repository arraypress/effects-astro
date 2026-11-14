/**
 * @module @arraypress/effects-astro/export/fetch
 *
 * Same-origin files as `data:` URLs, for exports that must carry
 * everything inside them: an SVG drawn as an image cannot load anything
 * from outside itself. Each URL is fetched once per page.
 */

/** Every URL asked for, by its absolute form, and its `data:` URL to come. */
/** @type {Map<string, Promise<string>>} */
const seen = new Map();

/**
 * Every top-level `url(…)` in a CSS value: quoted (as computed values are)
 * or bare. A quoted one is matched whole, so a `url(#id)` inside a `data:`
 * URL's own text is never taken for another.
 */
const URLS = /url\(\s*(?:"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)'|([^'")\s]*))\s*\)/g;

/**
 * The URL a `URLS` match holds, whichever way it was quoted.
 *
 * @param {(string | undefined)[]} groups The match's groups (from 1), or the match itself.
 * @param {number} [from] Where the groups start in it: 1 for a match, 0 for a replacer's groups.
 * @returns {string} The URL.
 */
const urlOf = (groups, from = 1) => groups[from] ?? groups[from + 1] ?? groups[from + 2] ?? '';

/**
 * Whether a URL loads from outside: not a `data:` URL, not a `#fragment`.
 *
 * @param {string} u The URL.
 * @returns {boolean} Whether it does.
 */
const outer = (u) => !!u && !u.startsWith('data:') && !u.startsWith('#');

/**
 * Every `url(…)` in a CSS value that would load from outside.
 *
 * @param {string} value A CSS declaration block or value.
 * @returns {string[]} The URLs, in order (repeats kept).
 */
export function outerUrls(value) {
	return [...value.matchAll(URLS)].map((m) => urlOf(m)).filter(outer);
}

/**
 * Whether a CSS value has a `url(…)` that would load from outside.
 *
 * @param {string} value A CSS declaration block or value.
 * @returns {boolean} Whether it has.
 */
export const hasOuterUrl = (value) => outerUrls(value).length > 0;

/**
 * A blob as a `data:` URL.
 *
 * @param {Blob} blob The blob.
 * @returns {Promise<string>} Its `data:` URL.
 */
export const blobToDataUrl = (blob) =>
	new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = () => resolve(/** @type {string} */ (reader.result));
		reader.onerror = () => reject(reader.error);
		reader.readAsDataURL(blob);
	});

/**
 * A file as a `data:` URL, fetched once (a failed fetch is tried again
 * next time); a `data:` URL is returned as it is.
 *
 * @param {string} url Absolute, or relative to the page.
 * @returns {Promise<string>} Its `data:` URL.
 * @throws {Error} When the file cannot be fetched.
 */
export function toDataUrl(url) {
	if (url.startsWith('data:')) return Promise.resolve(url);
	const abs = new URL(url, location.href).href;
	let p = seen.get(abs);
	if (!p) {
		p = fetch(abs)
			.then((r) => {
				if (!r.ok) throw new Error(`export: ${r.status} fetching ${abs}`);
				return r.blob();
			})
			.then(blobToDataUrl);
		seen.set(abs, p);
		p.catch(() => seen.delete(abs));
	}
	return p;
}

/**
 * A CSS value with every `url(…)` that loads from outside swapped for its
 * `data:` URL; one that cannot be fetched becomes `none` rather than be
 * left pointing outside the image.
 *
 * @param {string} value A CSS declaration block or value.
 * @returns {Promise<string>} The value, self-contained.
 */
export async function inlineCssUrls(value) {
	const found = outerUrls(value);
	if (!found.length) return value;
	/** @type {Map<string, string>} */
	const map = new Map();
	await Promise.all(
		[...new Set(found)].map(async (u) => {
			try {
				map.set(u, await toDataUrl(u));
			} catch {
				map.set(u, '');
			}
		}),
	);
	return value.replace(URLS, (all, ...groups) => {
		const u = urlOf(groups, 0);
		if (!map.has(u)) return all;
		return map.get(u) ? `url("${map.get(u)}")` : 'none';
	});
}
