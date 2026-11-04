import { test } from 'node:test';
import assert from 'node:assert/strict';
import { COLORS, nebulaField, galaxyRamp, nebulaPixels } from '../src/runtime/galaxy.js';

test('nebulaField gives a value a pixel, 0–1, the same for the same seed', () => {
	const field = nebulaField(80, 45, 7);
	assert.equal(field.length, 80 * 45);
	assert.ok(field.every((v) => v >= 0 && v <= 1));
	assert.deepEqual(nebulaField(80, 45, 7), field, 'the same seed, the same nebula');
	assert.notDeepEqual(nebulaField(80, 45, 8), field);
	// Not flat: clouds and darker gaps both.
	const min = Math.min(...field);
	const max = Math.max(...field);
	assert.ok(max - min > 0.3, `spread ${min}–${max}`);
});

test('nebulaField tiles: its noise wraps, so the first column follows on from the last', () => {
	const w = 64;
	const field = nebulaField(w, 32, 3);
	let seam = 0;
	let inner = 0;
	for (let y = 0; y < 32; y++) {
		seam += Math.abs(field[y * w] - field[y * w + w - 1]);
		inner += Math.abs(field[y * w + 31] - field[y * w + 32]);
	}
	assert.ok(seam < inner * 3 + 0.5, `seam ${seam} vs inner ${inner}`);
});

test('galaxyRamp runs from near-black through the colours to a pale top', () => {
	const ramp = galaxyRamp(COLORS, 256);
	assert.equal(ramp.length, 256 * 3);
	const at = (i) => [ramp[i * 3], ramp[i * 3 + 1], ramp[i * 3 + 2]];
	assert.ok(at(0).every((v) => v < 60), `dark start ${at(0)}`);
	assert.deepEqual(at(255), [245, 240, 255]);
	// The colours sit at their stops: deep, the four colours, pale is six stops over 255 steps.
	const blue = at(Math.round((255 / 5) * 1));
	assert.ok(Math.abs(blue[0] - 0x3a) < 6 && Math.abs(blue[2] - 0xd9) < 6, `first colour ${blue}`);
	assert.throws(() => galaxyRamp(['tomato']), TypeError);
	assert.deepEqual(galaxyRamp([]), galaxyRamp(COLORS), 'no colours, the default');
});

test('nebulaPixels paints each value along the ramp, opaque', () => {
	const ramp = galaxyRamp(['#ff0000', '#00ff00'], 3);
	const px = nebulaPixels(Float32Array.from([0, 0.5, 1]), ramp);
	assert.equal(px.length, 12);
	assert.deepEqual([...px.slice(8, 12)], [245, 240, 255, 255]);
	assert.deepEqual([...px.slice(4, 8)], [ramp[3], ramp[4], ramp[5], 255]);
	assert.ok([3, 7, 11].every((i) => px[i] === 255));
});
