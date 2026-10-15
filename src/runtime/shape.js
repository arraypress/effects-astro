/**
 * @module @arraypress/effects-astro/shape
 *
 * A shape for an effect to be made of: a word in a font, or an image (an
 * SVG logo, a PNG), drawn white into a canvas as a mask. From the mask,
 * effects take points (particles that form the shape), a distance field
 * (glass that bevels from its edges), or the mask itself (voxels).
 *
 * Shapes are drawn once the page's fonts have loaded, so a word is in the
 * font the page uses, not a fallback.
 */

/**
 * @typedef {object} ShapeSource
 * @property {string} [text] A word or short line to draw.
 * @property {string} [font] The CSS font for `text`, without the size
 *   (default: the page's body font, bold).
 * @property {string} [src] An image URL (an SVG logo, a PNG) to draw instead of text.
 * @property {number} [padding=0.08] Space around the shape, a share of its area.
 * @property {{ x: number, y: number, width: number, height: number }} [area]
 *   Where in the canvas the shape goes, each 0–1 from the top left (default: all of it).
 */

/**
 * @typedef {object} Mask
 * @property {HTMLCanvasElement} canvas The shape, white on transparent.
 * @property {Uint8ClampedArray} alpha One byte a pixel: the shape's coverage, 0–255.
 * @property {number} width The canvas width.
 * @property {number} height The canvas height.
 */

/**
 * Loads an image.
 *
 * @param {string} src Its URL.
 * @returns {Promise<HTMLImageElement>} The image, decoded.
 * @throws {Error} When it cannot be loaded.
 */
function loadImage(src) {
	return new Promise((resolve, reject) => {
		const img = new Image();
		img.crossOrigin = 'anonymous';
		img.onload = () => resolve(img);
		img.onerror = () => reject(new Error(`Could not load ${src}`));
		img.src = src;
	});
}

/**
 * A CSS font at a size: the style and weight words of `font` go before the
 * size, as the canvas needs them, and the family after.
 *
 * @param {string} font A CSS font without a size, e.g. `900 Anton, sans-serif`.
 * @param {number} size The size in pixels.
 * @returns {string} e.g. `900 120px Anton, sans-serif`.
 */
export function fontAt(font, size) {
	const lead = font.match(/^((?:normal|italic|oblique|small-caps|bold|bolder|lighter|\d{3})\s+)*/)?.[0] ?? '';
	return `${lead}${size}px ${font.slice(lead.length)}`;
}

/**
 * Draws a shape into a mask, fitted inside the canvas with its aspect kept.
 *
 * @param {ShapeSource} source What to draw.
 * @param {number} width The mask's width in pixels.
 * @param {number} height The mask's height in pixels.
 * @returns {Promise<Mask>} The mask.
 * @throws {Error} When an image source cannot be loaded.
 */
export async function drawShape(source, width, height) {
	const canvas = document.createElement('canvas');
	canvas.width = width;
	canvas.height = height;
	const ctx = /** @type {CanvasRenderingContext2D} */ (canvas.getContext('2d', { willReadFrequently: true }));
	const pad = source.padding ?? 0.08;
	const area = source.area ?? { x: 0, y: 0, width: 1, height: 1 };
	const room = { w: width * area.width * (1 - pad * 2), h: height * area.height * (1 - pad * 2) };
	// The middle of the area: shapes are centred on it.
	const cx = width * (area.x + area.width / 2);
	const cy = height * (area.y + area.height / 2);
	ctx.fillStyle = '#fff';

	if (source.src) {
		const img = await loadImage(source.src);
		const scale = Math.min(room.w / (img.naturalWidth || room.w), room.h / (img.naturalHeight || room.h));
		const w = (img.naturalWidth || room.w) * scale;
		const h = (img.naturalHeight || room.h) * scale;
		ctx.drawImage(img, cx - w / 2, cy - h / 2, w, h);
		// Whatever its colours, the shape is where it is opaque.
		ctx.globalCompositeOperation = 'source-in';
		ctx.fillRect(0, 0, width, height);
		ctx.globalCompositeOperation = 'source-over';
	} else {
		await document.fonts?.ready;
		const family = source.font ?? `700 ${getComputedStyle(document.body).fontFamily}`;
		const text = source.text ?? '';
		ctx.font = fontAt(family, 100);
		const m = ctx.measureText(text);
		const textHeight = (m.actualBoundingBoxAscent + m.actualBoundingBoxDescent) || 100;
		const size = 100 * Math.min(room.w / (m.width || 1), room.h / textHeight);
		ctx.font = fontAt(family, size);
		const fitted = ctx.measureText(text);
		ctx.textBaseline = 'alphabetic';
		const top = cy - (fitted.actualBoundingBoxAscent + fitted.actualBoundingBoxDescent) / 2;
		ctx.fillText(text, cx - fitted.width / 2, top + fitted.actualBoundingBoxAscent);
	}

	const data = ctx.getImageData(0, 0, width, height).data;
	const alpha = new Uint8ClampedArray(width * height);
	for (let i = 0; i < alpha.length; i++) alpha[i] = data[i * 4 + 3];
	return { canvas, alpha, width, height };
}

