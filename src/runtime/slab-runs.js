/**
 * @module @arraypress/effects-astro/slab-runs
 *
 * GlassStack's slicing: a logo cut into horizontal slices, each slice's
 * stretches of logo (its runs) becoming the glass discs of the stack. Pure,
 * so it runs (and is tested) without a browser: it reads a mask's coverage
 * and writes a small texture the shader reads, a row per slice.
 *
 * A slice samples a band of the logo, not one line, so a small part (a dot,
 * a thin bar) is never lost between slices: `phase` says where in its
 * slice the band sits (0 top, 1 bottom) and `band` how much of the slice it
 * covers (0 a line, 1 all of it).
 */

/**
 * @typedef {object} Run
 * @property {number} from Its first column.
 * @property {number} to Its last column.
 */

/**
 * The runs of each slice: where the logo crosses it, as column spans.
 *
 * @param {{ alpha: Uint8ClampedArray | Uint8Array, width: number, height: number }} mask The logo's coverage, rows from the top.
 * @param {number} slices How many slices, top to bottom.
 * @param {{ phase?: number, band?: number, threshold?: number, min?: number }} [options] Where each slice samples
 *   (`phase`, 0–1, default 0.5), how much of it (`band`, 0–1, default 0.35), the coverage that counts (`threshold`,
 *   0–255, default 110) and the narrowest run kept, in columns (`min`, default 2).
 * @returns {Run[][]} A list of runs per slice, top first, each left to right.
 */
export function sliceRuns(mask, slices, options = {}) {
	const { alpha, width, height } = mask;
	const phase = options.phase ?? 0.5;
	const band = options.band ?? 0.35;
	const threshold = options.threshold ?? 110;
	const min = options.min ?? 2;
	const pitch = height / slices;
	/** @type {Run[][]} */
	const out = [];
	for (let i = 0; i < slices; i++) {
		const centre = (i + phase) * pitch;
		const reach = Math.max(0.5, (band * pitch) / 2);
		const top = Math.max(0, Math.floor(centre - reach));
		const bottom = Math.min(height - 1, Math.ceil(centre + reach));
		/** @type {Run[]} */
		const runs = [];
		let from = -1;
		for (let x = 0; x <= width; x++) {
			let on = false;
			if (x < width) for (let y = top; y <= bottom && !on; y++) on = alpha[y * width + x] > threshold;
			if (on && from < 0) from = x;
			if (!on && from >= 0) {
				if (x - from >= min) runs.push({ from, to: x - 1 });
				from = -1;
			}
		}
		out.push(runs);
	}
	return out;
}

/**
 * The runs as the shader's texture: a row per slice (top first), a texel
 * per column. Inside a run, red and green hold where the column is along
 * it (0 its left edge, 1 its right) in sixteen bits, blue is 255, and alpha
 * the run's width as a share of the row; outside, all four are 0.
 *
 * @param {Run[][]} runs The runs per slice.
 * @param {number} width The row's width in columns.
 * @returns {Uint8Array} RGBA bytes, `width × runs.length` texels.
 */
export function runsTexture(runs, width) {
	const out = new Uint8Array(width * runs.length * 4);
	runs.forEach((row, i) => {
		for (const { from, to } of row) {
			const span = to - from + 1;
			const share = Math.min(255, Math.round((span / width) * 255));
			for (let x = from; x <= to; x++) {
				const along = Math.round(((x - from + 0.5) / span) * 65535);
				const o = (i * width + x) * 4;
				out[o] = along >> 8;
				out[o + 1] = along & 255;
				out[o + 2] = 255;
				out[o + 3] = share;
			}
		}
	});
	return out;
}

/**
 * When each slice's disc has grown, in the intro: the bottom first, the
 * top last, each over a share of the whole, eased out with a slight
 * overshoot so the glass settles.
 *
 * @param {number} slice Which slice, 0 the top.
 * @param {number} slices How many.
 * @param {number} t Seconds since the intro began.
 * @param {number} [duration=1.6] Seconds until the top disc has grown.
 * @returns {number} Its size, 0 none to 1 whole (a little over while settling).
 */
export function slabGrowth(slice, slices, t, duration = 1.6) {
	if (duration <= 0) return 1;
	const grow = duration * 0.38;
	const from = slices > 1 ? ((slices - 1 - slice) / (slices - 1)) * (duration - grow) : 0;
	const x = (t - from) / grow;
	if (x <= 0) return 0;
	if (x >= 1) return 1;
	// easeOutBack: past 1 a little, back to exactly 1
	const c = 1.4;
	return 1 + (c + 1) * (x - 1) ** 3 + c * (x - 1) ** 2;
}
