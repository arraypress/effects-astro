/** The sequence's parts, in seconds at speed 1: the drop forming, spreading into its shape, and melting away. */
export declare const DROP_PHASES: Readonly<{ form: number; spread: number; melt: number }>;

/** The drop's radius when it lands, a share of the tile's edge. */
export declare const DROP_SIZE: number;

export interface DropLayout {
	/** The glass's middle, each 0–1 from the top left. */
	centre: { x: number; y: number };
	/** The tile's edge, a share of the element's height. */
	tile: number;
	/** The mark's box under the glass, a share of the height. */
	mark: number;
	/** The mark's box at rest, a share of the height. */
	rest: number;
}

export interface DropState {
	/** How far the drop has formed, 0–1. */
	drop: number;
	/** From the drop (0) to the tile or mark (1); it overshoots a little as the glass settles. */
	morph: number;
	/** How much the glass's edge still ripples, 0–1. */
	wobble: number;
	/** Seconds since the drop landed, or −1 before. */
	ripple: number;
	/** How far the mark has risen under the glass (or, as the logo's own glass melts, come through flat), 0–1. */
	markIn: number;
	/** How much glass there is, 1 whole to 0 melted. */
	glass: number;
	/** The mark's size, 1 under the glass to `restScale` at rest. */
	scale: number;
	/** Whether the sequence has finished and nothing more moves. */
	done: boolean;
}

/** The settings the plan reads. */
export interface DropPlanConfig {
	area?: { x: number; y: number; width: number; height: number };
	size?: number;
	markScale?: number;
	restScale?: number;
	hold?: number;
	loopDelay?: number;
	loop?: boolean;
	rest?: 'flat' | 'glass';
	delay?: number;
	speed?: number;
	form?: 'tile' | 'mark';
}

/** Where the glass and the mark sit in an element (`aspect`, its width over its height): a square tile `size` of the area's shorter side, the mark's box `markScale` of it, `restScale` times that at rest. */
export declare function dropLayout(config: DropPlanConfig, aspect: number): DropLayout;

/** The cycle's length in seconds at speed 1: the sequence, then the rest before it plays again (none without `loop`). */
export declare function dropCycle(config: DropPlanConfig): number;

/** What the sequence is doing `seconds` after it started (`Infinity`: the final state). */
export declare function dropAt(seconds: number, config: DropPlanConfig): DropState;
