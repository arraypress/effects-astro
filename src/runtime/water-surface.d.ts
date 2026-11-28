/** The light and the water's colours, a look's or overridden. */
export interface WaterLook {
	/** The water's colour in the troughs. */
	deep: string;
	/** The colour light takes scattering through thin crests. */
	scatter: string;
	/** The sky low down (the brightest part reflected on the waves' backs). */
	horizon: string;
	/** The sky high up. */
	zenith: string;
	/** The sun's (or the moon's) light. */
	sun: string;
	/** How bright the sun is. */
	power: number;
	/** The sun's height, degrees. */
	height: number;
	/** The filmic exposure. */
	exposure: number;
}

export type WaterLookName = 'dusk' | 'teal' | 'night' | 'golden' | 'ink';

export interface WaterSurfaceConfig {
	/** The light and the water. Default 'dusk'. */
	look?: WaterLookName;
	/** Overrides for the look's colours and light. */
	colors?: Partial<WaterLook>;
	/** The sea state: 0.5 a calm ripple, 1 a breeze, 1.6 choppy. Default 1.15. */
	waves?: number;
	/** Where the waves run, degrees: 180 towards the camera (crests across the frame), 90 across. Default 180. */
	wind?: number;
	/** How far the camera looks down, degrees (18–40). Default 20. */
	pitch?: number;
	/** Where the sun is, degrees left (−) or right (+) of straight ahead. Default −20. */
	sun?: number;
	/** Where the sharp band is, 0 the top of the frame to 1 the bottom. Default 0.5. */
	focus?: number;
	/** How shallow the focus is: 0 all sharp, 1 the reference's, 2 very soft. Default 1. */
	aperture?: number;
	/** How many tiny glints flash on the crests in focus. Default 1. */
	sparkle?: number;
	/** How strong the ring of ripples spreading from a point is; 0 for none. Default 1. */
	rings?: number;
	/** The seconds after which the water repeats exactly. Default 30. */
	loop?: number;
	/** Plays the clock faster or slower; 0 for one still frame. Default 1. */
	speed?: number;
	/** Fine grain; 0 for none. Default 0.022. */
	grain?: number;
	/** Picks the waves (and where the loop starts). Default 0. */
	seed?: number;
	/** An area dimmed behind copy. */
	quiet?: { x?: number; y?: number; radius?: number; depth?: number } | null;
}

export declare const WATER_LOOKS: Record<WaterLookName, WaterLook>;
export declare const WATER_DEFAULTS: Required<Omit<WaterSurfaceConfig, 'colors' | 'quiet' | 'rings'>>;
export declare const MAX_WAVES: number;
export declare const GEOMETRY_WAVES: number;
export declare function waterSettings(config?: WaterSurfaceConfig): Required<Omit<WaterSurfaceConfig, 'colors' | 'quiet' | 'rings'>> &
	WaterSurfaceConfig & { lookColors: WaterLook };
export declare function waterWaves(
	config?: WaterSurfaceConfig,
	count?: number,
): { dir: [number, number]; k: number; amp: number; omega: number; phase: number }[];
export declare function waterHeight(config: WaterSurfaceConfig, x: number, z: number, t: number): number;
export declare function ringOf(o: ReturnType<typeof waterSettings>): { x: number; z: number; omega: number; amp: number };
export declare function focusDistance(o: ReturnType<typeof waterSettings>): number;
export declare function sunDirection(o: ReturnType<typeof waterSettings>): [number, number, number];
export declare function waterStill(config?: WaterSurfaceConfig): string;
export declare function waterStillSvg(config?: WaterSurfaceConfig, id?: string): string;
export declare function waterTime(config: WaterSurfaceConfig, elapsedMs: number): number;
export declare function waterSurface(el: HTMLElement, config?: WaterSurfaceConfig): () => void;

/** Each wave's phase at a moment in the loop, wrapped to a turn, written into every other slot of `out`: worked out once a frame for the shader. */
export declare function wavePhases(waves: { omega: number; phase: number }[], time: number, loop: number, out?: Float32Array): Float32Array;
