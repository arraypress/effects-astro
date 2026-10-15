export type Vec3 = [number, number, number];

/** The camera over the sea: world space x right, y up, z ahead, metres. */
export interface OceanView {
	eye: Vec3;
	right: Vec3;
	up: Vec3;
	forward: Vec3;
	/** Focal length, in units of the frame's height. */
	focal: number;
	/** How far the lens is shifted, in units of the frame's height, to put the horizon in place. */
	shift: number;
	/** The frame's width over its height. */
	aspect: number;
}

/** The camera `height` metres above the sea, looking slightly down, its lens shifted so the horizon sits at `horizon` (0–1 up the frame). `x` and `lift` move it, in metres. */
export function oceanView(options: { height: number; horizon: number; aspect: number; x?: number; lift?: number }): OceanView;

/** Where a point on the frame (x 0–1 from the left, y 0–1 from the bottom) looks: a unit vector. */
export function viewRay(view: OceanView, x: number, y: number): Vec3;

/** The direction towards the sun: the look's place (`x` across, `elevation` degrees), or an override's point on the frame; kept just clear of the horizon. */
export function sunDirection(view: OceanView, horizon: number, look: { x: number; elevation: number }, override?: { x?: number; y?: number } | null): Vec3;
