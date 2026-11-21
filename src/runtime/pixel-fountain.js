/**
 * @module @arraypress/effects-astro/pixel-fountain
 *
 * Retro 8-bit sparks: chunky square pixels fire up out of an element's top
 * edge (a footer, a band) or out of the letters of a wordmark, arc under
 * gravity with a little spread and a drifting wind, and break down as they
 * go. Each steps through a short ramp of colours (an acid lime, a darker
 * lime, olive, then gone), shrinks in whole-pixel steps (a double block, a
 * block, half, a quarter) or splits into two to four smaller pixels that
 * scatter, and some flicker on and off like a dying CRT pixel before they
 * vanish. Every pixel is drawn on its size's grid, anchored to the edge,
 * each frame, so motion reads as stepped rather than smooth.
 *
 * A few pixels trickle up on their own along the edge; moving the pointer
 * over the host fires a stream from under it, and a click or tap fires a
 * power-up: a bigger burst whose first frames burn white.
 *
 * With `source: 'pointer'` nothing fires on its own: blocks fire only where
 * the pointer is, as it moves over the host, a few for every stretch it
 * travels (none while it rests or once it leaves). They pop out and up with
 * a little spread and a kick along the pointer's way, arc under gravity and
 * break down within about a second: a block-dust trail off the cursor, in
 * one solid ink (the text's colour unless `color` is set), with a few
 * chunky blocks among the small ones. A tap fires a burst where it lands;
 * a click does too only with `press`.
 *
 * The simulation (`createFountain`) is pure and seeded: it runs in fixed
 * 60 Hz steps, so the same seed and the same emits give the same pixels
 * whatever the frame rate. At most MAX_PIXELS live at once, in a pool that
 * allocates nothing while it runs. Canvas 2D in device pixels, every
 * rectangle on whole pixels, so the blocks stay crisp at any pixel ratio.
 * Drawn only while near the screen and while the tab shows (the shared
 * loop); with prefers-reduced-motion, a still scatter of pixels (nothing
 * at all from the pointer).
 */

import { createCanvas2D } from './canvas2d.js';
import { parseColor, toHex, toOklab, fromOklab, mixOklab } from './color.js';
import { watchColors } from './mount.js';
import { pickColors } from './palettes.js';
import { pressAt } from './pointer.js';
import { seededRandom } from './random.js';
import { textNodesWithin, paintGlyphs } from './text.js';

/**
 * @typedef {object} PixelFountainConfig
 * @property {string} [color='#c8ff00'] The pixels' colour when they fire; the darker steps they fade through are made from it. With `source: 'pointer'`, the one ink every block is drawn in (default the text's colour, `currentColor`).
 * @property {string[]} [colors] The steps a pixel fades through, first to last (overrides `color`; from the pointer, only the first is used).
 * @property {string} [palette] A shared palette by name, its colours as the steps, when there are no `colors`.
 * @property {number} [cell=8] A pixel's size, CSS px (a power-up's biggest blocks are two).
 * @property {number} [rise=240] How far above the edge the pixels can fly, CSS px (160 from the pointer: how far above the host the canvas reaches, and about how high a tap's burst flies).
 * @property {number} [rate=14] Pixels a second trickling up on their own, per 1,000 CSS px of edge; 0 for none (always none from the pointer).
 * @property {number} [burst=40] Pixels a click or tap fires (24 from the pointer).
 * @property {number} [trail=10] From the pointer: blocks fired for every 100 CSS px it moves (at most 12 a move).
 * @property {boolean} [press] Whether a mouse click fires a burst: default true, false from the pointer (where a tap still does).
 * @property {number} [gravity=1] How hard they are pulled back, 0–2.
 * @property {number} [spread=0.5] How widely they fan out, 0–1.
 * @property {number} [drift=0.3] How much a wind pushes them sideways, 0–1.
 * @property {number} [life=1.4] The longest a pixel lives, seconds (0.9 from the pointer).
 * @property {number} [split=0.4] The chance a pixel splits into smaller ones rather than shrinking, 0–1 (0.2 from the pointer).
 * @property {number} [flicker=0.35] The chance a pixel flickers out on and off before it goes, 0–1 (0.5 from the pointer).
 * @property {'edge' | 'text' | 'pointer'} [source='edge'] Fire from the host's top edge, from the filled pixels of its text, or only from the pointer as it moves over the host.
 * @property {string} [host] A selector for the element the pixels fire from and the pointer is followed over: the nearest ancestor that matches, else the first on the page. Default the element's positioned parent.
 * @property {number} [seed=1] Seeds the randomness.
 */

