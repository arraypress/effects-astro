/**
 * @module @arraypress/effects-astro/paint-drip
 *
 * A mark sprayed in paint, the paint running: wet paint pools along the
 * mark's lower edges, and where a pool grows past what surface tension holds
 * a drip breaks away. Each drip falls under gravity against the paint's
 * viscosity, leaving paint behind as it goes, so its head (a rounded bead)
 * shrinks and slows and its body thins; it stops when too little is left to
 * move it, or when it reaches something below, and dries (its wet sheen
 * fades). Several drips of different volumes start at different times; they
 * hold, fade, and the paint runs again, on a loop.
 *
 * The physics is plain JavaScript and pure (`dripRun`, `dripAnchors`,
 * `dripPlan`): the same seed draws the same drips, and the still (every drip
 * at its full length) is the loop's resting frame. Drawn on a 2D canvas: the
 * ground with a soft light and grain, the mark tinted with a sprayed edge, the
 * drips, a glow, and grain over the paint.
 *
 * Opaque: it paints its `background` everywhere. With prefers-reduced-motion
 * (or `speed: 0`) it is one still frame, the drips at full length.
 */

import { createCanvas2D, grainPattern, grainOnto } from './canvas2d.js';
import { loadImage } from './image.js';
import { parseColor, mixOklab, toHex } from './color.js';
import { seededRandom as mulberry32 } from './random.js';

/**
 * @typedef {object} PaintDripConfig
 * @property {string} [src] The mark, as an image URL (a white SVG works; any colour, only its alpha is used).
 * @property {string} [color='#C8FF00'] The paint.
 * @property {string} [background='#85857F'] The ground, painted everywhere.
 * @property {{ x: number, y: number, size: number }} [box] Where the mark sits: its centre (0–1 from the top left) and its edge (a share of the height).
 * @property {number} [drips=3] How many drips run.
 * @property {number} [volume=1] How much paint each drip carries (longer runs).
 * @property {number} [floor=0.84] No drip runs past this, a share of the height from the top (the name's room).
 * @property {number} [glow=0.55] How much the paint glows; 0 for none.
 * @property {number} [spray=0.6] How rough the sprayed edge is; 0 for a clean edge.
 * @property {number} [grain=0.12] Grain over the ground and the paint; 0 for none.
 * @property {number} [hold=2.6] Seconds the finished drips hold before they fade and run again.
 * @property {number} [seed=0] Which drips (where, how big, when), so two cards differ.
 * @property {number} [speed=1] Plays the clock faster or slower; 0 for one still frame.
 */

/** The settings' defaults. */
export const DRIP_DEFAULTS = {
	color: '#C8FF00',
	background: '#85857F',
	box: { x: 0.5, y: 0.42, size: 0.5 },
	drips: 3,
	volume: 1,
	floor: 0.84,
	glow: 0.55,
	spray: 0.6,
	grain: 0.12,
	hold: 2.6,
	seed: 0,
	speed: 1,
};

/**
 * The paint's physics, in heights (shares of the canvas's height) and seconds. A drip's head holds `m` paint; it is
 * a bead of radius `BEAD * √m`. Surface tension holds the first `YIELD` of it; gravity pulls the rest, viscosity
 * drags it back, and it lays paint along its path in proportion to how fast it goes and how wide it is.
 */
const PHYSICS = {
	/** Seconds per step. */
	dt: 1 / 60,
	/** Gravity on the free paint, heights / s². */
	gravity: 1.6,
	/** Viscous drag, per second. */
	drag: 4.5,
	/** Paint surface tension holds (a drip can't start below it, and stops when it falls back to it). */
	yield: 0.35,
	/** Bead radius per √paint, heights. */
	bead: 0.02,
	/** Paint laid behind, per height of path per bead radius. */
	lay: 300,
	/** The body's width, a share of the bead's width when it passed. */
	body: 0.5,
	/** Paint fed from the mark into the pool, per second, while it feeds. */
	feed: 1.6,
	/** Longest run, seconds (a drip that never stops is cut here). */
	longest: 9,
};

/**
 * @typedef {object} DripRun
 * @property {number} t0 When the paint starts to pool, seconds into the loop.
 * @property {number} duration How long until it stops, seconds from t0.
 * @property {Float32Array} y The head's depth below its edge at each step, heights.
 * @property {Float32Array} r The bead's radius at each step, heights.
 * @property {Float32Array} v The head's speed at each step, heights / s.
 * @property {Float32Array} w The body's width at each depth step (`DEPTH_STEP` apart), heights.
 * @property {number} length Its final depth, heights.
 */

