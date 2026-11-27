/** Round lights, or six-bladed ones. */
export type BokehShape = 'round' | 'blades';

export interface PhotoBokehConfig {
	/** The photo (same origin, or served for CORS). */
	src: string;
	/** The widest blur, a share of the height. Default 0.03. */
	blur?: number;
	/** How fast the focus racks, cycles a second. Default 0.06. */
	rate?: number;
	/** How much the depth guess leans on the picture (its brightness and colour) against its height in the frame, 0–1. Default 0.55. */
	near?: number;
	/** Out-of-focus lights drifting through it (soft filled glows), up to 12; 0 for none. Default 6. */
	discs?: number;
	/** Their radius, a share of the height. Default 0.11. */
	size?: number;
	/** How bright they are. Default 0.35. */
	glow?: number;
	/** Round lights, or six-bladed ones. Default 'round'. */
	shape?: BokehShape;
	/** How fast they rise, heights a second. Default 0.02. */
	drift?: number;
	/** Darkening toward the edges; 0 for none. Default 0.35. */
	vignette?: number;
	/** Fine grain over all of it; 0 for none. Default 0.04. */
	grain?: number;
	/** Where the focus and the lights start, so two cards differ. Default 0. */
	seed?: number;
	/** Plays every clock faster or slower; 0 for one still frame. Default 1. */
	speed?: number;
	/** An area dimmed a little for copy: centre (0–1 from the top left), radius (share of the height), depth (0–1). */
	quiet?: { x?: number; y?: number; radius?: number; depth?: number } | null;
}

/** The settings' defaults, shared by the shader and the JS twin. */
export declare const BOKEH_DEFAULTS: Required<Omit<PhotoBokehConfig, 'src' | 'speed' | 'quiet'>>;

/** The most lights the shader draws. */
export declare const MAX_DISCS: number;

/** Where the plane of focus is at a time: a depth from 0 (far) to 1 (near). */
export declare function focusAt(config: Partial<PhotoBokehConfig>, t: number): number;

/** How soft a point at a depth is at a time: the blur's radius, a share of the height. */
export declare function blurAt(config: Partial<PhotoBokehConfig>, depth: number, t: number): number;

/** Where an out-of-focus light is at a time: its centre (0–1 of the frame) and radius (heights). */
export declare function discAt(config: Partial<PhotoBokehConfig>, i: number, t: number): { x: number; y: number; r: number };

/** The photo's brightest, most coloured pixels (from RGBA 0–255), lightened, for the lights' tints. */
export declare function highlightTints(rgba: ArrayLike<number>): [number, number, number][];

/** A CSS `background` that stands in before the shader starts and without WebGL: the photo, covering. */
export declare function photoBokehStill(config: Pick<PhotoBokehConfig, 'src'>): string;

/** Starts the rack focus on an element (its first canvas). Returns a function that stops it. */
export declare function photoBokeh(el: HTMLElement, config: PhotoBokehConfig): () => void;
