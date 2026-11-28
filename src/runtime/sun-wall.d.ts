type Quiet = { x?: number; y?: number; radius?: number; depth?: number } | null;

/** Blinds or a prism's spectrum. */
export type SunWallMode = 'blinds' | 'prism';

export interface SunWallConfig {
	/** Blinds or a prism's spectrum. Default 'blinds'. */
	mode?: SunWallMode;
	/** The wall's paint. Default '#cdb89d'. */
	wall?: string;
	/** The sunlight's colour. Default '#ffe2b0'. */
	sun?: string;
	/** How strong the sun is. Default 1. */
	exposure?: number;
	/** How lit the wall is in shade, 0–1. Default 0.34. */
	ambient?: number;
	/** Which way the light falls across the wall, degrees from upright. Default -24. */
	angle?: number;
	/** How many bars in the patch (blinds). Default 11. */
	slats?: number;
	/** How much of each bar's pitch lets light through, 0–1 (blinds). Default 0.55. */
	open?: number;
	/** How much the bars and the patch soften with distance, 0–1. Default 0.6. */
	soft?: number;
	/** The light patch's centre, 0–1 from the top left. Default [0.5, 0.48]. */
	patch?: [number, number];
	/** The patch's width and height, shares of the card's. Default [0.62, 0.72]. */
	size?: [number, number];
	/** The spectrum's width, a share of the height (prism). Default 0.065. */
	band?: number;
	/** How much the spectrum bows (prism). Default 0.05. */
	bow?: number;
	/** How far the light creeps, a share of the height. Default 0.05. */
	drift?: number;
	/** How fast it creeps, cycles a second. Default 0.06. */
	rate?: number;
	/** Fine grain; 0 for none. Default 0.03. */
	grain?: number;
	/** Where its creeping starts. Default 0. */
	seed?: number;
	/** Plays every clock faster or slower; 0 for one still frame. Default 1. */
	speed?: number;
	/** An area dimmed: centre (0–1), radius (share of the height), depth (0–1). */
	quiet?: Quiet;
}

export declare const SUN_MODES: readonly SunWallMode[];
export declare const SUN_DEFAULTS: Required<Omit<SunWallConfig, 'speed' | 'quiet'>>;
export declare function spectrumRgb(x: number): [number, number, number];
export declare function blindsAt(config: SunWallConfig, x: number, y: number, aspect: number, time?: number): number;
export declare function sunWallStill(config: SunWallConfig): string;
export declare function sunWall(el: HTMLElement, config: SunWallConfig): () => void;
