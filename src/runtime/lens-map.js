/**
 * @module @arraypress/effects-astro/lens-map
 *
 * The displacement map of a rounded glass panel seen as a thick lens: a
 * rounded rectangle's signed distance field, rasterised one pixel per CSS
 * pixel. Red and green hold how far each point of the panel looks across
 * and down (0.5 for not at all), strongest at the rim, where a thick slab
 * of glass bends light hardest, and nothing in its flat middle. Blue holds
 * where the rim catches the light, for a bright highlight. The pure maths
 * is here; liquid-glass.js turns the map into an SVG filter.
 *
 * The technique (an SDF rasterised to a displacement map, blue as a
 * specular mask, fed to `feDisplacementMap`) is adapted from Sam Asante's
 * liquid-glass (https://github.com/samasante/liquid-glass, MIT,
 * © 2026 Sam Asante). This is our own code.
 */

/** The light the rim catches comes from the top left, mostly from above. */
const LIGHT = normalise(-0.45, -0.89);
/** How bright the rim facing away from the light is, against the lit side. */
const BACKLIGHT = 0.5;
/** How wide the rim's bright line is, px. */
const LINE = 1.6;
/** How bright the soft glow inside the line is, against the line. */
const GLOW = 0.22;

/**
 * Scales a vector to length 1.
 *
 * @param {number} x Across.
 * @param {number} y Down.
 * @returns {[number, number]} The unit vector; [0, 0] for a zero one.
 */
function normalise(x, y) {
	const length = Math.hypot(x, y);
	return length ? [x / length, y / length] : [0, 0];
}

/**
 * The signed distance from a point to a rounded rectangle's edge, and the
 * edge's outward normal there.
 *
 * @param {number} x The point across, px from the rectangle's left.
 * @param {number} y The point down, px from its top.
 * @param {number} width The rectangle's width, px.
 * @param {number} height Its height, px.
 * @param {number} radius Its corner radius, px (clamped to half the shorter side).
 * @returns {{ distance: number, nx: number, ny: number }} The distance, px
 *   (negative inside), and the unit normal pointing out of the nearest edge.
 */
export function roundedRect(x, y, width, height, radius) {
	const r = Math.max(0, Math.min(radius, width / 2, height / 2));
	const px = x - width / 2;
	const py = y - height / 2;
	const qx = Math.abs(px) - (width / 2 - r);
	const qy = Math.abs(py) - (height / 2 - r);
	const sx = px < 0 ? -1 : 1;
	const sy = py < 0 ? -1 : 1;
	if (qx > 0 && qy > 0) {
		const [nx, ny] = normalise(qx, qy);
		return { distance: Math.hypot(qx, qy) - r, nx: nx * sx, ny: ny * sy };
	}
	return qx > qy ? { distance: qx - r, nx: sx, ny: 0 } : { distance: qy - r, nx: 0, ny: sy };
}

/**
 * How hard the glass bends at a depth in from its edge: 1 at the rim,
 * easing to 0 where the bezel meets the flat middle, with no crease there.
 *
 * @param {number} depth Px in from the edge (0 at the rim).
 * @param {number} bezel The rim's width, px.
 * @returns {number} The bend, 0–1; 0 outside the bezel and outside the panel.
 */
export function bend(depth, bezel) {
	if (depth < 0 || bezel <= 0 || depth >= bezel) return 0;
	const u = 1 - depth / bezel;
	return u * u;
}

/**
 * How brightly the rim catches the light at a point: a thin bright line
 * along the edge with a soft glow inside it, brightest where the edge faces
 * the light (top left) and fainter on the far side.
 *
 * @param {number} depth Px in from the edge.
 * @param {number} nx The edge's outward normal, across.
 * @param {number} ny The edge's outward normal, down.
 * @param {number} bezel The rim's width, px.
 * @returns {number} The highlight, 0–1.
 */
export function shine(depth, nx, ny, bezel) {
	if (depth < 0 || bezel <= 0 || depth >= bezel) return 0;
	const facing = nx * LIGHT[0] + ny * LIGHT[1];
	const lit = facing > 0 ? 0.35 + 0.65 * facing : BACKLIGHT * (0.35 - 0.65 * facing);
	const line = Math.exp(-((depth / LINE) ** 2));
	const glow = (1 - depth / bezel) ** 3 * GLOW;
	return Math.min(1, lit * (line + glow));
}

/**
 * Rasterises a rounded panel's lens map: RGBA, one pixel per CSS pixel,
 * row by row. Red and green are where each point looks, across and down,
 * as 0.5 + half the bend (towards the middle, as through the curved edge
 * of a thick lens); blue is the rim's highlight; alpha is opaque. Only the
 * bands within the bezel of an edge are worked out; the middle is filled flat.
 *
 * @param {number} width The panel's width, px (rounded to whole pixels, at least 1).
 * @param {number} height Its height, px.
 * @param {number} radius Its corner radius, px.
 * @param {number} bezel The rim's width, px.
 * @returns {Uint8ClampedArray<ArrayBuffer>} The map, `width * height * 4` bytes.
 */
export function lensMap(width, height, radius, bezel) {
	const w = Math.max(1, Math.round(width));
	const h = Math.max(1, Math.round(height));
	const data = new Uint8ClampedArray(w * h * 4);
	new Uint32Array(data.buffer).fill(new Uint32Array(new Uint8Array([128, 128, 0, 255]).buffer)[0]);
	const r = Math.max(0, Math.min(radius, w / 2, h / 2));
	const band = Math.ceil(bezel + r);

	/**
	 * Works out one pixel of the map.
	 *
	 * @param {number} x Its column.
	 * @param {number} y Its row.
	 */
	const pixel = (x, y) => {
		const { distance, nx, ny } = roundedRect(x + 0.5, y + 0.5, w, h, r);
		const depth = -distance;
		const amount = bend(depth, bezel);
		const i = (y * w + x) * 4;
		data[i] = 128 - nx * amount * 127;
		data[i + 1] = 128 - ny * amount * 127;
		data[i + 2] = shine(depth, nx, ny, bezel) * 255;
	};

	for (let y = 0; y < h; y++) {
		if (y < band || y >= h - band) {
			for (let x = 0; x < w; x++) pixel(x, y);
			continue;
		}
		for (let x = 0; x < Math.min(band, w); x++) pixel(x, y);
		for (let x = Math.max(band, w - band); x < w; x++) pixel(x, y);
	}
	return data;
}
