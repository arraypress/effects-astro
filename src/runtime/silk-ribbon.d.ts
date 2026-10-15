import type { PaletteName } from './palettes.js';

export interface SilkRibbonConfig {
	/** The satin's colours, shaded from the darkest to the lightest whatever their order. Default hot pink, coral, peach. */
	colors?: string[];
	/** A shared palette by name (`PALETTES`, any case), when there are no `colors`. */
	palette?: PaletteName | (string & {});
	/** The ground around the ribbon. Default `#f6f4f1`. */
	background?: string;
	/** Where the ribbon runs. Default `right`. */
	side?: 'right' | 'left' | 'center';
	/** How tightly it turns along its length; 0 lies flat. Default 1. */
	twist?: number;
	/** How deep the folds along it are; 0 for flat satin. Default 1. */
	folds?: number;
	/** The soft out-of-focus glow behind it; 0 for none. Default 1. */
	glow?: number;
	/** How fast the folds move. Default 1. */
	speed?: number;
}

/** Starts a silk ribbon in `el`'s canvas. Returns a function that stops it. */
export function silkRibbon(el: HTMLElement, config: SilkRibbonConfig): () => void;
