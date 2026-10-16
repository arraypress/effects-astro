/**
 * Writes demo/src/customise/props.json: every component's props as the
 * demo's customise panel needs them, read from the same types as
 * COMPONENTS.md (scripts/props.mjs), so the panel cannot drift from the code.
 *
 *   node scripts/demo-props.mjs
 *
 * For each prop: its name, its kind (number, boolean, enum, colours, colour,
 * palette, point, vector, string or other), its default, its doc, a range
 * and step for numbers, and how it reaches the page live, if it can:
 * through the element's `data-effect-config` (`"config"`), a CSS custom
 * property, or a class. Ranges are read from the doc ("0–1", "0 to 2",
 * "0 sharp, 1 as round as they go"), else derived from the default.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { allDeclarations, readComponent, readComponents, root } from './props.mjs';
import { literal } from '../demo/src/customise/literal.js';

const out = join(root, 'demo/src/customise/props.json');
const aliases = allDeclarations();

/**
 * @typedef {{ css: string, unit: string } | { class: string } | { classPrefix: string }} Route
 * @typedef {{ name: string, min: number, max: number, step: number }} Field
 * @typedef {{ name: string, kind: string, doc: string, default?: unknown, options?: string[], min?: number, max?: number, step?: number, fields?: Field[], live?: 'config' | Route }} Prop
 */

/**
 * The default a prop's doc gives, after "Default": a leading number,
 * boolean or literal in backticks, else an array or object in backticks
 * further on; nothing for "none" or words.
 *
 * @param {string} doc The doc.
 * @returns {unknown} The default, or undefined.
 */