/** The most pixels alive at once. */
export const MAX_PIXELS = 400;

/** The simulation's fixed step, seconds (60 Hz). */
export const STEP = 1 / 60;

/** A pixel's sizes, in cells: a power-up's double block, a block, a half and a quarter. */
const TIER_CELLS = [2, 1, 0.5, 0.25];

/** The smallest tier. */
const LAST_TIER = TIER_CELLS.length - 1;

/** The pull, CSS px/s², at `gravity` 1. */
const GRAVITY = 1000;

/** How hard each kind of emit throws, a share of the throw that reaches 0.62 of `rise`. */
const POWER = { ambient: [0.5, 0.35], move: [0.62, 0.3], burst: [0.7, 0.6], trail: [0.15, 0.7], tap: [0.4, 0.55] };

/** How far into its flight a fired pixel may already be, seconds: a burst comes out as a spurt, not one slab. */
const LEAD = { ambient: 0, move: 0.06, burst: 0.3, trail: 0, tap: 0.05 };

/** The size a pixel fires at, by what fired it: a double block below the first share of a roll, a block below the second, else a half. */
const TIERS = { ambient: [0, 0.7], move: [0.15, 1], burst: [0.4, 1], trail: [0.2, 0.7], tap: [0.35, 0.85] };

/** How far a pointer's block may lean from straight up, radians at `spread` 1 (a tap's twice as far). */
const FAN = 1.1;

/** The share of the pointer's way (CSS px a move) a trail block is kicked along, as CSS px/s. */
const KICK = 7;

/** The most kick a trail block takes along the pointer's way, CSS px/s. */
const MAX_KICK = 260;

/** The most blocks one pointer move fires. */
export const TRAIL_CAP = 12;

/** The settings that change with `source: 'pointer'`: no trickle, a short life, fewer splits, more flicker, a lower canvas, a smaller tap. */
export const POINTER_DEFAULTS = { rate: 0, life: 0.9, split: 0.2, flicker: 0.5, rise: 160, burst: 24, trail: 10 };

/** The wind at `drift` 1, CSS px/s² (a slow swing either way). */
const WIND = 70;

/** Each pixel's own sideways push at `drift` 1, CSS px/s². */
const WOBBLE = 140;

/** How fast pieces of a split scatter, CSS px/s, at `spread` 0.5. */
const SCATTER = 110;

/** A power-up's first share of life, drawn in its hot colour. */
const HOT = 0.1;

/** How light the hot colour is: the first step mixed this far to white. */
const HOT_MIX = 0.6;

/**
 * @typedef {object} Pixel
 * @property {number} x Centre, CSS px from the canvas's left.
 * @property {number} y Centre, CSS px from the canvas's top.
 * @property {number} vx Velocity across, CSS px/s.
 * @property {number} vy Velocity down, CSS px/s (negative rises).
 * @property {number} age Seconds lived.
 * @property {number} life Seconds it lives.
 * @property {number} tier Its size: an index into the tiers (0 a double block, 3 a quarter).
 * @property {number} next The share of its life at which it next breaks down.
 * @property {number} gap The share of life between breaks.
 * @property {boolean} hot A power-up's pixel: its first frames burn white.
 * @property {number} flicker The share of life from which it flickers (over 1 for never).
 * @property {boolean} on Whether it shows this frame (false while flickered off).
 * @property {number} blink Steps until it next flickers.
 * @property {number} wobble Its own sideways push, CSS px/s².
 */

/**
 * @typedef {object} FountainOptions
 * @property {number} width The canvas's width, CSS px.
 * @property {number} height The canvas's height, CSS px.
 * @property {number} [floor] Where the edge is, CSS px down the canvas. Default its bottom.
 * @property {number} [cell=8] A block's size, CSS px.
 * @property {number} [rise=240] How far above the floor a full throw reaches, CSS px.
 * @property {number} [rate=14] Ambient pixels a second per 1,000 CSS px of width.
 * @property {number} [gravity=1] The pull, 0–2.
 * @property {number} [spread=0.5] The fan, 0–1.
 * @property {number} [drift=0.3] The wind, 0–1.
 * @property {number} [life=1.4] The longest life, seconds.
 * @property {number} [split=0.4] The chance of a split at each break, 0–1.
 * @property {number} [flicker=0.35] The chance of flickering out, 0–1.
 * @property {number} [trail=10] Blocks a pointer's move fires for every 100 CSS px it travels.
 * @property {number} [seed=1] The seed.
 */

/**
 * @typedef {'ambient' | 'move' | 'burst' | 'trail' | 'tap'} EmitKind
 * What fired a pixel: the trickle, the pointer moving over the edge or the
 * letters, a press (a power-up); or, from the pointer, its trail and a tap.
 */

