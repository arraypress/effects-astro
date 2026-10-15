/**
 * What the gallery's pages share: its pages, in order, and the copy and
 * colours the heroes without copy of their own borrow.
 */

/** The pages, in the order the bar lists them. */
export const PAGES = [
	{ name: 'Backgrounds', href: '/' },
	{ name: 'Backdrop', href: '/backdrop' },
	{ name: 'Paper', href: '/paper' },
	{ name: 'Logos', href: '/logos' },
	{ name: 'Wordmarks', href: '/wordmarks' },
	{ name: 'Text', href: '/text' },
	{ name: 'Surfaces', href: '/surfaces' },
];

/** Headlines for the heroes that have no copy of their own. */
export const LINES = [
	['Launch your next idea.', 'A line about what you sell and who it is for, where a real hero would put it.'],
	['Sell what you make.', 'Digital downloads, licence keys and instant delivery, on a page that feels alive.'],
	['Design that moves.', 'One component behind your copy, and the page stops looking like a template.'],
	['Your store, your rules.', 'No marketplace cut, no monthly platform fee, no waiting on anyone.'],
	['Ship it tonight.', 'Start from a theme made for one kind of business, and finish it with your agent.'],
	['Light up your launch.', 'Colour that follows the pointer, and holds still for anyone who asks it to.'],
	['From idea to checkout.', 'Everything a small shop needs, and nothing it does not.'],
	['Beautiful by default.', 'Tuned to look right behind real copy, before you change a setting.'],
];
/**
 * A headline and a line under it, for the nth hero without copy.
 *
 * @param i Which hero.
 * @returns The headline and its line.
 */
export const line = (i: number) => LINES[i % LINES.length];
/** Accents for heroes that take one, chosen to look like real brands, not one shade of violet. */
export const ACCENTS = ['#f97316', '#10b981', '#0ea5e9', '#f43f5e', '#eab308', '#14b8a6', '#84cc16', '#6366f1'];
/**
 * A shader's file name as a title: `halftone-dots` → `Halftone Dots`.
 *
 * @param name The name.
 * @returns The title.
 */
export const title = (name: string) => name.replace(/(^|-)(\w)/g, (_, dash, c) => (dash ? ' ' : '') + c.toUpperCase());

/** Paper shaders that bend a photo, and those that work on a logo's shape. */
export const PICTURES = ['fluted-glass', 'water', 'lens-distortion', 'image-dithering', 'halftone-dots', 'halftone-cmyk', 'paper-texture'];
export const LOGOS = ['liquid-metal', 'heatmap', 'gem-smoke'];