function docDefault(doc) {
	const after = doc.match(/\bDefault:?\s+([\s\S]*?)(?:\.\s|\.$|$)/)?.[1];
	if (!after || /^none\b/.test(after)) return undefined;
	const lead = after.match(/^(-?\d*\.?\d+|true|false)\b/)?.[1];
	if (lead) return literal(lead);
	const code = after.match(/^`([^`]+)`/)?.[1] ?? after.match(/`([[{][^`]*)`/)?.[1];
	return code === undefined ? undefined : literal(code);
}

/**
 * The defaults a component's code gives in its destructuring of
 * `Astro.props` (`perspective = 900`), for literals only.
 *
 * @param {string} text The component's file.
 * @returns {Record<string, unknown>} The defaults by prop.
 */
function codeDefaults(text) {
	const body = text.match(/const \{([\s\S]*?)\} = Astro\.props/)?.[1] ?? '';
	/** @type {Record<string, unknown>} */
	const found = {};
	for (const [, name, value] of body.matchAll(/(?:^|,)\s*(\w+)\s*=\s*(-?\d*\.?\d+|true|false|'[^']*')\s*(?=,|$)/g)) found[name] = literal(value);
	return found;
}

/**
 * The string literals of a union type, looking through a named alias
 * (`HaloShape`); `(string & {})` is left out.
 *
 * @param {string} type The type.
 * @returns {string[] | null} The options, or null when it is not such a union.
 */
function options(type) {
	const alias = type.match(/^([A-Z]\w+)(?:\s*\|\s*\(string & \{\}\))?$/)?.[1];
	if (alias && alias !== 'PaletteName') {
		const body = aliases.match(new RegExp(`export type ${alias} =([^;]+);`))?.[1];
		return body ? options(body.replace(/\s+/g, ' ').trim().replace(/^\|\s*/, '')) : null;
	}
	const parts = type.split('|').map((p) => p.trim()).filter((p) => p !== '(string & {})');
	return parts.length > 1 && parts.every((p) => /^'[^']*'$/.test(p)) ? parts.map((p) => p.slice(1, -1)) : null;
}

/**
 * Rounds a number to two significant figures, for derived range ends.
 *
 * @param {number} n The number.
 * @returns {number} It, rounded.
 */
const nice = (n) => (n === 0 ? 0 : Number(n.toPrecision(2)));

/**
 * A slider's step for a range: about two hundred steps across it, rounded
 * to 1, 2 or 5 of a power of ten; whole numbers for wide ranges of whole defaults.
 *
 * @param {number} min The low end.
 * @param {number} max The high end.
 * @param {unknown} start The default.
 * @returns {number} The step.
 */
function stepFor(min, max, start) {
	if (Number.isInteger(start) && max - min >= 10) return 1;
	const raw = (max - min) / 200;
	const power = 10 ** Math.floor(Math.log10(raw));
	const step = [1, 2, 5, 10].map((m) => m * power).find((s) => s >= raw) ?? raw;
	return Number(step.toPrecision(1));
}

/**
 * A number's range: written in its doc ("0–1", "0 to 2", or a list such as
 * "0 sharp, 1 as round as they go"), else derived from its default and units.
 *
 * @param {string} doc The doc.
 * @param {unknown} start The default.
 * @returns {{ min: number, max: number, step: number } | null} The range, or null with neither.
 */
function range(doc, start) {
	const text = doc.replace(/\bDefault\b[\s\S]*$/, '');
	const d = typeof start === 'number' ? start : undefined;
	const degrees = /\bdegrees\b/.test(text);
	let min;
	let max;
	const written = text.match(/(-?\d*\.?\d+)\s*(?:–|to)\s*(-?\d*\.?\d+)/);
	const listed = [...text.matchAll(/(?:^|[(:,;]\s*)(-?\d*\.?\d+)\s+(?=[a-z])/g)].map((m) => Number(m[1]));
	if (written) [min, max] = [Number(written[1]), Number(written[2])];
	else if (listed.length > 1) [min, max] = [Math.min(...listed), Math.max(...listed)];
	if (degrees && d !== undefined && d < 0) [min, max] = [-90, 90];
	else if (degrees && ((max ?? 0) >= 180 || (d ?? 0) >= 90)) [min, max] = [min ?? 0, 360];
	if (min === undefined || max === undefined) {
		if (d === undefined) return null;
		const zero = d === 0 || /\b0 (for|holds|is)\b/.test(text);
		if (d < 0) [min, max] = [nice(d * 2), nice(-d * 2)];
		else if (d === 0) [min, max] = [0, /\bpx\b/.test(text) ? 40 : 1];
		else if (/\bshare\b/.test(text) && d <= 1) [min, max] = [zero ? 0 : nice(d / 4), Math.min(1, nice(d * 4))];
		else [min, max] = [zero ? 0 : nice(d / 4), nice(d * 3)];
	}
	if (d !== undefined) [min, max] = [Math.min(min, d), Math.max(max, d)];
	const step = stepFor(min, max, d);
	/**
	 * Puts a range end on the slider's grid of steps, so a slider stops on round values.
	 *
	 * @param {number} n The end.
	 * @param {(n: number) => number} round Math.floor for the low end, Math.ceil for the high.
	 * @returns {number} The end, on the grid.
	 */
	const snap = (n, round) => Number((round(n / step) * step).toFixed(6));
	return { min: snap(min, Math.floor), max: snap(max, Math.ceil), step };
}

/**
 * The number fields of an object type (`{ x?: number; y?: number }`) or a
 * tuple of numbers (`[number, number, number]`, as x, y, z), each with the
 * range its doc gives, or 0–1.
 *
 * @param {string} type The type.
 * @param {string} doc The doc.
 * @param {unknown} start The default.
 * @returns {{ kind: 'point' | 'vector', fields: Field[] } | null} The fields, or null when it is neither.
 */
function fields(type, doc, start) {
	const bare = type.replace(/\s*\|\s*null$/, '');
	const object = bare.match(/^\{([^{}]*)\}$/)?.[1];
	const tuple = bare.match(/^\[(number(?:,\s*number)+)\]$/)?.[1];
	/** @type {string[]} */
	let names;
	if (object) {
		const entries = object.split(';').map((p) => p.trim()).filter(Boolean);
		if (!entries.every((p) => /^\w+\??:\s*number$/.test(p))) return null;
		names = entries.map((p) => p.replace(/\??:.*/, ''));
	} else if (tuple) names = ['x', 'y', 'z', 'w'].slice(0, tuple.split(',').length);
	else return null;
	const values = Array.isArray(start) ? start : [];
	const spread = values.length && values.every((v) => Math.abs(v) <= 1) && values.some((v) => v < 0);
	const shared = /0–1/.test(doc) ? { min: 0, max: 1 } : spread ? { min: -1, max: 1 } : { min: 0, max: 1 };
	return { kind: object ? 'point' : 'vector', fields: names.map((name) => ({ name, ...shared, step: 0.01 })) };
}

/**
 * How a component's props reach its element, read from its code: the props
 * it passes in `data-effect-config` (all it does not take out, when it
 * spreads the rest into `config`), the CSS custom properties it sets from
 * them, and the classes they switch.
 *
 * @param {string} text The component's file.
 * @param {string[]} names Its props.
 * @returns {Record<string, 'config' | Route>} How each that can reaches the page.
 */
function routes(text, names) {
	const markup = text.split(/^---$/m).slice(1).join('---');
	const taken = text.match(/const \{([\s\S]*?)\} = Astro\.props/)?.[1] ?? '';
	const rest = taken.match(/\.\.\.(\w+)\s*,?\s*$/)?.[1];
	/** @type {Record<string, 'config' | Route>} */
	const found = {};
	const spread = rest && new RegExp(`config=\\{${rest}\\}|JSON\\.stringify\\(${rest}\\)`).test(markup);
	if (spread) {
		const out = new Set([...taken.matchAll(/(?:^|,)\s*(\w+)/g)].map((m) => m[1]));
		for (const name of names) if (!out.has(name)) found[name] = 'config';
	}
	for (const [, list] of text.matchAll(/data-effect-config=\{JSON\.stringify\(\{([^}]*)\}\)\}/g)) {
		for (const [, name] of list.matchAll(/(\w+)(?=\s*(?:,|$))/g)) if (names.includes(name)) found[name] = 'config';
	}
	for (const [, css, name, unit] of text.matchAll(/(--[\w-]+):\s*\$\{(\w+)\}([a-z%]*)/g)) if (names.includes(name) && !found[name]) found[name] = { css, unit };
	for (const [, cls, name] of text.matchAll(/'([\w-]+)':\s*(\w+)\s*[,}]/g)) if (names.includes(name) && !found[name]) found[name] = { class: cls };
	for (const [, prefix, name] of text.matchAll(/`([\w-]+)\$\{(\w+)\}`/g)) if (names.includes(name) && !found[name]) found[name] = { classPrefix: prefix };
	return found;
}

/**
 * The selector for a component's element on the page: its
 * `data-effect-<name>` for a canvas effect, that of the component it is
 * built on (`<ColorPanels>` on `<PaperBackground>`), else the first class
 * it gives its element.
 *
 * @param {string} text The component's file.
 * @returns {string | null} The selector, or null when there is none to read.
 */
function selector(text) {
	const canvas = text.match(/<EffectCanvas[^>]*\bname="([\w-]+)"/)?.[1];
	if (canvas) return `[data-effect-${canvas}]`;
	const base = text.match(/^import (\w+) from '\.\/(\w+)\.astro';$/m);
	if (base && new RegExp(`<${base[1]}\\b`).test(text)) return selector(readComponent(`${base[2]}.astro`).text);
	const first = text.split(/^---$/m)[2]?.match(/class:list=\{\['([\w-]+)'/)?.[1];
	return first ? `.${first}` : null;
}

/**
 * A prop's kind, and what its kind needs (options, a range, fields).
 *
 * @param {{ name: string, type: string, doc: string }} member The prop.
 * @param {unknown} start Its default.
 * @returns {Omit<Prop, 'name' | 'doc' | 'default' | 'live'>} Its kind and the rest.
 */
function kind({ name, type, doc }, start) {
	const colourish = /colou?r|\bhex\b/i.test(doc) || (typeof start === 'string' && /^#[\da-f]{3,8}$/i.test(start));
	if (name === 'palette') return { kind: 'palette' };
	const choices = options(type);
	if (choices) return { kind: 'enum', options: choices };
	if (/^string\[\]$/.test(type)) return { kind: colourish || name === 'colors' ? 'colors' : 'list' };
	if (/^string\b/.test(type)) return { kind: colourish ? 'color' : 'string' };
	if (/^boolean\b/.test(type)) return { kind: 'boolean' };
	if (/^number\b/.test(type)) return { kind: 'number', ...range(doc, start) };
	return fields(type, doc, start) ?? { kind: 'other' };
}

/** @type {Record<string, { selector: string | null, props: Prop[] }>} */
const all = {};
for (const component of readComponents()) {
	const names = component.rows.map((r) => r.name);
	const live = routes(component.text, names);
	const coded = codeDefaults(component.text);
	all[component.name] = {
		selector: selector(component.text),
		props: component.rows.map((row) => {
			const start = docDefault(row.doc) ?? coded[row.name];
			return { name: row.name, ...kind(row, start), doc: row.doc, ...(start === undefined ? {} : { default: start }), ...(live[row.name] ? { live: live[row.name] } : {}) };
		}),
	};
}
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, `${JSON.stringify(all, null, '\t')}\n`);
console.log(`demo/src/customise/props.json: ${Object.keys(all).length} components`);
