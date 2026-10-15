export interface SpotlightConfig {
	/** The light's radius, a share of the font size. Default 0.85. */
	radius?: number;
	/** How far outside the text (CSS px) the pointer still lights it. Default 40. */
	reach?: number;
}

/** Starts the spotlight on `el` (styled by SpotlightText.astro). Returns a function that stops it. */
export function spotlight(el: HTMLElement, config: SpotlightConfig): () => void;
