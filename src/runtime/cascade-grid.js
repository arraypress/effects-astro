/**
 * @module @arraypress/effects-astro/cascade-grid
 *
 * A regular grid of cells, staggered hexagons or square-set dots, that
 * behaves like a scrolling spectrogram: each row is one band of a made-up
 * spectrum, and each column shows that spectrum a little later than the
 * column before it, so whatever rises in one column cascades across the
 * grid as a wave. A cell's level (0–1) swells it from an idle state, a
 * small dim speck, to a reactive one, near the whole cell in the second
 * colour; the low rows run a little busier, as a real spectrum does.
 *
 * The sketches kept a ring buffer of levels, written once a tick and read
 * further back column by column. Here there is no buffer and no state on
 * the CPU: a cell's level is worked out where it is drawn, as smooth
 * noise over (row, time − column × lag), stretched through a window and
 * lifted by the tilt, so it is the same at any frame rate and costs one
 * shader pass. Each cell is an anti-aliased distance field (a pointy-top
 * hexagon or a circle) in its own cell of the lattice; its size, colour
 * (blended in Oklab), outline and opacity follow its level. The same
 * level and lattice are here in plain JavaScript (`cascadeLevel`,
 * `latticeCell`, `cascadeCells`), so a page can draw a still that agrees.
 *
 * Clear between the cells, or the `background` colour. A `quiet` area
 * calms the cells behind copy. Without WebGL nothing is drawn; with
 * prefers-reduced-motion, or `speed: 0`, it is one still frame.
 *
 * After `hex_spectrogram_bg` and `circle_grid_bg`, Processing sketches
 * shared with the owner (2026-11-20): the lattices, the idle-to-reactive
 * blend, the level window and the tilt are theirs; here the levels are
 * analytic and timed in seconds, and the noise's lattice hash is Dave
 * Hoskins' Hash without Sine (MIT, © 2014 David Hoskins), which keeps the
 * GPU and `cascadeLevel` in step.
 */

import { createStage } from './stage.js';
import { GLSL_GRADIENT_NOISE, gnoise } from './hash-noise.js';
import { GLSL_OKLAB, mixOklab, parseColor, toHex, toOklab } from './color.js';
import { GLSL_QUIET, quietUniform } from './glsl.js';
import { watchColors } from './mount.js';
import { pickColors } from './palettes.js';
import { frameNow } from './loop.js';

/**
 * @typedef {object} CascadeGridConfig
 * @property {'hex' | 'dot'} [cell='hex'] The cells: staggered pointy-top hexagons, or dots on a square grid.
 * @property {number} [pitch=16] A cell's width in CSS px.
 * @property {number} [cols] Cells across instead, whatever the width (overrides `pitch`).
 * @property {string[]} [colors] Two CSS hex colours: an idle cell's and a reactive one's. Default the sketch's grey and green.
 * @property {string} [palette] A shared palette by name (PALETTES; any case), when there are no `colors`: its last and first colours.
 * @property {string} [background] A CSS hex colour to fill behind the cells; none leaves the canvas clear there.
 * @property {number} [idle] An idle cell's size, a share of the cell (0–1). Default 0.12 for hexagons, 0.14 for dots.
 * @property {number} [reactive] A reactive cell's size, a share of the cell (0–1; 1 is flush). Default 0.92 for hexagons, 0.9 for dots.
 * @property {'solid' | 'outline' | 'core'} [fill] How a cell is drawn: filled, outlined, or outlined around a solid core that grows with its level (the hexagon sketch's look). Default `core` for hexagons, `solid` for dots.
 * @property {[number, number]} [stroke=[0.06, 0.12]] The outline's width, idle and reactive, a share of the cell (0–0.5).
 * @property {[number, number]} [opacity=[0.5, 1]] A cell's opacity, idle and reactive (0–1).
 * @property {number} [lag=0.06] Seconds between one column and the next: the wave crosses `1 / lag` columns a second.
 * @property {number} [evolve=0.6] How fast the spectrum changes, noise units a second.
 * @property {number} [scale=0.12] Noise units a row: higher makes the bands narrower.
 * @property {[number, number]} [range=[0.3, 0.75]] The noise window stretched to 0–1: a lower top makes more cells reactive.
 * @property {number} [tilt=0.35] How much busier the low rows are (0–1): the bottom row gets it all, the middle none.
 * @property {'right' | 'left' | 'up' | 'down'} [direction='right'] Which way the wave travels. Up and down make the columns the spectrum, busier at the left.
 * @property {number | [number, number]} [offset=0] Where the noise starts (a number, or a band and a time shift), so two grids differ.
 * @property {number} [speed=1] Plays the clock faster or slower; 0 for one still frame.
 * @property {{ x?: number, y?: number, radius?: number, depth?: number } | null} [quiet=null]
 *   An area kept calm: centre (0–1 from the top left), radius (share of the height), depth (0–1).
 */