/** The body's widths are kept this far apart, heights. */
export const DEPTH_STEP = 0.002;

/**
 * Runs one drip from pooling to drying: its head's depth, size and speed at each step, and the width its body is
 * left at along its path.
 *
 * @param {object} drip The drip.
 * @param {number} drip.paint How much paint flows into it (its volume), about 0.5–1.6.
 * @param {number} drip.room How far it can fall before it meets something, heights.
 * @param {number} [drip.t0=0] When it starts pooling, seconds.
 * @returns {DripRun} The run.
 */
export function dripRun({ paint, room, t0 = 0 }) {
	const P = PHYSICS;
	const ys = [],
		rs = [],
		vs = [],
		ws = [];
	let m = 0,
		v = 0,
		y = 0,
		fed = 0,
		moving = false,
		t = 0;
	const steps = Math.ceil(P.longest / P.dt);
	for (let i = 0; i < steps; i++) {
		// the pool fills from the mark until its paint has come
		if (fed < paint) {
			const add = Math.min(paint - fed, P.feed * P.dt);
			m += add;
			fed += add;
		}
		const r = P.bead * Math.sqrt(Math.max(m, 0));
		// gravity on the free paint (above what surface tension holds), viscosity against it
		const free = Math.max(0, m - P.yield);
		const a = (P.gravity * free) / (m + 0.25);
		if (free > 0) moving = true;
		v += (a - P.drag * v) * P.dt;
		if (v < 0) v = 0;
		let dy = v * P.dt;
		// it meets something below: the bead flattens against it and stops there
		let met = false;
		if (y + dy + r > room) {
			dy = Math.max(0, room - r - y);
			v = 0;
			met = moving;
		}
		// paint laid along the path: the body, as wide as a share of the bead when it passed
		if (dy > 0) {
			const lost = Math.min(m - P.yield * 0.6, P.lay * r * dy);
			m -= Math.max(0, lost);
			const from = Math.floor(y / DEPTH_STEP),
				to = Math.floor((y + dy) / DEPTH_STEP);
			for (let k = from; k <= to; k++) if (ws[k] === undefined) ws[k] = 2 * r * P.body;
		}
		y += dy;
		ys.push(y);
		rs.push(P.bead * Math.sqrt(Math.max(m, 0)));
		vs.push(v);
		t += P.dt;
		// dried: it moved, and now holds too little paint to go on (and has slowed to nothing)
		if (moving && fed >= paint && ((v < 0.002 && m <= P.yield * 1.02) || met)) break;
	}
	// a body width at every depth down to the head
	const n = Math.floor(y / DEPTH_STEP) + 1;
	const w = new Float32Array(n);
	let last = ws[0] ?? 2 * P.bead * P.body;
	for (let k = 0; k < n; k++) w[k] = last = ws[k] ?? last;
	return { t0, duration: t, y: Float32Array.from(ys), r: Float32Array.from(rs), v: Float32Array.from(vs), w, length: y };
}

/**
 * Where a drip runs from at a time: its head's depth, bead and speed.
 *
 * @param {DripRun} run The run.
 * @param {number} t Seconds into the loop.
 * @returns {{ y: number, r: number, v: number, started: boolean, done: boolean }} The head.
 */
export function dripAt(run, t) {
	const s = t - run.t0;
	if (s <= 0) return { y: 0, r: 0, v: 0, started: false, done: false };
	const i = Math.min(run.y.length - 1, Math.floor(s / PHYSICS.dt));
	return { y: run.y[i], r: run.r[i], v: run.v[i], started: true, done: i === run.y.length - 1 };
}

/**
 * @typedef {object} DripAnchor
 * @property {number} x Across, a share of the box (0–1).
 * @property {number} y Down, a share of the box (0–1): the edge the paint hangs from.
 * @property {number} room How far below it is clear, a share of the box (to the box's foot when it runs out of the box).
 * @property {boolean} open Whether it runs clear out of the box (nothing of the mark below it).
 */

/**
 * The places paint drips from: points on the mark's lower edges (ink above, clear below), the gentler the slope and
 * the lower on the mark the likelier, the lowest points of a run likelier still (paint gathers where an edge turns
 * up again), picked apart from each other.
 *
 * @param {ArrayLike<number>} alpha The mark's coverage, 0–1, row by row.
 * @param {number} w Its width, cells.
 * @param {number} h Its height, cells.
 * @param {number} count How many.
 * @param {number} seed Which.
 * @returns {DripAnchor[]} The places, left to right.
 */
