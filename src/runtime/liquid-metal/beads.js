/**
 * @module @arraypress/effects-astro/liquid-metal/beads
 *
 * The droplets a splash throws: beads of metal that fly out of the crater,
 * fall, and find their way back. One landing on the metal sinks into it
 * with a small ripple; one landing off it crawls back across the floor,
 * drawn to the nearest edge (down the distance field's slope), and melts
 * into it where it touches. Worked out on the CPU: a splash is a couple of
 * dozen beads at most.
 *
 * Positions are in box heights (x 0 to the box's aspect, y 0–1 up).
 */

/** Pulls a flying bead down, box heights a second squared. */
const GRAVITY = 4;
/** Draws a bead on the floor back to the metal, box heights a second squared. */
const PULL = 0.9;
/** How fast a crawling bead's speed dies away, per second. */
const FRICTION = 2;
/** How long a bead takes to sink in, seconds. */
const SINK = 0.24;
/** The longest a bead crawls before it is taken back anyway, seconds. */
const CRAWL = 6;
/** The slope below which the field is flat (a bead beyond its reach): there, a bead heads back to where it was thrown from. */
const FLAT = 0.2;

/**
 * @typedef {object} Bead
 * @property {number} x Across, box heights.
 * @property {number} y Up, box heights.
 * @property {number} vx Speed across, box heights a second.
 * @property {number} vy Speed up.
 * @property {number} z Height off the ground, box heights.
 * @property {number} vz Speed off the ground.
 * @property {number} r Its radius now.
 * @property {number} size Its radius when thrown.
 * @property {'fly' | 'crawl' | 'sink'} mode In the air, crawling back, or sinking in.
 * @property {boolean} joined Sinking into the edge (drawn melted into it), not into the top.
 * @property {number} age Seconds since it landed.
 * @property {number} ox Where it was thrown from, across.
 * @property {number} oy Where it was thrown from, up.
 */

/**
 * The distance field at a point, and its slope.
 *
 * @typedef {(x: number, y: number) => { d: number, gx: number, gy: number }} FieldSampler
 */

/**
 * Reads a packed distance field (src/runtime/shape.js's `distanceField`)
 * at points in box heights.
 *
 * @param {Uint8Array} field One byte a pixel, rows from the top, 0.5 (128) at the edge.
 * @param {number} width Its width.
 * @param {number} height Its height.
 * @param {number} spread Its reach either side of the edge, box heights.
 * @param {number} aspect The box's width over its height.
 * @returns {FieldSampler} The distance (positive inside, box heights) and
 *   its slope, which points inwards.
 */
export function fieldSampler(field, width, height, spread, aspect) {
	/**
	 * The field at a pixel position, bilinearly, edges clamped.
	 *
	 * @param {number} px Across, pixels.
	 * @param {number} py Down, pixels.
	 * @returns {number} The distance, box heights.
	 */
	const at = (px, py) => {
		const x = Math.min(width - 1, Math.max(0, px));
		const y = Math.min(height - 1, Math.max(0, py));
		const x0 = Math.floor(x);
		const y0 = Math.floor(y);
		const x1 = Math.min(width - 1, x0 + 1);
		const y1 = Math.min(height - 1, y0 + 1);
		const fx = x - x0;
		const fy = y - y0;
		const top = field[y0 * width + x0] * (1 - fx) + field[y0 * width + x1] * fx;
		const bottom = field[y1 * width + x0] * (1 - fx) + field[y1 * width + x1] * fx;
		return ((top * (1 - fy) + bottom * fy) / 255 - 0.5) * 2 * spread;
	};
	const sx = (width - 1) / aspect;
	const sy = height - 1;
	return (x, y) => {
		const px = x * sx;
		const py = (1 - y) * sy;
		const e = 1.5;
		return {
			d: at(px, py),
			gx: (at(px + e, py) - at(px - e, py)) / ((2 * e) / sx),
			gy: (at(px, py - e) - at(px, py + e)) / ((2 * e) / sy),
		};
	};
}

/**
 * The beads a splash throws: a ring of them, flung out and up at
 * different speeds and sizes.
 *
 * @param {number} x Where it landed, across (box heights).
 * @param {number} y Where it landed, up.
 * @param {number} count How many beads.
 * @param {number} [scale=1] Their size and reach, 1 for a full splash.
 * @param {() => number} [random=Math.random] The random source.
 * @returns {Bead[]} The beads, in the air.
 */
