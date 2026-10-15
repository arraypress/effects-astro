/**
 * The heroes' own controls: a Paper hero's presets, a tag's code onto the
 * clipboard, the cursor demo's switch, and a ScrollReveal card's replay.
 * Which hero is on show is src/scripts/viewer.js; the customise panel is
 * src/scripts/panel.js.
 */

import { change, stateOf } from '../customise/state.js';

/**
 * Plays a revealed element's arrival again: hidden at once (no transition),
 * then shown, so it animates in as it did on arrival.
 *
 * @param {HTMLElement} el The element.
 */
const replay = (el) => {
	if (!el.classList.contains('is-visible')) return;
	el.style.transition = 'none';
	el.classList.remove('is-visible');
	void el.offsetWidth;
	el.style.transition = '';
	el.classList.add('is-visible');
};
// Hovering a ScrollReveal card in the demo plays its animation again.
document.querySelectorAll('[data-replay]').forEach((el) => el.addEventListener('pointerenter', () => replay(/** @type {HTMLElement} */ (el))));

document.addEventListener('click', (e) => {
	const target = /** @type {HTMLElement} */ (e.target);

	// A Paper preset: the effect starts again with it, and the tag says so.
	const chip = /** @type {HTMLButtonElement | null} */ (target.closest('[data-preset]'));
	if (chip) {
		const hero = /** @type {HTMLElement} */ (chip.closest('[data-hero]'));
		change(hero, { preset: chip.dataset.preset }, true);
		return;
	}

	// A tag's code: onto the clipboard.
	const code = /** @type {HTMLElement | null} */ (target.closest('[data-copy]'));
	if (code) {
		navigator.clipboard?.writeText(code.dataset.copy ?? '').then(() => {
			code.classList.add('is-copied');
			setTimeout(() => code.classList.remove('is-copied'), 1200);
		});
	}

	// The cursor demo: stamp the custom cursor in, or take it out.
	const cursor = /** @type {HTMLButtonElement | null} */ (target.closest('[data-cursor-toggle]'));
	if (cursor) {
		const slot = document.querySelector('[data-cursor-slot]');
		const template = /** @type {HTMLTemplateElement | null} */ (document.querySelector('[data-cursor-template]'));
		if (!slot || !template) return;
		const on = !slot.childElementCount;
		if (on) slot.append(template.content.cloneNode(true));
		else slot.replaceChildren();
		cursor.textContent = on ? 'Back to the normal pointer' : 'Try the custom cursor';
	}
});

// A Paper hero's preset chips follow its preset, however it changed (a chip, the panel's Reset).
document.addEventListener('customise:line', (e) => {
	const hero = /** @type {HTMLElement} */ (e.target);
	const preset = stateOf(hero)?.values.preset;
	hero.querySelectorAll('[data-preset]').forEach((c) => c.classList.toggle('is-on', /** @type {HTMLElement} */ (c).dataset.preset === preset));
});
