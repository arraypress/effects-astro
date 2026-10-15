/** The layouts, the first the default. */
export const LAYOUTS: readonly ['fan', 'stack', 'arc'];

/** How the covers are laid out: a hand of cards, a deck seen at an angle, or a carousel arc. */
export type Layout = 'fan' | 'stack' | 'arc';

/** Where one cover sits. Lengths are in cover widths. */
export interface Pose {
	/** Across; right is positive. */
	x: number;
	/** Down. */
	y: number;
	/** Towards the viewer. */
	z: number;
	/** Turn about the horizontal axis, degrees. */
	rx: number;
	/** Turn about the vertical axis, degrees. */
	ry: number;
	/** Turn in the plane, degrees. */
	rz: number;
	/** Scale. */
	s: number;
	/** How far out of focus, 0 sharp to 1 the furthest. */
	blur: number;
}

/** The state a stack is in. */
export interface PoseState {
	/** How far apart the covers sit, 0–2. Default 1. */
	spread?: number;
	/** Whether the covers are fanned apart. Default false. */
	open?: boolean;
	/** The cover lifted forward; -1 for none. Default -1. */
	lifted?: number;
}

/** A known layout, or `fan`. */
export function layoutOf(layout: unknown): Layout;

/** The cover in front when none is lifted: the middle one in a fan (half way between two when the count is even) or an arc (the left of two), the first in a stack. */
export function frontOf(layout: Layout, n: number): number;

/** Every cover's pose: placed, centred, and given how far it is out of focus. */
export function stackPoses(layout: Layout, n: number, state?: PoseState): Pose[];

/** The room the stack needs at its widest (open, any cover lifted), in cover widths. */
export function stackBounds(layout: Layout, n: number, spread?: number, ratio?: number): { wide: number; tall: number };

/** A pose as a CSS transform, in `--ps-w` (the cover's width); the same functions every time, so it eases. */
export function poseTransform(pose: Pose): string;

/** A pose's depth of field as a CSS filter (brightness, saturation, a little blur on the furthest), at a strength of 0–1. */
export function poseFilter(pose: Pose, depth: number): string;