export function dripAnchors(alpha, w, h, count, seed) {
	const ink = (x, y) => x >= 0 && y >= 0 && x < w && y < h && alpha[y * w + x] >= 0.5;
	/** The edge each column hangs from: every ink cell with 3 clear below it, and how far it is clear. */
	const edges = /** @type {{ x: number, y: number, room: number, open: boolean }[][]} */ (Array.from({ length: w }, () => []));
	for (let x = 0; x < w; x++)
		for (let y = 0; y < h - 1; y++)
			if (ink(x, y) && !ink(x, y + 1) && !ink(x, y + 2) && !ink(x, y + 3)) {
				let k = y + 1;
				while (k < h && !ink(x, k)) k++;
				edges[x].push({ x, y, room: k - y - 1, open: k >= h });
			}
	/** The edge in column x nearest a depth. */
	const near = (x, y) => (edges[x] ?? []).reduce((best, e) => (!best || Math.abs(e.y - y) < Math.abs(best.y - y) ? e : best), null);
	const span = Math.max(3, Math.round(w * 0.02));
	const candidates = [];
	for (let x = span; x < w - span; x++)
		for (const e of edges[x]) {
			const a = near(x - span, e.y),
				b = near(x + span, e.y);
			if (!a || !b || Math.abs(a.y - e.y) > span * 2 || Math.abs(b.y - e.y) > span * 2) continue;
			const slope = Math.abs(b.y - a.y) / (2 * span);
			if (slope > 1.3) continue; // too steep to hold paint: it runs down the edge instead
			const lowest = a.y <= e.y && b.y <= e.y;
			const room = e.room / h;
			const weight = (0.08 + (e.y / h) ** 2) * (lowest ? 3 : 1) * Math.min(1, room / 0.08 + (e.open ? 1 : 0)) * (1 - slope * 0.5);
			if (weight > 0) candidates.push({ x: e.x / w, y: (e.y + 1) / h, room, open: e.open, weight });
		}
	const rand = mulberry32(Math.floor(seed * 1000) + 17);
	const picked = /** @type {DripAnchor[]} */ ([]);
	const gap = 0.11;
	for (let n = 0; n < count && candidates.length; n++) {
		const pool = candidates.filter((c) => picked.every((p) => Math.abs(p.x - c.x) >= gap));
		if (!pool.length) break;
		const total = pool.reduce((s, c) => s + c.weight, 0);
		let at = rand() * total;
		const c = pool.find((q) => (at -= q.weight) <= 0) ?? pool[pool.length - 1];
		picked.push({ x: c.x, y: c.y, room: c.room, open: c.open });
	}
	return picked.sort((a, b) => a.x - b.x);
}

/**
 * @typedef {object} DripPlan
 * @property {{ x: number, y: number, room: number, run: DripRun }[]} drips Each drip: where it hangs (heights from the top left) and its run.
 * @property {number} cycle The loop's length, seconds.
 * @property {number} settled When the last drip has stopped, seconds.
 */

/**
 * Every drip's run for a mark: where each hangs, how much paint it carries, when it starts, and the loop around them.
 *
 * @param {DripAnchor[]} anchors From dripAnchors.
 * @param {object} at Where the mark is: its box's left and top, and its edge, heights.
 * @param {number} at.left The box's left, heights.
 * @param {number} at.top The box's top, heights.
 * @param {number} at.size The box's edge, heights.
 * @param {PaintDripConfig} config The settings.
 * @returns {DripPlan} The plan.
 */
export function dripPlan(anchors, at, config) {
	const o = { ...DRIP_DEFAULTS, ...config };
	const rand = mulberry32(Math.floor(o.seed * 1000) + 101);
	let t = 0.3 + rand() * 0.4;
	const drips = anchors.map((a) => {
		const x = at.left + a.x * at.size,
			y = at.top + a.y * at.size;
		const room = Math.max(0.01, a.open ? o.floor - y : a.room * at.size - 0.004);
		const paint = o.volume * (0.55 + rand() * 1.05);
		const run = dripRun({ paint, room, t0: t });
		t += 0.35 + rand() * 1.1;
		return { x, y, room, run };
	});
	const settled = drips.reduce((s, d) => Math.max(s, d.run.t0 + d.run.duration), 0);
	return { drips, settled, cycle: settled + o.hold + FADE + 0.6 };
}

