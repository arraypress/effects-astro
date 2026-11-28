/** Turns sharing on (or off) for stages started from now on: they draw in one hidden WebGL context and copy each frame into their own canvas. Off by default. */
export function shareContexts(on?: boolean): void;
/** Whether new stages share the one context. */
export function sharingContexts(): boolean;
/** The most a side of the hidden canvas grows to. */
export const HOST_MAX: number;
/** A tracked view of a context: the state its caller sets and the resources it makes are remembered. */
export function trackGL(gl: any): {
	gl: any;
	state: object;
	/** The context put back to its defaults. */
	reset(): void;
	/** This view's state laid on again. */
	replay(): void;
	/** This view's resources deleted. */
	dispose(): void;
};
/** A stage's place in the shared context, or null without WebGL (or when its canvas has a WebGL context already). */
export function sharedPlace(canvas: HTMLCanvasElement): {
	gl: any;
	begin(w: number, h: number): void;
	opaque(): void;
	end(w: number, h: number): void;
	dispose(): void;
} | null;
