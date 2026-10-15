/**
 * @module @arraypress/effects-astro/world-labels
 *
 * Where <WorldRoutes> puts the cities' names: beside each city, trying
 * the right, the left, above and below in turn, and leaving a name out
 * rather than letting it cover another or another city's dot. Names that
 * must show (the home city's, the one under the pointer) take the first
 * side that fits the box whatever they cover.
 */

/**
 * @typedef {object} LabelItem
 * @property {number} x The city, CSS px across.
 * @property {number} y The city, CSS px down.
 * @property {number} w The name's width, CSS px.
 * @property {number} h The name's height, CSS px.
 * @property {number} gap Space between the city's centre and its name.
 * @property {boolean} [force] Show it even where it overlaps.
 */

/** @typedef {{ x: number, y: number, w: number, h: number }} Rect A box, its top left and size. */

/**
 * Do two boxes overlap?
 *
 * @param {Rect} a One.
 * @param {Rect} b The other.
 * @returns {boolean} True when they share any area.
 */
const overlaps = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

/**
 * Places names beside their cities, first come first served: pass the
 * ones that matter most first.
 *
 * @param {LabelItem[]} items The names, in order of importance.
 * @param {Rect[]} obstacles What names must not cover (the cities' dots), each item's own city included.
 * @param {{ width: number, height: number } | null} bounds The box names must stay in, or null for anywhere.
 * @returns {(Rect | null)[]} Each name's box, or null where it is left out.
 */
export function placeLabels(items, obstacles, bounds) {
	/** @type {Rect[]} */
	const placed = [];
	return items.map((item) => {
		const { x, y, w, h, gap } = item;
		/** @type {Rect[]} */
		const sides = [
			{ x: x + gap, y: y - h / 2, w, h },
			{ x: x - gap - w, y: y - h / 2, w, h },
			{ x: x - w / 2, y: y - gap - h, w, h },
			{ x: x - w / 2, y: y + gap, w, h },
		];
		const inside = sides.filter((r) => !bounds || (r.x >= 0 && r.y >= 0 && r.x + r.w <= bounds.width && r.y + r.h <= bounds.height));
		const free = inside.find((r) => !placed.some((p) => overlaps(p, r)) && !obstacles.some((o) => overlaps(o, r)));
		const box = free ?? (item.force ? (inside[0] ?? sides[0]) : null);
		if (box) placed.push(box);
		return box;
	});
}
