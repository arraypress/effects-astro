/**
 * @module @arraypress/effects-astro/rain-on-glass/wipe
 *
 * Where the pointer has wiped the fog off the glass: a coarse grid that a
 * soft brush clears along each stroke and that fogs back over, from the
 * edges of each patch inwards, a few seconds later.
 */

/** How clear a fresh wipe is: over 1, so its middle holds clear a moment before fading. */
const FRESH = 1.6;
/** How fast the fog returns, in clearness a second. */
const RETURN = 0.36;

/**
 * @typedef {object} Wipe
 * @property {number} width Cells across.
 * @property {number} height Cells up.
 * @property {(x: number, y: number, radius: number) => void} stamp Wipes a soft spot at x, y (0–1, y up), `radius` a share of the height.
 * @property {(dt: number) => boolean} settle Lets the fog return for `dt` seconds; true when `bytes` changed (upload them), false while the glass stays all fogged.
 * @property {Uint8Array} bytes Clearness per cell, 0–255, bottom row first: for a LUMINANCE texture.
 */

/**
 * Makes a wipe grid.
 *
 * @param {number} width Cells across.
 * @param {number} height Cells up.
 * @returns {Wipe} The grid, all fogged.
 */
export function createWipe(width, height) {
	const clear = new Float32Array(width * height);
	const bytes = new Uint8Array(width * height);
	let active = false;
	return {
		width,
		height,
		bytes,
		stamp(x, y, radius) {
			const r = Math.max(1, radius * height);
			const cx = x * width;
			const cy = y * height;
			for (let j = Math.max(0, Math.floor(cy - r)); j <= Math.min(height - 1, Math.ceil(cy + r)); j++) {
				for (let i = Math.max(0, Math.floor(cx - r)); i <= Math.min(width - 1, Math.ceil(cx + r)); i++) {
					const d = Math.hypot(i + 0.5 - cx, j + 0.5 - cy) / r;
					if (d >= 1) continue;
					const k = 1 - d * d;
					clear[j * width + i] = Math.max(clear[j * width + i], FRESH * k * k * (3 - 2 * k));
				}
			}
			active = true;
		},
		settle(dt) {
			if (!active) return false;
			active = false;
			const step = RETURN * dt;
			for (let i = 0; i < clear.length; i++) {
				const v = Math.max(0, clear[i] - step);
				clear[i] = v;
				bytes[i] = Math.min(255, Math.round(v * 255));
				if (v > 0) active = true;
			}
			return true;
		},
	};
}
