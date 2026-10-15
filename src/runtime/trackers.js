/**
 * @module @arraypress/effects-astro/trackers
 *
 * A machine-vision overlay: boxes with corner brackets and a small label,
 * laid over an effect like a detector's debug view. The effect decides
 * where each box goes every frame (it knows where its subject is); this
 * only keeps the elements, eases them there and fades them in and out.
 *
 * The boxes are elements inside the effect's element, styled by the
 * `.effect-tracker` rules in EffectCanvas.astro. They are decoration:
 * hidden from assistive technology with the rest of the effect.
 */

/**
 * @typedef {object} TrackerBox
 * @property {number} x Left, CSS px from the element's left.
 * @property {number} y Top, CSS px from the element's top.
 * @property {number} w Width, CSS px.
 * @property {number} h Height, CSS px.
 */

/**
 * Makes a set of tracker boxes in an element.
 *
 * @param {HTMLElement} el The effect's element.
 * @param {number} count How many boxes.
 * @param {object} [options]
 * @param {'box' | 'marker'} [options.kind='box'] Bracketed boxes, or small crosshair markers.
 * @returns {{ place: (i: number, box: TrackerBox | null, label?: string) => void, destroy: () => void }}
 *   `place` moves box `i` towards `box` (null fades it out) and sets its
 *   label; `destroy` removes them.
 */
export function createTrackers(el, count, { kind = 'box' } = {}) {
	const layer = document.createElement('div');
	layer.className = 'effect-trackers';
	el.append(layer);
	const boxes = Array.from({ length: count }, () => {
		const node = document.createElement('div');
		node.className = `effect-tracker is-${kind}`;
		const label = document.createElement('span');
		node.append(label);
		layer.append(node);
		return { node, label, at: /** @type {TrackerBox | null} */ (null), text: '' };
	});

	return {
		place(i, box, text) {
			const b = boxes[i];
			if (!b) return;
			if (!box) {
				b.node.style.opacity = '0';
				b.at = null;
				return;
			}
			// Ease towards the target, as a tracker locks on; jump there when it first appears.
			const at = b.at ?? box;
			b.at = {
				x: at.x + (box.x - at.x) * 0.25,
				y: at.y + (box.y - at.y) * 0.25,
				w: at.w + (box.w - at.w) * 0.25,
				h: at.h + (box.h - at.h) * 0.25,
			};
			b.node.style.opacity = '1';
			b.node.style.transform = `translate(${b.at.x.toFixed(1)}px, ${b.at.y.toFixed(1)}px)`;
			b.node.style.width = `${b.at.w.toFixed(1)}px`;
			b.node.style.height = `${b.at.h.toFixed(1)}px`;
			if (text !== undefined && text !== b.text) {
				b.text = text;
				b.label.textContent = text;
			}
		},
		destroy() {
			layer.remove();
		},
	};
}
