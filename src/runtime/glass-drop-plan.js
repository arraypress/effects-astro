/**
 * @module @arraypress/effects-astro/glass-drop-plan
 *
 * GlassDrop's plan, apart from its shader so it can be tested and so a page
 * can lay a still of the resting mark exactly where the effect leaves it:
 * where the glass and the mark sit (`dropLayout`), and what the sequence
 * is doing at a moment (`dropAt`): a drop of liquid glass forms, spreads
 * into a tile (or into the mark's own shape) with the mark rising under it,
 * holds, then melts away and leaves the mark flat on the ground. On a loop,
 * each round starts from the resting mark, which fades as the drop forms, so
 * a page can show the resting mark as the effect's still and the effect
 * takes over from it without a jump.
 */

/** The sequence's parts, in seconds at speed 1: the drop forming, spreading into its shape, and melting away. */
export const DROP_PHASES = Object.freeze({ form: 0.7, spread: 1.3, melt: 1.1 });

/** The drop's radius when it lands, a share of the tile's edge. */
export const DROP_SIZE = 0.17;

/** The settings the plan reads, with their defaults. */
const DEFAULTS = { size: 0.7, markScale: 0.62, restScale: 1, hold: 2.4, loopDelay: 1.6, loop: false, rest: 'flat', delay: 0, speed: 1 };

/**
 * @typedef {object} DropLayout
 * @property {{ x: number, y: number }} centre The glass's middle, each 0–1 from the top left.
 * @property {number} tile The tile's edge, a share of the element's height.
 * @property {number} mark The mark's box under the glass, a share of the height.
 * @property {number} rest The mark's box at rest, a share of the height.
 */

/**
 * Where the glass and the mark sit in an element: the tile is a square
 * `size` of the area's shorter side, centred in it; the mark's box is
 * `markScale` of the tile under the glass, and `restScale` times that once
 * the glass has gone. A square box holds the whole image (an SVG logo's
 * viewBox), so a still drawn in the same box lines up exactly.
 *
 * @param {{ area?: { x: number, y: number, width: number, height: number }, size?: number, markScale?: number, restScale?: number }} config The settings.
 * @param {number} aspect The element's width over its height.
 * @returns {DropLayout} The layout.
 */
export function dropLayout(config, aspect) {
	const area = config.area ?? { x: 0, y: 0, width: 1, height: 1 };
	const size = config.size ?? DEFAULTS.size;
	const markScale = config.markScale ?? DEFAULTS.markScale;
	const restScale = config.restScale ?? DEFAULTS.restScale;
	const tile = Math.min(area.width * aspect, area.height) * size;
	return {
		centre: { x: area.x + area.width / 2, y: area.y + area.height / 2 },
		tile,
		mark: tile * markScale,
		rest: tile * markScale * restScale,
	};
}

/**
 * @typedef {object} DropState
 * @property {number} drop How far the drop has formed, 0–1 (its radius is `drop × DROP_SIZE` of the tile).
 * @property {number} morph From the drop (0) to the tile or mark (1); it overshoots a little as the glass settles.
 * @property {number} wobble How much the glass's edge still ripples, 0–1.
 * @property {number} ripple Seconds since the drop landed (the rings on the ground), or −1 before.
 * @property {number} markIn How far the mark has risen under the glass, 0–1.
 * @property {number} glass How much glass there is, 1 whole to 0 melted.
 * @property {number} scale The mark's size, 1 under the glass to `restScale` at rest.
 * @property {boolean} done Whether the sequence has finished and nothing more moves.
 */

/** Hermite ease, 0–1. */
const ease = (x) => {
	const t = Math.min(1, Math.max(0, x));
	return t * t * (3 - 2 * t);
};

/**
 * The cycle's length in seconds at speed 1: the sequence, then the rest
 * before it plays again (none when it does not loop).
 *
 * @param {{ hold?: number, loopDelay?: number, loop?: boolean, rest?: 'flat' | 'glass' }} config The settings.
 * @returns {number} Seconds.
 */
export function dropCycle(config) {
	const hold = config.hold ?? DEFAULTS.hold;
	if ((config.rest ?? DEFAULTS.rest) === 'glass') return DROP_PHASES.form + DROP_PHASES.spread;
	const end = DROP_PHASES.form + DROP_PHASES.spread + hold + DROP_PHASES.melt;
	return (config.loop ?? DEFAULTS.loop) ? end + (config.loopDelay ?? DEFAULTS.loopDelay) : end;
}

/**
 * What the sequence is doing at a moment. `Infinity` gives the final state:
 * the mark flat at its rest size (or, with `rest: 'glass'`, the glass held).
 *
 * @param {number} seconds Seconds since it started, before `delay` and `speed` are applied.
 * @param {{ hold?: number, loopDelay?: number, loop?: boolean, rest?: 'flat' | 'glass', delay?: number, speed?: number, restScale?: number, form?: 'tile' | 'mark' }} config The settings.
 * @returns {DropState} The state.
 */
export function dropAt(seconds, config) {
	const hold = config.hold ?? DEFAULTS.hold;
	const restScale = config.restScale ?? DEFAULTS.restScale;
	const keep = (config.rest ?? DEFAULTS.rest) === 'glass';
	const looping = !keep && (config.loop ?? DEFAULTS.loop);
	const speed = Math.max(0.05, config.speed ?? DEFAULTS.speed);
	let t = (seconds - (config.delay ?? DEFAULTS.delay)) * speed;
	const cycle = dropCycle(config);
	if (!Number.isFinite(t)) t = keep ? cycle : cycle + hold + DROP_PHASES.melt + 1;
	else if (looping && t > 0) t %= cycle;
	const { form, spread, melt } = DROP_PHASES;
	const glassOnly = (config.form ?? 'tile') === 'mark';

	const drop = t <= 0 ? 0 : t >= form ? 1 : 1 - (1 - t / form) ** 3;
	const u = (t - form) / spread;
	// A damped spring from the drop to the shape: past it a little, then settling, landing on exactly 1.
	const spring = u <= 0 ? 0 : 1 - Math.exp(-5 * u) * Math.cos(9 * u);
	const morph = u <= 0 ? 0 : u >= 1 ? 1 : spring + (1 - spring) * ease((u - 0.75) / 0.25);
	const wobble = t <= 0 ? 0 : u <= 0 ? Math.min(1, t / form) * 0.6 : u >= 1 ? 0 : Math.exp(-4 * u);
	const ripple = t >= form ? t - form : -1;
	const markIn = glassOnly ? 0 : ease((u - 0.2) / 0.6);
	const v = keep ? 0 : ease((t - form - spread - hold) / melt);
	const end = form + spread + (keep ? 0 : hold + melt);
	// On a loop every round starts from where the last one rested: the flat mark, fading as the new drop forms.
	if (looping && t < form)
		return { drop, morph, wobble, ripple, markIn: 1 - drop, glass: 1, scale: restScale, done: false };
	return {
		drop,
		morph,
		wobble,
		ripple,
		markIn: glassOnly ? v : markIn,
		glass: 1 - v,
		scale: 1 + (restScale - 1) * v,
		done: !looping && t >= end + 2,
	};
}
