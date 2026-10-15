export interface SignalLinesConfig {
	/** The lines' colour. Default `#aeaeb8`. */
	color?: string;
	/** The pulses' colour. Default `#fafafa`. */
	pulse?: string;
	/** How many lines. Default 7. */
	lines?: number;
	/** How tall the waves are. Default 1. */
	amplitude?: number;
	/** How fast they move. Default 1. */
	speed?: number;
	/** How often pulses run; 0 for none. Default 1. */
	pulses?: number;
	/** Grain on the strokes, 0–1. Default 0.5. */
	grain?: number;
}

export interface WaveBarsConfig {
	/** The bars' colour. Default `#aeaeb8`. */
	color?: string;
	/** Space between bars, CSS px. Default 8. */
	step?: number;
	/** A bar's width, CSS px. Default 3. */
	bar?: number;
	/** The tallest bar, a share of the height either side of the middle. Default 0.34. */
	height?: number;
	/** Seconds between retunes. Default 2. */
	every?: number;
	/** The band of light drifting across. Default true. */
	sweep?: boolean;
	/** Grain on the bars, 0–1. Default 0.4. */
	grain?: number;
}

/** Starts signal lines in `el`'s canvas. Returns a function that stops it. */
export function signalLines(el: HTMLElement, config: SignalLinesConfig): () => void;

/** Starts tuning wave bars in `el`'s canvas. Returns a function that stops it. */
export function waveBars(el: HTMLElement, config: WaveBarsConfig): () => void;