/**
 * Scatters points over a shape, evenly: each lands on a pixel the shape
 * covers, with a little jitter so they do not sit on a grid.
 *
 * @param {Mask} mask The shape.
 * @param {number} count How many points.
 * @param {() => number} [random=Math.random] The random source (seed it for repeatable layouts).
 * @returns {Float32Array} x, y pairs, each 0–1 (y up).
 */
export function samplePoints(mask, count, random = Math.random) {
	const inside = [];
	for (let i = 0; i < mask.alpha.length; i++) if (mask.alpha[i] > 127) inside.push(i);
	const points = new Float32Array(count * 2);
	if (!inside.length) return points;
	for (let k = 0; k < count; k++) {
		const i = inside[Math.floor(random() * inside.length)];
		const x = (i % mask.width) + random();
		const y = Math.floor(i / mask.width) + random();
		points[k * 2] = x / mask.width;
		points[k * 2 + 1] = 1 - y / mask.height;
	}
	return points;
}

/**
 * Scatters points along a shape's edge: each lands on a covered pixel with
 * an uncovered one beside it, with a little jitter, for effects that trace
 * the outline more brightly than the fill.
 *
 * @param {Mask} mask The shape.
 * @param {number} count How many points.
 * @param {() => number} [random=Math.random] The random source.
 * @returns {Float32Array} x, y pairs, each 0–1 (y up); zeros when the shape has no edge.
 */
export function edgePoints(mask, count, random = Math.random) {
	const { width, height, alpha } = mask;
	/**
	 * Is the pixel at (x, y) covered? Outside the mask counts as not.
	 *
	 * @param {number} x Across.
	 * @param {number} y Down.
	 * @returns {boolean} Whether the shape covers it.
	 */
	const covered = (x, y) => x >= 0 && y >= 0 && x < width && y < height && alpha[y * width + x] > 127;
	const edge = [];
	for (let y = 0; y < height; y++) {
		for (let x = 0; x < width; x++) {
			if (covered(x, y) && !(covered(x - 1, y) && covered(x + 1, y) && covered(x, y - 1) && covered(x, y + 1))) edge.push(y * width + x);
		}
	}
	const points = new Float32Array(count * 2);
	if (!edge.length) return points;
	for (let k = 0; k < count; k++) {
		const i = edge[Math.floor(random() * edge.length)];
		points[k * 2] = ((i % width) + random()) / width;
		points[k * 2 + 1] = 1 - (Math.floor(i / width) + random()) / height;
	}
	return points;
}

/**
 * Points on a grid over a shape: one wherever a grid cell's centre is
 * inside, for shapes drawn as a dot matrix.
 *
 * @param {Mask} mask The shape.
 * @param {number} columns Grid cells across; rows follow from the aspect.
 * @returns {Float32Array} x, y pairs, each 0–1 (y up).
 */
export function gridPoints(mask, columns) {
	const step = mask.width / columns;
	const rows = Math.floor(mask.height / step);
	const out = [];
	for (let r = 0; r < rows; r++) {
		for (let c = 0; c < columns; c++) {
			const x = Math.floor((c + 0.5) * step);
			const y = Math.floor((r + 0.5) * step);
			if (mask.alpha[y * mask.width + x] > 127) out.push(x / mask.width, 1 - y / mask.height);
		}
	}
	return new Float32Array(out);
}

/**
 * One row of a squared Euclidean distance transform (Felzenszwalb and
 * Huttenlocher): for each cell, the squared distance to the nearest cell
 * whose value is 0.
 *
 * @param {Float64Array} f The row, in place: 0 at sources, a large number elsewhere.
 * @param {number} n Its length.
 * @param {Float64Array} d Scratch for the output.
 * @param {Int32Array} v Scratch: parabola positions.
 * @param {Float64Array} z Scratch: parabola boundaries.
 */
