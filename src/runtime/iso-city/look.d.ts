import type { Rgb } from '../color.js';

/** The day defaults: buildings, parks, roads; the taxis; the ground. */
export const DAY: { colors: string[]; accent: string; background: string };
/** The night defaults. */
export const NIGHT: { colors: string[]; accent: string; background: string };
/** The cars that are not taxis. */
export const NEUTRALS: string[];

/** Every colour the city is drawn in. */
export interface Look {
	buildings: Rgb;
	roofs: Rgb;
	detail: Rgb;
	parks: Rgb;
	trees: Rgb[];
	trunk: Rgb;
	path: Rgb;
	water: Rgb;
	roads: Rgb;
	pavement: Rgb;
	marking: Rgb;
	lamp: Rgb;
	solar: Rgb;
	tints: Rgb[];
	background: Rgb;
	accent: Rgb;
	neutrals: Rgb[];
	person: Rgb;
	night: boolean;
}

/** The city's colours from its settings: three given, or a palette softened, or the defaults; the rest mixed from them in Oklab. */
export function cityLook(config: { colors?: string[]; palette?: string; accent?: string; background?: string; night?: boolean }): Look;
