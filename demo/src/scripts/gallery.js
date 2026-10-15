/**
 * The gallery's behaviour: brings each hero's effect in as it nears the
 * screen and takes it out once it is well past, swaps a Paper hero's
 * preset, copies a tag's code, and keeps the bar's readout on the hero in
 * view. Effects start and stop themselves as they are added and removed
 * (mount() watches the page).
 */

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

document.addEventListener('click', (e) => {
	const target = /** @type {HTMLElement} */ (e.target);

	// A Paper preset: rewrite the effect's settings, and stamp it again.
	const chip = /** @type {HTMLButtonElement | null} */ (target.closest('[data-preset]'));
	if (chip) {
		const hero = /** @type {HTMLElement} */ (chip.closest('[data-hero]'));
		const template = /** @type {HTMLTemplateElement} */ (hero.querySelector('[data-live-template]'));
		const effect = /** @type {HTMLElement | null} */ (template.content.querySelector('[data-effect-config]'));
		if (!effect) return;
		effect.dataset.effectConfig = JSON.stringify({ ...JSON.parse(effect.dataset.effectConfig ?? '{}'), preset: chip.dataset.preset });
		hero.querySelectorAll('[data-preset]').forEach((c) => c.classList.toggle('is-on', c === chip));
		// The tag shows the line for what is on screen now.
		const tag = /** @type {HTMLElement | null} */ (hero.querySelector('[data-copy]'));
		if (tag) {
			tag.dataset.copy = (tag.dataset.copy ?? '').replace(/preset="[^"]*"/, `preset="${chip.dataset.preset}"`);
			tag.textContent = tag.dataset.copy;
		}
		hide(hero);
		show(hero);
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
