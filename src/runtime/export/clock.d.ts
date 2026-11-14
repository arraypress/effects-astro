import type { Moved } from './snapshot.js';

/** The animations under an element, held. */
export interface Clock {
	/** How many animations it holds. */
	readonly count: number;
	/** Sets every animation to `ms` from its start. */
	seek(ms: number): void;
	/** What the animations move: each element (or pseudo-element) and its animated properties. */
	moved(): Moved[];
	/** Lets the animations run on from where they were. */
	release(): void;
}

/** A keyframe's property in CSS's own spelling (`backgroundColor` is `background-color`; a custom property as it is). */
export function cssProperty(p: string): string;

/** The properties a set of keyframes (from `getKeyframes()`) animates, in CSS's spelling. */
export function keyframeProps(keyframes: object[]): Set<string>;

/** What to read again for an element: `'all'` once anything animates a custom property (or keyframes name nothing), else the properties so far and these. */
export function mergeProps(before: string[] | 'all', props: Set<string>): string[] | 'all';

/** Pauses the CSS animations under `root` (and on it) to step them by hand; `release()` lets them run on. */
export function clock(root: Element): Clock;
