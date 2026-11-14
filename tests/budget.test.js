import { test } from 'node:test';
import assert from 'node:assert/strict';
import { budget } from '../src/runtime/budget.js';

/**
 * Something to run that keeps a log of its starts and stops.
 *
 * @param {string[]} log The log.
 * @param {string} name What it is called in the log.
 * @returns {() => () => void} Starts it; returns how to stop it.
 */
const runner = (log, name) => () => {
	log.push(`start ${name}`);
	return () => log.push(`stop ${name}`);
};

test('budget: runs up to its cap at once, the rest in the order they asked', () => {
	const take = budget(2);
	/** @type {string[]} */
	const log = [];
	const [a, b, c, d] = [{}, {}, {}, {}];
	const giveA = take(a, runner(log, 'a'));
	take(b, runner(log, 'b'));
	take(c, runner(log, 'c'));
	take(d, runner(log, 'd'));
	assert.deepEqual(log, ['start a', 'start b']);
	giveA();
	assert.deepEqual(log, ['start a', 'start b', 'stop a', 'start c'], 'the longest-waiting starts as one stops');
});

test('budget: a waiting one that gives its turn back leaves the queue, never starting', () => {
	const take = budget(1);
	/** @type {string[]} */
	const log = [];
	const [a, b, c] = [{}, {}, {}];
	const giveA = take(a, runner(log, 'a'));
	const giveB = take(b, runner(log, 'b'));
	take(c, runner(log, 'c'));
	giveB();
	giveA();
	assert.deepEqual(log, ['start a', 'stop a', 'start c']);
});

test('budget: giving a turn back twice is harmless', () => {
	const take = budget(1);
	/** @type {string[]} */
	const log = [];
	const give = take({}, runner(log, 'a'));
	give();
	give();
	assert.deepEqual(log, ['start a', 'stop a']);
	take({}, runner(log, 'b'));
	assert.deepEqual(log, ['start a', 'stop a', 'start b'], 'the turn is free again');
});
