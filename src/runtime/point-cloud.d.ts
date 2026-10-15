import type { PaletteName } from './palettes.js';

export interface PointCloudConfig {
	/** The word drawn in dots. */
	text?: string;
	/** Its CSS font, without the size. Default: the page's, bold. */
	font?: string;
	/** An image (an SVG logo) to draw in dots instead. */
	src?: string;
	/** Where the word sits, each 0–1 from the top left. Default across the middle. */
	area?: { x: number; y: number; width: number; height: number };
	/** The word's dots, then the clouds' low and high colours. Default white, deep blue, sky blue. */
	colors?: string[];
	/** A shared palette by name (`PALETTES`, any case), when there are no `colors`. */
	palette?: PaletteName | (string & {});
	/** The ground. Default `#020205`. */
	background?: string;
	/** Dots across the word's grid. Default 110. */
	columns?: number;
	/** A word dot's size, a share of the grid's spacing. Default 0.72. */
	dot?: number;
	/** How many sheets of point cloud. Default 9. */
	sheets?: number;
	/** A cloud point's size, CSS px. Default 2.2. */
	pointSize?: number;
	/** Tracker boxes locking onto the word, a detector's debug look (try 4); 0 for none. Default 0. */
	trackers?: number;
	/** How far the scene tilts towards the pointer. Default 1. */
	tilt?: number;
}

/** Starts a point cloud in `el`'s canvas. Returns a function that stops it. */
export function pointCloud(el: HTMLElement, config: PointCloudConfig): () => void;
