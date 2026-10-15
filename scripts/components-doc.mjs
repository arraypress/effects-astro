/**
 * Writes COMPONENTS.md: every component's props, from the components
 * themselves (their `Props` interfaces) and the runtime `.d.ts` files
 * their settings come from, so the reference cannot drift from the code.
 *
 *   node scripts/components-doc.mjs
 *
 * Reads each prop's doc comment, name, optionality and type (scripts/props.mjs);
 * a default is whatever the comment says after "Default".
 */

import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { readComponents, root } from './props.mjs';

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

const components = readComponents();
for (const { name, summary, example, rows } of components) {
	out += `\n## \`<${name}>\`\n\n${summary}\n`;
	if (example) out += `\n\`\`\`astro\n${example}\n\`\`\`\n`;
	if (rows.length) {
		out += `\n| Prop | Type | |\n|---|---|---|\n`;
		for (const r of rows) out += `| \`${r.name}\`${r.optional ? '' : ' (required)'} | \`${cell(r.type)}\` | ${cell(r.doc)} |\n`;
	}
}
writeFileSync(join(root, 'COMPONENTS.md'), out);
console.log(`COMPONENTS.md: ${components.length} components`);
