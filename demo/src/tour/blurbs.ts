/**
 * A one-line description of each hero, for the "All effects" overview,
 * read from what already describes it: a shader background's module
 * header, a Paper shader's presets, and otherwise the README's line for
 * the component.
 */
import readme from '../../../README.md?raw';
import { PRESETS } from '../../../src/vendor/paper/presets.js';
import { parseLine } from '../customise/markup.js';

/** Each shader background's source, by path. */
const BACKGROUNDS = import.meta.glob<string>('../../../src/runtime/shader-backgrounds/*.js', { query: '?raw', import: 'default', eager: true });

/**
 * Prose as one plain line: no asides in brackets, no backticks, no full stop.
 *
 * @param text The prose.
 * @returns The line.
 */
const plain = (text: string) =>
	text
		.replace(/\s*\([^)]*\)/g, '')
		.replace(/`/g, '')
		.replace(/\.$/, '')
		.trim();

/** The README's line for each component, from its tables (`| \`<Name>\` | What it is | … |`). */
const README = new Map([...readme.matchAll(/^\| `<(\w+)>` \| ([^|]+) \|/gm)].map(([, name, text]) => [name, plain(text)]));

/**
 * The first sentence of a module's header, without the name it opens with
 * (`Silk: flowing folds…` → `Flowing folds…`).
 *
 * @param source The module's source.
 * @returns The sentence.
 */
function header(source: string) {
	const doc = source.match(/\/\*\*([\s\S]*?)\*\//)?.[1] ?? '';
	const prose = doc
		.split('\n')
		.map((line) => line.replace(/^\s*\* ?/, ''))
		.filter((line) => !line.startsWith('@'))
		.join(' ')
		.trim();
	const said = plain((prose.match(/^(.*?\.)(?:\s|$)/)?.[1] ?? prose).replace(/^[^:]+:\s*/, ''));
	return said.charAt(0).toUpperCase() + said.slice(1);
}

/**
 * A hero's description, from the line that makes it.
 *
 * @param code The line (`<ShaderBackground effect="silk" />`).
 * @returns The description; empty when nothing describes it.
 */
export function blurb(code: string): string {
	const { name, props } = parseLine(code);
	if (name === 'ShaderBackground') {
		const source = BACKGROUNDS[`../../../src/runtime/shader-backgrounds/${props.effect}.js`];
		if (source) return header(source);
	}
	if (name === 'PaperShader') {
		const presets = PRESETS[props.shader as keyof typeof PRESETS];
		if (presets) return `Presets: ${presets.map((p) => p.name).join(', ')}`;
	}
	return README.get(name) ?? '';
}
