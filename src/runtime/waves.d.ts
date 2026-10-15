import type { PaletteName } from './palettes.js';
import type { AudioSource } from './audio.js';

export interface SignalLinesConfig {
	/** One colour for every line. Default: the `colors` gradient. */
	color?: string;
	/** Colours the lines run through from left to right, blended in Oklab. Default sea-glass, ice and pale gold. */
	colors?: string[];
	/** A shared palette by name (`PALETTES`, any case), when there are no `colors` or `color`. */
	palette?: PaletteName | (string & {});
	/** The pulses' colour. Default `#fafafa`. */
	pulse?: string;
	/** How many lines, 2–12. Default 7. */
	lines?: number;
	/** How tall the waves are. Default 1. */
	amplitude?: number;
	/** How fast they move. Default 1. */
	speed?: number;
	/** How often pulses run; 0 for none. Default 1. */
	pulses?: number;
	/** How much light the lines and pulses give off, 0–2. Default 1. */
	glow?: number;
	/** Film grain in the light, 0–1. Default 0.5. */
	grain?: number;
	/** How far out of focus the back lines are, and how much their colours fringe; 0 for all sharp. Default 1. */
	depth?: number;
	/** How far the lines part round the pointer and how much it lights them; 0 for not at all. Default 1. */
	bend?: number;
	/** Follow the sound playing: `'page'` for whatever plays, or a CSS selector for an `<audio>`/`<video>` or a player's container (a WaveformPlayer). The lines carry its waveform, as tall as it is loud, and kicks send pulses; while nothing plays they keep their own motion. Default none. */
	audio?: AudioSource;
	/** An area where the light dims (behind a headline): centre x/y (0–1, from the top left), radius (a share of the height) and depth (0 none, 1 dark). Default none. */
	quiet?: { x?: number; y?: number; radius?: number; depth?: number } | null;
}

export interface WaveBarsConfig {
	/** One colour for every bar. Default: the `colors` gradient. */
	color?: string;
	/** Colours the bars run through from left to right, blended in Oklab. Default teal, ice and apricot. */
	colors?: string[];
	/** A shared palette by name (`PALETTES`, any case), when there are no `colors` or `color`. */
	palette?: PaletteName | (string & {});
	/** Space between bars, CSS px. Default 8. */
	step?: number;
	/** A bar's width, CSS px. Default 3. */
	bar?: number;
	/** The tallest bar, a share of the height either side of the middle. Default 0.34. */
	height?: number;
	/** Seconds between retunes. Default 2. */
	every?: number;
	/** The playhead sweeping across, lighting the bars it plays. Default true. */
	sweep?: boolean;
	/** Film grain in the light, 0–1. Default 0.4. */
	grain?: number;
	/** Peak marks over the bars that hold, then drop, as a meter's do. Default true. */
	peaks?: boolean;
	/** How much light the bars and playhead give off, 0–2. Default 1. */
	glow?: number;
	/** How much the bars under the pointer rise and light; 0 for not at all. Default 1. */
	scrub?: number;
	/** Follow the sound playing: `'page'` for whatever plays, or a CSS selector for an `<audio>`/`<video>` or a player's container (a WaveformPlayer). The bars show its spectrum (bass in the middle) and the playhead follows the track; while nothing plays they keep their own motion. Default none. */
	audio?: AudioSource;
	/** An area where the light dims (behind a headline): centre x/y (0–1, from the top left), radius (a share of the height) and depth (0 none, 1 dark). Default none. */
	quiet?: { x?: number; y?: number; radius?: number; depth?: number } | null;
}

/** Starts signal lines in `el`'s canvas (WebGL; the canvas is removed without it). Returns a function that stops it. */
export function signalLines(el: HTMLElement, config: SignalLinesConfig): () => void;

/** Starts tuning wave bars in `el`'s canvas (WebGL; the canvas is removed without it). Returns a function that stops it. */
export function waveBars(el: HTMLElement, config: WaveBarsConfig): () => void;
