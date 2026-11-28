import { test } from 'node:test';
import assert from 'node:assert/strict';

// just enough browser for the loop: an observer that marks everything near, frames that never fire on their own
globalThis.IntersectionObserver ??= class {
	constructor(cb) { this.cb = cb; }
	observe(el) { this.cb([{ target: el, isIntersecting: true }]); }
	unobserve() {}
};
globalThis.requestAnimationFrame ??= () => 1;
globalThis.cancelAnimationFrame ??= () => {};
globalThis.document ??= { hidden: false, addEventListener() {} };

const { animate, holdFrames, frameNow, track } = await import('../src/runtime/loop.js');

/** An element with children, as far as `contains` goes. */
const el = (parent) => {
	const e = { kids: new Set(), contains: (x) => x === e || [...e.kids].some((k) => k.contains(x)) };
	parent?.kids.add(e);
	return e;
};

/** A stateful effect: a simulation that accumulates its steps (like a drip), drawn from `now` and its state. */
function sim(node, log) {
	let x = 0;
	const start = frameNow();
	return animate(node, (now, dt) => {
		x += dt * (1 + x); // depends on every step taken
		log.push({ t: +(now - start).toFixed(3), x: +x.toFixed(9) });
	});
}

test('holdFrames: a held effect is drawn at exact times from 0, stepping 1/60 s, the same every run', () => {
	const runs = [];
	for (let run = 0; run < 2; run++) {
		const card = el(),
			canvasHost = el(card);
		const log = [];
		const hold = holdFrames(card, { ratio: 3 });
		const stop = sim(canvasHost, log); // started under the hold: its clock reads 0
		assert.equal(hold.count(), 1);
		hold.seek(0);
		hold.seek(100);
		hold.seek(1000 / 30); // behind: never stepped back
		hold.seek(250);
		runs.push(log);
		hold.release();
		stop();
	}
	assert.deepEqual(runs[0], runs[1]);
	assert.equal(runs[0][0].t, 0);
	assert.equal(runs[0].at(-1).t, 250);
	for (let i = 1; i < runs[0].length; i++) assert.ok(runs[0][i].t - runs[0][i - 1].t <= 1000 / 60 + 0.01);
});

test('holdFrames: frameNow is the held time while a hold is on, the real clock after; effects outside are left alone', () => {
	const card = el(),
		inside = el(card),
		outside = el();
	const hold = holdFrames(card);
	let outsideCalls = 0;
	const s1 = animate(outside, () => outsideCalls++);
	const s2 = animate(inside, () => {});
	assert.equal(hold.count(), 1, 'only the one inside is held');
	hold.seek(500);
	assert.equal(frameNow(), 500);
	assert.equal(outsideCalls, 0, 'seek draws only what it holds');
	hold.release();
	assert.ok(Math.abs(frameNow() - performance.now()) < 50);
	s1();
	s2();
});

test('holdFrames: the effect is told to draw at the export resolution while held, and given back after', () => {
	const card = el(),
		host = el(card);
	const calls = [];
	const stop = animate(host, () => {}, { hold: (on, ratio) => calls.push([on, ratio]) });
	const hold = holdFrames(card, { ratio: 4.05 });
	hold.release();
	assert.deepEqual(calls, [[true, 4.05], [false, 1]]);
	stop();
});

test('holdFrames: ready waits for an effect started again under the hold', async () => {
	const card = el(),
		host = el(card);
	const hold = holdFrames(card);
	setTimeout(() => animate(host, () => {}), 40);
	assert.equal(await hold.ready(1000), 1);
	hold.release();
	const none = holdFrames(el());
	await assert.rejects(none.ready(60));
	none.release();
});

test('loopPlan: the video starts after the kept head, and its tail fades into it, so the last frame leads into the first', async () => {
	const { loopPlan } = await import('../src/runtime/export/field-video.js');
	const total = 240,
		fade = 18;
	const plan = loopPlan(total, fade);
	assert.deepEqual(plan(0), { frame: fade, over: null }, 'frame 0 is the recording just after the head');
	assert.deepEqual(plan(total - fade - 1), { frame: total - 1, over: null });
	// the crossfade: recorded frames total…total+fade-1, each with head frame 0…fade-1 over it, rising
	let last = 0;
	for (let n = total - fade; n < total; n++) {
		const { frame, over } = plan(n);
		assert.equal(frame, n + fade);
		assert.equal(over.frame, n + fade - total);
		assert.ok(over.alpha > last && over.alpha < 1);
		last = over.alpha;
	}
	// the seam: the last video frame shows mostly head frame fade-1, and the first shows recorded frame fade, its neighbour
	assert.equal(plan(total - 1).over.frame + 1, plan(0).frame);
	assert.ok(plan(total - 1).over.alpha > 0.9);
	// no crossfade: the video is the recording, frame for frame
	assert.deepEqual(loopPlan(90, 0)(89), { frame: 89, over: null });
});

test('holdFrames: Math.random is seeded while a hold is on (the same grain every run) and the page’s own after', () => {
	const own = Math.random;
	const draw = () => {
		const h = holdFrames(el());
		const xs = [Math.random(), Math.random(), Math.random()];
		h.release();
		return xs;
	};
	const a = draw(),
		b = draw();
	assert.deepEqual(a, b);
	assert.ok(a.every((x) => x >= 0 && x < 1));
	assert.equal(Math.random, own);
});

test('holdFrames: ready() waits for the pictures effects are loading (track), so no run starts before one arrives', async () => {
	const root = el();
	const h = holdFrames(root);
	animate(root, () => {});
	let arrived = false;
	track(new Promise((r) => setTimeout(r, 120)).then(() => (arrived = true)));
	await h.ready(2000);
	assert.equal(arrived, true);
	h.release();
});
