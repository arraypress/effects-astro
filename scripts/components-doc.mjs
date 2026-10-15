/**
 * Writes COMPONENTS.md: every component's props, from the components
 * themselves (their `Props` interfaces) and the runtime `.d.ts` files
 * their settings come from, so the reference cannot drift from the code.
 *
 *   node scripts/components-doc.mjs
 *
 * Reads each prop's doc comment, name, optionality and type; a default is
 * whatever the comment says after "Default".
 */

import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const components = join(root, 'src/components');
const runtime = join(root, 'src/runtime');

/**
 * The members of a TypeScript interface body: doc, name, optional, type.
 *
 * @param {string} body The text between the interface's braces.
 * @returns {{ name: string, optional: boolean, type: string, doc: string }[]} Its members.
 */
function members(body) {
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
function findInterface(text, name) {
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
 * Escapes a cell for a Markdown table.
 *
 * @param {string} s The text.
 * @returns {string} Safe in a table cell.
 */
const cell = (s) => s.replace(/\|/g, '\\|');

let out = `# Components

Every component in \`@arraypress/effects-astro\`, with every prop. Generated from the components' own types by \`node scripts/components-doc.mjs\`; do not edit by hand.

Import each from its own path: \`import Name from '@arraypress/effects-astro/Name.astro'\`.
`;

const files = readdirSync(components).filter((f) => f.endsWith('.astro') && f !== 'EffectCanvas.astro').sort();
for (const file of files) {
	const text = readFileSync(join(components, file), 'utf8');
	const name = file.replace('.astro', '');
	const summary = text.match(/\/\*\*\s*\n\s*\*\s*([\s\S]*?)\n\s*\*\s*\n/)?.[1].replace(/\n\s*\*\s*/g, ' ').trim() ?? '';
	const example = text.match(/@example\n([\s\S]*?)\*\//)?.[1].replace(/^\s*\*\s?/gm, '').trim();
	const props = findInterface(text, 'Props');
	const rows = [];
	if (props?.extends) {
		const source = text.match(new RegExp(`import type \\{ ${props.extends} \\} from '\\.\\./runtime/([\\w-]+)\\.js'`))?.[1];
		if (source) {
			const dts = readFileSync(join(runtime, `${source}.d.ts`), 'utf8');
			rows.push(...members(findInterface(dts, props.extends)?.body ?? ''));
		}
	}
	rows.push(...members(props?.body ?? '').filter((m) => !m.name.startsWith('[')).map((m) => (m.name === 'class' && !m.doc ? { ...m, doc: 'Classes for the element.' } : m)));
	out += `\n## \`<${name}>\`\n\n${summary}\n`;
	if (example) out += `\n\`\`\`astro\n${example}\n\`\`\`\n`;
	if (rows.length) {
		out += `\n| Prop | Type | |\n|---|---|---|\n`;
		for (const r of rows) out += `| \`${r.name}\`${r.optional ? '' : ' (required)'} | \`${cell(r.type)}\` | ${cell(r.doc)} |\n`;
	}
}
writeFileSync(join(root, 'COMPONENTS.md'), out);
console.log(`COMPONENTS.md: ${files.length} components`);