/** The settings' defaults, shared by the shader and the JavaScript twins (`idle`, `reactive` and `fill` depend on the cell; see CELL_DEFAULTS). */
export const CASCADE_DEFAULTS = {
	cell: /** @type {'hex' | 'dot'} */ ('hex'),
	pitch: 16,
	stroke: /** @type {[number, number]} */ ([0.06, 0.12]),
	opacity: /** @type {[number, number]} */ ([0.5, 1]),
	lag: 0.06,
	evolve: 0.6,
	scale: 0.12,
	range: /** @type {[number, number]} */ ([0.3, 0.75]),
	tilt: 0.35,
	direction: /** @type {'right' | 'left' | 'up' | 'down'} */ ('right'),
};

/** Each cell's own defaults: an idle and a reactive size, and how it is drawn. */
export const CELL_DEFAULTS = {
	hex: { idle: 0.12, reactive: 0.92, fill: /** @type {'solid' | 'outline' | 'core'} */ ('core') },
	dot: { idle: 0.14, reactive: 0.9, fill: /** @type {'solid' | 'outline' | 'core'} */ ('solid') },
};

/** The default colours: the hexagon sketch's grey (idle) and green (reactive). */
const SKETCH = ['#c9c9c9', '#97cd3a'];

/** A row's height over the pitch: √3⁄2 for staggered hexagons (they tessellate), 1 for dots. */
const ROW = { hex: Math.sqrt(3) / 2, dot: 1 };

/** How `fill` is passed to the shader. */
const FILLS = { solid: 0, outline: 1, core: 2 };

/** Spectrum and cascade axes by direction, as `uDir`: the spectrum index is `dot(xy, (col, row))`, the cascade index `dot(zw, (col, row))`. */
const DIRECTIONS = {
	right: [0, 1, 1, 0],
	left: [0, 1, -1, 0],
	down: [1, 0, 0, 1],
	up: [1, 0, 0, -1],
};

