/** Where the light is, and the quiet area, as the other fields take them. */
type Quiet = { x?: number; y?: number; radius?: number; depth?: number } | null;

export interface LensFlareConfig {
	/** The ground, painted everywhere. Default '#030406'. */
	background?: string;
	/** The streak's colour (the lens coating's): blue for the classic, amber or teal for others. Default '#4f8dff'. */
	streak?: string;
	/** The ghosts' main tint; they also take the streak's and a green one. Default '#ffb36b'. */
	ghost?: string;
	/** The ground's glow round the source. Default the streak's, deep. */
	haze?: string;
	/** Where the light is, 0–1 from the top left. Default [0.24, 0.32]. */
	source?: [number, number];
	/** How long the streak reaches each way, in widths. Default 1.6. */
	length?: number;
	/** The streak's half-height, a share of the height. Default 0.006. */
	width?: number;
	/** How bright it all is. Default 1. */
	power?: number;
	/** How many ghosts, 0–6. Default 5. */
	ghosts?: number;
	/** How far the source wanders, a share of the height. Default 0.06. */
	drift?: number;
	/** How fast it wanders, cycles a second. Default 0.05. */
	rate?: number;
	/** How much the source flickers. Default 0.04. */
	flicker?: number;
	/** Fine grain; 0 for none. Default 0.035. */
	grain?: number;
	/** Where its wandering starts. Default 0. */
	seed?: number;
	/** Plays every clock faster or slower; 0 for one still frame. Default 1. */
	speed?: number;
	/** An area dimmed: centre (0–1), radius (share of the height), depth (0–1). */
	quiet?: Quiet;
}

export declare const FLARE_DEFAULTS: Required<Omit<LensFlareConfig, 'haze' | 'speed' | 'quiet'>>;
export declare const MAX_GHOSTS: number;
export declare function flareSource(config: LensFlareConfig, aspect: number, time?: number): [number, number];
export declare function flareGhosts(config: LensFlareConfig, aspect: number, time?: number): { x: number; y: number; radius: number }[];
export declare function streakAt(config: LensFlareConfig, x: number, y: number, aspect: number, time?: number): number;
export declare function flareStill(config: LensFlareConfig): string;
export declare function lensFlare(el: HTMLElement, config: LensFlareConfig): () => void;
