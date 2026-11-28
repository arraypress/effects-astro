type Quiet = { x?: number; y?: number; radius?: number; depth?: number } | null;

/** Which planet: the Earth (textured from NASA imagery), a dusty red planet, a grey moon or a banded gas giant. */
export type PlanetKind = 'earth' | 'mars' | 'moon' | 'giant';

export interface PlanetConfig {
	/** Which planet. Default 'earth'. */
	kind?: PlanetKind;
	/** The Earth's day map (equirectangular, same origin). */
	day?: string;
	/** The Earth's night lights (red) and water mask (green), the same size as `day`. */
	aux?: string;
	/** Where the limb crosses the middle of the frame, 0–1 from the top. Default 0.8. */
	horizon?: number;
	/** How strongly the horizon curves (the camera's height). Default 1. */
	curve?: number;
	/** Where along the horizon the sun rises, 0–1 from the left. Default 0.5. */
	sunX?: number;
	/** The horizon's roll, degrees. Default 0. */
	tilt?: number;
	/** The atmosphere's colour far from the sun. Default '#5b9bff'. */
	air?: string;
	/** Its colour beside the sun. Default '#ffd9a8'. */
	glow?: string;
	/** The flare's streak. Default '#7aa6ff'. */
	streak?: string;
	/** The flare's ghosts' main tint. Default '#ffb36b'. */
	ghost?: string;
	/** How strong the flare is; 0 for none. Default 1. */
	flare?: number;
	/** How bright the night side's city lights are. Default 1. */
	lights?: number;
	/** Seconds before the picture repeats. Default 96. */
	period?: number;
	/** Sunrises a period. Default 1. */
	rises?: number;
	/** Degrees of longitude the planet turns in a period. Default 6. */
	spin?: number;
	/** The longitude facing the camera at time 0. Default -40. */
	longitude?: number;
	/** The latitude the camera looks along. Default 18. */
	latitude?: number;
	/** How high the sun climbs over the limb, heights of the frame. Default 0.05. */
	rise?: number;
	/** Where in its cycle the sun starts (0 hidden, 0.22 cresting, 0.5 highest). Default 0.22. */
	phase?: number;
	/** Fine grain; 0 for none. Default 0.025. */
	grain?: number;
	/** For the noise planets' patterns. Default 0. */
	seed?: number;
	/** Plays every clock faster or slower; 0 for one still frame. Default 1. */
	speed?: number;
	/** An area dimmed. */
	quiet?: Quiet;
}

export declare const PLANET_DEFAULTS: Required<Omit<PlanetConfig, 'day' | 'aux' | 'speed' | 'quiet'>>;
export declare function planetPeriod(config: PlanetConfig): number;
export declare function sunLift(config: PlanetConfig, time?: number): number;
export declare function sunPlace(config: PlanetConfig, aspect: number, time?: number): { x: number; y: number; lift: number };
/** The point the flare's ghosts line up through (heights from the middle, y down): beside the lockup, not through it. */
export declare function ghostCentre(config: { seed: number }, aspect: number, sun: { x: number; y: number }): [number, number];
export declare function planetStill(config: PlanetConfig): string;
export declare function planet(el: HTMLElement, config: PlanetConfig): () => void;
