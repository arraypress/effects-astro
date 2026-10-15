/**
 * @module @arraypress/effects-astro/iso-city/shadows
 *
 * The city's shadows on the ground, baked once into a map seen from above:
 * each building's shadow (the hull of its footprint and that footprint
 * thrown along the sun to its roof's height), each tree's, and a gentle
 * darkening round every building's foot. Drawn on a 2D canvas with a blur
 * (the canvas's own shadow, cast from shapes drawn off its edge, which
 * every browser supports), lightest over darkest so overlaps never double.
 */

/** World units of ground round the street grid the map covers. */
export const MARGIN = 3;

/**
 * @typedef {[number, number]} Point
 */

/**
 * Where the shadow of a point at a height falls: away from the sun.
 *
 * @param {[number, number, number]} sun The direction towards the sun (y up, above the horizon).
 * @param {number} height The height.
 * @returns {Point} The shift on the ground, x and z.
 */
export function shadowShift(sun, height) {
	return [(-sun[0] / sun[1]) * height, (-sun[2] / sun[1]) * height];
}

/**
 * The convex hull of some points (Andrew's monotone chain).
 *
 * @param {Point[]} points The points.
 * @returns {Point[]} The hull, anticlockwise.
 */
export function hull(points) {
	const p = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
	if (p.length < 3) return p;
	/**
	 * Which way three points turn.
	 *
	 * @param {Point} o The first.
	 * @param {Point} a The second.
	 * @param {Point} b The third.
	 * @returns {number} Positive anticlockwise.
	 */
	const turn = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
	/** @type {Point[]} */
	const lower = [];
	for (const q of p) {
		while (lower.length >= 2 && turn(lower[lower.length - 2], lower[lower.length - 1], q) <= 0) lower.pop();
		lower.push(q);
	}
	/** @type {Point[]} */
	const upper = [];
	for (const q of [...p].reverse()) {
		while (upper.length >= 2 && turn(upper[upper.length - 2], upper[upper.length - 1], q) <= 0) upper.pop();
		upper.push(q);
	}
	return [...lower.slice(0, -1), ...upper.slice(0, -1)];
}

/**
 * Bakes the shadow map.
 *
 * @param {import('./plan.js').CityPlan} plan The plan.
 * @param {[number, number, number]} sun The direction towards the sun.
 * @param {number} [resolution=1024] The map's size, pixels a side.
 * @returns {{ canvas: HTMLCanvasElement, rect: [number, number, number] }} The map
 *   (red: 0 lit, 1 in shadow), and where it lies: its least x and z, and 1 / its span.
 */
export function bakeShadows(plan, sun, resolution = 1024) {
	const span = plan.extent + MARGIN * 2;
	const canvas = document.createElement('canvas');
	canvas.width = canvas.height = resolution;
	const ctx = /** @type {CanvasRenderingContext2D} */ (canvas.getContext('2d'));
	ctx.fillStyle = '#000';
	ctx.fillRect(0, 0, resolution, resolution);
	ctx.globalCompositeOperation = 'lighten';
	const k = resolution / span;
	// Shapes are drawn a canvas-width off to the left; only their blurred shadow lands on the map.
	const away = resolution * 2;
	ctx.shadowOffsetX = away;
	/**
	 * Draws a blurred shape.
	 *
	 * @param {(ctx: CanvasRenderingContext2D, at: (x: number, z: number) => Point) => void} shape Traces the path.
	 * @param {number} strength How dark, 0–1.
	 * @param {number} blur How soft, world units.
	 */
	const draw = (shape, strength, blur) => {
		ctx.shadowColor = `rgba(255, 255, 255, ${strength})`;
		ctx.shadowBlur = blur * k;
		ctx.fillStyle = '#fff';
		ctx.beginPath();
		shape(ctx, (x, z) => [(x + MARGIN) * k - away, (z + MARGIN) * k]);
		ctx.fill();
	};
	/**
	 * Traces a polygon.
	 *
	 * @param {Point[]} points The polygon, in world x and z.
	 * @returns {(ctx: CanvasRenderingContext2D, at: (x: number, z: number) => Point) => void} The tracer.
	 */
	const polygon = (points) => (c, at) => {
		points.forEach(([x, z], i) => {
			const [px, pz] = at(x, z);
			if (i) c.lineTo(px, pz);
			else c.moveTo(px, pz);
		});
		c.closePath();
	};

	for (const b of plan.buildings) {
		const base = b.parts[0];
		const grow = 0.05;
		draw(polygon([[base.x0 - grow, base.z0 - grow], [base.x1 + grow, base.z0 - grow], [base.x1 + grow, base.z1 + grow], [base.x0 - grow, base.z1 + grow]]), 0.32, 0.12);
		for (const part of b.parts) {
			/** @type {Point[]} */
			const corners = [[part.x0, part.z0], [part.x1, part.z0], [part.x1, part.z1], [part.x0, part.z1]];
			/** @type {Point[]} */
			const cast = [];
			for (const h of [part.y0, part.y1]) {
				const [dx, dz] = shadowShift(sun, h);
				for (const [x, z] of corners) cast.push([x + dx, z + dz]);
			}
			const shape = polygon(hull(cast));
			draw(shape, 0.78, 0.05);
			draw(shape, 0.4, 0.3);
		}
	}
	for (const t of plan.trees) {
		const [dx, dz] = shadowShift(sun, t.h + t.r * 1.6);
		draw((c, at) => {
			const [px, pz] = at(t.x + dx * 0.8, t.z + dz * 0.8);
			c.arc(px, pz, t.r * 0.95 * k, 0, Math.PI * 2);
		}, 0.5, 0.06);
		draw((c, at) => {
			const [px, pz] = at(t.x, t.z);
			c.arc(px, pz, t.r * 0.6 * k, 0, Math.PI * 2);
		}, 0.25, 0.1);
	}
	for (const l of plan.lamps) {
		const [dx, dz] = shadowShift(sun, 0.36);
		draw(polygon(hull([[l.x - 0.012, l.z - 0.012], [l.x + 0.012, l.z + 0.012], [l.x + dx - 0.012, l.z + dz - 0.012], [l.x + dx + 0.012, l.z + dz + 0.012]])), 0.35, 0.03);
	}
	return { canvas, rect: [-MARGIN, -MARGIN, 1 / span] };
}
