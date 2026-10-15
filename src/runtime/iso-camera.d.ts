export type Vec3 = [number, number, number];

/** True isometric elevation, about 35.26°: the three axes foreshorten equally. */
export const ISO_PITCH: number;

export interface IsoCameraOptions {
	/** The point at the middle of the view. Default the origin. */
	target?: Vec3;
	/** Heading the camera looks from, radians: 0 from +z, π/2 from +x. Default π/4. */
	yaw?: number;
	/** Elevation, radians: 0 level, π/2 straight down. Default ISO_PITCH. */
	pitch?: number;
	/** The world height the view spans, top to bottom. Default 10. */
	height?: number;
	/** The view's width over its height. Default 1. */
	aspect?: number;
	/** How far either side of the target, along the view, is kept. Default 100. */
	depth?: number;
	/** Moves the picture across the screen, in clip units. Default [0, 0]. */
	shift?: [number, number];
}

export interface IsoCamera {
	/** World to clip space, column-major (for `uniformMatrix4fv`). */
	matrix: Float32Array;
	/** The unit direction from the target towards the camera. */
	eye: Vec3;
	/** Where a world point lands, in clip space. */
	project(p: Vec3): [number, number, number];
	/** The world point at height `h` (default 0) under clip position x, y. */
	ground(x: number, y: number, h?: number): Vec3;
}

/** Makes an orthographic isometric camera (y-up world, WebGL clip space). */
export function isoCamera(options?: IsoCameraOptions): IsoCamera;
