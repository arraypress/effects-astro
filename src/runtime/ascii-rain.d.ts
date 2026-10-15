import type { PaletteName } from './palettes.js';

export interface AsciiRainConfig {
	/** Three CSS hex colours the glyphs take, the brightest nearly white. Default a cool cyan and green. */
	colors?: string[];
	/** A shared palette by name (`PALETTES`, any case), when there are no `colors`. */
	palette?: PaletteName | (string & {});
	/** How often rows jump sideways for a moment, their colours splitting wider; 0 for never. Default 1. */
	glitch?: number;
	/** A character set (`data`: hollow and solid bars; `bars`, `ascii`, `blocks`, `binary`, `boxes`) or the characters, darkest first. Default `data`. */
	glyphs?: string;
	/** A character cell's height in CSS px. Default 14. */
	cell?: number;
	/** A cell's width over its height. Default 1 for `data`, 0.6 for type. */
	aspect?: number;
	/** Which way the streaks run, degrees: 0 rightwards, 90 down, 180 left, 270 up. Default 0. */
	angle?: number;
	/** Streak lanes across the surface. Default 40. */
	lines?: number;
	/** A streak's length, a share of the gap between them (0–1). Default 0.3. */
	trail?: number;
	/** How many lanes have a streak at any time, 0–1. Default 0.7. */
	density?: number;
	/** A lane's streak width, a share of the lane (0–1). Default 0.9. */
	width?: number;
	/** A still cloud of data, or streaks running on a rippling surface. Default `cloud`. */
	pattern?: 'cloud' | 'waves';
	/** How fast it moves: the rows stream, or the streaks run; 0 for one still frame. Default 1. */
	speed?: number;
	/** How much each lane's speed differs, 0–1. Default 0.6. */
	variance?: number;
	/** How tall the surface's waves are; 0 for flat. Default 1. */
	ripple?: number;
	/** How close together the waves are. Default 1. */
	waves?: number;
	/** How far the surface leans back, degrees (0 face-on, 80 nearly edge-on). Default 58. */
	tilt?: number;
	/** How much of the surface fills the frame (larger is closer). Default 1. */
	zoom?: number;
	/** How strongly the waves are lit and shaded; 0 for flat. Default 1. */
	lighting?: number;
	/** How far blue bleeds left and red right of each glyph, CSS px; 0 for none. Default 3. */
	aberration?: number;
	/** With `waves`, whether the pointer ripples the surface and a click drops a ring. Default true. */
	interactive?: boolean;
	/** An area kept clear: centre (0–1 from the top left), radius (share of the height), depth (0–1). */
	quiet?: { x?: number; y?: number; radius?: number; depth?: number } | null;
	/** The font the glyphs are drawn in. Default a monospace stack. */
	font?: string;
}

/** Starts ASCII rain in `el`'s canvas (transparent where there is none). Returns a function that stops it. */
export function asciiRain(el: HTMLElement, config: AsciiRainConfig): () => void;
