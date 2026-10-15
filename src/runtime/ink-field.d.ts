import type { PaletteName } from './palettes.js';
import type { AudioSource } from './audio.js';

export interface InkFieldConfig {
	/** One of the shared palettes (`PALETTES`, any case). Default `'Lumetri'`. */
	palette?: PaletteName | (string & {});
	/** Three colours as CSS hex, in place of the palette's (fewer are looped). Default the palette's. */
	colors?: string[];
	/** A glint colour, in place of the palette's (unused by the ink look). Default the palette's. */
	glint?: string;
	/** The pointer stirs the ink and the lamp follows it, on devices that hover. Default true. */
	interactive?: boolean;
	/** A press drops ink that blooms open (not on links, buttons or fields). Off by default: on a page-wide field, stray clicks would splash. Default false. */
	drops?: boolean;
	/** Where the lamp rests when the pointer is away, 0–1 from the top left. Default `{ x: 0.14, y: 0.14 }`. */
	lamp?: { x?: number; y?: number };
	/** Hold one frame of settled ink and never animate, as with reduced motion: for a field behind body copy. Default false. */
	still?: boolean;
	/** Share of the pixel ratio drawn at. Default 0.5. */
	scale?: number;
	/** Follow the sound playing: `'page'` for whatever plays, or a CSS selector for an `<audio>`/`<video>` or a player's container (a WaveformPlayer). Kicks stir the ink and it brightens with the beat; while nothing plays it keeps its own motion. Default none. */
	audio?: AudioSource;
}

/** The settings an ink field runs with: three colours (the palette's, or those given over it), a glint, the lamp's rest (0–1 from the top left) and the rest, defaults filled in. */
export function inkFieldSettings(config?: InkFieldConfig): {
	colors: string[];
	glint: string;
	lamp: { x: number; y: number };
	interactive: boolean;
	still: boolean;
	scale: number;
};

/** The CSS `background` that stands in without a float render target: the colours as still pools of light on the water's colour. */
export function inkFallback(colors: string[]): string;

/** Starts an ink field in `el`'s canvas. Returns a function that stops it. */
export function inkField(el: HTMLElement, config: InkFieldConfig): () => void;