/** Seconds the drips take to fade before the paint runs again. */
const FADE = 0.9;

/**
 * How far into the loop a frame is, and how visible the drips are: they fade out at the loop's end.
 *
 * @param {DripPlan} plan The plan.
 * @param {number} time Seconds since it started (already at its speed).
 * @returns {{ t: number, fade: number }} Seconds into the loop, and the drips' opacity.
 */
export function dripClock(plan, time) {
	const t = ((time % plan.cycle) + plan.cycle) % plan.cycle;
	const fadeAt = plan.cycle - FADE - 0.6;
	const fade = t < fadeAt ? 1 : t < fadeAt + FADE ? 1 - (t - fadeAt) / FADE : 0;
	return { t, fade };
}

/**
 * A CSS `background` that stands in for the ground before the canvas draws: its colour with the soft light in its
 * middle.
 *
 * @param {PaintDripConfig} config The settings.
 * @returns {string} The CSS background.
 */
export function dripStill(config) {
	const o = { ...DRIP_DEFAULTS, ...config };
	const lit = toHex(mixOklab(parseColor(o.background), parseColor('#ffffff'), 0.12));
	return `radial-gradient(120% 90% at 50% 38%, ${lit} 0%, ${o.background} 70%)`;
}

/**
 * The paint's sheen: a lighter tint of it for the wet highlight.
 *
 * @param {string} color The paint.
 * @returns {string} The highlight.
 */
const sheenOf = (color) => toHex(mixOklab(parseColor(color), parseColor('#ffffff'), 0.65));

/**
 * Starts the paint running on an element: a canvas inside it (its first), the mark loaded from `src`.
 *
 * @param {HTMLElement} el The element.
 * @param {PaintDripConfig} config The settings.
 * @returns {() => void} Stops it.
 */
