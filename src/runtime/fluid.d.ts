import type { Rgb } from './color.js';

export interface FluidOptions {
	/** Swirl kept alive between strokes (vorticity confinement). Default 28. */
	curl?: number;
	/** How fast motion dies away, per second. Default 0.25. */
	velocityFade?: number;
	/** How fast the dye fades, per second. Default 0.55. */
	inkFade?: number;
	/** How much the dye spreads and softens as it moves, 0–1. Default 0. */
	diffusion?: number;
}

export interface Fluid {
	/**
	 * Pushes the fluid at (x, y) (0–1 across, 0–1 up) by (dx, dy), in
	 * velocity-grid cells a second, and adds `dye` ([0, 0, 0] for none).
	 * `radius` is a share of the height (default 0.0025).
	 */
	splat(x: number, y: number, dx: number, dy: number, dye: Rgb, radius?: number): void;
	/** Moves the fluid on by `dt` seconds. */
	step(dt: number): void;
	/** Binds the dye and the velocity to texture units for another shader. */
	bind(dyeUnit: number, velocityUnit: number): void;
	/** The target's width over height, so splats stay round. */
	resize(aspect: number): void;
}

/** A Stable Fluids solve on a WebGL 2 context; null where half-float targets cannot be drawn to. */
export function createFluid(gl: WebGL2RenderingContext, options?: FluidOptions): Fluid | null;

export interface StirOptions {
	/** The ink's palette, looped through as it is laid. */
	colors: Rgb[];
	/** How hard the pointer pushes the fluid. Default 1. */
	force?: number;
	/** How much ink a stroke leaves, 0 for none. Default 0.16. */
	trail?: number;
	/** Whether a click or tap drops a bloom of ink. Default true. */
	drops?: boolean;
	/** The size of a stroke's splats and of a drop, 1 as standard. */
	radius?: number;
	/** Clicks on these are theirs, not the fluid's. Default: links, buttons, form fields and `[data-effect-ignore]`. */
	ignore?: string;
}

/**
 * Connects a fluid to the pointer over `el`. Call `update(dt)` each frame
 * before `fluid.step`; `setColors` changes the ink; `destroy` stops listening.
 */
export function stir(fluid: Fluid, el: HTMLElement, options: StirOptions): {
	update(dt: number): void;
	setColors(colors: Rgb[]): void;
	destroy(): void;
};