const FRAG = `
precision highp float;
uniform vec2 uRes;
uniform float uPitch;
uniform float uHex;
uniform float uTime;
uniform float uLag;
uniform float uEvolve;
uniform float uScale;
uniform vec2 uRange;
uniform float uTilt;
uniform vec2 uOffset;
uniform vec4 uDir;
uniform vec2 uSize;
uniform vec2 uStroke;
uniform vec2 uAlpha;
uniform float uFill;
uniform vec3 uLo;
uniform vec3 uHi;
uniform vec4 uBg;
${GLSL_OKLAB}
${GLSL_QUIET}
${GLSL_GRADIENT_NOISE}

// A band's level at a moment: two octaves of noise over (band, time), spread
// to about the sketches' Perlin noise (most of it 0.3-0.7), the window
// stretched to 0-1, and the tilt lifting the low end (h 0 to 0.5).
float cascadeLevel(float a, float b, float h, float t) {
	float s = (t - b * uLag) * uEvolve + uOffset.y;
	vec2 p = vec2(a * uScale + uOffset.x, s);
	float n = 0.5 + 2.2 * ((2.0 * gnoise(p) + gnoise(p * 2.03 + 17.0)) / 3.0 - 0.5);
	float v = clamp((n - uRange.x) / (uRange.y - uRange.x), 0.0, 1.0);
	float lift = uTilt * max(0.0, 1.0 - 2.0 * h);
	if (lift > 0.0) v += lift * gnoise(vec2(a * 0.3 + 50.0 + uOffset.x, s * 1.7));
	return clamp(v, 0.0, 1.0);
}

// A pointy-top hexagon's distance, its apothem r (iq's, turned a quarter).
float sdHex(vec2 p, float r) {
	const vec3 k = vec3(-0.866025404, 0.5, 0.577350269);
	p = abs(p.yx);
	p -= 2.0 * min(dot(k.xy, p), 0.0) * k.xy;
	p -= vec2(clamp(p.x, -k.z * r, k.z * r), r);
	return length(p) * sign(p.y);
}

void main() {
	// x from the left edge, y down from the middle row.
	vec2 px = vec2(gl_FragCoord.x, 0.5 * uRes.y - gl_FragCoord.y);
	float rowH = uPitch * mix(1.0, 0.866025404, uHex);
	// The nearest cell centre, in the two rows either side of the point (one column in each).
	float r0 = floor(px.y / rowH);
	float best = 1e9;
	vec2 cell = vec2(0.0);
	vec2 centre = vec2(0.0);
	for (int i = 0; i < 2; i++) {
		float r = r0 + float(i);
		float shift = uHex * 0.5 * mod(r, 2.0);
		float c = floor(px.x / uPitch - shift);
		vec2 at = vec2((c + 0.5 + shift) * uPitch, r * rowH);
		vec2 d = px - at;
		float dist = dot(d, d);
		if (dist < best) { best = dist; cell = vec2(c, r); centre = at; }
	}

	float a = dot(uDir.xy, cell);
	float b = dot(uDir.zw, cell);
	// How far up the spectrum: from the bottom (rows), or from the left (columns).
	float h = uDir.x > 0.5 ? centre.x / uRes.x : 0.5 - centre.y / uRes.y;
	float v = cascadeLevel(a, b, h, uTime);
	vec2 q = vec2(centre.x - 0.5 * uRes.x, -centre.y) / uRes.y;
	v *= mix(1.0 - uQuiet.w, 1.0, quietOpen(q));

	float rad = 0.5 * uPitch * mix(uSize.x, uSize.y, v);
	vec2 d = px - centre;
	float sd = uHex > 0.5 ? sdHex(d, rad) : length(d) - rad;
	float w = 0.5 * uPitch * mix(uStroke.x, uStroke.y, v);
	float op = mix(uAlpha.x, uAlpha.y, v);
	vec3 col = fromOklab(mix(uLo, uHi, v));
	// Solid: the shape. Outline and core: a ring on its edge, at least a pixel wide.
	float alpha = op * (uFill < 0.5 ? clamp(0.5 - sd, 0.0, 1.0) : clamp(0.5 - (abs(sd) - max(w, 0.5)), 0.0, 1.0));
	vec3 ink = col * alpha;
	if (uFill > 1.5) {
		// The solid core, grown with the level, over the outline.
		float cd = uHex > 0.5 ? sdHex(d, rad * v) : length(d) - rad * v;
		float core = clamp(0.5 - cd, 0.0, 1.0) * v * uAlpha.y;
		ink = fromOklab(uHi) * core + ink * (1.0 - core);
		alpha = core + alpha * (1.0 - core);
	}
	gl_FragColor = vec4(ink + uBg.rgb * uBg.a * (1.0 - alpha), alpha + uBg.a * (1.0 - alpha));
}
`;

/**
 * The settings with every default filled in, the cell's own included.
 *
 * @param {CascadeGridConfig} config The settings.
 * @returns {Required<Omit<CascadeGridConfig, 'cols' | 'colors' | 'palette' | 'background' | 'quiet' | 'offset'>> & { offset: [number, number] }}
 *   The settings the shader takes.
 */
export function cascadeOptions(config = {}) {
	const cell = config.cell === 'dot' ? 'dot' : 'hex';
	const own = CELL_DEFAULTS[cell];
	const offset = config.offset ?? 0;
	return {
		...CASCADE_DEFAULTS,
		...own,
		...Object.fromEntries(Object.entries(config).filter(([, v]) => v !== undefined)),
		cell,
		fill: config.fill && config.fill in FILLS ? config.fill : own.fill,
		direction: config.direction && config.direction in DIRECTIONS ? config.direction : 'right',
		offset: typeof offset === 'number' ? [offset * 1.37, offset * 7.31] : [offset[0] ?? 0, offset[1] ?? 0],
	};
}

/**
 * A band's level at a moment: what the shader draws a cell at, before the
 * quiet area. Moving one column on (`b + 1`) is the same level `lag`
 * seconds later: the cascade.
 *
 * @param {number} a The band: the row (or the column, flowing up or down).
 * @param {number} b The cascade index: the column (or the row).
 * @param {number} h How far up the spectrum the cell is, 0 at the low end and 1 at the high (only below 0.5 is tilted).
 * @param {number} t Seconds, as the shader's clock (already at its speed).
 * @param {CascadeGridConfig} [config] The settings.
 * @returns {number} 0–1.
 */
export function cascadeLevel(a, b, h, t, config = {}) {
	const { lag, evolve, scale, range, tilt, offset } = cascadeOptions(config);
	const s = (t - b * lag) * evolve + offset[1];
	const x = a * scale + offset[0];
	const n = 0.5 + 2.2 * ((2 * gnoise(x, s) + gnoise(x * 2.03 + 17, s * 2.03 + 17)) / 3 - 0.5);
	let v = Math.min(1, Math.max(0, (n - range[0]) / (range[1] - range[0])));
	const lift = tilt * Math.max(0, 1 - 2 * h);
	if (lift > 0) v += lift * gnoise(a * 0.3 + 50 + offset[0], s * 1.7);
	return Math.min(1, Math.max(0, v));
}

