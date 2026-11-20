import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
	CASCADE_DEFAULTS,
	CELL_DEFAULTS,
	cascadeOptions,
	cascadeLevel,
	latticeOf,
	latticeCell,
	cascadeCells,
	cascadeColors,
	cascadeStill,
} from '../src/runtime/cascade-grid.js';

test('cascadeOptions fills in the defaults, the cell its own, and turns a number offset into a pair', () => {
	const hex = cascadeOptions();
	assert.equal(hex.cell, 'hex');
	assert.equal(hex.fill, CELL_DEFAULTS.hex.fill);
	assert.equal(hex.idle, CELL_DEFAULTS.hex.idle);
	assert.equal(hex.lag, CASCADE_DEFAULTS.lag);
	assert.deepEqual(hex.offset, [0, 0]);
	const dot = cascadeOptions({ cell: 'dot', lag: 0.2, idle: undefined });
	assert.equal(dot.fill, 'solid');
	assert.equal(dot.reactive, CELL_DEFAULTS.dot.reactive);
	assert.equal(dot.idle, CELL_DEFAULTS.dot.idle, 'undefined keeps the default');
	assert.equal(dot.lag, 0.2);
	assert.equal(cascadeOptions({ cell: /** @type {any} */ ('star') }).cell, 'hex');
	assert.equal(cascadeOptions({ fill: /** @type {any} */ ('dashed') }).fill, 'core');
	assert.equal(cascadeOptions({ direction: /** @type {any} */ ('sideways') }).direction, 'right');
	assert.deepEqual(cascadeOptions({ offset: [2, 3] }).offset, [2, 3]);
	assert.notDeepEqual(cascadeOptions({ offset: 1 }).offset, cascadeOptions({ offset: 2 }).offset);
});

test('cascadeLevel stays in 0–1, spreads across it, and is the same for the same input', () => {
	const levels = [];
	for (let a = -20; a < 20; a++) for (let b = 0; b < 40; b++) levels.push(cascadeLevel(a, b, 1, 3.7));
	assert.ok(levels.every((v) => v >= 0 && v <= 1));
	assert.ok(levels.some((v) => v === 0) && levels.some((v) => v > 0.95), 'idle and reactive cells both');
	const mean = levels.reduce((s, v) => s + v, 0) / levels.length;
	assert.ok(mean > 0.3 && mean < 0.65, `mean ${mean}`);
	assert.equal(cascadeLevel(3, 5, 0.8, 2), cascadeLevel(3, 5, 0.8, 2));
	assert.notEqual(cascadeLevel(3, 5, 0.8, 2), cascadeLevel(3, 5, 0.8, 2.5), 'it moves');
});

test('cascadeLevel cascades: one column on is the same level lag seconds later', () => {
	for (const lag of [0.06, 0.15]) {
		for (const [a, b, t] of [
			[0, 0, 1],
			[7, 12, 4.2],
			[-5, 30, 100],
		]) {
			const here = cascadeLevel(a, b, 0.3, t, { lag });
			const next = cascadeLevel(a, b + 1, 0.3, t + lag, { lag });
			assert.ok(Math.abs(here - next) < 1e-9, `${a}, ${b}, ${t}: ${here} vs ${next}`);
		}
	}
});

test('cascadeLevel: the tilt makes the low end busier and leaves the top half alone', () => {
	let low = 0;
	let flat = 0;
	for (let a = 0; a < 30; a++)
		for (let b = 0; b < 30; b++) {
			low += cascadeLevel(a, b, 0, 2, { tilt: 0.5 });
			flat += cascadeLevel(a, b, 0, 2, { tilt: 0 });
			assert.equal(cascadeLevel(a, b, 0.6, 2, { tilt: 0.5 }), cascadeLevel(a, b, 0.6, 2, { tilt: 0 }));
		}
	assert.ok(low > flat * 1.1, `${low} vs ${flat}`);
});

test('latticeOf: cols divide the width, pitch scales by the ratio, hexagon rows are √3⁄2 apart', () => {
	assert.deepEqual(latticeOf({ cols: 30 }, 660), { pitch: 22, rowHeight: 22 * (Math.sqrt(3) / 2) });
	assert.deepEqual(latticeOf({ cell: 'dot', pitch: 10 }, 999, 2), { pitch: 20, rowHeight: 20 });
	assert.equal(latticeOf({}, 100).pitch, CASCADE_DEFAULTS.pitch);
});

