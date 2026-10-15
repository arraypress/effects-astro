/**
 * The panel's controls, built as elements: a slider with its readout, a
 * switch, a row of segmented buttons, a colour picker, and a group of
 * sliders for a point. Each calls back with the new value; sliders and
 * pickers also say when they are let go, so the effect can restart then.
 */

/**
 * @typedef {(value: any, done: boolean) => void} Report Called with a new value; `done` once it is let go.
 */

let ids = 0;

/**
 * A fresh id for a control, so its label can point at it.
 *
 * @returns {string} The id.
 */
const nextId = () => `customise-${++ids}`;

/**
 * Makes an element.
 *
 * @param {string} tag The tag.
 * @param {Record<string, string | number | boolean>} [attributes] Its attributes; false leaves one out.
 * @param {(Node | string)[]} [children] What goes inside.
 * @returns {HTMLElement} The element.
 */
export function make(tag, attributes = {}, children = []) {
	const el = document.createElement(tag);
	for (const [key, value] of Object.entries(attributes)) if (value !== false) el.setAttribute(key, value === true ? '' : String(value));
	el.append(...children);
	return el;
}

/**
 * A number as a slider shows it: as many decimals as its step has.
 *
 * @param {number} value The number.
 * @param {number} step The slider's step.
 * @returns {string} The readout.
 */
const readout = (value, step) => value.toFixed(String(step).split('.')[1]?.length ?? 0);

/**
 * A control's name, with its doc as the tooltip.
 *
 * @param {string} name The prop's name.
 * @param {string} doc Its doc.
 * @param {string} [target] The id of the input it labels; without one, a span with an id of its own, for a group to point at.
 * @returns {HTMLElement} The label.
 */
const label = (name, doc, target) => make(target ? 'label' : 'span', { class: 'control__name', title: doc, ...(target ? { for: target } : { id: nextId() }) }, [name]);

/**
 * A slider with a numeric readout.
 *
 * @param {{ name: string, doc: string, min: number, max: number, step: number, value: number }} spec What it sets, its range and where it starts.
 * @param {Report} report Called as it moves, and once more when it is let go.
 * @returns {HTMLElement} The control.
 */
export function slider({ name, doc, min, max, step, value }, report) {
	const id = nextId();
	const input = /** @type {HTMLInputElement} */ (make('input', { type: 'range', id, class: 'slider', min, max, step, value }));
	const out = make('output', { class: 'control__value', for: id }, [readout(value, step)]);
	/** Paints the track up to the thumb. */
	const fill = () => input.style.setProperty('--fill', `${((Number(input.value) - min) / (max - min || 1)) * 100}%`);
	fill();
	input.addEventListener('input', () => {
		out.textContent = readout(Number(input.value), step);
		fill();
		report(Number(input.value), false);
	});
	input.addEventListener('change', () => report(Number(input.value), true));
	return make('div', { class: 'control' }, [make('div', { class: 'control__head' }, [label(name, doc, id), out]), input]);
}

/**
 * An on/off switch.
 *
 * @param {{ name: string, doc: string, value: boolean }} spec What it sets and where it starts.
 * @param {Report} report Called with the new state.
 * @returns {HTMLElement} The control.
 */
export function toggle({ name, doc, value }, report) {
	const id = nextId();
	const button = make('button', { type: 'button', id, class: 'switch', role: 'switch', 'aria-checked': String(value) }, [make('span', { class: 'switch__knob' })]);
	button.addEventListener('click', () => {
		const on = button.getAttribute('aria-checked') !== 'true';
		button.setAttribute('aria-checked', String(on));
		report(on, true);
	});
	return make('div', { class: 'control control--inline' }, [make('div', { class: 'control__head' }, [label(name, doc, id), button])]);
}

/**
 * A row of buttons, one for each option, the chosen one pressed.
 *
 * @param {{ name: string, doc: string, options: string[], value: string }} spec What it sets, its options and where it starts.
 * @param {Report} report Called with the option chosen.
 * @returns {HTMLElement} The control.
 */
export function segments({ name, doc, options, value }, report) {
	const title = label(name, doc);
	const buttons = options.map((option) => make('button', { type: 'button', class: 'segment', 'aria-pressed': String(option === value), 'data-option': option }, [option]));
	const group = make('div', { class: 'segments', role: 'group', 'aria-labelledby': title.id }, buttons);
	group.addEventListener('click', (e) => {
		const chosen = /** @type {HTMLElement} */ (e.target).closest('[data-option]');
		if (!chosen) return;
		buttons.forEach((b) => b.setAttribute('aria-pressed', String(b === chosen)));
		report(/** @type {HTMLElement} */ (chosen).dataset.option, true);
	});
	return make('div', { class: 'control' }, [make('div', { class: 'control__head' }, [title]), group]);
}

/**
 * A colour picker: a round swatch that opens the system's picker, and its hex.
 *
 * @param {{ label: string, value: string }} spec What it is called (for screen readers) and where it starts.
 * @param {Report} report Called as the colour changes, and once more when it is chosen.
 * @returns {HTMLElement} The picker.
 */
export function picker({ label: name, value }, report) {
	const input = /** @type {HTMLInputElement} */ (make('input', { type: 'color', value, 'aria-label': name }));
	const hex = make('span', { class: 'picker__hex' }, [value]);
	input.addEventListener('input', () => {
		hex.textContent = input.value;
		report(input.value, false);
	});
	input.addEventListener('change', () => report(input.value, true));
	return make('label', { class: 'picker', style: `--swatch: ${value}` }, [input, hex]);
}

/**
 * A point or a vector as one slider a field, under the prop's name.
 *
 * @param {{ name: string, doc: string, fields: { name: string, min: number, max: number, step: number }[], value: Record<string, number> }} spec What it sets, its fields and where they start.
 * @param {Report} report Called with the whole point as any field moves.
 * @returns {HTMLElement} The control.
 */
export function point({ name, doc, fields, value }, report) {
	const now = { ...value };
	const sliders = fields.map((field) =>
		slider({ ...field, doc, value: now[field.name] }, (v, done) => {
			now[field.name] = v;
			report({ ...now }, done);
		}),
	);
	return make('div', { class: 'control control--group' }, [make('div', { class: 'control__head' }, [label(name, doc)]), ...sliders]);
}