/**
 * The lattice's spacing on a target.
 *
 * @param {CascadeGridConfig} config The settings (`cell`, `pitch`, `cols`).
 * @param {number} width The target's width, in the units wanted back.
 * @param {number} [ratio=1] Pixels per CSS px, for `pitch`.
 * @returns {{ pitch: number, rowHeight: number }} A cell's width and a row's height.
 */
export function latticeOf(config, width, ratio = 1) {
	const cell = config.cell === 'dot' ? 'dot' : 'hex';
	const pitch = config.cols ? width / config.cols : (config.pitch ?? CASCADE_DEFAULTS.pitch) * ratio;
	return { pitch, rowHeight: pitch * ROW[cell] };
}

/**
 * The cell a point is in (the shader's lattice): columns from the left
 * edge, rows from the middle row down (negative above it). Hexagon rows
 * are √3⁄2 of the pitch apart, the odd ones shifted half a cell right, so
 * they tessellate; dots sit on a square grid.
 *
 * @param {'hex' | 'dot'} cell The cells.
 * @param {number} x Across, from the left edge.
 * @param {number} y Down, from the middle row's centre line.
 * @param {number} pitch A cell's width.
 * @returns {{ col: number, row: number, x: number, y: number }} The cell, and its centre.
 */
export function latticeCell(cell, x, y, pitch) {
	if (cell === 'dot') {
		const col = Math.floor(x / pitch);
		const row = Math.floor(y / pitch + 0.5);
		return { col, row, x: (col + 0.5) * pitch, y: row * pitch };
	}
	const rowH = pitch * ROW.hex;
	const r0 = Math.floor(y / rowH);
	let best = { col: 0, row: 0, x: 0, y: 0 };
	let dist = Infinity;
	for (const row of [r0, r0 + 1]) {
		const shift = 0.5 * (((row % 2) + 2) % 2);
		const col = Math.floor(x / pitch - shift);
		const cx = (col + 0.5 + shift) * pitch;
		const cy = row * rowH;
		const d = (x - cx) ** 2 + (y - cy) ** 2;
		if (d < dist) {
			dist = d;
			best = { col, row, x: cx, y: cy };
		}
	}
	return best;
}

/**
 * One frame, cell by cell: each cell's centre (from the top left) and the
 * level the shader draws it at, the quiet area included.
 *
 * @param {CascadeGridConfig} config The settings (the same as the shader's).
 * @param {number} width The target's width.
 * @param {number} height The target's height.
 * @param {number} [time=0] Seconds, as the shader's clock (already at its speed).
 * @returns {{ col: number, row: number, x: number, y: number, level: number }[]} Every cell whose centre is on the target.
 */
export function cascadeCells(config, width, height, time = 0) {
	const o = cascadeOptions(config);
	const { pitch, rowHeight } = latticeOf(config, width);
	const [ax, ay, bx, by] = DIRECTIONS[o.direction];
	const [qx, qy, radius, depth] = quietUniform(config.quiet, width / height);
	const smooth = (/** @type {number} */ e0, /** @type {number} */ e1, /** @type {number} */ x) => {
		const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
		return t * t * (3 - 2 * t);
	};
	const rows = Math.floor(height / 2 / rowHeight);
	/** @type {{ col: number, row: number, x: number, y: number, level: number }[]} */
	const cells = [];
	for (let row = -rows; row <= rows; row++) {
		const shift = o.cell === 'hex' ? 0.5 * (((row % 2) + 2) % 2) : 0;
		for (let col = -1; (col + 0.5 + shift) * pitch <= width; col++) {
			const x = (col + 0.5 + shift) * pitch;
			if (x < 0) continue;
			const y = row * rowHeight;
			const h = ax > 0 ? x / width : 0.5 - y / height;
			let level = cascadeLevel(ax * col + ay * row, bx * col + by * row, h, time, config);
			if (radius > 0) {
				const d = Math.hypot((x - width / 2) / height - qx, -y / height - qy);
				level *= 1 - depth + depth * smooth(radius * 0.06, radius, d);
			}
			cells.push({ col, row, x, y: y + height / 2, level });
		}
	}
	return cells;
}

/**
 * The two colours as the shader takes them.
 *
 * @param {CascadeGridConfig} config The settings.
 * @returns {[string, string]} An idle cell's colour and a reactive one's (a palette's last and first).
 */
