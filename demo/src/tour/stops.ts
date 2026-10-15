/**
 * Every hero in the gallery, in order, for the bar's arrows and the "All
 * effects" overview. Each page in PAGES is rendered with Astro's container
 * and its heroes are read from the markup, so the pages stay the only list
 * of them. They render with `locals.collecting` set, which tells the
 * layout not to collect in turn.
 */
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { PAGES } from '../gallery';
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
	/** Where it is: its page and anchor (`/logos#liquid-metal`). */
	href: string;
	/** Its place in the whole gallery, from 1. */
	n: number;
}

/** A page's heroes. */
export interface Group {
	/** The page's name. */
	name: string;
	/** Its heroes, in order. */
	stops: Stop[];
}

/** A page, as the container renders it. */
type Page = Parameters<AstroContainer['renderToString']>[0];

/** The pages' modules, by path. */
const FILES = import.meta.glob<{ default: Page }>('../pages/*.astro');

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
 * The heroes in a rendered page, in order: each one's anchor, name, lead
 * colour and the line in its tag.
 *
 * @param html The page.
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
 * Every page's heroes, in the order the bar lists the pages.
 *
 * @returns The groups.
 * @throws When a page in PAGES has no file.
 */
export async function collect(): Promise<Group[]> {
	const container = await AstroContainer.create();
	const pages = await Promise.all(
		PAGES.map(async (page) => {
			const load = FILES[`../pages/${page.href.slice(1) || 'index'}.astro`];
			if (!load) throw new Error(`No page for ${page.href}`);
			return heroesIn(await container.renderToString((await load()).default, { locals: { collecting: true } }));
		}),
	);
	let n = 0;
	return PAGES.map((page, i) => ({
		name: page.name,
		stops: pages[i].map(({ code, ...hero }) => ({ ...hero, blurb: blurb(code), href: `${page.href}#${hero.id}`, n: ++n })),
	}));
}
