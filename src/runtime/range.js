/**
 * @module @arraypress/effects-astro/range
 *
 * A range slider that shows how far along it is: keeps `--fill` (0–100%)
 * on the input for the filled part of the track, and writes the value,
 * formatted, into the `<output>` that names it in its `for`.
 */

import { numberFormat } from './number-format.js';

/**
 * Follows a range input.
 *
 * @param {HTMLElement} el The `<input type="range">`.
 * @param {import('./number-format.js').NumberStyle} config How to write the value.
 * @returns {() => void} Stops it.
 */
export function range(el, config) {
	const input = /** @type {HTMLInputElement} */ (el);
	const write = numberFormat(config);
	const output = input.id ? document.querySelector(`output[for~="${CSS.escape(input.id)}"]`) : null;

	/** Shows the current value. */
	const update = () => {
		const min = Number(input.min || 0);
		const max = Number(input.max || 100);
		const share = max > min ? (Number(input.value) - min) / (max - min) : 0;
		input.style.setProperty('--fill', `${(share * 100).toFixed(2)}%`);
		if (output) output.textContent = write(Number(input.value));
	};
	input.addEventListener('input', update);
	update();
	return () => input.removeEventListener('input', update);
}