export function paintDrip(el, config) {
	const o = { ...DRIP_DEFAULTS, ...config, box: { ...DRIP_DEFAULTS.box, ...config.box } };
	const sheen = sheenOf(o.color);
	/** @type {HTMLImageElement | null} */
	let image = null;
	/** @type {DripPlan | null} */
	let plan = null;
	/** The ground and the sprayed mark, drawn once a size. */
	let ground = /** @type {HTMLCanvasElement | null} */ (null);
	let mark = /** @type {HTMLCanvasElement | null} */ (null);
	/** The paint's layer, redrawn each frame it changes. */
	const paint = document.createElement('canvas');
	const pctx = paint.getContext('2d');
	let pattern = /** @type {CanvasPattern | null} */ (null);
	let lastKey = '';
	const start = performance.now();
	const still = o.speed <= 0;

	/**
	 * The mark's box on the canvas, CSS px.
	 *
	 * @param {number} W Width.
	 * @param {number} H Height.
	 */
	const boxOf = (W, H) => {
		const size = o.box.size * H;
		return { left: o.box.x * W - size / 2, top: o.box.y * H - size / 2, size };
	};

	/**
	 * Draws the ground (its colour, a soft light, grain) and the mark (tinted, its edge sprayed), and plans the drips,
	 * for a size.
	 *
	 * @param {import('./canvas2d.js').Canvas2D} c The canvas.
	 */
	const prepare = (c) => {
		const { width: W, height: H, dpr } = c;
		ground = document.createElement('canvas');
		ground.width = Math.round(W * dpr);
		ground.height = Math.round(H * dpr);
		const g = ground.getContext('2d');
		if (!g) return;
		g.scale(dpr, dpr);
		g.fillStyle = o.background;
		g.fillRect(0, 0, W, H);
		const light = g.createRadialGradient(W * 0.5, H * 0.36, 0, W * 0.5, H * 0.36, H * 0.75);
		light.addColorStop(0, 'rgba(255,255,255,0.13)');
		light.addColorStop(1, 'rgba(255,255,255,0)');
		g.fillStyle = light;
		g.fillRect(0, 0, W, H);
		const vignette = g.createRadialGradient(W * 0.5, H * 0.45, H * 0.35, W * 0.5, H * 0.45, H * 0.85);
		vignette.addColorStop(0, 'rgba(0,0,0,0)');
		vignette.addColorStop(1, 'rgba(0,0,0,0.22)');
		g.fillStyle = vignette;
		g.fillRect(0, 0, W, H);
		const gp = grainPattern(g);
		if (gp && o.grain > 0) {
			g.globalAlpha = o.grain * 0.6;
			g.globalCompositeOperation = 'overlay';
			g.fillStyle = gp;
			g.fillRect(0, 0, W, H);
			g.globalAlpha = 1;
			g.globalCompositeOperation = 'source-over';
		}
		paint.width = Math.round(W * dpr);
		paint.height = Math.round(H * dpr);
		pattern = pctx ? grainPattern(pctx) : null;
		if (!image) return;
		const box = boxOf(W, H);
		// the mark tinted, its soft edge broken into spray: a slightly blurred copy whose half-covered pixels are kept
		// or dropped at random
		const px = Math.max(8, Math.round(box.size * dpr));
		mark = document.createElement('canvas');
		mark.width = px;
		mark.height = px;
		const k = mark.getContext('2d', { willReadFrequently: true });
		if (!k) return;
		k.filter = o.spray > 0 ? `blur(${(0.25 + o.spray * 0.55) * dpr}px)` : 'none';
		k.drawImage(image, 0, 0, px, px);
		k.filter = 'none';
		const data = k.getImageData(0, 0, px, px);
		const alpha = new Float32Array(px * px);
		const rand = mulberry32(Math.floor(o.seed * 1000) + 7);
		const [cr, cg, cb] = parseColor(o.color).map((v) => Math.round(v * 255));
		for (let i = 0; i < px * px; i++) {
			const a = data.data[i * 4 + 3] / 255;
			alpha[i] = a;
			// inside the edge solid; in the soft fringe kept or dropped at random, the outer half rarely (a fine speckle)
			const kept = o.spray > 0 && a > 0.08 && a < 0.92 ? (rand() < (a < 0.5 ? a * a : a) ? 1 : 0) : a >= 0.5 ? 1 : 0;
			data.data[i * 4] = cr;
			data.data[i * 4 + 1] = cg;
			data.data[i * 4 + 2] = cb;
			data.data[i * 4 + 3] = kept * 255;
		}
		k.putImageData(data, 0, 0);
		// where the paint drips from, read off the mark at a coarser size
		const n = 160;
		const probe = document.createElement('canvas');
		probe.width = n;
		probe.height = n;
		const q = probe.getContext('2d', { willReadFrequently: true });
		if (!q) return;
		q.drawImage(image, 0, 0, n, n);
		const pd = q.getImageData(0, 0, n, n).data;
		const cover = new Float32Array(n * n);
		for (let i = 0; i < n * n; i++) cover[i] = pd[i * 4 + 3] / 255;
		const anchors = dripAnchors(cover, n, n, o.drips, o.seed);
		plan = dripPlan(anchors, { left: box.left / H, top: box.top / H, size: box.size / H }, o);
		lastKey = '';
	};

	/**
	 * Draws one drip on the paint layer: its body down to the head, a fillet where it leaves the edge, the bead, and
	 * while wet a sheen down one side and a glint on the bead.
	 *
	 * @param {CanvasRenderingContext2D} p The paint layer, in CSS px.
	 * @param {DripPlan['drips'][number]} d The drip.
	 * @param {number} t Seconds into the loop.
	 * @param {number} H The canvas's height, px.
	 */
	const drawDrip = (p, d, t, H) => {
		const head = dripAt(d.run, t);
		if (!head.started) return;
		const x0 = d.x * H,
			y0 = d.y * H;
		const depth = head.y * H;
		const rb = Math.max(head.r * H, 0.6);
		// a gentle sway as it runs, the same each loop
		const sway = (s) => Math.sin(s * 0.07 + d.x * 40) * Math.min(1.2, s * 0.02);
		const widthAt = (s) => {
			const k = Math.min(d.run.w.length - 1, Math.max(0, Math.floor(s / H / DEPTH_STEP)));
			return (d.run.w[k] ?? rb) * H;
		};
		p.beginPath();
		// the fillet off the edge, then down the left of the body
		const w0 = widthAt(0);
		const fillet = Math.max(w0 * 0.9, rb * 0.8);
		p.moveTo(x0 - w0 / 2 - fillet, y0 - 0.5);
		p.quadraticCurveTo(x0 - w0 / 2, y0, x0 - w0 / 2, y0 + fillet);
		const neck = Math.max(0, depth - rb * 0.6);
		const steps = Math.max(2, Math.ceil(neck / 2));
		for (let i = 1; i <= steps; i++) {
			const s = (neck * i) / steps;
			p.lineTo(x0 + sway(s) - widthAt(s) / 2, y0 + s);
		}
		// round the bead: a little teardrop while it moves, round once it rests
		const stretch = 1 + Math.min(0.45, head.v * 6);
		const bx = x0 + sway(depth),
			by = y0 + depth;
		p.ellipse(bx, by, rb, rb * stretch, 0, Math.PI, 0, true);
		for (let i = steps; i >= 1; i--) {
			const s = (neck * i) / steps;
			p.lineTo(x0 + sway(s) + widthAt(s) / 2, y0 + s);
		}
		p.lineTo(x0 + w0 / 2, y0 + fillet);
		p.quadraticCurveTo(x0 + w0 / 2, y0, x0 + w0 / 2 + fillet, y0 - 0.5);
		p.closePath();
		p.fill();
		// wet: a sheen down the body and a glint on the bead, fading as the paint dries
		const since = head.done ? t - (d.run.t0 + d.run.duration) : 0;
		const wet = head.done ? Math.max(0, 1 - since / 1.8) : 1;
		if (wet > 0.01 && depth > rb) {
			p.save();
			p.globalAlpha = 0.45 * wet;
			p.strokeStyle = sheen;
			p.lineWidth = Math.max(0.6, w0 * 0.18);
			p.lineCap = 'round';
			p.beginPath();
			p.moveTo(x0 - widthAt(0) * 0.18, y0 + fillet);
			for (let s = fillet; s < neck; s += 3) p.lineTo(x0 + sway(s) - widthAt(s) * 0.18, y0 + s);
			p.stroke();
			p.globalAlpha = 0.7 * wet;
			p.fillStyle = sheen;
			p.beginPath();
			p.ellipse(bx - rb * 0.35, by - rb * 0.1 * stretch, rb * 0.22, rb * 0.32 * stretch, -0.3, 0, Math.PI * 2);
			p.fill();
			p.restore();
		}
	};

	/**
	 * One frame: the ground, then the paint (the mark and the drips, grain on them) with its glow.
	 *
	 * @param {import('./canvas2d.js').Canvas2D} c The canvas.
	 * @param {number} now The time, ms.
	 */
	const draw = (c, now) => {
		const { ctx, width: W, height: H, dpr } = c;
		if (!ground || !pctx) return;
		const time = still || c.still ? Infinity : ((now - start) / 1000) * o.speed;
		const clock = plan ? (time === Infinity ? { t: plan.settled + 0.01, fade: 1 } : dripClock(plan, time)) : { t: 0, fade: 1 };
		// only when something changed: a moving drip, the fade, or a new size
		const moving = plan?.drips.some((d) => {
			const h = dripAt(d.run, clock.t);
			return h.started && (!h.done || clock.t - (d.run.t0 + d.run.duration) < 1.9);
		});
		const key = `${W}x${H}:${moving || clock.fade < 1 ? clock.t.toFixed(3) : 'rest'}:${clock.fade.toFixed(2)}:${Boolean(mark)}`;
		if (key === lastKey) return;
		lastKey = key;
		ctx.drawImage(ground, 0, 0, W, H);
		pctx.setTransform(1, 0, 0, 1, 0, 0);
		pctx.clearRect(0, 0, paint.width, paint.height);
		pctx.setTransform(dpr, 0, 0, dpr, 0, 0);
		if (mark) {
			const box = boxOf(W, H);
			pctx.drawImage(mark, box.left, box.top, box.size, box.size);
		}
		if (plan && clock.fade > 0) {
			pctx.save();
			pctx.globalAlpha = clock.fade;
			pctx.fillStyle = o.color;
			for (const d of plan.drips) drawDrip(pctx, d, clock.t, H);
			pctx.restore();
		}
		if (pattern && o.grain > 0) grainOnto({ ctx: pctx, canvas: paint, width: W, height: H, dpr, still: true }, pattern, o.grain * 0.8);
		ctx.save();
		if (o.glow > 0) {
			ctx.shadowColor = o.color;
			ctx.shadowBlur = 10 * o.glow * dpr;
		}
		ctx.drawImage(paint, 0, 0, W, H);
		ctx.restore();
	};

	const { c, stop } = createCanvas2D(el, {
		draw: (cv, now) => draw(cv, now),
		resize: (cv) => {
			prepare(cv);
			draw(cv, performance.now());
		},
	});
	if (!c) return stop;
	let alive = true;
	if (o.src)
		loadImage(o.src)
			.then((img) => {
				if (!alive) return;
				image = img;
				prepare(c);
				draw(c, performance.now());
			})
			.catch((error) => console.warn('[effects-astro]', error));
	return () => {
		alive = false;
		stop();
	};
}