/**
 * The steps a pixel fades through, made from one colour in Oklab: darker
 * and less saturated each step, the hue turning a little towards olive.
 *
 * @param {string} color The first step, CSS hex.
 * @param {number} [count=4] How many steps.
 * @returns {string[]} The steps, CSS hex, first to last.
 * @throws {TypeError} When the colour is not hex.
 */
export function fadeSteps(color, count = 4) {
	const [L, a, b] = toOklab(parseColor(color));
	const chroma = Math.hypot(a, b);
	const hue = Math.atan2(b, a);
	return Array.from({ length: Math.max(1, count) }, (_, k) => {
		const t = count > 1 ? k / (count - 1) : 0;
		const l = L * (1 - 0.55 * t);
		const c = chroma * (1 - 0.5 * t);
		const h = hue - ((16 * Math.PI) / 180) * t;
		return toHex(fromOklab([l, c * Math.cos(h), c * Math.sin(h)]));
	});
}

/**
 * The colour a pixel is drawn in at a point in its life: one step of the
 * ramp for each equal share of it (the first while new, the last as it
 * goes), or the hot colour (-1) for a power-up's first frames.
 *
 * @param {number} t The share of its life lived, 0–1.
 * @param {number} count How many steps.
 * @param {boolean} [hot=false] A power-up's pixel.
 * @returns {number} The step's index, or -1 for the hot colour.
 */
export function shadeAt(t, count, hot = false) {
	if (hot && t < HOT) return -1;
	return Math.min(count - 1, Math.max(0, Math.floor(t * count)));
}

/**
 * Each tier's size in device pixels: whole pixels, at least one, so every
 * block lands on the device's own grid.
 *
 * @param {number} cell A block's size, CSS px.
 * @param {number} dpr Device pixels a CSS px.
 * @returns {number[]} The double block's, the block's, the half's and the quarter's sizes.
 */
export function tierSizes(cell, dpr) {
	const block = Math.max(1, Math.round(cell * dpr));
	return TIER_CELLS.map((k) => Math.max(1, Math.round(block * k)));
}

/**
 * Where a pixel is drawn: its centre snapped to the grid of its own size,
 * the grid's columns counted from the left and its rows up from the floor,
 * so a block resting on the edge sits flush on it and every move is a
 * whole step of the grid.
 *
 * @param {number} x Centre, across (device px).
 * @param {number} y Centre, down (device px).
 * @param {number} size Its size (device px, whole).
 * @param {number} floor The edge, down (device px, whole).
 * @returns {[number, number]} The block's left and top.
 */
export function pixelRect(x, y, size, floor) {
	const col = Math.round(x / size - 0.5);
	const row = Math.round((floor - y) / size - 0.5);
	// + 0 turns a -0 (a centre just left of the first column) into 0.
	return [col * size + 0, floor - (row + 1) * size + 0];
}

/**
 * The cells of a grid that a picture of text fills, for firing from the
 * letters: each cell whose centre and most of four points round it are
 * inked. The grid's columns run from the left and its rows up from the
 * floor, as the pixels' do. Tops (filled cells with an empty one above)
 * are listed first.
 *
 * @param {Uint8ClampedArray} rgba The picture, RGBA (only alpha is read), one pixel a CSS px.
 * @param {number} width Its width.
 * @param {number} height Its height.
 * @param {number} cell The grid's cell, CSS px.
 * @param {number} [floor=height] The grid's bottom, px down the picture.
 * @returns {{ points: Float32Array, tops: number }} Cell centres as x, y pairs (tops first), and how many are tops.
 */
export function inkedCells(rgba, width, height, cell, floor = height) {
	const cols = Math.floor(width / cell);
	const rows = Math.floor(floor / cell);
	/**
	 * Is the picture inked at a point?
	 *
	 * @param {number} x Across, px.
	 * @param {number} y Down, px.
	 * @returns {number} 1 if so, else 0.
	 */
	const at = (x, y) => {
		const px = Math.min(width - 1, Math.max(0, Math.floor(x)));
		const py = Math.min(height - 1, Math.max(0, Math.floor(y)));
		return rgba[(py * width + px) * 4 + 3] > 127 ? 1 : 0;
	};
	const q = cell / 4;
	const filled = new Uint8Array(cols * rows);
	for (let row = 0; row < rows; row++) {
		for (let col = 0; col < cols; col++) {
			const cx = col * cell + cell / 2;
			const cy = floor - row * cell - cell / 2;
			const around = at(cx - q, cy - q) + at(cx + q, cy - q) + at(cx - q, cy + q) + at(cx + q, cy + q);
			filled[row * cols + col] = at(cx, cy) && around >= 2 ? 1 : 0;
		}
	}
	/** @type {number[]} */
	const tops = [];
	/** @type {number[]} */
	const rest = [];
	for (let row = 0; row < rows; row++) {
		for (let col = 0; col < cols; col++) {
			if (!filled[row * cols + col]) continue;
			const above = row + 1 < rows && filled[(row + 1) * cols + col];
			(above ? rest : tops).push(col * cell + cell / 2, floor - row * cell - cell / 2);
		}
	}
	return { points: Float32Array.from([...tops, ...rest]), tops: tops.length / 2 };
}

