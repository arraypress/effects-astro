/**
 * @module @arraypress/effects-astro/iso-camera
 *
 * An orthographic camera for isometric scenes: it looks down on a target
 * from a compass heading (`yaw`) and an elevation (`pitch`), with no
 * perspective, so parallel edges stay parallel and a grid reads as the
 * familiar diamond. Gives the matrix a vertex shader multiplies by,
 * where a point lands on screen, and which point of the ground lies under
 * a screen position (for picking).
 *
 * The world is y-up. Clip space is WebGL's: x and y −1 to 1, z −1 nearest.
 */

/** True isometric elevation, about 35.26°: the three axes foreshorten equally. */
export const ISO_PITCH = Math.atan(1 / Math.SQRT2);

/**
 * @typedef {[number, number, number]} Vec3
 */

/**
 * @typedef {object} IsoCameraOptions
 * @property {Vec3} [target=[0, 0, 0]] The point at the middle of the view.
 * @property {number} [yaw=π/4] Heading the camera looks from, radians: 0 from +z, π/2 from +x.
 * @property {number} [pitch=ISO_PITCH] Elevation, radians: 0 level, π/2 straight down.
 * @property {number} [height=10] The world height the view spans, top to bottom.
 * @property {number} [aspect=1] The view's width over its height.
 * @property {number} [depth=100] How far either side of the target, along the view, is kept.
 * @property {[number, number]} [shift=[0, 0]] Moves the picture across the screen, in clip units.
 */

/**
 * @typedef {object} IsoCamera
 * @property {Float32Array} matrix World to clip space, column-major (for `uniformMatrix4fv`).
 * @property {Vec3} eye The unit direction from the target towards the camera.
 * @property {(p: Vec3) => [number, number, number]} project Where a world point lands, in clip space.
 * @property {(x: number, y: number, h?: number) => Vec3} ground The world point at height `h` (default 0) under clip position x, y.
 */

/**
 * Makes an isometric camera.
 *
 * @param {IsoCameraOptions} [options] Where it looks from and what it frames.
 * @returns {IsoCamera} The camera.
 */
export function isoCamera({ target = [0, 0, 0], yaw = Math.PI / 4, pitch = ISO_PITCH, height = 10, aspect = 1, depth = 100, shift = [0, 0] } = {}) {
	const cp = Math.cos(pitch);
	/** @type {Vec3} */
	const d = [Math.sin(yaw) * cp, Math.sin(pitch), Math.cos(yaw) * cp];
	// Right is the view direction crossed with up; up on screen completes the frame.
	const rl = Math.hypot(d[2], d[0]) || 1;
	/** @type {Vec3} */
	const r = [d[2] / rl, 0, -d[0] / rl];
	/** @type {Vec3} */
	const u = [r[1] * -d[2] - r[2] * -d[1], r[2] * -d[0] - r[0] * -d[2], r[0] * -d[1] - r[1] * -d[0]];
	const hh = height / 2;
	const hw = hh * aspect;
	/**
	 * The dot product.
	 *
	 * @param {Vec3} a The first.
	 * @param {Vec3} b The second.
	 * @returns {number} a · b.
	 */
	const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
	const rows = [
		[r[0] / hw, r[1] / hw, r[2] / hw, -dot(r, target) / hw + shift[0]],
		[u[0] / hh, u[1] / hh, u[2] / hh, -dot(u, target) / hh + shift[1]],
		[-d[0] / depth, -d[1] / depth, -d[2] / depth, dot(d, target) / depth],
		[0, 0, 0, 1],
	];
	const matrix = new Float32Array(16);
	for (let c = 0; c < 4; c++) for (let row = 0; row < 4; row++) matrix[c * 4 + row] = rows[row][c];
	return {
		matrix,
		eye: d,
		project: (p) => /** @type {Vec3} */ ([0, 1, 2].map((i) => rows[i][0] * p[0] + rows[i][1] * p[1] + rows[i][2] * p[2] + rows[i][3])),
		ground(x, y, h = 0) {
			const a = (x - shift[0]) * hw;
			const b = (y - shift[1]) * hh;
			const k = (h - target[1] - u[1] * b) / (d[1] || 1e-6);
			return /** @type {Vec3} */ ([0, 1, 2].map((i) => target[i] + r[i] * a + u[i] * b + d[i] * k));
		},
	};
}
