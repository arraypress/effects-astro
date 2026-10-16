/**
 * The gallery's groups, in the order it shows them: each a type the bar
 * filters by (`?type=logos`), its heroes in src/heroes/<type>.astro (read
 * by src/tour/heroes.ts). The one page renders them in this order and the
 * tour collects them in it, so this is the only list of them.
 */

/** A group of heroes. */
export interface Group {
	/** Its name, as the bar shows it. */
	name: string;
	/** Its type, as the address names it, and its heroes' file. */
	type: string;
}

/** The groups, in order. */
export const GROUPS: Group[] = [
	{ name: 'Backgrounds', type: 'backgrounds' },
	{ name: 'Logos', type: 'logos' },
	{ name: 'Wordmarks', type: 'wordmarks' },
	{ name: 'Text', type: 'text' },
	{ name: 'Surfaces', type: 'surfaces' },
];
