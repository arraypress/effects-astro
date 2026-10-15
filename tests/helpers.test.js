import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isLand, LAND } from '../src/runtime/world-land.js';
import { CITIES } from '../src/runtime/world-routes.js';

test('the land grid has every city on or beside land', () => {
	let cells = 0;
	LAND.runs.split(',').forEach((run) => (cells += parseInt(run, 36)));
	assert.equal(cells, LAND.cols * LAND.rows);
	assert.ok(!isLand(0, -30), 'mid-Atlantic is sea');
	for (const [name, [lat, lon]] of Object.entries(CITIES)) {
		const near = [-1.5, 0, 1.5].some((dy) => [-1.5, 0, 1.5].some((dx) => isLand(lat + dy, lon + dx)));
		assert.ok(near, name);
	}
});