/**
 * Makes a fountain: a seeded pool of pixels, stepped at a fixed rate.
 *
 * @param {FountainOptions} options The settings.
 * @returns {{
 *   pixels: Pixel[],
 *   readonly count: number,
 *   readonly time: number,
 *   resize: (width: number, height: number, floor?: number) => void,
 *   setOrigins: (points: Float32Array | null, tops?: number) => void,
 *   emit: (x: number, y: number, n: number, kind?: EmitKind) => number,
 *   emitNear: (x: number, y: number, n: number, kind?: EmitKind, radius?: number) => number,
 *   emitEdge: (x: number, n: number, kind?: EmitKind) => number,
 *   emitAmbient: (n: number, kind?: EmitKind) => number,
 *   moveTo: (x: number, y: number) => number,
 *   lift: () => void,
 *   step: (dt?: number) => void,
 *   clear: () => void,
 * }} The fountain: `pixels[0…count)` are alive.
 */
export function createFountain(options) {
	const CELL = options.cell ?? 8;
	const RISE = options.rise ?? 240;
	const RATE = options.rate ?? 14;
	const G = GRAVITY * (options.gravity ?? 1);
	const SPREAD = options.spread ?? 0.5;
	const DRIFT = options.drift ?? 0.3;
	const LIFE = options.life ?? 1.4;
	const SPLIT = options.split ?? 0.4;
	const FLICKER = options.flicker ?? 0.35;
	const TRAIL = options.trail ?? 10;
	const random = seededRandom(options.seed ?? 1);
	// The throw that reaches 0.62 of `rise` at the nominal pull, whatever `gravity` is: gravity changes the arc, not the throw.
	const THROW = Math.sqrt(2 * GRAVITY * RISE * 0.62);
	const sizes = TIER_CELLS.map((k) => CELL * k);

	let width = options.width;
	let height = options.height;
	let floor = options.floor ?? options.height;
	let count = 0;
	let time = 0;
	let owed = 0;
	/** @type {Float32Array | null} */
	let origins = null;
	let topCount = 0;
	// The pointer's last place (NaN while it is away), and the share of a block its moves owe.
	let px = NaN;
	let py = NaN;
	let carry = 0;

	/** @type {Pixel[]} */
	const pixels = Array.from({ length: MAX_PIXELS }, () => ({
		x: 0,
		y: 0,
		vx: 0,
		vy: 0,
		age: 0,
		life: 1,
		tier: 1,
		next: 2,
		gap: 1,
		hot: false,
		flicker: 2,
		on: true,
		blink: 0,
		wobble: 0,
	}));

	/**
	 * Sets a pixel's break-downs from its tier: evenly from about a third
	 * of its life (a fifth for a double block).
	 *
	 * @param {Pixel} p The pixel.
	 */
	const schedule = (p) => {
		const left = LAST_TIER - p.tier;
		if (left <= 0) {
			p.next = 2;
			return;
		}
		const first = (p.tier === 0 ? 0.18 : 0.3) + random() * 0.12;
		p.next = first;
		// The last break late (about four fifths of the way), so the smallest pieces only flash before they go.
		p.gap = (1.2 - first) / left;
	};

	/**
	 * Brings a pixel to life from the pool.
	 *
	 * @param {number} x Centre, across, CSS px.
	 * @param {number} y Centre, down, CSS px.
	 * @param {EmitKind} kind What fired it.
	 * @param {number} [kx=0] A kick across, CSS px/s (the pointer's way, for its trail).
	 * @param {number} [ky=0] A kick down, CSS px/s.
	 * @returns {boolean} False when the pool is full.
	 */
	const spawn = (x, y, kind, kx = 0, ky = 0) => {
		if (count >= MAX_PIXELS) return false;
		const p = pixels[count++];
		const [base, range] = POWER[kind];
		const speed = THROW * (base + random() * range);
		const pointer = kind === 'trail' || kind === 'tap';
		p.x = x;
		p.y = y;
		if (pointer) {
			// Out and up, leaning either way by `spread`, and carried a little along the pointer's way.
			const lean = (random() * 2 - 1) * SPREAD * FAN * (kind === 'tap' ? 2 : 1);
			p.vx = Math.sin(lean) * speed + kx;
			p.vy = -Math.cos(lean) * speed + ky;
		} else {
			const fan = kind === 'burst' ? 2 : 1;
			p.vx = (random() * 2 - 1) * SPREAD * fan * speed * 0.5;
			p.vy = -speed;
		}
		p.age = 0;
		// Gone before it lands: a flight's length at most, so each runs through its colours in the air.
		// The pointer's blocks are thrown from mid-air, so they only live their life (and fall past where they started).
		const flight = G > 0 && !pointer ? (2 * speed) / G : Infinity;
		p.life = Math.min(LIFE * (0.6 + random() * 0.4), flight * (0.85 + random() * 0.2));
		const roll = random();
		const [big, block] = TIERS[kind];
		p.tier = roll < big ? 0 : roll < block ? 1 : 2;
		schedule(p);
		p.hot = kind === 'burst';
		p.flicker = random() < FLICKER ? 0.45 + random() * 0.3 : 2;
		p.on = true;
		p.blink = 0;
		p.wobble = (random() * 2 - 1) * DRIFT * WOBBLE;
		// Some way into its flight already, as if fired a moment ago.
		const lead = random() * LEAD[kind];
		p.x += p.vx * lead;
		p.y += p.vy * lead + 0.5 * G * lead * lead;
		p.vy += G * lead;
		p.age = Math.min(lead, p.life * 0.5);
		return true;
	};

	/**
	 * Breaks a pixel down a tier: it shrinks where it is, or (by `split`'s
	 * chance, room allowing) splits into two to four of the quarters of
	 * itself, each thrown outward from where it sat.
	 *
	 * @param {Pixel} p The pixel.
	 */
	const breakDown = (p) => {
		const was = sizes[p.tier];
		p.tier++;
		p.next += p.gap;
		if (random() >= SPLIT || count >= MAX_PIXELS) return;
		const pieces = Math.min(2 + Math.floor(random() * 3), 1 + MAX_PIXELS - count);
		// The four quarters, in a shuffled order; the pixel keeps the first.
		const quarters = [
			[-1, -1],
			[1, -1],
			[-1, 1],
			[1, 1],
		];
		for (let i = 3; i > 0; i--) {
			const j = Math.floor(random() * (i + 1));
			[quarters[i], quarters[j]] = [quarters[j], quarters[i]];
		}
		const scatter = SCATTER * (0.5 + SPREAD);
		const cx = p.x;
		const cy = p.y;
		for (let k = 0; k < pieces; k++) {
			const q = k === 0 ? p : pixels[count++];
			if (q !== p) {
				Object.assign(q, p);
				q.flicker = random() < FLICKER ? Math.max(p.age / p.life, 0.45 + random() * 0.3) : 2;
				q.wobble = (random() * 2 - 1) * DRIFT * WOBBLE;
			}
			const [qx, qy] = quarters[k];
			q.x = cx + (qx * was) / 4;
			q.y = cy + (qy * was) / 4;
			q.vx = p.vx + qx * scatter * (0.4 + random() * 0.6);
			q.vy = p.vy + qy * scatter * (0.2 + random() * 0.5) - scatter * 0.3;
		}
	};

	/**
	 * Returns a pixel to the pool: the last live one takes its place.
	 *
	 * @param {number} i Its index.
	 */
	const kill = (i) => {
		count--;
		if (i !== count) [pixels[i], pixels[count]] = [pixels[count], pixels[i]];
	};

	/**
	 * A random place for an ambient pixel: on a letter's top (mostly) or
	 * anywhere in it when there are origins, else along the edge.
	 *
	 * @returns {[number, number]} Its centre, CSS px.
	 */
	const ambientAt = () => {
		if (origins && origins.length) {
			const n = origins.length / 2;
			const i = topCount && random() < 0.8 ? Math.floor(random() * topCount) : Math.floor(random() * n);
			return [origins[i * 2], origins[i * 2 + 1]];
		}
		const col = Math.floor((random() * width) / CELL);
		return [col * CELL + CELL / 2, floor - CELL / 2];
	};

	return {
		pixels,
		get count() {
			return count;
		},
		get time() {
			return time;
		},
		resize(w, h, f = h) {
			width = w;
			height = h;
			floor = f;
		},
		setOrigins(points, tops = 0) {
			origins = points;
			topCount = tops;
		},
		emit(x, y, n, kind = 'burst') {
			const jitter = (kind === 'burst' ? 2.5 : kind === 'move' || kind === 'tap' ? 1 : 0) * CELL;
			let made = 0;
			for (let i = 0; i < n; i++) {
				if (!spawn(x + (random() * 2 - 1) * jitter, y, kind)) break;
				made++;
			}
			return made;
		},
		emitNear(x, y, n, kind = 'burst', radius = 80) {
			if (!origins || !origins.length) return this.emit(x, y, n, kind);
			/** @type {number[]} */
			const near = [];
			for (let i = 0; i < origins.length; i += 2) {
				if (Math.hypot(origins[i] - x, origins[i + 1] - y) <= radius) near.push(i);
			}
			// Nothing to fire from near a move; a press fires where it landed.
			if (!near.length) return kind === 'burst' ? this.emit(x, y, n, kind) : 0;
			let made = 0;
			for (let k = 0; k < n; k++) {
				const i = near[Math.floor(random() * near.length)];
				if (!spawn(origins[i], origins[i + 1], kind)) break;
				made++;
			}
			return made;
		},
		emitEdge(x, n, kind = 'burst') {
			return this.emit(Math.floor(x / CELL) * CELL + CELL / 2, floor - CELL / 2, n, kind);
		},
		emitAmbient(n, kind = 'ambient') {
			let made = 0;
			for (let i = 0; i < n; i++) {
				const [x, y] = ambientAt();
				if (!spawn(x, y, kind)) break;
				made++;
			}
			return made;
		},
		moveTo(x, y) {
			const was = [px, py];
			px = x;
			py = y;
			// The first place after a lift only marks where the pointer is.
			if (!Number.isFinite(was[0])) return 0;
			const dx = x - was[0];
			const dy = y - was[1];
			const d = Math.hypot(dx, dy);
			if (!d) return 0;
			carry += (d * TRAIL) / 100;
			// A hair under a whole block counts: ten moves of a tenth must make one.
			const owed = Math.floor(carry + 1e-9);
			const n = Math.min(TRAIL_CAP, owed);
			// What the cap cut off is dropped, not saved up for later moves.
			carry = Math.max(0, carry - owed);
			const kick = Math.min(MAX_KICK, d * KICK) / d;
			const jitter = CELL;
			let made = 0;
			for (let i = 0; i < n; i++) {
				// Spaced along the stretch just travelled, ending at the pointer, so a quick sweep leaves an even trail.
				const t = (i + random()) / n;
				const x0 = was[0] + dx * t + (random() * 2 - 1) * jitter;
				const y0 = was[1] + dy * t + (random() * 2 - 1) * jitter;
				if (!spawn(x0, y0, 'trail', dx * kick, dy * kick * 0.5)) break;
				made++;
			}
			return made;
		},
		lift() {
			px = NaN;
			py = NaN;
			carry = 0;
		},
		step(dt = STEP) {
			time += dt;
			owed += ((RATE * width) / 1000) * dt;
			// A hair under one counts: sixty steps of a sixtieth must make a whole pixel.
			while (owed >= 1 - 1e-9) {
				owed--;
				const [x, y] = ambientAt();
				spawn(x, y, 'ambient');
			}
			const wind = DRIFT * WIND * Math.sin(time * 0.7) * Math.cos(time * 0.23);
			const drag = 1 - 0.6 * dt;
			for (let i = 0; i < count; i++) {
				const p = pixels[i];
				p.age += dt;
				const t = p.age / p.life;
				if (t >= 1) {
					kill(i--);
					continue;
				}
				while (t >= p.next && p.tier < LAST_TIER) breakDown(p);
				p.vy += G * dt;
				p.vx = (p.vx + (wind + p.wobble) * dt) * drag;
				p.x += p.vx * dt;
				p.y += p.vy * dt;
				const half = sizes[p.tier] / 2;
				// Fallen back into the edge, or off the sides.
				if ((p.vy > 0 && p.y - half > floor) || p.x < -half || p.x > width + half) {
					kill(i--);
					continue;
				}
				if (t >= p.flicker && --p.blink <= 0) {
					// A dying pixel: on for a shorter while, off for a longer, the nearer its end.
					p.on = !p.on;
					p.blink = p.on ? 1 + Math.floor(random() * 4 * (1 - t) + 1) : 1 + Math.floor(random() * 3 + t * 4);
				}
			}
		},
		clear() {
			count = 0;
			owed = 0;
		},
	};
}

