export interface LightFieldConfig {
	/** The light's three colours, as CSS hex. */
	colors: string[];
	/** The caustic bands' colour. Default a warm white, `#fff3c4`. */
	glint?: string;
	/** How fast the light moves. Default 1. */
	speed?: number;
	/** How strongly the pointer bends the light; 0 for not at all. Default 1. */
	lens?: number;
	/** Split the colours at the edges. Default true; always off on phones. */
	prism?: boolean;
	/** The fluid under the light: false for none, or its settings. Default true. */
	fluid?: boolean | { trail?: number; drops?: boolean; force?: number; fade?: number; diffusion?: number; radius?: number; curl?: number; ignore?: string };
	/** An area where the light dims: centre (0–1 from the top left), radius (share of the height), depth (0–1). */
	quiet?: { x?: number; y?: number; radius?: number; depth?: number } | null;
	/** How much the corners darken, 0–1. Default 0.45. */
	vignette?: number;
	/** Film grain. Default 0.035. */
	grain?: number;
	/** Share of the pixel ratio drawn at. Default 0.5. */
	scale?: number;
}

/** Starts a light field in `el`'s canvas. Returns a function that stops it. */
export function lightField(el: HTMLElement, config: LightFieldConfig): () => void;