function edt1d(f, n, d, v, z) {
	let k = 0;
	v[0] = 0;
	z[0] = -Infinity;
	z[1] = Infinity;
	for (let q = 1; q < n; q++) {
		let s = (f[q] + q * q - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
		while (s <= z[k]) {
			k--;
			s = (f[q] + q * q - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
		}
		k++;
		v[k] = q;
		z[k] = s;
		z[k + 1] = Infinity;
	}
	k = 0;
	for (let q = 0; q < n; q++) {
		while (z[k + 1] < q) k++;
		d[q] = (q - v[k]) * (q - v[k]) + f[v[k]];
	}
	for (let q = 0; q < n; q++) f[q] = d[q];
}

/**
 * The distance from every pixel to the nearest pixel where `set(i)` is true.
 *
 * @param {number} width The grid's width.
 * @param {number} height The grid's height.
 * @param {(i: number) => boolean} set Whether pixel i is a source.
 * @returns {Float64Array} Distances in pixels.
 */
function distanceTo(width, height, set) {
	const grid = new Float64Array(width * height);
	for (let i = 0; i < grid.length; i++) grid[i] = set(i) ? 0 : 1e20;
	const n = Math.max(width, height);
	const f = new Float64Array(n);
	const d = new Float64Array(n);
	const v = new Int32Array(n);
	const z = new Float64Array(n + 1);
	for (let x = 0; x < width; x++) {
		for (let y = 0; y < height; y++) f[y] = grid[y * width + x];
		edt1d(f, height, d, v, z);
		for (let y = 0; y < height; y++) grid[y * width + x] = f[y];
	}
	for (let y = 0; y < height; y++) {
		for (let x = 0; x < width; x++) f[x] = grid[y * width + x];
		edt1d(f, width, d, v, z);
		for (let x = 0; x < width; x++) grid[y * width + x] = Math.sqrt(f[x]);
	}
	return grid;
}

/**
 * A signed distance field of a shape, packed for a texture: 0.5 at the
 * edge, rising inside, falling outside, `spread` pixels from the edge to
 * either end.
 *
 * @param {Mask} mask The shape.
 * @param {number} [spread=24] How far from the edge, in mask pixels, the field reaches 0 or 1.
 * @returns {Uint8Array} One byte a pixel, rows from the top.
 */
export function distanceField(mask, spread = 24) {
	const { width, height, alpha } = mask;
	const outside = distanceTo(width, height, (i) => alpha[i] > 127);
	const inside = distanceTo(width, height, (i) => alpha[i] <= 127);
	const out = new Uint8Array(width * height);
	for (let i = 0; i < out.length; i++) {
		const signed = inside[i] - outside[i];
		out[i] = Math.max(0, Math.min(255, Math.round((0.5 + signed / (2 * spread)) * 255)));
	}
	return out;
}

/**
 * Softens a one-byte field with two passes of a box blur, across then down,
 * twice: near enough a gaussian. Rounds the ridge a distance field has down
 * the middle of every stroke.
 *
 * @param {Uint8Array} field The field, rows from the top; left unchanged.
 * @param {number} width Its width.
 * @param {number} height Its height.
 * @param {number} radius The blur's reach, in pixels.
 * @returns {Uint8Array} The softened field.
 */
export function blurField(field, width, height, radius) {
	const r = Math.max(1, Math.round(radius));
	let src = Float32Array.from(field);
	let dst = new Float32Array(src.length);
	/**
	 * One box pass along rows or columns.
	 *
	 * @param {boolean} across Along rows (true) or down columns (false).
	 */
	const pass = (across) => {
		const lines = across ? height : width;
		const length = across ? width : height;
		/**
		 * A pixel's index, by line and position along it.
		 *
		 * @param {number} line The row (across) or column (down).
		 * @param {number} i The position along it.
		 * @returns {number} The index into the field.
		 */
		const at = (line, i) => (across ? line * width + i : i * width + line);
		for (let line = 0; line < lines; line++) {
			let sum = 0;
			for (let i = -r; i <= r; i++) sum += src[at(line, Math.min(length - 1, Math.max(0, i)))];
			for (let i = 0; i < length; i++) {
				dst[at(line, i)] = sum / (2 * r + 1);
				sum += src[at(line, Math.min(length - 1, i + r + 1))] - src[at(line, Math.max(0, i - r))];
			}
		}
		[src, dst] = [dst, src];
	};
	pass(true);
	pass(false);
	pass(true);
	pass(false);
	return Uint8Array.from(src, (v) => Math.round(v));
}