export function splash(x, y, count, scale = 1, random = Math.random) {
	/** @type {Bead[]} */
	const beads = [];
	for (let k = 0; k < count; k++) {
		const angle = ((k + random() * 0.7) / count) * Math.PI * 2;
		const speed = (0.14 + random() * 0.36) * scale;
		const size = (0.007 + random() * random() * 0.014) * scale;
		beads.push({
			x: x + Math.cos(angle) * 0.02 * scale,
			y: y + Math.sin(angle) * 0.02 * scale,
			vx: Math.cos(angle) * speed,
			vy: Math.sin(angle) * speed,
			z: 0.004,
			vz: (0.8 + random() * 0.7) * Math.sqrt(scale),
			r: size,
			size,
			mode: 'fly',
			joined: false,
			age: 0,
			ox: x,
			oy: y,
		});
	}
	return beads;
}

/**
 * Moves the beads on, and returns those still out.
 *
 * @param {Bead[]} beads The beads; each is updated in place.
 * @param {number} dt Seconds.
 * @param {FieldSampler} sample The shape's distance field.
 * @param {number} aspect The box's width over its height: beads stay inside it.
 * @param {(x: number, y: number, size: number) => void} land Called where a
 *   bead lands on the metal or melts into it, with its size: the surface ripples there.
 * @returns {Bead[]} The beads not yet taken back.
 */
export function stepBeads(beads, dt, sample, aspect, land) {
	/** @type {Bead[]} */
	const out = [];
	for (const b of beads) {
		if (b.mode === 'sink') {
			b.r -= (b.size * dt) / SINK;
			if (b.r > 0) out.push(b);
			continue;
		}
		if (b.mode === 'fly') {
			b.vz -= GRAVITY * dt;
			b.z += b.vz * dt;
			b.x += b.vx * dt;
			b.y += b.vy * dt;
			if (b.z <= 0) {
				b.z = 0;
				const { d } = sample(b.x, b.y);
				if (d > -b.r) {
					// On the metal, or close enough to touch it: it goes back in.
					b.mode = 'sink';
					b.joined = d < b.r;
					land(b.x, b.y, b.size);
				} else {
					// On the floor: it skids, then crawls back.
					b.mode = 'crawl';
					b.vx *= 0.3;
					b.vy *= 0.3;
				}
			}
		} else {
			b.age += dt;
			const { d, gx, gy } = sample(b.x, b.y);
			// Down the field's slope to the nearest edge; beyond its reach, home.
			const flat = Math.hypot(gx, gy) < FLAT;
			const tx = flat ? b.ox - b.x : gx;
			const ty = flat ? b.oy - b.y : gy;
			const g = Math.hypot(tx, ty) || 1;
			const drag = Math.exp(-FRICTION * dt);
			b.vx = (b.vx + (tx / g) * PULL * dt) * drag;
			b.vy = (b.vy + (ty / g) * PULL * dt) * drag;
			b.x += b.vx * dt;
			b.y += b.vy * dt;
			if (d > -b.r * 0.4 || b.age > CRAWL) {
				b.mode = 'sink';
				b.joined = true;
				land(b.x, b.y, b.size * 0.6);
			}
		}
		b.x = Math.min(aspect - b.r, Math.max(b.r, b.x));
		b.y = Math.min(1 - b.r, Math.max(b.r, b.y));
		out.push(b);
	}
	return out;
}

/**
 * Packs beads for the render: x, y, radius, and the height off the ground
 * for one drawn on top (in the air, or sinking into the top), or -1 for
 * one drawn melted into the edge (crawling, or sinking into the edge).
 *
 * @param {Bead[]} beads The beads.
 * @param {Float32Array} out Room for four floats a bead.
 * @returns {number} How many were packed (no more than fit).
 */
export function packBeads(beads, out) {
	const n = Math.min(beads.length, Math.floor(out.length / 4));
	for (let i = 0; i < n; i++) {
		const b = beads[i];
		const melted = b.mode === 'crawl' || (b.mode === 'sink' && b.joined);
		out.set([b.x, b.y, Math.max(b.r, 0), melted ? -1 : b.z], i * 4);
	}
	return n;
}
