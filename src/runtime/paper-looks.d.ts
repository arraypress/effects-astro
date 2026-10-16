import type { PaperShaderName } from './paper.js';

/** A Paper look's name: its component's, in kebab case. */
export type PaperLookName = 'color-panels';

/** A Paper shader as a background of its own. */
export interface PaperLook {
	/** Its shader. */
	shader: PaperShaderName;
	/** The preset its props start from. */
	preset: string;
	/** Which of Paper's settings each of its own props sets, by prop. */
	props: Record<string, string>;
}

/** The Paper looks, by name. */
export const PAPER_LOOKS: Readonly<Record<PaperLookName, PaperLook>>;
