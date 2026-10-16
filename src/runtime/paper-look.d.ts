import type { PaperConfig } from './paper.js';
import type { PaletteName } from './palettes.js';
import type { PaperLookName } from './paper-looks.js';

/** What every Paper look takes besides its own props (src/runtime/paper-looks.js). */
export interface PaperLookOptions {
	/** A shared palette by name (`PALETTES`, any case), when there are no `colors`. */
	palette?: PaletteName | (string & {});
	/** Dims it towards its `background` behind the copy: the centre (`x` across, `y` down, 0–1), the `radius` (of the height) and the `depth`, 0–1. Default none. */
	quiet?: { x?: number; y?: number; radius?: number; depth?: number };
}

/** A Paper look and its props: the shared ones and its own, each over its preset's setting. */
export interface PaperLookConfig extends PaperLookOptions {
	/** The look. */
	look: PaperLookName;
	/** One of its shader's presets, by name, to start from. Default the look's. */
	preset?: string;
	/** Its colours. */
	colors?: string[];
	/** The colour behind it. */
	background?: string;
	/** How fast it moves (0 holds). */
	speed?: number;
	/** How large it is drawn. */
	zoom?: number;
	/** Its turn, degrees. */
	rotation?: number;
	/** Where its centre sits, `[x, y]`, -1–1. */
	offset?: [number, number];
	/** The look's own props. */
	[prop: string]: unknown;
}

/** A look's props as a Paper shader's config: its shader, preset and settings. Throws for an unknown look. */
export function paperLookSettings(config: PaperLookConfig): PaperConfig;

/** The CSS mask that dims a canvas behind copy, sized in the element's height. */
export function quietMask(quiet: NonNullable<PaperLookOptions['quiet']>): string;

/** Starts a Paper look in `el`'s canvas. Returns a function that stops it. */
export function paperLook(el: HTMLElement, config: PaperLookConfig): () => void;
