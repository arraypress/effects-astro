/** Cities a route can name, as [degrees north, degrees east]. */
export const CITIES: Record<
	| 'amsterdam' | 'auckland' | 'bangkok' | 'berlin' | 'buenos-aires' | 'cairo' | 'cape-town' | 'chicago'
	| 'dubai' | 'dublin' | 'edinburgh' | 'hong-kong' | 'istanbul' | 'jakarta' | 'lagos' | 'london'
	| 'los-angeles' | 'madrid' | 'mexico-city' | 'mumbai' | 'nairobi' | 'new-york' | 'paris' | 'san-francisco'
	| 'sao-paulo' | 'seoul' | 'shanghai' | 'singapore' | 'stockholm' | 'sydney' | 'tokyo' | 'toronto',
	[number, number]
>;

/** A city's key, or [degrees north, degrees east]. */
export type Place = keyof typeof CITIES | [number, number];

export interface WorldRoutesConfig {
	/** The routes, each from a place to a place. Default ten routes round the world. */
	routes?: [Place, Place][];
	/** The routes' colour. Default `#38bdf8`. */
	color?: string;
	/** The land dots' colour. Default `#ffffff`. */
	land?: string;
	/** The land dots' opacity. Default 0.18. */
	landOpacity?: number;
	/** Space between land dots, CSS px. Default 7. */
	pitch?: number;
	/** A land dot's radius, CSS px. Default 1.4. */
	dot?: number;
	/** Seconds a comet takes along a route. Default 3.2. */
	lap?: number;
	/** How high the arcs bow, a share of their length. Default 0.3. */
	lift?: number;
}

/** Starts a dotted world map with comets running between cities in `el`'s canvas. Returns a function that stops it. */
export function worldRoutes(el: HTMLElement, config: WorldRoutesConfig): () => void;