test('latticeCell finds the nearest centre: a cell centre maps to itself, odd hexagon rows sit half a cell on', () => {
	const pitch = 20;
	const rowH = pitch * (Math.sqrt(3) / 2);
	for (let row = -3; row <= 3; row++)
		for (let col = 0; col < 5; col++) {
			const shift = row % 2 === 0 ? 0 : 0.5;
			const x = (col + 0.5 + shift) * pitch;
			const y = row * rowH;
			const cell = latticeCell('hex', x + 1.2, y - 1.7, pitch);
			assert.deepEqual([cell.col, cell.row], [col, row], `${col}, ${row}`);
			assert.ok(Math.abs(cell.x - x) < 1e-9 && Math.abs(cell.y - y) < 1e-9);
		}
	// Every point's centre is no further than a hexagon's corner (the circumradius) away.
	const corner = pitch / Math.sqrt(3);
	for (let x = 0; x < 100; x += 1.7)
		for (let y = -50; y < 50; y += 1.3) {
			const c = latticeCell('hex', x, y, pitch);
			assert.ok(Math.hypot(x - c.x, y - c.y) <= corner + 1e-9, `${x}, ${y}`);
		}
	assert.deepEqual(latticeCell('dot', 25, 14, 10), { col: 2, row: 1, x: 25, y: 10 });
	assert.deepEqual(latticeCell('dot', 3, -6, 10), { col: 0, row: -1, x: 5, y: -10 });
});

test('cascadeCells lays the frame: every centre on the target, the same settings the same frame', () => {
	const cells = cascadeCells({ cols: 30 }, 330, 412, 2);
	assert.ok(cells.length > 30 * 40);
	assert.ok(cells.every((c) => c.x >= 0 && c.x <= 330 && c.y >= 0 && c.y <= 412 && c.level >= 0 && c.level <= 1));
	assert.ok(cells.some((c) => c.y === 206), 'a row on the middle line');
	assert.deepEqual(cascadeCells({ cols: 30 }, 330, 412, 2), cells);
	assert.notDeepEqual(cascadeCells({ cols: 30, offset: 4 }, 330, 412, 2), cells, 'offsets differ');
	assert.notDeepEqual(cascadeCells({ cols: 30 }, 330, 412, 3), cells, 'it moves');
	const dots = cascadeCells({ cell: 'dot', cols: 20 }, 200, 100);
	assert.equal(new Set(dots.map((c) => c.x)).size, 20);
});

test('cascadeCells keeps the quiet area calm and leaves the edges alone', () => {
	const loud = { cols: 30, range: /** @type {[number, number]} */ ([0, 0.3]) };
	const quiet = cascadeCells({ ...loud, quiet: { radius: 0.3, depth: 1 } }, 330, 412);
	const open = cascadeCells(loud, 330, 412);
	const middle = (/** @type {typeof open} */ cells) => cells.reduce((m, c) => (Math.hypot(c.x - 165, c.y - 206) < Math.hypot(m.x - 165, m.y - 206) ? c : m));
	assert.ok(middle(quiet).level < 0.01);
	assert.ok(middle(open).level > 0.5);
	assert.equal(quiet[0].level, open[0].level, 'a corner is untouched');
});

test('cascadeColors gives the idle and reactive colours, a palette its last and first', () => {
	assert.deepEqual(cascadeColors({}), ['#c9c9c9', '#97cd3a']);
	assert.deepEqual(cascadeColors({ colors: ['#111111', '#222222'] }), ['#111111', '#222222']);
	assert.deepEqual(cascadeColors({ palette: 'Uranium' }), ['#1b1b1b', '#aaff0b']);
});

test('cascadeStill draws the idle lattice over the ground, or only the ground when it cannot place it', () => {
	const hex = cascadeStill({ pitch: 10, background: '#0b0b0b', colors: ['#ffffff', '#c8ff00'] });
	assert.match(hex, /radial-gradient.*10px 17\.321px.*radial-gradient.*5px calc\(50% \+ 8\.66px\).*#0b0b0b$/);
	const dot = cascadeStill({ cell: 'dot', cols: 30, background: '#000000' }, 330);
	assert.match(dot, /^radial-gradient\(circle, #[0-9a-f]{6} .*0 50% \/ 11px 11px, #000000$/);
	assert.equal(cascadeStill({ cols: 30, background: '#000000' }), '#000000');
	assert.equal(cascadeStill({ cols: 30 }), 'transparent');
});
