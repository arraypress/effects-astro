export interface MagneticConfig {
	/** How far it follows the pointer, a share of the pointer's distance from its centre. Default 0.3. */
	strength?: number;
	/** How far outside the element the pull starts, CSS px. Default 40. */
	reach?: number;
}

/** Makes an element lean towards a nearby pointer (`--magnet-x`, `--magnet-y`, and half that for its contents). Returns a function that stops it. */
export function magnetic(el: HTMLElement, config: MagneticConfig): () => void;
