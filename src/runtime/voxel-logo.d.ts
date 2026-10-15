import type { PaletteName } from './palettes.js';

export interface VoxelLogoConfig {
	/** A character or word to build in cubes. */
	text?: string;
	/** Its CSS font, without the size. Default: the page's, bold. */
	font?: string;
	/** An image (an SVG logo) to build instead. */
	src?: string;
	/** Where the solid sits, each 0–1 from the top left. Default the right half. */
	area?: { x: number; y: number; width: number; height: number };
	/** The ink, then the paper. Default mint on near-black. */
	colors?: string[];
	/** A shared palette by name (`PALETTES`, any case), when there are no `colors`. */
	palette?: PaletteName | (string & {});
	/** How large the solid is in its area (1 just fits when face-on). Default 1.3. */
	size?: number;
	/** Cubes across the shape. Default 28. */
	cells?: number;
	/** Cubes deep. Default 4. */
	depth?: number;
	/** The dither's pixel size, CSS px; 0 for smooth shading. Default 2. */
	dither?: number;
	/** Tracking markers ringing the solid (try 6); 0 for none. Default 0. */
	markers?: number;
	/** How far it rocks and turns towards the pointer. Default 1. */
	rock?: number;
}

/** Starts a voxel logo in `el`'s canvas. Returns a function that stops it. */
export function voxelLogo(el: HTMLElement, config: VoxelLogoConfig): () => void;