export function cascadeColors(config) {
	const colors = pickColors(config, SKETCH, (palette) => [palette.colors[2], palette.colors[0]]);
	return [colors[0], colors[colors.length - 1]];
}

/**
 * A CSS `background` showing the grid at rest, for before the shader
 * starts and without WebGL: the idle cells as dots (an idle hexagon reads
 * as one) over the `background` colour, in the shader's lattice. Without
 * a width it can only place cells by `pitch`, so with `cols` it is the
 * ground alone.
 *
 * @param {CascadeGridConfig} config The settings.
 * @param {number} [width] The element's width in CSS px, when known (needed with `cols`).
 * @returns {string} A CSS `background` value.
 */
export function cascadeStill(config, width) {
	const o = cascadeOptions(config);
	const ground = config.background ?? 'transparent';
	if (config.cols && !width) return ground;
	const { pitch, rowHeight } = latticeOf(config, width ?? 1);
	const [idle] = cascadeColors(config);
	const ink = config.background ? toHex(mixOklab(parseColor(config.background), parseColor(idle), o.opacity[0])) : idle;
	const r = Math.max(0.6, (pitch * Math.max(o.idle, o.stroke[0])) / 2);
	const px = (/** @type {number} */ n) => `${+n.toFixed(3)}px`;
	const dot = `radial-gradient(circle, ${ink} ${px(r)}, transparent ${px(r + 0.6)})`;
	// A percentage places a tile's middle on the element's (the middle row's line); the odd hexagon rows sit a row below, half a cell on.
	if (o.cell === 'dot') return `${dot} 0 50% / ${px(pitch)} ${px(rowHeight)}, ${ground}`;
	const tile = `${px(pitch)} ${px(rowHeight * 2)}`;
	return `${dot} 0 50% / ${tile}, ${dot} ${px(pitch / 2)} calc(50% + ${px(rowHeight)}) / ${tile}, ${ground}`;
}

/**
 * Starts the grid on an element: a canvas inside it (its first), filling it.
 *
 * @param {HTMLElement} el The element.
 * @param {CascadeGridConfig} config The settings.
 * @returns {() => void} Stops it.
 */
export function cascadeGrid(el, config) {
	const o = cascadeOptions(config);
	const speed = config.speed ?? 1;
	const lab = (/** @type {string} */ c) => toOklab(parseColor(c));
	let [lo, hi] = cascadeColors(config).map(lab);
	const bg = config.background ? [...parseColor(config.background), 1] : [0, 0, 0, 0];
	const start = frameNow();

	const { stage, stop } = createStage(el, {
		fragment: FRAG,
		still: speed <= 0,
		setup({ gl, uniform }) {
			gl.uniform1f(uniform('uHex'), o.cell === 'hex' ? 1 : 0);
			gl.uniform1f(uniform('uLag'), o.lag);
			gl.uniform1f(uniform('uEvolve'), o.evolve);
			gl.uniform1f(uniform('uScale'), o.scale);
			gl.uniform2f(uniform('uRange'), o.range[0], Math.max(o.range[1], o.range[0] + 1e-3));
			gl.uniform1f(uniform('uTilt'), o.tilt);
			gl.uniform2f(uniform('uOffset'), o.offset[0], o.offset[1]);
			gl.uniform4fv(uniform('uDir'), DIRECTIONS[o.direction]);
			gl.uniform2f(uniform('uSize'), o.idle, o.reactive);
			gl.uniform2f(uniform('uStroke'), o.stroke[0], o.stroke[1]);
			gl.uniform2f(uniform('uAlpha'), o.opacity[0], o.opacity[1]);
			gl.uniform1f(uniform('uFill'), FILLS[o.fill]);
			gl.uniform4f(uniform('uBg'), bg[0], bg[1], bg[2], bg[3]);
		},
		resize({ gl, uniform, canvas, ratio }) {
			gl.uniform1f(uniform('uPitch'), latticeOf(config, canvas.width, ratio).pitch);
			gl.uniform4f(uniform('uQuiet'), ...quietUniform(config.quiet, canvas.width / canvas.height));
		},
		uniforms({ gl, uniform }, now) {
			gl.uniform1f(uniform('uTime'), ((now - start) / 1000) * Math.max(0, speed));
			gl.uniform3f(uniform('uLo'), lo[0], lo[1], lo[2]);
			gl.uniform3f(uniform('uHi'), hi[0], hi[1], hi[2]);
		},
	});
	if (!stage) return stop;

	const unwatch = watchColors(el, (next) => {
		[lo, hi] = cascadeColors({ colors: next.colors }).map(lab);
		if (stage.still) stage.redraw();
	});
	return () => {
		stop();
		unwatch();
	};
}
