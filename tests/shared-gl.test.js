import { test } from 'node:test';
import assert from 'node:assert/strict';
import { trackGL, shareContexts, sharingContexts } from '../src/runtime/shared-gl.js';

/** A fake context that records the calls made on it and keeps the state they set. */
function fakeGL() {
	const calls = [];
	const gl = {
		TEXTURE0: 33984, TEXTURE_2D: 3553, BLEND: 3042, DEPTH_TEST: 2929, CULL_FACE: 2884, SCISSOR_TEST: 3089, STENCIL_TEST: 2960,
		POLYGON_OFFSET_FILL: 32823, SAMPLE_ALPHA_TO_COVERAGE: 32926, ONE: 1, ZERO: 0, SRC_ALPHA: 770, ONE_MINUS_SRC_ALPHA: 771, FUNC_ADD: 32774,
		UNPACK_FLIP_Y_WEBGL: 37440, UNPACK_PREMULTIPLY_ALPHA_WEBGL: 37441, UNPACK_ALIGNMENT: 3317, FRAMEBUFFER: 36160,
		calls,
		enabled: new Set(),
		bound: new Map(),
		active: 33984,
		made: 0,
		deleted: [],
	};
	const log = (name) => (...args) => calls.push([name, ...args]);
	Object.assign(gl, {
		enable(c) { gl.enabled.add(c); calls.push(['enable', c]); },
		disable(c) { gl.enabled.delete(c); calls.push(['disable', c]); },
		blendFunc: log('blendFunc'),
		blendEquation: log('blendEquation'),
		depthMask: log('depthMask'),
		colorMask: log('colorMask'),
		pixelStorei: log('pixelStorei'),
		bindFramebuffer: log('bindFramebuffer'),
		activeTexture(u) { gl.active = u; calls.push(['activeTexture', u]); },
		bindTexture(t, x) { gl.bound.set(`${gl.active}:${t}`, x); calls.push(['bindTexture', t, x]); },
		createTexture() { return { id: ++gl.made }; },
		deleteTexture(x) { gl.deleted.push(x); },
		getExtension: () => null,
	});
	return gl;
}

test('a tracked view remembers its state and lays it on again after another changed it', () => {
	const gl = fakeGL();
	const a = trackGL(gl), b = trackGL(gl);
	const tex = a.gl.createTexture();
	a.gl.activeTexture(gl.TEXTURE0 + 2);
	a.gl.bindTexture(gl.TEXTURE_2D, tex);
	a.gl.enable(gl.BLEND);
	a.gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
	// another stage takes the context: defaults, then its own (nothing)
	b.reset();
	b.replay();
	assert.equal(gl.enabled.has(gl.BLEND), false, 'b draws without a\'s blending');
	b.gl.activeTexture(gl.TEXTURE0 + 2);
	b.gl.bindTexture(gl.TEXTURE_2D, null);
	// a's turn again
	a.reset();
	a.replay();
	assert.equal(gl.enabled.has(gl.BLEND), true, 'a\'s blending is back');
	assert.equal(gl.bound.get(`${gl.TEXTURE0 + 2}:${gl.TEXTURE_2D}`), tex, 'a\'s texture is bound on its unit again');
	assert.equal(gl.active, gl.TEXTURE0 + 2, 'and its active unit');
	assert.deepEqual(gl.calls.filter((c) => c[0] === 'blendFunc').at(-1), ['blendFunc', gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA]);
});

test('a tracked view deletes what it made when disposed, and only that', () => {
	const gl = fakeGL();
	const a = trackGL(gl), b = trackGL(gl);
	const t1 = a.gl.createTexture(), t2 = b.gl.createTexture();
	a.dispose();
	assert.deepEqual(gl.deleted, [t1]);
	assert.ok(!gl.deleted.includes(t2));
});

test('sharing is off by default and switches on for later stages', () => {
	assert.equal(sharingContexts(), false);
	shareContexts();
	assert.equal(sharingContexts(), true);
	shareContexts(false);
	assert.equal(sharingContexts(), false);
});
