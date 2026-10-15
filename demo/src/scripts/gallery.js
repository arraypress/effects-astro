/**
 * The gallery's behaviour: brings each hero's effect in as it nears the
 * screen and takes it out once it is well past, swaps a Paper hero's
 * preset, recolours an InkField hero's ink live, copies a tag's code, and
 * keeps the bar's readout on the hero in view. Effects start and stop
 * themselves as they are added and removed (mount() watches the page).
 */

import { setColors } from '@arraypress/effects-astro';
import { PALETTES } from '@arraypress/effects-astro/runtime/palettes';

const heroes = /** @type {HTMLElement[]} */ ([...document.querySelectorAll('[data-hero]')]);

/**
 * Puts a hero's effect into it, if it is not there already.
 *
 * @param {HTMLElement} hero The hero.
 */
const show = (hero) => {
	const live = hero.querySelector('[data-live]');
	const template = /** @type {HTMLTemplateElement | null} */ (hero.querySelector('[data-live-template]'));
	if (!live || !template || live.childElementCount) return;
	live.append(template.content.cloneNode(true));
	hero.classList.add('is-live');
};

/**
 * Takes a hero's effect out, which stops it and frees its GPU context.
 *
 * @param {HTMLElement} hero The hero.
 */
const hide = (hero) => {
	hero.querySelector('[data-live]')?.replaceChildren();
	hero.classList.remove('is-live');
};

/**
 * Changes a setting of the effect a hero stamps in, so the next stamp starts
 * with it.
 *
 * @param {HTMLElement} hero The hero.
 * @param {string} key The setting.
 * @param {string} value Its new value.
 * @returns {boolean} False when the hero has no effect to change.
 */
const configure = (hero, key, value) => {
	const template = /** @type {HTMLTemplateElement | null} */ (hero.querySelector('[data-live-template]'));
	const effect = /** @type {HTMLElement | null | undefined} */ (template?.content.querySelector('[data-effect-config]'));
	if (!effect) return false;
	effect.dataset.effectConfig = JSON.stringify({ ...JSON.parse(effect.dataset.effectConfig ?? '{}'), [key]: value });
	return true;
};

/**
 * Marks a hero's chip as the one on, and rewrites its tag's `key="…"`, so
 * the tag shows the line for what is on screen now.
 *
 * @param {HTMLElement} hero The hero.
 * @param {HTMLElement} chip The chip chosen.
 * @param {string} key The attribute in the tag's code.
 * @param {string} value Its new value.
 */
const choose = (hero, chip, key, value) => {
	hero.querySelectorAll('.chip').forEach((c) => c.classList.toggle('is-on', c === chip));
	const tag = /** @type {HTMLElement | null} */ (hero.querySelector('[data-copy]'));
	if (!tag) return;
	tag.dataset.copy = (tag.dataset.copy ?? '').replace(new RegExp(`${key}="[^"]*"`), `${key}="${value}"`);
	tag.textContent = tag.dataset.copy;
};

/**
 * Marks a hero's palette chip as the one on, and rewrites its tag for the
 * palette: its own colours (and glint) out, `palette="…"` in.
 *
 * @param {HTMLElement} hero The hero.
 * @param {HTMLElement} chip The chip chosen.
 * @param {string} name The palette's name.
 */
const paletteTag = (hero, chip, name) => {
	hero.querySelectorAll('[data-palette]').forEach((c) => c.classList.toggle('is-on', c === chip));
	const tag = /** @type {HTMLElement | null} */ (hero.querySelector('[data-copy]'));
	if (!tag) return;
	let code = (tag.dataset.copy ?? '').replace(/ colors=\{\[[^\]]*\]\}/, '').replace(/ glint="[^"]*"/, '');
	code = /palette="[^"]*"/.test(code) ? code.replace(/palette="[^"]*"/, `palette="${name}"`) : code.replace(/^(<\w+)/, `$1 palette="${name}"`);
	tag.dataset.copy = code;
	tag.textContent = code;
};

// Live from half a screen before it arrives to half a screen after it leaves.
const near = new IntersectionObserver(
	(entries) => entries.forEach((entry) => (entry.isIntersecting ? show(/** @type {HTMLElement} */ (entry.target)) : hide(/** @type {HTMLElement} */ (entry.target)))),
	{ rootMargin: '50% 0px' },
);
heroes.forEach((hero) => near.observe(hero));

// The readout: which hero is in the middle of the screen.
const readout = document.querySelector('[data-readout]');
const middle = new IntersectionObserver(
	(entries) => {
		const entry = entries.find((e) => e.isIntersecting);
		if (!entry) return;
		const hero = /** @type {HTMLElement} */ (entry.target);
		if (readout) readout.textContent = `${heroes.indexOf(hero) + 1} / ${heroes.length} · ${hero.dataset.name}`;
	},
	{ rootMargin: '-50% 0px -50% 0px' },
);
heroes.forEach((hero) => middle.observe(hero));

/**
 * Plays a revealed element's arrival again: hidden at once (no transition),
 * then shown, so it animates in as it did on scroll.
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

	// A Paper preset: rewrite the effect's settings, and stamp it again.
	const chip = /** @type {HTMLButtonElement | null} */ (target.closest('[data-preset]'));
	if (chip) {
		const hero = /** @type {HTMLElement} */ (chip.closest('[data-hero]'));
		const preset = chip.dataset.preset ?? '';
		if (!configure(hero, 'preset', preset)) return;
		choose(hero, chip, 'preset', preset);
		hide(hero);
		show(hero);
		return;
	}

	// A palette: the effect takes it in place of its own colours. Ink on
	// screen eases to it (setColors); anything else is stamped again in it.
	const swatch = /** @type {HTMLButtonElement | null} */ (target.closest('[data-palette]'));
	if (swatch) {
		const hero = /** @type {HTMLElement} */ (swatch.closest('[data-hero]'));
		const name = /** @type {keyof typeof PALETTES} */ (swatch.dataset.palette ?? '');
		const palette = PALETTES[name];
		if (!palette || !configure(hero, 'palette', name)) return;
		configure(hero, 'colors', undefined);
		configure(hero, 'glint', undefined);
		const ink = hero.querySelector('[data-live] [data-effect-ink-field]');
		if (ink) setColors(ink, palette.colors, palette.glint);
		else {
			hide(hero);
			show(hero);
		}
		paletteTag(hero, swatch, name);
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
