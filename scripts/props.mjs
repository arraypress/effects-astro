/**
 * Reads the components' props from the components themselves (their
 * `Props` interfaces) and the runtime `.d.ts` files their settings come
 * from. Shared by the scripts that write COMPONENTS.md and the demo's
 * prop metadata, so both read the code the same way.
 */

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

export const root = new URL('..', import.meta.url).pathname;
const components = join(root, 'src/components');
const runtime = join(root, 'src/runtime');

/**
 * @typedef {{ name: string, optional: boolean, type: string, doc: string }} Member
 * @typedef {{ name: string, file: string, text: string, summary: string, example: string | undefined, rows: Member[], source: string | null }} Component
 */

/**
 * The members of a TypeScript interface body: doc, name, optional, type.
 *
 * @param {string} body The text between the interface's braces.
 * @returns {Member[]} Its members.
 */
export function members(body) {
	const out = [];
	let doc = '';
	let chunk = '';
	let depth = 0;
	for (let i = 0; i < body.length; i++) {
		// A doc comment at the top level belongs to the next member.
		if (depth === 0 && body.startsWith('/**', i)) {
			const end = body.indexOf('*/', i);
			doc = body.slice(i + 3, end).replace(/^\s*\*\s?/gm, '').replace(/\s+/g, ' ').trim();
			i = end + 1;
			continue;
		}
		if (depth === 0 && body.startsWith('//', i)) {
			i = body.indexOf('\n', i);
			if (i < 0) break;
			continue;
		}
		const ch = body[i];
		if ('{(<['.includes(ch)) depth++;
		if ('})>]'.includes(ch)) depth--;
		if (ch === ';' && depth === 0) {
			const m = chunk.trim().match(/^([A-Za-z_][\w]*)(\??):\s*([\s\S]+)$/);
			if (m) out.push({ name: m[1], optional: m[2] === '?', type: m[3].replace(/\s+/g, ' ').trim(), doc });
			doc = '';
			chunk = '';
			continue;
		}
		chunk += ch;
	}
	return out;
}

/**
 * Finds an interface in a file and returns its body.
 *
 * @param {string} text The file.
 * @param {string} name The interface.
 * @returns {{ body: string, extends: string | null } | null} Its body and what it extends.
 */
export function findInterface(text, name) {
	const start = text.search(new RegExp(`interface ${name}\\b`));
	if (start < 0) return null;
	const head = text.slice(start, text.indexOf('{', start));
	const ext = head.match(/extends\s+([\w]+)/)?.[1] ?? null;
	let depth = 0;
	let i = text.indexOf('{', start);
	const open = i;
	for (; i < text.length; i++) {
		if (text[i] === '{') depth++;
		else if (text[i] === '}' && --depth === 0) break;
	}
	return { body: text.slice(open + 1, i), extends: ext };
}

/**
 * A runtime `.d.ts` file's text.
 *
 * @param {string} name The module's name, without the extension.
 * @returns {string} Its text.
 */
export const declarations = (name) => readFileSync(join(runtime, `${name}.d.ts`), 'utf8');

/**
 * Every runtime `.d.ts` file's text, together: where type aliases are looked up.
 *
 * @returns {string} All of them.
 */
export const allDeclarations = () =>
	readdirSync(runtime)
		.filter((f) => f.endsWith('.d.ts'))
		.map((f) => readFileSync(join(runtime, f), 'utf8'))
		.join('\n');

/**
 * Reads one component: its summary, its example, and its props, those of
 * the runtime interface it extends first.
 *
 * @param {string} file The component's file name, `Name.astro`.
 * @returns {Component} The component.
 */
export function readComponent(file) {
	const text = readFileSync(join(components, file), 'utf8');
	const name = file.replace('.astro', '');
	const summary = text.match(/\/\*\*\s*\n\s*\*\s*([\s\S]*?)\n\s*\*\s*\n/)?.[1].replace(/\n\s*\*\s*/g, ' ').trim() ?? '';
	const example = text.match(/@example\n([\s\S]*?)\*\//)?.[1].replace(/^\s*\*\s?/gm, '').trim();
	const props = findInterface(text, 'Props');
	const rows = [];
	let source = null;
	if (props?.extends) {
		source = text.match(new RegExp(`import type \\{ ${props.extends} \\} from '\\.\\./runtime/([\\w-]+)\\.js'`))?.[1] ?? null;
		if (source) rows.push(...members(findInterface(declarations(source), props.extends)?.body ?? ''));
	}
	rows.push(...members(props?.body ?? '').filter((m) => !m.name.startsWith('[')).map((m) => (m.name === 'class' && !m.doc ? { ...m, doc: 'Classes for the element.' } : m)));
	return { name, file, text, summary, example, rows, source };
}

/** The components other components render, not used on their own. */
const INTERNAL = new Set(['EffectCanvas.astro', 'PaperBackground.astro']);

/**
 * Every component but the internal ones, in name order.
 *
 * @returns {Component[]} The components.
 */
export const readComponents = () =>
	readdirSync(components)
		.filter((f) => f.endsWith('.astro') && !INTERNAL.has(f))
		.sort()
		.map(readComponent);
