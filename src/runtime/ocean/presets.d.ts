/** A time of day for the ocean. */
export type OceanTime = 'dawn' | 'noon' | 'sunset' | 'night';

/** A time of day's sun, sky and water. Colours are CSS hex. */
export interface OceanLook {
	time: OceanTime;
	/** Where the sun sits across the frame, 0–1 from the left (beyond it, off to the side). */
	x: number;
	/** Its height above the horizon, degrees. */
	elevation: number;
	/** Its apparent radius, radians. */
	size: number;
	/** The colour of its light on the water. */
	light: string;
	/** How strong that light is. */
	power: number;
	/** The sky overhead. */
	zenith: string;
	/** The sky along the horizon, and the haze. */
	horizon: string;
	/** The glow round the sun. */
	glow: string;
	/** The deep water's own colour. */
	deep: string;
	/** The colour light takes through a thin crest. */
	scatter: string;
	/** The clouds' shaded side. */
	cloud: string;
	/** How far, in metres, the air takes to hide the sea. */
	haze: number;
	/** The camera's exposure. */
	exposure: number;
	/** How bright the stars are, 0 for none. */
	stars: number;
}

/** The times of day. */
export const OCEAN_TIMES: Readonly<Record<OceanTime, OceanLook>>;

/** The default time of day: `sunset`. */
export const OCEAN_TIME: OceanTime;

/** Moves a colour's hue and chroma towards a tint's in Oklab (`amount` 0–1, default 0.6), keeping its lightness. Throws a TypeError for a colour that is not hex. */
export function tintColor(color: string, tint: string, amount?: number): string;

/**
 * A time of day (default `sunset`; an unknown one is warned about),
 * tinted by `colors` or `palette`: the first tints the sky, the second the
 * water, the third the light, each keeping its lightness.
 */
export function oceanLook(config: { time?: string; colors?: string[]; palette?: string }): OceanLook;

/** The scene as a CSS `background` for a browser without WebGL; `horizon` 0–1 up the frame (default 0.3). */
export function oceanBackdrop(look: OceanLook, horizon?: number): string;
