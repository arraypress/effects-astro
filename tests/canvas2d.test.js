import { test } from 'node:test';
import assert from 'node:assert/strict';
import { claimCanvas } from '../src/runtime/canvas2d.js';

/**
 * A stand-in canvas: one kind of context for life, attributes, and a place among its siblings.
 *
 * @param {string | null} [claimed] The kind of context it already holds.
 * @returns {any} The canvas.
 */
function fakeCanvas(claimed = null) {
	const attrs = new Map();
	const canvas = {
		kind: claimed,
		parent: /** @type {any} */ (null),
		get attributes() {
			return [...attrs].map(([name, value]) => ({ name, value }));
		},
		setAttribute: (name, value) => attrs.set(name, String(value)),
		getAttribute: (name) => attrs.get(name) ?? null,
		getContext(kind) {
			if (canvas.kind && canvas.kind !== kind) return null;
			canvas.kind = kind;
			return { kind };
		},
		replaceWith(other) {
			const list = canvas.parent?.children;
			if (!list) return;
			list[list.indexOf(canvas)] = other;
			other.parent = canvas.parent;
			canvas.parent = null;
		},
		remove() {
			const list = canvas.parent?.children;
			if (list) list.splice(list.indexOf(canvas), 1);
			canvas.parent = null;
		},
	};
	return canvas;
}

/**
 * A stand-in element holding some canvases.
 *
 * @param {any[]} canvases Its children.
 * @returns {any} The element.
 */
function fakeElement(canvases) {
	const el = {
		children: canvases,
		querySelector: () => el.children[0] ?? null,
		append(child) {
			child.parent = el;
			el.children.push(child);
		},
	};
	for (const c of canvases) c.parent = el;
	return el;
}

globalThis.document = /** @type {any} */ ({ createElement: () => fakeCanvas() });

test("claimCanvas draws in the element's own canvas when it can", () => {
	const own = fakeCanvas();
	const el = fakeElement([own]);
	const { canvas, ctx, release } = claimCanvas(el);
	assert.equal(canvas, own);
	assert.deepEqual(ctx, { kind: '2d' });
	release();
	assert.deepEqual(el.children, [own]);
});

test('claimCanvas swaps a canvas claimed for WebGL for a 2D one, and puts it back', () => {
	const webgl = fakeCanvas('webgl2');
	webgl.setAttribute('class', 'stage-canvas');
	const el = fakeElement([webgl]);
	const { canvas, ctx, release } = claimCanvas(el);
	assert.notEqual(canvas, webgl);
	assert.deepEqual(ctx, { kind: '2d' });
	assert.equal(canvas.getAttribute('class'), 'stage-canvas', 'its attributes come too');
	assert.deepEqual(el.children, [canvas], 'in its place');
	release();
	assert.deepEqual(el.children, [webgl], 'the host canvas is back');
});

test('claimCanvas adds a canvas to an element with none, and takes it out again', () => {
	const el = fakeElement([]);
	const { canvas, ctx, release } = claimCanvas(el);
	assert.deepEqual(el.children, [canvas]);
	assert.deepEqual(ctx, { kind: '2d' });
	release();
	assert.deepEqual(el.children, []);
});
