/** The loop and the video for `recordField`. */
export interface FieldVideoOptions {
	/** The loop's length in the effect's own time, seconds (an effect that declares its own exact loop is recorded for that, whole). */
	cycle: number;
	/** How much faster than the effect the video plays (it lasts `cycle / speed`). Default 1. */
	speed?: number;
	/** The crossfade that closes the loop, seconds of video. Default 0.6. */
	fade?: number;
	/** The video's width, px (its height follows the element's). */
	width: number;
	/** Frames a second. Default 30. */
	fps?: number;
	/** Starts the element's effect again, so the recording runs from a fresh start at time 0. */
	restart?: () => unknown;
	/**
	 * Draws on each finished frame, at `t` seconds of video: something that keeps its own time over the effect (an
	 * animated logo). Drawn after the crossfade, so only the effect fades into its start; it must loop by itself.
	 */
	over?: (t: number, canvas: HTMLCanvasElement) => void | Promise<void>;
	/** Called with the share done, 0–1. */
	progress?: (done: number) => void;
	/** Stops it. */
	signal?: AbortSignal;
}

/** Frames of a held effect under an element, each drawn with everything over and under it. */
export interface FieldFrames {
	readonly width: number;
	readonly height: number;
	/** The effect's own exact loop, seconds, when it declares one (`data-effect-cycle`); null otherwise. */
	readonly cycle: number | null;
	/** Steps the effect to frame `i`'s time and draws the element onto `canvas` (a new one by default). */
	frame(i: number, canvas?: HTMLCanvasElement): Promise<HTMLCanvasElement>;
	/** Gives the effect back to the page. */
	release(): void;
}

/** Holds the effect under `el`, starts it again (`restart`) and reads its frames at `width` px. */
export function fieldFrames(el: HTMLElement, options: { width: number; fps?: number; speed?: number; restart?: () => unknown }): Promise<FieldFrames>;

/**
 * A live effect and what sits on it as a seamless looping video (MP4, or WebM), from a fresh start at time 0; the loop
 * closed by a crossfade of its last `fade` seconds into its first.
 */
export function recordField(el: HTMLElement, options: FieldVideoOptions): Promise<{ blob: Blob; ext: string; type: string }>;

/**
 * Which recorded frame each video frame shows, for a loop closed by a crossfade of `fade` frames: the recorded frame,
 * and the kept frame laid over it at what opacity (none outside the crossfade).
 */
export function loopPlan(total: number, fade: number): (n: number) => { frame: number; over: { frame: number; alpha: number } | null };
