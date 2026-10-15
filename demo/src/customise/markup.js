/**
 * Reads and writes a component's line as Astro markup: a hero's starting
 * line (`<InkField palette="Barbie" drops />`) into its props, and props
 * back into a line (`speed={1.4}`, `colors={['#…', '#…']}`, `interactive={false}`).
 */

import { literal } from './literal.js';

/**
 * @typedef {{ name: string, props: Record<string, unknown>, order: string[], close: string, after: string }} Line
 */

/**
 * Reads an expression in braces from a line, quotes and nested braces included.
 *
 * @param {string} text The line.
 * @param {number} at Where its opening brace is.
 * @returns {{ inner: string, end: number }} What is inside, and where after the closing brace.
 */
function braced(text, at) {
	let depth = 0;
	let quote = '';
	for (let i = at; i < text.length; i++) {
		const ch = text[i];
		if (quote) {
			if (ch === quote && text[i - 1] !== '\\') quote = '';
		} else if (ch === "'" || ch === '"' || ch === '`') quote = ch;
		else if (ch === '{') depth++;
		else if (ch === '}' && --depth === 0) return { inner: text.slice(at + 1, i), end: i + 1 };
	}
	return { inner: text.slice(at + 1), end: text.length };
}

/**
 * Reads a line: the component, its props in order, how its tag closes and
 * what follows it (children, a closing tag, a note).
 *
 * @param {string} code The line.
 * @returns {Line} What it says.
 */
export function parseLine(code) {
	const name = code.match(/^<([\w.]+)/)?.[1] ?? '';
	/** @type {Record<string, unknown>} */
	const props = {};
	const order = [];
	let i = name.length + 1;
	while (i < code.length) {
		while (/\s/.test(code[i] ?? '')) i++;
		if (code.startsWith('/>', i) || code[i] === '>') {
			const close = code[i] === '>' ? '>' : '/>';
			return { name, props, order, close, after: code.slice(i + close.length) };
		}
		const key = code.slice(i).match(/^[\w:-]+/)?.[0];
		if (!key) break;
		i += key.length;
		let value = /** @type {unknown} */ (true);
		if (code[i] === '=') {
			i++;
			if (code[i] === '"') {
				const end = code.indexOf('"', i + 1);
				value = code.slice(i + 1, end);
				i = end + 1;
			} else if (code[i] === '{') {
				const { inner, end } = braced(code, i);
				value = literal(inner);
				i = end;
			}
		}
		props[key] = value;
		order.push(key);
	}
	return { name, props, order, close: '/>', after: '' };
}

/**
 * A value as JavaScript, the way a person would write it in markup.
 *
 * @param {unknown} value The value.
 * @returns {string} It, as source.
 */
export function source(value) {
	if (typeof value === 'string') return `'${value.replace(/'/g, "\\'")}'`;
	if (Array.isArray(value)) return `[${value.map(source).join(', ')}]`;
	if (value && typeof value === 'object') {
		const entries = Object.entries(value).filter(([, v]) => v !== undefined);
		return entries.length ? `{ ${entries.map(([k, v]) => `${k}: ${source(v)}`).join(', ')} }` : '{}';
	}
	return String(value);
}

/**
 * One prop as an Astro attribute: `name="text"`, `name` for true, else `name={…}`.
 *
 * @param {string} name The prop.
 * @param {unknown} value Its value.
 * @returns {string} The attribute.
 */
export const attribute = (name, value) => (typeof value === 'string' ? `${name}="${value}"` : value === true ? name : `${name}={${source(value)}}`);

/**
 * Writes a line back: the component, the attributes given, and how the
 * starting line closed and went on.
 *
 * @param {Line} line The starting line.
 * @param {string[]} attributes The attributes, written.
 * @returns {string} The line.
 */
export const writeLine = (line, attributes) => `<${line.name}${attributes.map((a) => ` ${a}`).join('')}${line.close === '/>' ? ' />' : '>'}${line.after}`;
