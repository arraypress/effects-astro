import { test } from 'node:test';
import assert from 'node:assert/strict';
import { flareSource, flareGhosts, streakAt, flareStill, MAX_GHOSTS } from '../src/runtime/lens-flare.js';

test('the streak is a thin horizontal line through the source: bright along it, gone a little above or below', () => {
	const c = { source: [0.3, 0.4], drift: 0 };
	const [sx, sy] = flareSource(c, 0.8);
	assert.ok(streakAt(c, sx, sy, 0.8) > 0.99);
	assert.ok(streakAt(c, sx + 0.3, sy, 0.8) > 0.2, 'it reaches far along');
	assert.ok(streakAt(c, sx, sy + 0.05, 0.8) < 0.01, 'and is thin across');
	assert.ok(streakAt(c, sx + 0.6, sy, 0.8) < streakAt(c, sx + 0.2, sy, 0.8), 'falling off along its length');
});

test('the ghosts lie on the line from the source through the centre, and move the other way as the source drifts', () => {
	const c = { source: [0.2, 0.3], drift: 0.08, rate: 0.1 };
	const aspect = 0.8;
	const [sx, sy] = flareSource(c, aspect, 0);
	for (const g of flareGhosts(c, aspect, 0)) {
		const cross = (0.5 * aspect - sx) * (g.y - sy) - (0.5 - sy) * (g.x - sx);
		assert.ok(Math.abs(cross) < 1e-9);
	}
	const t1 = 2.5;
	const [sx1] = flareSource(c, aspect, t1);
	const far0 = flareGhosts(c, aspect, 0)[1].x,
		far1 = flareGhosts(c, aspect, t1)[1].x;
	assert.ok(Math.sign(sx1 - sx) === -Math.sign(far1 - far0), 'a ghost past the centre moves against the source');
	assert.equal(flareGhosts({ ghosts: 99 }, aspect).length, MAX_GHOSTS);
	assert.equal(flareGhosts({ ghosts: 0 }, aspect).length, 0);
});

test('a CSS-only still: the glow, the streak band, the ground', () => {
	const css = flareStill({ background: '#010203', source: [0.25, 0.3] });
	assert.doesNotMatch(css, /url\(|data:/);
	assert.match(css, /^radial-gradient\(circle at 25% 30%/);
	assert.match(css, /, #010203$/);
});
