/**
 * Each group's heroes, as a component: src/heroes/<type>.astro. Kept apart
 * from the list of groups (src/tour/groups.ts), so a page that needs only
 * the list does not take in every hero's stylesheets.
 */
import type { experimental_AstroContainer as AstroContainer } from 'astro/container';

/** A group's heroes, as a component. */
export type Heroes = Parameters<AstroContainer['renderToString']>[0];

/** The group files' modules, by path. */
const FILES = import.meta.glob<{ default: Heroes }>('../heroes/*.astro', { eager: true });

/**
 * A group's heroes.
 *
 * @param type The group's type, which names its file.
 * @returns Its heroes, as a component.
 * @throws When it has no file.
 */
export function heroesOf(type: string): Heroes {
	const file = FILES[`../heroes/${type}.astro`];
	if (!file) throw new Error(`No heroes for ${type}`);
	return file.default;
}
