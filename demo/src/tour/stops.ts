/**
 * Every hero in the gallery, in order, for the bar's arrows and the "All
 * effects" overview. Each group's heroes (src/tour/heroes.ts) are rendered
 * with Astro's container and read from the markup, so the group files stay
 * the only list of them.
 */
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { GROUPS } from './groups';
import { heroesOf } from './heroes';
import { blurb } from './blurbs';

/** A hero, as the tour knows it. */
export interface Stop {
	/** Its anchor. */
	id: string;
	/** What it is, as its tag shows it. */
	name: string;
	/** One line on what it does. */
	blurb: string;
	/** Its lead colour, when it has one. */
	accent?: string;
	/** Where it is (`/#liquid-metal`). */
	href: string;
	/** Its place in the whole gallery, from 1. */
	n: number;
}

/** A group's heroes. */
export interface Tour {
	/** The group's name. */
	name: string;
	/** Its type. */
	type: string;
	/** Its heroes, in order. */
	stops: Stop[];
}

/** A hero's opening tag. */
const SECTION = /<section\b[^>]*\bdata-hero\b[^>]*>/g;

/** The entities Astro writes into attributes. */
const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'", '#x27': "'" };

/**
 * An attribute's value in some markup, unescaped: the first one found.
 *
 * @param html The markup.
 * @param name The attribute.
 * @returns Its value; undefined when there is none.
 */
function attr(html: string, name: string) {
	const value = html.match(new RegExp(`\\s${name}="([^"]*)"`))?.[1];
	return value?.replace(/&(amp|lt|gt|quot|#39|#x27);/g, (_, entity: string) => ENTITIES[entity]);
}

/**
 * The heroes in some rendered markup, in order: each one's anchor, name,
 * lead colour and the line in its tag.
 *
 * @param html The markup.
 * @returns The heroes.
 */
function heroesIn(html: string) {
	const tags = [...html.matchAll(SECTION)];
	return tags.map((tag, i) => {
		const inside = html.slice(tag.index + tag[0].length, tags[i + 1]?.index);
		return {
			id: attr(tag[0], 'id') ?? '',
			name: attr(tag[0], 'data-name') ?? '',
			accent: attr(tag[0], 'style')?.match(/--hero-accent:\s*([^;]+)/)?.[1].trim(),
			code: attr(inside, 'data-copy') ?? '',
		};
	});
}

/**
 * Every group's heroes, in the gallery's order.
 *
 * @returns The groups' tours.
 */
export async function collect(): Promise<Tour[]> {
	const container = await AstroContainer.create();
	const groups = await Promise.all(GROUPS.map(async ({ type }) => heroesIn(await container.renderToString(heroesOf(type)))));
	let n = 0;
	return GROUPS.map(({ name, type }, i) => ({
		name,
		type,
		stops: groups[i].map(({ code, ...hero }) => ({ ...hero, blurb: blurb(code), href: `/#${hero.id}`, n: ++n })),
	}));
}
