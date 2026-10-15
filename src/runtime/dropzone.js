/**
 * @module @arraypress/effects-astro/dropzone
 *
 * A file drop target: the element's file input takes files dropped on it
 * as well as picked, keeping only those its `accept` allows. While files
 * are dragged over it the element carries `data-state="over"`, and
 * `"rejected"` for a moment when nothing dropped was accepted. Dropped
 * files land in the input and fire its `change`, so a form or a listener
 * sees them exactly as if they had been picked.
 */

/**
 * Whether a file matches an input's `accept` list: extensions (`.pdf`),
 * MIME types (`text/csv`) and wildcards (`image/*`). An empty list takes
 * anything.
 *
 * @param {File} file The file.
 * @param {string} accept The input's `accept` attribute.
 * @returns {boolean} Whether it is accepted.
 */
export function accepts(file, accept) {
	const rules = accept
		.split(',')
		.map((rule) => rule.trim().toLowerCase())
		.filter(Boolean);
	if (!rules.length) return true;
	const name = file.name.toLowerCase();
	const type = file.type.toLowerCase();
	return rules.some((rule) =>
		rule.startsWith('.') ? name.endsWith(rule) : rule.endsWith('/*') ? type.startsWith(rule.slice(0, -1)) : type === rule,
	);
}

/**
 * Makes an element a drop target for the file input inside it.
 *
 * @param {HTMLElement} el The element, holding an `<input type="file">`.
 * @returns {() => void} Stops it.
 */
export function dropzone(el) {
	const input = /** @type {HTMLInputElement | null} */ (el.querySelector('input[type="file"]'));
	if (!input) return () => {};
	let depth = 0;
	/** @type {ReturnType<typeof setTimeout> | undefined} */
	let timer;

	/**
	 * Sets the state the styles follow.
	 *
	 * @param {'idle' | 'over' | 'rejected'} state The state.
	 */
	const show = (state) => {
		clearTimeout(timer);
		el.dataset.state = state;
		if (state === 'rejected') timer = setTimeout(() => show('idle'), 900);
	};

	/**
	 * Lets a drag over the element drop here, not open the file in the tab.
	 *
	 * @param {DragEvent} e The drag event.
	 */
	const over = (e) => {
		if (!e.dataTransfer?.types.includes('Files') || input.disabled) return;
		e.preventDefault();
		e.dataTransfer.dropEffect = 'copy';
	};

	/**
	 * Counts the drag in: enter and leave fire for every child crossed.
	 *
	 * @param {DragEvent} e The drag event.
	 */
	const enter = (e) => {
		if (!e.dataTransfer?.types.includes('Files') || input.disabled) return;
		depth++;
		show('over');
	};

	/** Counts the drag out, back to idle once it has left the element. */
	const leave = () => {
		depth = Math.max(0, depth - 1);
		if (!depth && el.dataset.state === 'over') show('idle');
	};

	/**
	 * Puts the accepted files in the input and fires its `change`.
	 *
	 * @param {DragEvent} e The drop event.
	 */
	const drop = (e) => {
		if (!e.dataTransfer?.files.length || input.disabled) return;
		e.preventDefault();
		depth = 0;
		const files = [...e.dataTransfer.files].filter((file) => accepts(file, input.accept)).slice(0, input.multiple ? undefined : 1);
		if (!files.length) return show('rejected');
		const transfer = new DataTransfer();
		files.forEach((file) => transfer.items.add(file));
		input.files = transfer.files;
		input.dispatchEvent(new Event('change', { bubbles: true }));
		show('idle');
	};

	el.addEventListener('dragover', over);
	el.addEventListener('dragenter', enter);
	el.addEventListener('dragleave', leave);
	el.addEventListener('drop', drop);
	show('idle');
	return () => {
		clearTimeout(timer);
		el.removeEventListener('dragover', over);
		el.removeEventListener('dragenter', enter);
		el.removeEventListener('dragleave', leave);
		el.removeEventListener('drop', drop);
	};
}
