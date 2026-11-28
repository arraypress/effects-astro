/** What an export may ask of an effect on the loop. */
export interface FrameHooks {
	/** Called when an export holds the effect (`on`, with the pixel ratio to draw at) and when it lets it go. */
	hold?: (on: boolean, ratio: number) => void;
}

/**
 * Registers a frame callback on the page's one animation loop, called while
 * `el` is within 128px of the viewport and the tab is showing. `dt` is the
 * seconds since the last frame (0 after a pause, at most 1/20). Returns a
 * function that unregisters it.
 */
export function animate(el: Element, frame: (now: number, dt: number) => void, hooks?: FrameHooks): () => void;

/** The time effects draw at, ms: `performance.now()`, or the held time while an export holds effects. */
export function frameNow(): number;

/** Effects held by an export (`holdFrames`). */
export interface HeldFrames {
	/** How many effects it holds now. */
	count(): number;
	/** Resolves (with the count) once it holds at least one effect; rejects after `timeout` ms (default 5000). */
	ready(timeout?: number): Promise<number>;
	/** Draws every held effect at `ms` from the hold's start (stepped forward 1/60 s at a time, never back). Synchronous. */
	seek(ms: number): void;
	/** Gives the effects back to the loop. */
	release(): void;
}

/**
 * Holds the effects under `root` for an export: the loop stops drawing them and `seek` draws them by hand at exact
 * times from 0, with `Math.random` seeded while held, so a recording is the same every time. `ratio`: the pixel ratio to
 * draw at while held; `seed`: the random's seed (default 1).
 */
/** Marks a load an effect waits on (a picture): a hold's `ready()` waits for it. Returns the same promise. */
export function track<T>(promise: Promise<T>): Promise<T>;

export function holdFrames(root: Element, options?: { ratio?: number; seed?: number }): HeldFrames;
