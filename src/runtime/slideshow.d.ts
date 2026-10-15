/** A slide number brought into range, wrapping round at either end. */
export function wrap(i: number, count: number): number;

/** Which way a finished drag goes: 1 for the next slide (a swipe left), -1 for the previous, 0 for no swipe. */
export function swipeStep(dx: number, dy: number, ms: number): -1 | 0 | 1;

export interface SlideshowOptions {
	/** How many slides there are. */
	count: number;
	/** Seconds each slide stays before the next, when playing. Default 5. */
	interval?: number;
	/** Move on by itself. Default true. */
	autoplay?: boolean;
	/** What to read out for a slide (its alt). */
	describe?(index: number): string;
	/** Draws the change; the slideshow waits for it, keeping the latest asked for meanwhile. */
	show(to: number, from: number, dir: 1 | -1): Promise<void> | void;
}

/**
 * Runs a slideshow on an element: moving on every `interval` (held while
 * hovered, focused, pressed, off screen or in a hidden tab), the arrow keys
 * and a swipe, `[data-slide-dot]` buttons (with `aria-current` and a
 * `--slide-progress` while playing), and `[data-slide-live]` reading out the slide
 * a person moved to.
 */
export function slideshow(el: HTMLElement, options: SlideshowOptions): { go(to: number, dir?: 1 | -1, user?: boolean): void; stop(): void };
