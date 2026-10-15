/** A palette's name. */
export type PaletteName =
	| 'Lumetri'
	| 'Forest'
	| 'Cadmium'
	| 'Peacock'
	| 'Vermillion'
	| 'Barbie'
	| 'Uranium'
	| 'Azure'
	| 'Ruby'
	| 'Ultramarine'
	| 'Saffron'
	| 'Crimson'
	| 'Ember'
	| 'Lagoon'
	| 'Citrus'
	| 'Glacier'
	| 'Rosewater'
	| 'Mono';

/** A palette: three colours and a highlight. */
export interface Palette {
	/** Three colours, as CSS hex. */
	colors: [string, string, string];
	/** A highlight colour. */
	glint: string;
}

/** The palettes by name (Lumetri, Forest, Cadmium, Peacock, Vermillion, Barbie, Uranium, Azure, Ruby, Ultramarine, Saffron, Crimson, Ember, Lagoon, Citrus, Glacier, Rosewater, Mono), in the order a switcher should cycle them. */
export const PALETTES: Readonly<Record<PaletteName, Palette>>;

/** A palette by name, in any case; undefined when there is none by that name. */
export function findPalette(name: string | undefined): Palette | undefined;

/** An effect's colours: its own `colors`, else its `palette` shaped to what it takes, else `fallback`. */
export function pickColors(config: { colors?: string[]; palette?: string }, fallback: string[], shape?: (palette: Palette) => string[]): string[];
