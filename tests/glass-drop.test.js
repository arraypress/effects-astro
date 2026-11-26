import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dropAt, dropCycle, dropLayout, DROP_PHASES } from '../src/runtime/glass-drop-plan.js';

const { form, spread, melt } = DROP_PHASES;

test('the drop forms, spreads with a little overshoot, and settles on exactly its shape', () => {
	const c = { hold: 2 };
	assert.equal(dropAt(0, c).drop, 0);
	assert.ok(dropAt(form / 2, c).drop > 0.5 && dropAt(form / 2, c).morph === 0);
	let peak = 0;
	for (let t = form; t < form + spread; t += 0.02) peak = Math.max(peak, dropAt(t, c).morph);
	assert.ok(peak > 1, `it overshoots (${peak})`);
	const set = dropAt(form + spread + 0.01, c);
	assert.equal(set.morph, 1);
	assert.equal(set.wobble, 0);
	assert.equal(set.glass, 1);
	assert.ok(set.markIn > 0.99);
});

test('nothing shows before it starts, even with a delay', () => {
	const s = dropAt(0.5, { delay: 1 });
	assert.equal(s.drop, 0);
	assert.equal(s.wobble, 0);
	assert.equal(s.ripple, -1);
});

test('it melts to the flat mark at its rest size, and the final state is that', () => {
	const c = { hold: 1, restScale: 1.3 };
	const end = dropAt(Infinity, c);
	assert.deepEqual([end.glass, end.markIn, end.scale, end.done], [0, 1, 1.3, true]);
	const mid = dropAt(form + spread + 1 + melt / 2, c);
	assert.ok(mid.glass > 0.2 && mid.glass < 0.8 && mid.scale > 1 && mid.scale < 1.3);
});

test('with rest: glass it holds the glass for good', () => {
	const end = dropAt(Infinity, { rest: 'glass', loop: true });
	assert.deepEqual([end.glass, end.scale, end.morph], [1, 1, 1]);
	assert.equal(dropAt(100, { rest: 'glass' }).glass, 1);
});

test('the logo-shaped glass lets the flat logo through only as it melts', () => {
	const c = { form: 'mark', hold: 1 };
	assert.equal(dropAt(form + spread + 0.5, c).markIn, 0);
	assert.equal(dropAt(Infinity, c).markIn, 1);
});

test('a loop plays again after its rest; without one it stays done', () => {
	const c = { hold: 1, loop: true, loopDelay: 1 };
	const cycle = dropCycle(c);
	assert.equal(cycle, form + spread + 1 + melt + 1);
	const [a, b] = [dropAt(0.3, c), dropAt(0.3 + cycle, c)];
	for (const k of ['drop', 'morph', 'wobble', 'glass']) assert.ok(Math.abs(a[k] - b[k]) < 1e-9, k);
	assert.equal(dropAt(cycle * 3 + 0.1, { hold: 1 }).glass, 0);
	assert.equal(dropAt(cycle * 3 + 0.1, { hold: 1 }).done, true);
});

test('speed shortens it', () => {
	const slow = dropAt(form * 0.5, { speed: 1 }).drop;
	const fast = dropAt(form * 0.5, { speed: 2 }).drop;
	assert.ok(fast > slow);
});

test('the layout: a square tile in the area, the mark inside it, bigger at rest', () => {
	const l = dropLayout({ area: { x: 0.1, y: 0.1, width: 0.8, height: 0.6 }, size: 0.5, markScale: 0.6, restScale: 1.5 }, 0.8);
	assert.deepEqual(l.centre, { x: 0.5, y: 0.4 });
	assert.ok(Math.abs(l.tile - 0.3) < 1e-9, 'half the shorter side (0.6 high, 0.64 wide)');
	assert.ok(Math.abs(l.mark - 0.18) < 1e-9 && Math.abs(l.rest - 0.27) < 1e-9);
});

test('on a loop each round starts from the resting mark, fading as the drop forms', () => {
	const c = { hold: 1, loop: true, restScale: 1.3, delay: 1 };
	const before = dropAt(0, c);
	assert.deepEqual([before.markIn, before.scale, before.drop], [1, 1.3, 0]);
	const forming = dropAt(1 + DROP_PHASES.form / 2, c);
	assert.ok(forming.markIn > 0 && forming.markIn < 0.5 && forming.scale === 1.3);
	assert.equal(dropAt(1 + DROP_PHASES.form, c).markIn, 0);
});