/**
 * The element the pixels fire from: the nearest ancestor matching
 * `selector`, else the first match on the page, else the element's
 * positioned parent (or its parent).
 *
 * @param {HTMLElement} el The effect's element.
 * @param {string} [selector] The host's selector.
 * @returns {HTMLElement} The host.
 */
function findHost(el, selector) {
	if (selector) {
		const found = el.parentElement?.closest(selector) ?? document.querySelector(selector);
		if (found instanceof HTMLElement) return found;
		console.warn('[effects-astro]', `PixelFountain: no host "${selector}"; using its parent`);
	}
	return /** @type {HTMLElement} */ (el.offsetParent ?? el.parentElement ?? el);
}

/**
 * Whether a colour asks for the text's own (none, or `currentColor`).
 *
 * @param {string | undefined} color The colour given.
 * @returns {boolean} True to read the element's CSS colour.
 */
const isCurrent = (color) => !color || color.toLowerCase() === 'currentcolor';

/**
 * Starts the pixel fountain on an element (its first canvas is drawn
 * into). The element should be positioned over its host's top edge (or,
 * with `source: 'text'` or `'pointer'`, over the host and the space above
 * it), with its bottom on the host's bottom edge: the component does this.
 *
 * @param {HTMLElement} el The element.
 * @param {PixelFountainConfig} config The settings.
 * @returns {() => void} Stops it.
 */
