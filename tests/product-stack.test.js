import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LAYOUTS, frontOf, layoutOf, poseFilter, poseTransform, stackBounds, stackPoses } from '../src/runtime/stack-poses.js';

test('layoutOf keeps the known layouts and falls back to fan', () => {
	for (const layout of LAYOUTS) assert.equal(layoutOf(layout), layout);
	assert.equal(layoutOf('spiral'), 'fan');
	assert.equal(layoutOf(undefined), 'fan');
});

test('frontOf is the middle of a fan or arc (the left of two in an arc) and the first of a stack', () => {
	assert.equal(frontOf('fan', 5), 2);
	assert.equal(frontOf('arc', 6), 2);
	assert.equal(frontOf('fan', 6), 2.5);
	assert.equal(frontOf('stack', 6), 0);
});

test('the front cover is nearest the viewer and in focus, in every layout', () => {
	for (const layout of LAYOUTS) {
		const poses = stackPoses(layout, 5);
		const front = frontOf(layout, 5);
		const nearest = poses.reduce((best, p, i) => (p.z > poses[best].z ? i : best), 0);
		assert.equal(nearest, front, layout);
		assert.equal(poses[front].blur, 0, layout);
		assert.ok(poses.every((p) => p.blur >= 0 && p.blur <= 1), layout);
		assert.equal(Math.max(...poses.map((p) => p.blur)), 1, layout);
	}
});

test('a fan is symmetric about its centre', () => {
	const poses = stackPoses('fan', 5);
	for (let i = 0; i < 2; i++) {
		assert.ok(Math.abs(poses[i].x + poses[4 - i].x) < 1e-9);
		assert.ok(Math.abs(poses[i].rz + poses[4 - i].rz) < 1e-9);
		assert.ok(Math.abs(poses[i].y - poses[4 - i].y) < 1e-9);
	}
});

test('a stack is centred in its box', () => {
	const xs = stackPoses('stack', 6).map((p) => p.x);
	assert.ok(Math.abs(Math.min(...xs) + Math.max(...xs)) < 1e-9);
});

test('opening moves the covers further apart', () => {
	for (const layout of LAYOUTS) {
		const width = (/** @type {{ x: number }[]} */ poses) => Math.max(...poses.map((p) => p.x)) - Math.min(...poses.map((p) => p.x));
		assert.ok(width(stackPoses(layout, 5, { open: true })) > width(stackPoses(layout, 5)), layout);
	}
});

test('a lifted cover comes in front, into focus, and pushes its neighbours aside', () => {
	for (const layout of LAYOUTS) {
		const open = stackPoses(layout, 5, { open: true });
		const lifted = stackPoses(layout, 5, { open: true, lifted: 1 });
		assert.ok(lifted.every((p, i) => i === 1 || p.z < lifted[1].z), layout);
		assert.equal(lifted[1].blur, 0, layout);
		assert.ok(lifted[1].s > 1, layout);
		if (layout !== 'stack') {
			assert.ok(lifted[0].x < open[0].x, `${layout}: the left neighbour moves left`);
			assert.ok(lifted[2].x > open[2].x, `${layout}: the right neighbour moves right`);
		}
	}
});

test('an even fan has one cover in front, and no two covers share a depth', () => {
	for (const layout of /** @type {const} */ (['fan', 'arc'])) {
		const zs = stackPoses(layout, 6).map((p) => p.z);
		assert.equal(zs.indexOf(Math.max(...zs)), 2, layout);
		assert.equal(new Set(zs.map((z) => z.toFixed(6))).size, 6, layout);
	}
});

test('a lifted index out of range lifts nothing', () => {
	assert.deepEqual(stackPoses('fan', 3, { lifted: 7 }), stackPoses('fan', 3));
	assert.deepEqual(stackPoses('fan', 0), []);
});

test('stackBounds holds the stack across at rest, open and with its front cover lifted, and down with any lifted', () => {
	for (const layout of LAYOUTS) {
		const { wide, tall } = stackBounds(layout, 6, 1, 1);
		for (const state of [{}, { open: true }, { open: true, lifted: Math.floor(frontOf(layout, 6)) }]) {
			for (const p of stackPoses(layout, 6, state)) {
				assert.ok(Math.abs(p.x) + 0.5 <= wide / 2, `${layout} fits across`);
				assert.ok(Math.abs(p.y) + 0.5 <= tall / 2, `${layout} fits down`);
			}
		}
		for (let lifted = 0; lifted < 6; lifted++) {
			for (const p of stackPoses(layout, 6, { open: true, lifted })) assert.ok(Math.abs(p.y) + 0.5 <= tall / 2, `${layout} fits down, ${lifted} lifted`);
		}
		assert.ok(stackBounds(layout, 6, 2).wide > wide, layout);
	}
	assert.ok(stackBounds('fan', 4, 1, 0.75).tall > stackBounds('fan', 4, 1, 1).tall, 'taller covers need a taller box');
});

test('poseTransform writes lengths in cover widths, with the same functions every time', () => {
	const css = poseTransform({ x: 0.5, y: -0.25, z: 0, rx: 4, ry: -26, rz: 0, s: 1, blur: 0 });
	assert.equal(css, 'translate3d(calc(var(--ps-w) * 0.5), calc(var(--ps-w) * -0.25), calc(var(--ps-w) * 0)) rotateY(-26deg) rotateX(4deg) rotateZ(0deg) scale(1)');
});

test('poseFilter leaves a sharp cover alone, and blurs only the furthest', () => {
	const sharp = { x: 0, y: 0, z: 0, rx: 0, ry: 0, rz: 0, s: 1, blur: 0 };
	assert.equal(poseFilter(sharp, 1), 'brightness(1) saturate(1) blur(0px)');
	assert.match(poseFilter({ ...sharp, blur: 0.3 }, 1), /blur\(0px\)$/);
	assert.match(poseFilter({ ...sharp, blur: 1 }, 1), /^brightness\(0\.45\).*blur\(1\.95px\)$/);
	assert.equal(poseFilter({ ...sharp, blur: 1 }, 0), 'brightness(1) saturate(1) blur(0px)');
});
