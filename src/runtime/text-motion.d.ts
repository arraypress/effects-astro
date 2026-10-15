export interface ScrambleConfig {
	/** What it scrambles through. Default letters, digits and a few symbols. */
	characters?: string;
	/** Seconds to resolve. Default 0.9. */
	duration?: number;
	/** Scramble again when the pointer comes over it. Default false. */
	hover?: boolean;
}

export interface TypewriterConfig {
	/** What it types, in turn. */
	phrases: string[];
	/** Milliseconds a character when typing. Default 55. */
	speed?: number;
	/** Milliseconds a finished phrase stays. Default 1600. */
	pause?: number;
	/** Start again after the last. Default true. */
	loop?: boolean;
}

export interface RevealConfig {
	/** How it arrives. Default `up`. */
	from?: 'up' | 'down' | 'left' | 'right' | 'fade' | 'zoom' | 'blur';
	/** Each word arrives on its own, one after another. Default false. */
	words?: boolean;
	/** Seconds between words. Default 0.06. */
	stagger?: number;
	/** Seconds before it starts. Default 0. */
	delay?: number;
	/** Only the first time it comes into view. Default true. */
	once?: boolean;
}

/** Resolves an element's text out of random characters when it comes into view. Returns a function that stops it. */
export function scramble(el: HTMLElement, config: ScrambleConfig): () => void;

/** Types phrases one after another into the element's `[data-typed]` child. Returns a function that stops it. */
export function typewriter(el: HTMLElement, config: TypewriterConfig): () => void;

/** Brings an element into place (`.is-revealed`) as it scrolls into view. Returns a function that stops it. */
export function reveal(el: HTMLElement, config: RevealConfig): () => void;
