export interface FlutedGlassConfig {
	/** The blooms' colours, the one that follows the pointer first. Default indigo, violet, pink. */
	colors?: string[];
	/** The ground behind the glass. Default `#f4f4f5`. */
	background?: string;
	/** The flutes' slant, degrees from vertical. Default -35. */
	angle?: number;
	/** Flutes across the longer side. Default 9. */
	frequency?: number;
	/** 0: flat flutes with sharp seams; 1: a gentle curve all across. Default 0.5. */
	softness?: number;
	/** How hard each flute bends what is behind it. Default 1.5. */
	refraction?: number;
	/** How far the colours part at the seams; 0 for none. Default 0.6. */
	dispersion?: number;
	/** The highlight along each flute; 0 for none. Default 0.35. */
	highlight?: number;
	/** How strong the blooms are. Default 1. */
	bloom?: number;
}

/** Starts fluted glass in `el`'s canvas. Returns a function that stops it. */
export function flutedGlass(el: HTMLElement, config: FlutedGlassConfig): () => void;
