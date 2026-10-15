export interface CursorConfig {
	/** How quickly the ring catches up, 0–1 (1 is no trail). Default 0.18. */
	ease?: number;
	/** What makes the ring swell. Default `a, button, [data-cursor]`. */
	targets?: string;
}

/** Starts the custom cursor in `el` (holding `.dot`, `.ring`, `.label`). Returns a function that stops it. */
export function cursor(el: HTMLElement, config: CursorConfig): () => void;
