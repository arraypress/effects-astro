/** True on a phone or tablet: a coarse pointer on a screen no longer than 1366 CSS px. */
export function isMobileGpu(): boolean;

/**
 * The pixel ratio to draw at: the device's own, capped at 2 on a desktop and
 * 1.5 on a phone or tablet, times `scale`.
 */
export function pixelRatio(scale?: number): number;

/** True with prefers-reduced-motion: reduce. */
export function prefersReducedMotion(): boolean;

/** True with a fine, hovering pointer (a mouse or trackpad). */
export function canHover(): boolean;