export function pixelFountain(el, config) {
	const POINTER = config.source === 'pointer';
	// From the pointer: its own defaults, and never a trickle.
	const settings = POINTER ? { ...POINTER_DEFAULTS, ...config, rate: 0 } : config;
	const CELL = Math.max(2, settings.cell ?? 8);
	const BURST = settings.burst ?? 40;
	const PRESS = settings.press ?? !POINTER;
	const TEXT = settings.source === 'text';
	const host = findHost(el, settings.host);
	const fountain = createFountain({ ...settings, cell: CELL, width: 1, height: 1 });

	// The ramp's steps; from the pointer, one ink (empty for the text's colour).
	let steps = POINTER ? pickColors(settings, isCurrent(settings.color) ? [] : [/** @type {string} */ (settings.color)]) : pickColors(settings, fadeSteps(settings.color ?? '#c8ff00'));
	let hot = '';
	let ink = '';
	/**
	 * Takes a new set of steps, and the hot colour from the first.
	 *
	 * @param {string[]} next The steps.
	 */
	const recolor = (next) => {
		steps = next;
		readInk();
		try {
			hot = toHex(mixOklab(parseColor(steps[0]), [1, 1, 1], HOT_MIX));
		} catch {
			hot = steps[0];
		}
	};
	/** The pointer's one ink: the first step, or the element's CSS colour. */
	const readInk = () => {
		if (POINTER) ink = isCurrent(steps[0]) ? getComputedStyle(el).color : steps[0];
	};
	recolor(steps);
	const unwatch = watchColors(el, ({ colors }) => recolor(colors));

	let acc = 0;
	let stopped = false;
	/** Whether the last frame drew anything (an empty pool is cleared once, then left). */
	let drawn = true;
	/** @type {import('./canvas2d.js').Canvas2D | null} */
	let canvas2d = null;

	/** Reads the letters' filled cells (with `source: 'text'`), in the canvas's CSS px. */
	const readText = () => {
		const c = canvas2d;
		if (!TEXT || !c || stopped) return;
		const texts = textNodesWithin(host, el);
		const w = Math.max(1, Math.round(c.width));
		const h = Math.max(1, Math.round(c.height));
		const scratch = document.createElement('canvas');
		scratch.width = w;
		scratch.height = h;
		const ctx = scratch.getContext('2d', { willReadFrequently: true });
		if (!ctx) return;
		const box = c.canvas.getBoundingClientRect();
		ctx.fillStyle = '#000';
		paintGlyphs(ctx, texts, { x: box.left, y: box.top });
		const { points, tops } = inkedCells(ctx.getImageData(0, 0, w, h).data, w, h, CELL);
		fountain.setOrigins(points, tops);
		if (c.still) scatter(c);
	};

	/**
	 * With reduced motion: a still scatter, the fountain run on its own
	 * for a moment from its seed and held (nothing from the pointer).
	 *
	 * @param {import('./canvas2d.js').Canvas2D} c The canvas.
	 */
	const scatter = (c) => {
		fountain.clear();
		if (!POINTER) {
			for (let i = 0; i < 90; i++) {
				fountain.step();
				if (i % 5 === 0) fountain.emitAmbient(1, 'move');
			}
		}
		drawn = true;
		render(c);
	};

	/**
	 * Draws the live pixels, each on its own grid in device pixels: through
	 * the ramp, or from the pointer all in its one ink.
	 *
	 * @param {import('./canvas2d.js').Canvas2D} c The canvas.
	 */
	const render = (c) => {
		if (!fountain.count && !drawn) return;
		drawn = fountain.count > 0;
		const { ctx, dpr } = c;
		ctx.setTransform(1, 0, 0, 1, 0, 0);
		ctx.clearRect(0, 0, c.canvas.width, c.canvas.height);
		const sizes = tierSizes(CELL, dpr);
		const floor = c.canvas.height;
		const n = steps.length;
		let fill = '';
		if (POINTER) ctx.fillStyle = fill = ink;
		for (let i = 0; i < fountain.count; i++) {
			const p = fountain.pixels[i];
			if (!p.on) continue;
			if (!POINTER) {
				const shade = shadeAt(p.age / p.life, n, p.hot);
				const color = shade < 0 ? hot : steps[shade];
				if (color !== fill) ctx.fillStyle = fill = color;
			}
			const size = sizes[p.tier];
			const [x, y] = pixelRect(p.x * dpr, p.y * dpr, size, floor);
			ctx.fillRect(x, y, size, size);
		}
	};

	const { c, stop } = createCanvas2D(el, {
		resize(c) {
			canvas2d = c;
			fountain.resize(c.width, c.height);
			readInk();
			drawn = true;
			if (TEXT) readText();
			else if (c.still) scatter(c);
		},
		draw(c, _now, dt) {
			if (c.still) return render(c);
			acc = Math.min(acc + dt, STEP * 4);
			while (acc >= STEP) {
				fountain.step();
				acc -= STEP;
			}
			render(c);
		},
	});
	if (!c) {
		unwatch();
		return () => {};
	}
	if (TEXT) document.fonts?.ready.then(readText).catch(() => {});

	/** The pointer's last place over the host, viewport px, to fire along its path. */
	let last = /** @type {{ x: number, y: number } | null} */ (null);
	let travel = 0;

	/**
	 * A point in the canvas's CSS px.
	 *
	 * @param {number} clientX Viewport x.
	 * @param {number} clientY Viewport y.
	 * @returns {[number, number]} Across and down the canvas.
	 */
	const toCanvas = (clientX, clientY) => {
		const box = c.canvas.getBoundingClientRect();
		return [clientX - box.left, clientY - box.top];
	};

	/**
	 * Fires pixels from under a point.
	 *
	 * @param {number} clientX Viewport x.
	 * @param {number} clientY Viewport y.
	 * @param {number} n How many.
	 * @param {EmitKind} kind What fired them.
	 */
	const fireAt = (clientX, clientY, n, kind) => {
		const [x, y] = toCanvas(clientX, clientY);
		if (POINTER) fountain.emit(x, y, n, 'tap');
		else if (TEXT) fountain.emitNear(x, y, n, kind, kind === 'burst' ? 110 : 60);
		else fountain.emitEdge(x, n, kind);
	};

	/** @param {PointerEvent} e The move. */
	const move = (e) => {
		if (POINTER) {
			// Only over the host's own box (a child may overflow it).
			const box = host.getBoundingClientRect();
			if (e.clientX < box.left || e.clientX > box.right || e.clientY < box.top || e.clientY > box.bottom) return fountain.lift();
			const [x, y] = toCanvas(e.clientX, e.clientY);
			fountain.moveTo(x, y);
			return;
		}
		if (last) travel += Math.hypot(e.clientX - last.x, e.clientY - last.y);
		last = { x: e.clientX, y: e.clientY };
		const n = Math.min(8, Math.floor(travel / 10));
		if (!n) return;
		travel -= n * 10;
		fireAt(e.clientX, e.clientY, n, 'move');
	};
	/** Forgets the pointer's path when it leaves the host (and picks up the text's colour again as it comes back). */
	const leave = () => {
		last = null;
		travel = 0;
		fountain.lift();
		readInk();
	};
	/** @param {PointerEvent} e The press: a tap always fires, a click only with `press`. */
	const press = (e) => {
		if (!PRESS && e.pointerType === 'mouse') return;
		if (!pressAt(host, e)) return;
		fireAt(e.clientX, e.clientY, BURST, 'burst');
	};
	if (!c.still) {
		host.addEventListener('pointermove', move, { passive: true });
		host.addEventListener('pointerleave', leave);
		host.addEventListener('pointerdown', press);
	}

	return () => {
		stopped = true;
		host.removeEventListener('pointermove', move);
		host.removeEventListener('pointerleave', leave);
		host.removeEventListener('pointerdown', press);
		unwatch();
		stop();
	};
}
